import { drawEngineRandom } from "./engine-random";
import { addLog, applyCurrencyChange, findPlayer } from "./state-utils";
import type { GameState, TurnStage } from "./types";

/**
 * Double or nothing: every gain or loss of coins is queued by
 * `applyCurrencyChange`, then offered to the holder one at a time, once the
 * table is at rest. Accepting flips a coin: the amount happens a second time,
 * or is undone.
 */

/** Stages where nothing is half-resolved, so play can pause for the holder and resume as it was. */
const GAMBLE_STAGES: TurnStage[] = ["move", "hell", "shop", "turn-end", "blessing"];

export function formatGambleAmount(amount: number): string {
  return `${amount > 0 ? "+" : "−"}${Math.abs(amount)} pièces`;
}

/** Offers the next queued gamble when play is at rest; run after every action. */
export function offerGamble(state: GameState): GameState {
  if (state.phase !== "playing" || state.pendingGambles.length === 0) return state;
  if (!GAMBLE_STAGES.includes(state.turnStage)) return state;

  // Whoever left the table takes their stakes along.
  const gambles = state.pendingGambles.filter((gamble) => findPlayer(state, gamble.playerId));
  const [next] = gambles;
  const player = findPlayer(state, next?.playerId);
  if (!next || !player) return { ...state, pendingGambles: [] };

  const offered: GameState = {
    ...state,
    pendingGambles: gambles,
    turnStage: "gamble",
    gambleResumeStage: state.turnStage,
  };
  return addLog(
    offered,
    `${player.name} peut jouer ses ${formatGambleAmount(next.amount)} à Double or nothing.`,
    "event",
  );
}

/** The holder stakes the amount on a coin flip, or keeps it as it is; play then resumes. */
export function resolveGamble(state: GameState, accept: boolean): GameState {
  const [gamble, ...rest] = state.pendingGambles;
  const player = findPlayer(state, gamble?.playerId);
  if (state.turnStage !== "gamble" || !gamble || !player) return state;

  const resumed: GameState = { ...state, pendingGambles: rest, turnStage: state.gambleResumeStage };
  if (!accept) return addLog(resumed, `${player.name} ne tente pas Double or nothing.`);

  const doubled = drawEngineRandom() < 0.5;
  const nextState = addLog(
    resumed,
    doubled
      ? `Double or nothing : ${player.name} double ses ${formatGambleAmount(gamble.amount)} !`
      : `Double or nothing : les ${formatGambleAmount(gamble.amount)} de ${player.name} sont annulés !`,
    "event",
  );
  return applyCurrencyChange(nextState, player.id, doubled ? gamble.amount : -gamble.amount, { gamble: false });
}
