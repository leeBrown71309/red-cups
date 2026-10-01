import { getBoard, getShortestPath } from "./board";
import { addLog, applyCurrencyChange, updatePlayer } from "./state-utils";
import type { BulletFlight, GameState, NodeId, Player } from "./types";
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

/** Arrows do not bind a projectile; players in Hell are out of its reach. Ties go to the first seat. */
function findNearestTarget(state: GameState, from: NodeId): ChaseTarget | undefined {
  const board = getBoard(state);
  return state.players
    .filter((player) => player.position !== HELL_NODE_ID)
    .map((player) => ({ player, path: getShortestPath(board, from, player.position, true) }))
    .filter((entry): entry is ChaseTarget => entry.path !== null)
    .sort((left, right) => left.path.length - right.path.length)[0];
}

/** Called when a new round begins: wakes a waiting Bullet Bill up, then lets it charge. */
export function advanceBulletBill(state: GameState, round: number): GameState {
  const bullet = state.bulletBill;
  if (!bullet || (bullet.status === "waiting" && bullet.spawnRound > round)) return state;
  if (bullet.status === "active") return chargeNearestPlayer(state);

  const awake = addLog({ ...state, bulletBill: { ...bullet, status: "active" } }, "Bullet Bill s’active !", "event");
  return chargeNearestPlayer(awake);
}

function chargeNearestPlayer(state: GameState): GameState {
  const bullet = state.bulletBill;
  if (!bullet) return state;
  const target = findNearestTarget(state, bullet.position);
  if (!target) return state;

  // One tile per charge: a target next to it is hit, one standing on its own tile is hit without it moving.
  const path = target.path.slice(0, BULLET_BILL_CHARGE_STEPS);
  const position = path[path.length - 1] ?? bullet.position;
  const hit = position === target.player.position;
  const flight: BulletFlight = {
    seq: (state.lastBulletFlight?.seq ?? 0) + 1,
    from: bullet.position,
    path,
    targetId: target.player.id,
    victimId: hit ? target.player.id : null,
  };

  let nextState: GameState = { ...state, bulletBill: { ...bullet, position }, lastBulletFlight: flight };
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
