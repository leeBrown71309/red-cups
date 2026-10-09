import { ownsCard } from "./cards";
import { getOpenBoard, getShortestPath } from "./board";
import type { GameState, Player, PlayerId } from "./types";
import { MIST_CUP_DISTANCE, MIST_CYCLE_TURNS } from "./types";

/**
 * Mi-vu, Mi-vue (patch 0.2.3): the player is visible one of their own turns out of three, invisible for the two
 * others. Invisibility is a rule of the engine (nobody targets them, they target nobody, Draven spares them, Bullet
 * Bill does not chase them) and a rule of the screens, which hide the table from them and them from the table.
 * It is never stored: it follows from the turn count and from where the Red Cup stands.
 */

type MistState = Pick<GameState, "mapId" | "carouselReversed" | "iceTileNodeId" | "redCupNodeId"> &
  Partial<Pick<GameState, "mirageNodeId">>;

/** Whether the cycle puts the player in an invisible turn: none before their first, then visible, hidden, hidden. */
export function isInMistPhase(player: Pick<Player, "mistTurns">): boolean {
  const turns = player.mistTurns ?? 0;
  return turns > 0 && (turns - 1) % MIST_CYCLE_TURNS !== 0;
}

/**
 * Whether the player stands on a Red Cup's tile or on a tile next to it: they cannot hide there. In the desert either
 * Cup counts, the mirage as much as the real one, or hiding would tell them apart.
 */
export function isNearRedCup(state: MistState, player: Pick<Player, "position">): boolean {
  const cups = [state.redCupNodeId, state.mirageNodeId ?? null].filter((nodeId): nodeId is number => nodeId !== null);
  return cups.some((cupNodeId) => {
    if (player.position === cupNodeId) return true;
    const path = getShortestPath(getOpenBoard(state), cupNodeId, player.position, true);
    return path !== null && path.length <= MIST_CUP_DISTANCE;
  });
}

/** Whether nobody sees the player right now: Mi-vu, Mi-vue in a hidden turn, and far enough from the Red Cup. */
export function isInvisible(state: MistState, player: Player | null | undefined): boolean {
  return (
    player !== null &&
    player !== undefined &&
    ownsCard(player, "half-seen") &&
    isInMistPhase(player) &&
    !isNearRedCup(state, player)
  );
}

/** The players nobody sees right now. */
export function getInvisiblePlayerIds(state: GameState): PlayerId[] {
  return state.players.filter((player) => isInvisible(state, player)).map((player) => player.id);
}
