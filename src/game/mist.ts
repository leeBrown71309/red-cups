import { ownsCard } from "./cards";
import { getOpenBoard, getShortestPath } from "./board";
import type { GameState, Player, PlayerId } from "./types";
import { MIST_CUP_DISTANCE } from "./types";

/**
 * Invisibility (Mi-vu, Mi-vue's « Disparaître » since patch 0.2.5, and the Bombe de fumée) is a rule of the engine
 * (nobody targets the player, they target nobody, Draven spares them, Bullet Bill does not chase them) and a rule of
 * the screens, which hide the table from them and them from the table. The state is a countdown of own turns (`Player.hiddenTurns`);
 * whether the player is seen right now also depends on where the Red Cup stands, so it is never stored.
 */

type MistState = Pick<GameState, "mapId" | "carouselReversed" | "iceTileNodeId" | "redCupNodeId"> &
  Partial<Pick<GameState, "mirageNodeId">>;

/** Whether the player is under an invisibility, whether or not the Red Cup gives them away. */
export function isHidden(player: Pick<Player, "hiddenTurns">): boolean {
  return (player.hiddenTurns ?? 0) > 0;
}

/**
 * Whether the player stands on a Red Cup's tile or on a tile next to it: Mi-vu, Mi-vue cannot hide there. In the
 * desert either Cup counts, the mirage as much as the real one, or hiding would tell them apart.
 */
export function isNearRedCup(state: MistState, player: Pick<Player, "position">): boolean {
  const cups = [state.redCupNodeId, state.mirageNodeId ?? null].filter((nodeId): nodeId is number => nodeId !== null);
  return cups.some((cupNodeId) => {
    if (player.position === cupNodeId) return true;
    const path = getShortestPath(getOpenBoard(state), cupNodeId, player.position, true);
    return path !== null && path.length <= MIST_CUP_DISTANCE;
  });
}

/**
 * Whether nobody sees the player right now: they are under an invisibility and, for Mi-vu, Mi-vue, far enough from
 * the Red Cup (the Bombe de fumée has no such limit).
 */
export function isInvisible(state: MistState, player: Player | null | undefined): boolean {
  return (
    player !== null &&
    player !== undefined &&
    isHidden(player) &&
    (player.hiddenSighted === true || !(ownsCard(player, "half-seen") && isNearRedCup(state, player)))
  );
}

/**
 * Whether the player is in the dark right now: nobody sees them and they see nobody. Only Mi-vu, Mi-vue's
 * invisibility blinds; the Bombe de fumée hides its user from the table and leaves them the whole view (patch 0.3.0).
 */
export function isBlinded(state: MistState, player: Player | null | undefined): boolean {
  return isInvisible(state, player) && player?.hiddenSighted !== true;
}

/** The players nobody sees right now. */
export function getInvisiblePlayerIds(state: GameState): PlayerId[] {
  return state.players.filter((player) => isInvisible(state, player)).map((player) => player.id);
}

/** The players in the dark right now: invisible, and unable to see the table. */
export function getBlindedPlayerIds(state: GameState): PlayerId[] {
  return state.players.filter((player) => isBlinded(state, player)).map((player) => player.id);
}
