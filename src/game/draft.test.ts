import { describe, expect, it } from "vitest";
import { canPlayerSendAction } from "./action-permissions";
import { DRAFT_TIME_MS, getDraftOfferSize } from "./draft";
import { reduceGame } from "./game-actions";
import { getStartingCurrency } from "./passive-rules";
import { CLOCK_GRACE_MS } from "./turn-clock";
import type { GameState } from "./types";
import { EMPTY_GAME_STATE, GAME_COUNTDOWN_MS } from "./types";

/** The passive draft before the game (patch 0.1.4). */

function draftTable(playerCount: number, online = false): GameState {
  const playerNames = Array.from({ length: playerCount }, (_, index) => `Joueur ${index + 1}`);
  return reduceGame(
    EMPTY_GAME_STATE,
    { type: "startGame", playerNames, draft: true, ...(online ? { seed: 7 } : {}) },
    { now: online ? 0 : undefined },
  );
}

const offersOf = (state: GameState, index: number) => state.draft!.offers[state.players[index].id];

describe("passive draft", () => {
  it("deals three cards each up to six players, two beyond, never the same card twice", () => {
    expect([2, 6, 7, 8].map(getDraftOfferSize)).toEqual([3, 3, 2, 2]);
    for (const count of [2, 6, 8]) {
      const state = draftTable(count);
      expect(state.phase).toBe("draft");
      const dealt = state.players.flatMap((_, index) => offersOf(state, index));
      expect(dealt).toHaveLength(count * getDraftOfferSize(count));
      expect(new Set(dealt).size).toBe(dealt.length);
    }
  });

  it("keeps L'Ange-Gardien out of tables under four", () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const state = draftTable(3);
      expect(state.players.flatMap((_, index) => offersOf(state, index))).not.toContain("guardian-angel");
    }
  });

  it("lets a pick change, and closes once everybody picked, with the passives in effect", () => {
    let state = draftTable(2);
    const [first, second] = state.players;
    state = reduceGame(state, { type: "pickPassive", playerId: first.id, passiveId: offersOf(state, 0)[0] });
    state = reduceGame(state, { type: "pickPassive", playerId: first.id, passiveId: offersOf(state, 0)[1] });
    expect(state.phase).toBe("draft");
    // A card that was not dealt to the player is refused.
    expect(reduceGame(state, { type: "pickPassive", playerId: second.id, passiveId: offersOf(state, 0)[2] })).toBe(
      state,
    );

    const chosen = offersOf(state, 1)[2];
    const firstChoice = offersOf(state, 0)[1];
    state = reduceGame(state, { type: "pickPassive", playerId: second.id, passiveId: chosen });
    expect(state).toMatchObject({ phase: "playing", turnStage: "move", draft: null });
    expect(state.players.map((player) => player.passiveId)).toEqual(
      [firstChoice, chosen].map((passiveId) => (passiveId === "guardian-angel" ? "lambda" : passiveId)),
    );
    expect(state.players[1].currency).toBe(getStartingCurrency(state.players[1].passiveId));
  });

  it("online, closes after a minute with a random card for whoever did not pick, then counts down", () => {
    const state = draftTable(3, true);
    expect(state.draft?.deadline).toBe(DRAFT_TIME_MS);
    expect(reduceGame(state, { type: "expireClock" }, { now: DRAFT_TIME_MS - 1 })).toBe(state);

    const closed = reduceGame(state, { type: "expireClock" }, { now: DRAFT_TIME_MS });
    expect(closed.phase).toBe("playing");
    closed.players.forEach((player, index) => {
      const dealt = offersOf(state, index);
      expect(dealt.includes(player.passiveId) || player.passiveId === "lambda").toBe(true);
    });
    // The first turn's clock waits for the five-second countdown.
    expect(closed.turnClock?.runningSince).toBe(DRAFT_TIME_MS + GAME_COUNTDOWN_MS + CLOCK_GRACE_MS);
  });

  it("lets each player pick for themselves only", () => {
    const state = draftTable(2, true);
    const [first, second] = state.players;
    const action = { type: "pickPassive" as const, playerId: first.id, passiveId: offersOf(state, 0)[0] };
    expect(canPlayerSendAction(state, action, first.id)).toBe(true);
    expect(canPlayerSendAction(state, action, second.id)).toBe(false);
    expect(canPlayerSendAction(state, { type: "movePlayer", destination: 2, ignoreArrows: false }, first.id)).toBe(
      false,
    );
  });
});
