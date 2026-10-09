import { getBoard, getBoardNode, getNeighbors, type Board } from "./board";
import { ownsCard } from "./cards";
import { spendEnergy } from "./energy";
import { settleBoard } from "./game-effects";
import { withPowerEvent } from "./power-event";
import { addLog, findPlayer, getActivePlayer, updatePlayer } from "./state-utils";
import type { GameState, NodeId, Player } from "./types";
import {
  HELL_NODE_ID,
  MOVE_MINIMUM_ENERGY,
  SISTER_SWAP_COOLDOWN_ROUNDS,
  SISTER_SWAP_ENERGY,
  START_NODE_ID,
} from "./types";

/**
 * Sœur Fantôme (patch 0.2.3): a little ghost floats with the player. She starts on the start with them, and for every
 * step they walk she takes the opposite one (left for right, up for down, a diagonal for its opposite), when a road
 * leads that way from where she stands; otherwise she stays. She is never targeted and never triggers a tile or a
 * trap. Whatever sets the player down elsewhere (a teleport, a swap, a pull) leaves her where she is, and a trip
 * to Hell sends her back to the start.
 */

/** How far (radians) a road may stray from the exact opposite of the player's step to still count as it: 40°. */
const MIRROR_TOLERANCE = (40 * Math.PI) / 180;

/** The tile the little ghost floats on; the start until she first moves. */
export function getSisterNode(player: Pick<Player, "sisterNodeId">): NodeId {
  return player.sisterNodeId ?? START_NODE_ID;
}

export function hasSister(player: Pick<Player, "passiveId" | "passifId"> | undefined): player is Player {
  return player !== undefined && ownsCard(player, "ghost-sister");
}

function angleBetween(board: Board, from: NodeId, to: NodeId): number | null {
  const start = getBoardNode(board, from);
  const end = getBoardNode(board, to);
  return start && end ? Math.atan2(end.z - start.z, end.x - start.x) : null;
}

/** The smallest angle between two directions, in radians. */
function angularDistance(left: number, right: number): number {
  const turn = Math.abs(left - right) % (2 * Math.PI);
  return turn > Math.PI ? 2 * Math.PI - turn : turn;
}

/**
 * The tile the sister reaches from `sisterAt` when the player stepped `from` → `to`: the road that goes the
 * opposite way (within the tolerance, the closest one when several do), along the board's real roads, arrows and
 * Barrières obeyed. Null when no road does: she stays.
 */
export function mirrorStep(board: Board, sisterAt: NodeId, from: NodeId, to: NodeId): NodeId | null {
  const walked = angleBetween(board, from, to);
  if (walked === null) return null;
  const wanted = walked + Math.PI;
  let best: { nodeId: NodeId; gap: number } | null = null;
  for (const neighbor of getNeighbors(board, sisterAt)) {
    const heading = angleBetween(board, sisterAt, neighbor);
    if (heading === null) continue;
    const gap = angularDistance(heading, wanted);
    if (gap <= MIRROR_TOLERANCE && (best === null || gap < best.gap)) best = { nodeId: neighbor, gap };
  }
  return best?.nodeId ?? null;
}

/** The tile of the sister after each step of a walk: one entry for every step, repeating the tile where she stayed. */
export function mirrorWalk(board: Board, sisterAt: NodeId, from: NodeId, path: NodeId[]): NodeId[] {
  const tiles: NodeId[] = [];
  let current = sisterAt;
  let previous = from;
  for (const step of path) {
    current = mirrorStep(board, current, previous, step) ?? current;
    tiles.push(current);
    previous = step;
  }
  return tiles;
}

/**
 * After every action: the walk it made, if its walker has a sister, is mirrored by her. The record of the walk
 * carries her steps, so the scene plays them alongside the player's own.
 */
export function moveSisters(before: GameState, after: GameState): GameState {
  const walk = after.lastMovement;
  // A dive into a tunnel is no step: the player is set down elsewhere, and the sister stays where she is.
  if (
    !walk ||
    walk.seq === before.lastMovement?.seq ||
    walk.flungByGhost ||
    walk.tunnel ||
    walk.thawed ||
    walk.path.length === 0
  ) {
    return after;
  }
  const walker = findPlayer(after, walk.playerId);
  if (!hasSister(walker)) return after;
  const from = getSisterNode(walker);
  // On the board the walk was played on: a Red Cup picked up on arrival may flip the carousel right after.
  const tiles = mirrorWalk(getBoard(before), from, walk.from, walk.path);
  const to = tiles[tiles.length - 1] ?? from;
  const moved = updatePlayer(after, walker.id, (player) => ({ ...player, sisterNodeId: to }));
  return { ...moved, lastMovement: { ...walk, sister: { playerId: walker.id, from, path: tiles } } };
}

