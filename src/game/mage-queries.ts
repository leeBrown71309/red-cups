import { getNodeKindOf } from "./board";
import { ownsCard } from "./cards";
import { getBoardMap } from "./maps/map-registry";
import { isRestingTile } from "./quay";
import { getLuck } from "./mage-luck";
import { getActivePlayer } from "./state-utils";
import type { BlackMark, GameState, Player, PlayerId, WheelOutcomeId } from "./types";
import { HELL_NODE_ID } from "./types";

/**
 * What Mage noir's rules ask of the table, without changing it (patch 0.2.3). Kept apart from the teleport itself
 * so the rules that only need to know whether a mage may answer (Bullet Bill, the reaction window) do not depend on
 * the rules that move players around.
 */

/** Why the mage leaves their tile: what the event tells the scene and the journal. */
export type TeleportReason = "turn" | "reaction" | "wheel";

/** The wheel results that move their player: the mage may teleport to their mark instead of suffering them. */
export const DISPLACING_WHEEL_RESULTS: WheelOutcomeId[] = ["go-to-hell", "go-back", "advance-one", "go-to-start"];

/** Stages where the mage may lay their mark: their own turn, before or after the move. */
const MARK_STAGES = ["move", "shop", "turn-end"];

export function findMark(state: Pick<GameState, "blackMarks">, ownerId: PlayerId): BlackMark | undefined {
  return state.blackMarks.find((mark) => mark.ownerId === ownerId);
}

/** Whether the mage may lay their mark now: their turn, a tile of the board, no mud on it, none laid yet. */
export function canPlaceMark(state: GameState, player: Player): boolean {
  return (
    state.phase === "playing" &&
    getActivePlayer(state)?.id === player.id &&
    ownsCard(player, "black-mage") &&
    MARK_STAGES.includes(state.turnStage) &&
    player.position !== HELL_NODE_ID &&
    findMark(state, player.id) === undefined &&
    !state.mudTraps.some((trap) => trap.nodeId === player.position) &&
    // Archipel: a pentagram is not laid on a causeway the tide will drown, nor on a whirlpool.
    getNodeKindOf(getBoardMap(state.mapId), player.position) !== "causeway" &&
    isRestingTile(state, player.position)
  );
}

/** Whether the mage holds a mark and a chance to spend on it: the rest depends on where they stand in the turn. */
export function canTeleport(state: GameState, player: Player | undefined): player is Player {
  return (
    player !== undefined &&
    ownsCard(player, "black-mage") &&
    findMark(state, player.id) !== undefined &&
    getLuck(player) > 0
  );
}

/** Whether the mage may teleport during their own turn: before their move, and to another tile than theirs. */
export function canTeleportInTurn(state: GameState, player: Player | undefined): boolean {
  return (
    canTeleport(state, player) &&
    state.phase === "playing" &&
    getActivePlayer(state)?.id === player.id &&
    (state.turnStage === "move" || state.turnStage === "hell") &&
    findMark(state, player.id)?.nodeId !== player.position
  );
}

/** Whether the wheel pending for the mage would move them, so that they may teleport to their mark instead. */
export function canTeleportFromWheel(state: GameState, player: Player | undefined): boolean {
  const pending = state.pendingWheel;
  return (
    canTeleport(state, player) &&
    pending !== null &&
    pending.playerId === player.id &&
    DISPLACING_WHEEL_RESULTS.includes(pending.result.id)
  );
}
