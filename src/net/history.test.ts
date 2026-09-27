import { describe, expect, it } from "vitest";
import { reduceGame } from "../game/game-actions";
import { EMPTY_GAME_STATE, type GameState } from "../game/types";
import { getDurationMinutes, getOutcome, getWinnerName, parseHistoryGame, type HistoryGame } from "./history";

function finishedTable(): GameState {
  const state = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["Moussa", "Awa", "Léa"], seed: 7 });
  // Awa wins with more coins than Léa; Moussa is ranked last.
  const [moussa, awa, lea] = state.players;
  return {
    ...state,
    phase: "finished",
    winReason: "red-cups",
    winnerId: awa.id,
    players: [
      { ...moussa, currency: 100 },
      {
        ...awa,
        currency: 900,
        inventory: [1, 2, 3].map((index) => ({ id: `cup-${index}`, kind: "red-cup" as const })),
      },
      { ...lea, currency: 500 },
    ],
  };
}

function game(overrides: Partial<HistoryGame>): HistoryGame {
  return {
    ...parseHistoryGame({
      id: "g1",
      status: "finished",
      started_at: "2026-09-26T18:00:00Z",
      ended_at: "2026-09-26T18:42:20Z",
      final: finishedTable(),
      my_seat: 0,
      seats: null,
    }),
    ...overrides,
  };
}

describe("game history", () => {
  it("names the winner and the place of the account reading it", () => {
    expect(getOutcome(game({ mySeat: 1 }))).toEqual({ kind: "won" });
    expect(getOutcome(game({ mySeat: 2 }))).toEqual({ kind: "placed", place: 2, of: 3 });
    expect(getOutcome(game({ mySeat: 0 }))).toEqual({ kind: "placed", place: 3, of: 3 });
    expect(getWinnerName(game({}))).toBe("Awa");
  });

  it("counts a player who left the table as abandoned, and still in the table size", () => {
    const final = finishedTable();
    const [moussa, ...rest] = final.players;
    const outcome = getOutcome(game({ final: { ...final, players: rest, abandonedPlayers: [moussa] } }));
    expect(outcome).toEqual({ kind: "abandoned" });
    expect(getOutcome(game({ mySeat: 2, final: { ...final, players: rest, abandonedPlayers: [moussa] } }))).toEqual({
      kind: "placed",
      place: 2,
      of: 3,
    });
  });

  it("tells a game still on or interrupted apart from a finished one", () => {
    expect(getOutcome(game({ status: "playing", final: null, endedAt: null }))).toEqual({ kind: "playing" });
    expect(getOutcome(game({ status: "unfinished" }))).toEqual({ kind: "unfinished" });
    expect(getDurationMinutes(game({}))).toBe(42);
    expect(getDurationMinutes(game({ endedAt: null }))).toBeNull();
  });
});
