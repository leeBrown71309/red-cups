import { startWheel } from "./game-effects";
import { addLog, findPlayer } from "./state-utils";
import type { GameState } from "./types";

/**
 * Tour de Bénédiction: when every purse is empty (0 coins or less) as a turn
 * ends, the whole table spins the wheel of fortune in turn order, starting
 * with the player who would play next. The turn then passes as usual.
 */

export function isTableBroke(state: GameState): boolean {
  return state.players.length > 0 && state.players.every((player) => player.currency <= 0);
}

export function startBlessingRound(state: GameState): GameState {
  const seatCount = state.players.length;
  const blessingQueue = Array.from(
    { length: seatCount },
    (_, offset) => state.players[(state.activePlayerIndex + 1 + offset) % seatCount].id,
  );
  return addLog(
    { ...state, turnStage: "blessing", blessingQueue },
    "Toute la table est fauchée : Tour de Bénédiction ! Chacun tourne la roue du bonheur.",
    "event",
  );
}

export function spinBlessingWheel(state: GameState): GameState {
  const [spinnerId, ...rest] = state.blessingQueue;
  if (state.turnStage !== "blessing" || !findPlayer(state, spinnerId)) return state;
  return startWheel({ ...state, blessingQueue: rest }, "fortune", spinnerId, "blessing", { origin: "blessing" });
}
