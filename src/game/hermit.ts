import { hasCard } from "./cards";
import { addLog, findPlayer, updatePlayer } from "./state-utils";
import type { GameState, Player } from "./types";
import { HELL_NODE_ID } from "./types";

/**
 * L'Ermite (patch 0.2.3): somebody who arrives on the hermit's tile takes their prime away up to the end of the
 * hermit's next turn. Read from the positions before and after an action, like the other trips the engine counts.
 */
export function markHermitIntrusions(before: GameState, after: GameState): GameState {
  let nextState = after;
  for (const hermit of after.players.filter((player) => hasCard(player, "hermit"))) {
    const previous = findPlayer(before, hermit.id);
    // The hermit who walks onto somebody is not disturbed: they arrived, nobody arrived on them.
    if (!previous || previous.position !== hermit.position || hermit.position === HELL_NODE_ID) continue;
    const intruder = after.players.find((other) => {
      const was = findPlayer(before, other.id);
      return (
        other.id !== hermit.id &&
        was !== undefined &&
        was.position !== other.position &&
        other.position === hermit.position
      );
    });
    if (!intruder) continue;
    const lostUntil = getNextTurnRound(nextState, hermit);
    nextState = updatePlayer(nextState, hermit.id, (current) => ({ ...current, hermitLostUntilRound: lostUntil }));
    nextState = addLog(
      nextState,
      `${intruder.name} arrive sur la case de ${hermit.name} : l’Ermite perd sa prime jusqu’à la fin de son prochain tour.`,
      "bad",
    );
  }
  return nextState;
}

/** The round of the hermit's next turn: this one when they are still to play in it, the next one otherwise. */
function getNextTurnRound(state: GameState, hermit: Player): number {
  const seat = state.players.findIndex((player) => player.id === hermit.id);
  return seat > state.activePlayerIndex ? state.round : state.round + 1;
}
