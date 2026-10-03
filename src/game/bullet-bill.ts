import { getBoard, getShortestPath } from "./board";
import { isImmuneToItems } from "./passive-rules";
import { canUseNoThanks } from "./rules";
import { addLog, applyCurrencyChange, updatePlayer } from "./state-utils";
import type { BulletFlight, GameState, NodeId, Player, PlayerId } from "./types";
import { BULLET_BILL_CHARGE_STEPS, BULLET_BILL_DAMAGE, HELL_NODE_ID, START_NODE_ID } from "./types";

/**
 * Bullet Bill belongs to nobody. It lands on the start as soon as it is
 * bought, so the whole table sees it coming, then charges the nearest player
 * at the start of every round, from the next one on.
 */

export function launchBulletBill(state: GameState): GameState {
  return {
    ...state,
    bulletBill: { status: "waiting", position: START_NODE_ID, spawnRound: state.round + 1 },
  };
}

interface ChaseTarget {
  player: Player;
  path: NodeId[];
}

/**
 * Arrows do not bind a projectile; players in Hell are out of its reach, and
 * Chance aveugle is never chased. Ties go to the first seat.
 */
function findNearestTarget(state: GameState, from: NodeId): ChaseTarget | undefined {
  const board = getBoard(state);
  return state.players
    .filter((player) => player.position !== HELL_NODE_ID && !isImmuneToItems(player))
    .map((player) => ({ player, path: getShortestPath(board, from, player.position, true) }))
    .filter((entry): entry is ChaseTarget => entry.path !== null)
    .sort((left, right) => left.path.length - right.path.length)[0];
}

function isDue(state: GameState, round: number): boolean {
  const bullet = state.bulletBill;
  return bullet !== null && (bullet.status === "active" || bullet.spawnRound <= round);
}

interface Charge {
  target: ChaseTarget;
  /** One tile per charge: a target next to it is hit, one standing on its own tile is hit without it moving. */
  path: NodeId[];
  hit: boolean;
}

function planCharge(state: GameState, from: NodeId): Charge | null {
  const target = findNearestTarget(state, from);
  if (!target) return null;
  const path = target.path.slice(0, BULLET_BILL_CHARGE_STEPS);
  const landing = path[path.length - 1] ?? from;
  return { target, path, hit: landing === target.player.position };
}

/**
 * Non merci: the player Bullet Bill is about to hit as `round` starts, when
 * they may still cancel it. Nothing moves yet.
 */
/**
 * Who may stop the charge about to hit its victim as `round` begins: the
 * victim with Non merci, and L'Ange-Gardien with a Bouclier when the victim
 * is their protégé (author's answer). Empty when it just hits.
 */
export function findBulletReactors(
  state: GameState,
  round: number,
): { victimId: PlayerId; reactorIds: PlayerId[] } | null {
  const bullet = state.bulletBill;
  if (!bullet || !isDue(state, round)) return null;
  const charge = planCharge(state, bullet.position);
  if (!charge?.hit) return null;
  const victim = charge.target.player;
  const reactorIds = canUseNoThanks(victim, round) ? [victim.id] : [];
  const angel = state.players.find((player) => player.id === state.guardian?.angelId);
  const shielded =
    angel !== undefined &&
    state.guardian?.protegeId === victim.id &&
    angel.inventory.some((entry) => entry.kind === "item" && entry.itemId === "shield");
  if (shielded) reactorIds.push(angel.id);
  return reactorIds.length > 0 ? { victimId: victim.id, reactorIds } : null;
}

/**
 * Called when a new round begins: wakes a waiting Bullet Bill up, then lets it
 * charge. `dodged`: its victim cancelled the hit with Non merci.
 */
export function advanceBulletBill(state: GameState, round: number, dodged = false): GameState {
  const bullet = state.bulletBill;
  if (!bullet || !isDue(state, round)) return state;
  if (bullet.status === "active") return chargeNearestPlayer(state, dodged);

  const awake = addLog({ ...state, bulletBill: { ...bullet, status: "active" } }, "Bullet Bill s’active !", "event");
  return chargeNearestPlayer(awake, dodged);
}

function chargeNearestPlayer(state: GameState, dodged: boolean): GameState {
  const bullet = state.bulletBill;
  if (!bullet) return state;
  const charge = planCharge(state, bullet.position);
  if (!charge) return state;
  const { target, path, hit } = charge;
  const position = path[path.length - 1] ?? bullet.position;
  const flight: BulletFlight = {
    seq: (state.lastBulletFlight?.seq ?? 0) + 1,
    from: bullet.position,
    path,
    targetId: target.player.id,
    victimId: hit && !dodged ? target.player.id : null,
    ...(hit && dodged ? { dodgedBy: target.player.id } : {}),
  };

  let nextState: GameState = { ...state, bulletBill: { ...bullet, position }, lastBulletFlight: flight };
  if (hit && dodged) {
    nextState = { ...nextState, bulletBill: null };
    return addLog(nextState, `Bullet Bill s’écrase sans toucher ${target.player.name}.`, "good");
  }
  if (!hit) return addLog(nextState, `Bullet Bill fonce vers ${target.player.name}.`, "event");

  nextState = applyCurrencyChange(nextState, target.player.id, -BULLET_BILL_DAMAGE);
  nextState = updatePlayer(nextState, target.player.id, (player) => ({
    ...player,
    skippedTurns: player.skippedTurns + 1,
  }));
  nextState = addLog(
    nextState,
    `Bullet Bill percute ${target.player.name} : −${BULLET_BILL_DAMAGE} pièces et un tour sauté.`,
    "bad",
  );
  return { ...nextState, bulletBill: null };
}
