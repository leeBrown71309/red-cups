import { ownsCard } from "./cards";
import { findDevil, getDevilGoalFor } from "./devil";
import { addLog, settleKnockout } from "./state-utils";
import type { GameState, PlayerId, WinReason } from "./types";
import { GREEDY_GOAL } from "./types";

/**
 * Ends the game for `winnerId`, with L'Ange-Gardien when they protected the
 * winner: whatever was still waiting for a decision is dropped.
 */
export function endGame(stateBeforeEnd: GameState, winnerId: PlayerId, winReason: WinReason): GameState {
  // A loss that waited for its gamble knocks its holder out all the same: the stake does not outlive the game.
  const state = stateBeforeEnd.pendingGambles
    .filter((gamble) => gamble.knockout)
    .reduce((current, gamble) => settleKnockout(current, gamble.playerId), stateBeforeEnd);
  const guardian = state.guardian;
  return {
    ...state,
    phase: "finished",
    turnStage: "finished",
    winnerId,
    winReason,
    coWinnerId: guardian && guardian.protegeId === winnerId ? guardian.angelId : null,
    pendingWheel: null,
    pendingDuel: null,
    pendingDuelChoice: null,
    pendingDiscard: null,
    pendingChallenge: null,
    pendingCalmDown: null,
    pendingAdvance: null,
    pendingReaction: null,
    pendingTileWheels: [],
    pendingGambles: [],
    // A finished game is not held by anybody: the pause ends with it.
    pause: null,
    queuedWheels: [],
    pendingCupRepositionPlayerId: null,
    pendingCupRevealNodeId: null,
    pendingMirageRevealNodeId: null,
    pendingCupRepositionResumeStage: null,
  };
}

/**
 * Cupide wins the moment their balance reaches its goal, and le diable the
 * moment the others entered Hell often enough, whoever's turn it is.
 * Checked after every action.
 */
export function checkVictories(state: GameState): GameState {
  if (state.phase !== "playing") return state;
  const greedy = state.players.find((player) => ownsCard(player, "greedy") && player.currency >= GREEDY_GOAL);
  if (greedy) {
    const ended = endGame(state, greedy.id, "greedy");
    return addLog(ended, `${greedy.name} atteint ${GREEDY_GOAL} pièces et remporte la partie !`, "good");
  }
  const devil = findDevil(state);
  if (devil && state.devilHellTurns >= getDevilGoalFor(state)) {
    const ended = endGame(state, devil.id, "devil");
    return addLog(
      ended,
      `${state.devilHellTurns} tours passés en Enfer : ${devil.name}, le diable, l’emporte !`,
      "bad",
    );
  }
  return state;
}
