import { addLog } from "./state-utils";
import type { GameState, PlayerId, WinReason } from "./types";
import { GREEDY_GOAL } from "./types";

/** Ends the game for `winnerId`: whatever was still waiting for a decision is dropped. */
export function endGame(state: GameState, winnerId: PlayerId, winReason: WinReason): GameState {
  return {
    ...state,
    phase: "finished",
    turnStage: "finished",
    winnerId,
    winReason,
    pendingWheel: null,
    pendingDuel: null,
    pendingDiscard: null,
    pendingChallenge: null,
    pendingCalmDown: null,
    pendingAdvance: null,
    pendingReaction: null,
    pendingTileWheels: [],
    pendingGambles: [],
    pendingCupRepositionPlayerId: null,
    pendingCupRevealNodeId: null,
    pendingCupRepositionResumeStage: null,
  };
}

/**
 * Cupide wins the moment their balance reaches its goal, whoever's turn it is
 * and whatever earned the coins. Checked after every action.
 */
export function checkGreedyVictory(state: GameState): GameState {
  if (state.phase !== "playing") return state;
  const winner = state.players.find((player) => player.passiveId === "greedy" && player.currency >= GREEDY_GOAL);
  if (!winner) return state;
  const ended = endGame(state, winner.id, "greedy");
  return addLog(ended, `${winner.name} atteint ${GREEDY_GOAL} pièces et remporte la partie !`, "good");
}
