import { getBoard, isIce } from "./board";
import { hasCard, ownsCard } from "./cards";
import { createEngineId } from "./engine-random";
import type { GameState, MoleTunnel, NodeId, Player } from "./types";
import {
  HELL_NODE_ID,
  MOLE_COOLDOWN_ROUNDS,
  MOLE_DIG_ENERGY,
  MOLE_OWN_CROSSING_ENERGY,
  TUNNEL_CROSSINGS,
} from "./types";

/**
 * Taupe (patch 0.2.3): digs a tunnel from the tile they stand on to a tile they already visited, and moves through
 * it at once. The tunnel stays open both ways until somebody crosses it once more (the dig is its first use, the
 * crossing its second). Any player on one of its ends may cross it, for more energy than its digger pays.
 *
 * The rules here only decide where and when; the move itself goes through `applyMove`, so reaching the other end is
 * an arrival like any other (mud, Red Cup, wheel, shop, ice).
 */

/** What a dig or a crossing is: which tunnel, from which of its ends to the other, and whether it is the dig. */
export interface TunnelUse {
  tunnel: MoleTunnel;
  to: NodeId;
  dug: boolean;
}

/** Tiles the player stood on or walked through, in the order they were first reached. */
export function getVisitedNodeIds(player: Pick<Player, "visitedNodeIds">): NodeId[] {
  return player.visitedNodeIds ?? [];
}

/** Whether `nodeId` holds a trap (a Boue or one of le diable's Portails), which no tunnel starts from or leads to. */
function hasTrap(state: Pick<GameState, "mudTraps" | "hellPortals">, nodeId: NodeId): boolean {
  return state.mudTraps.some((trap) => trap.nodeId === nodeId) || state.hellPortals.some((p) => p.nodeId === nodeId);
}

/** Whether a tunnel already opens on this tile. */
export function hasTunnelEnd(state: Pick<GameState, "moleTunnels">, nodeId: NodeId): boolean {
  return state.moleTunnels.some((tunnel) => tunnel.a === nodeId || tunnel.b === nodeId);
}

/** A tile where a tunnel may start or end: not Hell, no ice, no Red Cup, no trap, no tunnel yet. */
function isDiggable(state: GameState, nodeId: NodeId): boolean {
  return (
    nodeId !== HELL_NODE_ID &&
    !isIce(getBoard(state), nodeId) &&
    state.redCupNodeId !== nodeId &&
    !hasTrap(state, nodeId) &&
    !hasTunnelEnd(state, nodeId)
  );
}

/** Whether it is `player`'s move and nothing has started yet: no die thrown, no Botte put on. */
function isFreeToMove(state: GameState, player: Player): boolean {
  return (
    state.phase === "playing" &&
    state.turnStage === "move" &&
    state.players[state.activePlayerIndex]?.id === player.id &&
    state.diceRoll === null &&
    state.moveDistance === 1
  );
}

/** Whether the player may dig right now: their cooldown, their energy, their stage and their tile allow it. */
export function canDig(state: GameState, player: Player): boolean {
  return (
    hasCard(player, "mole") &&
    isFreeToMove(state, player) &&
    state.round >= (player.moleReadyRound ?? 0) &&
    state.energyLeft >= MOLE_DIG_ENERGY &&
    isDiggable(state, player.position)
  );
}

/** The tiles a Taupe standing here may dig a tunnel to: visited, other than the one they stand on, and diggable. */
export function getDigTargets(state: GameState, player: Player): NodeId[] {
  if (!canDig(state, player)) return [];
  return getVisitedNodeIds(player).filter((nodeId) => nodeId !== player.position && isDiggable(state, nodeId));
}

/** What crossing `tunnel` costs `player`: the tunnels they dug themselves are cheaper. */
export function getCrossingEnergy(tunnel: MoleTunnel, player: Pick<Player, "id">): number {
  return tunnel.ownerId === player.id ? MOLE_OWN_CROSSING_ENERGY : MOLE_DIG_ENERGY;
}

/** The tunnels `player` may cross from where they stand, with the tile each one leads to. */
export function getCrossings(state: GameState, player: Player): TunnelUse[] {
  if (!isFreeToMove(state, player) || player.position === HELL_NODE_ID) return [];
  return state.moleTunnels
    .filter(
      (tunnel) =>
        (tunnel.a === player.position || tunnel.b === player.position) &&
        state.energyLeft >= getCrossingEnergy(tunnel, player),
    )
    .map((tunnel) => ({ tunnel, to: tunnel.a === player.position ? tunnel.b : tunnel.a, dug: false }));
}

/** The dig of a tunnel from the active player's tile to `destination`, or null when the rules refuse it. */
export function planDig(state: GameState, player: Player, destination: NodeId): TunnelUse | null {
  if (!getDigTargets(state, player).includes(destination)) return null;
  const tunnel: MoleTunnel = {
    id: createEngineId(),
    a: player.position,
    b: destination,
    ownerId: player.id,
    crossingsLeft: TUNNEL_CROSSINGS,
  };
  return { tunnel, to: destination, dug: true };
}

/** The crossing of `tunnelId` from the active player's tile, or null when the rules refuse it. */
export function planCrossing(state: GameState, player: Player, tunnelId: string): TunnelUse | null {
  return getCrossings(state, player).find((entry) => entry.tunnel.id === tunnelId) ?? null;
}

/** The round from which a Taupe who dug in `round` may dig again. */
export function getMoleReadyRound(round: number): number {
  return round + MOLE_COOLDOWN_ROUNDS;
}

/**
 * Tracks the tiles the Taupe (and the Mime, who may copy them) stood on or walked through. Run after every action,
 * from the positions and the last walk, so no rule has to remember to write them down.
 */
export function recordVisitedTiles(before: GameState, after: GameState): GameState {
  const walk = after.lastMovement && after.lastMovement.seq !== before.lastMovement?.seq ? after.lastMovement : null;
  let changed = false;
  const players = after.players.map((player) => {
    if (!ownsCard(player, "mole") && !ownsCard(player, "mime")) return player;
    const known = getVisitedNodeIds(player);
    const reached = [
      ...(walk && walk.playerId === player.id ? [walk.from, ...walk.path] : []),
      ...(player.position === HELL_NODE_ID ? [] : [player.position]),
    ].filter((nodeId) => nodeId !== HELL_NODE_ID && !known.includes(nodeId));
    const fresh = [...new Set(reached)];
    if (fresh.length === 0) return player;
    changed = true;
    return { ...player, visitedNodeIds: [...known, ...fresh] };
  });
  return changed ? { ...after, players } : after;
}