/** After every action: a player who fell into Hell has their sister go back to the start. */
export function sendSistersHome(before: GameState, after: GameState): GameState {
  let nextState = after;
  for (const player of after.players) {
    const previous = findPlayer(before, player.id);
    if (!hasSister(player) || !previous) continue;
    if (player.position !== HELL_NODE_ID || previous.position === HELL_NODE_ID) continue;
    if (getSisterNode(player) === START_NODE_ID) continue;
    nextState = updatePlayer(nextState, player.id, (current) => ({ ...current, sisterNodeId: START_NODE_ID }));
    nextState = addLog(nextState, `La sœur de ${player.name} retourne au Départ.`, "event");
  }
  return nextState;
}

/** Swap costs energy, and keeps the point the move needs when the Botte is on. */
function canAffordSwap(state: GameState): boolean {
  const kept = state.moveDistance > 1 ? MOVE_MINIMUM_ENERGY : 0;
  return state.energyLeft - SISTER_SWAP_ENERGY >= kept;
}

/**
 * Whether the active player may swap with their sister now: before their move, out of Hell, on another tile, and
 * once every `SISTER_SWAP_COOLDOWN_ROUNDS` rounds.
 */
export function canSwap(state: GameState, player: Player | undefined): player is Player {
  return (
    hasSister(player) &&
    state.phase === "playing" &&
    state.turnStage === "move" &&
    getActivePlayer(state)?.id === player.id &&
    state.diceRoll === null &&
    player.position !== HELL_NODE_ID &&
    getSisterNode(player) !== player.position &&
    state.round >= (player.swapReadyRound ?? 0) &&
    canAffordSwap(state)
  );
}

/**
 * Swap: the player and the sister change places, and the sister takes with her everything that lay on her tile: a
 * trap (a Boue, a Portail), the Red Cup, Bullet Bill, except the players. What she carries lands on the tile the
 * player leaves, without anything being triggered, picked up or struck there, and the player's arrival on her
 * tile triggers nothing either: the traps and the Red Cup are gone from it.
 */
export function swapWithSister(state: GameState): GameState {
  const player = getActivePlayer(state);
  if (!canSwap(state, player)) return state;
  const playerFrom = player.position;
  const sisterFrom = getSisterNode(player);

  const carriesMud = state.mudTraps.filter((trap) => trap.nodeId === sisterFrom).length;
  const carriesPortals = state.hellPortals.filter((portal) => portal.nodeId === sisterFrom).length;
  const carriesCup = state.redCupNodeId === sisterFrom;
  const carriesBill = state.bulletBill?.position === sisterFrom;

  let nextState: GameState = spendEnergy(state, SISTER_SWAP_ENERGY);
  nextState = {
    ...nextState,
    mudTraps: nextState.mudTraps.map((trap) => (trap.nodeId === sisterFrom ? { ...trap, nodeId: playerFrom } : trap)),
    hellPortals: nextState.hellPortals.map((portal) =>
      portal.nodeId === sisterFrom ? { ...portal, nodeId: playerFrom } : portal,
    ),
    redCupNodeId: carriesCup ? playerFrom : nextState.redCupNodeId,
    bulletBill:
      carriesBill && nextState.bulletBill ? { ...nextState.bulletBill, position: playerFrom } : nextState.bulletBill,
  };
  nextState = updatePlayer(nextState, player.id, (current) => ({
    ...current,
    position: sisterFrom,
    sisterNodeId: playerFrom,
    swapReadyRound: state.round + SISTER_SWAP_COOLDOWN_ROUNDS,
  }));
  nextState = withPowerEvent(nextState, {
    kind: "sister-swap",
    playerId: player.id,
    playerFrom,
    sisterFrom,
    carried: { mud: carriesMud, portals: carriesPortals, redCup: carriesCup, bulletBill: carriesBill },
  });
  const brought = [
    carriesCup ? "la Red Cup" : null,
    carriesMud > 0 ? "de la Boue" : null,
    carriesPortals > 0 ? "un Portail" : null,
    carriesBill ? "Bullet Bill" : null,
  ].filter((item): item is string => item !== null);
  const baggage = brought.length > 0 ? ` Elle emporte ${brought.join(", ")}.` : "";
  nextState = addLog(
    nextState,
    `${player.name} échange sa place avec sa sœur fantôme (case ${playerFrom} ↔ case ${sisterFrom}).${baggage}`,
    "event",
  );
  return settleBoard(nextState, nextState.turnStage);
}
