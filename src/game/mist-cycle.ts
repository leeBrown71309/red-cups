import { ownsCard } from "./cards";
import { isInMistPhase } from "./mist";
import { addOpenLog, findPlayer, updatePlayer } from "./state-utils";
import type { GameState, PlayerId } from "./types";

/**
 * A turn of the player begins, played or skipped: Mi-vu, Mi-vue's cycle moves on, and the table is told when they
 * turn invisible or show again.
 */
export function advanceMist(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!player || !ownsCard(player, "half-seen")) return state;
  const wasHidden = isInMistPhase(player);
  const nextState = updatePlayer(state, playerId, (current) => ({
    ...current,
    mistTurns: (current.mistTurns ?? 0) + 1,
  }));
  const nowHidden = isInMistPhase(findPlayer(nextState, playerId) ?? player);
  if (wasHidden === nowHidden) return nextState;
  return addOpenLog(
    nextState,
    nowHidden ? `${player.name} devient invisible pour deux tours.` : `${player.name} redevient visible.`,
  );
}
