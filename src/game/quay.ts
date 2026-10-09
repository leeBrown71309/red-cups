import { getNodeKindOf } from "./board";
import { getBoardMap } from "./maps/map-registry";
import { getFloodedNodeIds } from "./tide";
import type { BoardMap } from "./maps/map-types";
import type { GameState, NodeId, PlayerId } from "./types";

/**
 * Archipel des Marées and Désert des Mirages: a quay, an oasis, holds a single player. Nobody may end a walk on one
 * somebody else stands on (the road is shown as taken); whatever else brings a second player there, the safety nets
 * of `settleArchipel` and `settleDesert` push them back.
 */
export function isTakenSeat(state: Pick<GameState, "mapId" | "players">, nodeId: NodeId, walkerId: PlayerId): boolean {
  const kind = getNodeKindOf(getBoardMap(state.mapId), nodeId);
  return (
    (kind === "quay" || kind === "oasis") &&
    state.players.some((player) => player.id !== walkerId && player.position === nodeId)
  );
}

/**
 * Archipel: a tile somebody can be left on by a tunnel or a pentagram: never a whirlpool, which draws whoever
 * arrives away, nor a causeway the tide has drowned. Every other tile of every map is one.
 */
export function isRestingTile(state: Pick<GameState, "mapId" | "round">, nodeId: NodeId): boolean {
  const map = getBoardMap(state.mapId);
  if (getNodeKindOf(map, nodeId) === "whirlpool") return false;
  return !getFloodedNodeIds(map, state.round).includes(nodeId);
}

/**
 * Tiles of the map the Red Cup may appear on: ordinary tiles, never a quay, a causeway or a whirlpool (Archipel), nor
 * an oasis, a well or a pass (Désert).
 */
export function canHoldRedCup(map: BoardMap, nodeId: NodeId): boolean {
  const kind = getNodeKindOf(map, nodeId);
  return (
    kind !== "quay" &&
    kind !== "causeway" &&
    kind !== "whirlpool" &&
    kind !== "oasis" &&
    kind !== "well" &&
    kind !== "pass"
  );
}
