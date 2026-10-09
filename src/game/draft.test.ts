import { describe, expect, it } from "vitest";
import { canPlayerSendAction } from "./action-permissions";
import { CARD_KINDS } from "./cards";
import {
  DRAFT_TIME_MS,
  PASSIF_REVEAL_TIME_MS,
  dealUniquePassifs,
  getDraftOfferSize,
  getDraftPool,
  getRefusedPassifs,
  getStageOfferSize,
} from "./draft";
import { reduceGame } from "./game-actions";
import { getStartingCurrency } from "./passive-rules";
import { CLOCK_GRACE_MS } from "./turn-clock";
import type { GameState, PassiveId } from "./types";
import { EMPTY_GAME_STATE, GAME_COUNTDOWN_MS } from "./types";

/** The draft before the game: an actif picked, then a passif drawn (patch 0.1.4, two stages since patch 0.1.6). */

function draftTable(playerCount: number, online = false): GameState {
  const playerNames = Array.from({ length: playerCount }, (_, index) => `Joueur ${index + 1}`);
  return reduceGame(
    EMPTY_GAME_STATE,
    { type: "startGame", playerNames, draft: true, ...(online ? { seed: 7 } : {}) },
    { now: online ? 0 : undefined },
  );
}

const offersOf = (state: GameState, index: number) => state.draft!.offers[state.players[index].id];

/** Everybody picks the first card of their offer. */
function pickFirst(state: GameState): GameState {
  let next = state;
  for (const player of state.players) {
    next = reduceGame(next, { type: "pickPassive", playerId: player.id, passiveId: next.draft!.offers[player.id][0] });
  }
  return next;
}

describe("two-stage draft", () => {
  it("deals two actifs each, never a card twice while the pool lasts, never twice in one offer", () => {
    expect([2, 6, 8].map(getDraftOfferSize)).toEqual([2, 2, 2]);
    for (const count of [2, 4, 8]) {
      const state = draftTable(count);
      expect(state.phase).toBe("draft");
      expect(state.draft?.stage).toBe("actif");
      const dealt = state.players.flatMap((_, index) => offersOf(state, index));
      expect(dealt).toHaveLength(count * 2);
      expect(dealt.every((cardId) => CARD_KINDS[cardId] === "actif" && cardId !== "lambda")).toBe(true);
      state.players.forEach((_, index) => expect(new Set(offersOf(state, index)).size).toBe(2));
      if (count * 2 <= getDraftPool("actif", count).length) expect(new Set(dealt).size).toBe(dealt.length);
      // The roles exist once per table.
      for (const role of ["devil", "guardian-angel"] as PassiveId[]) {
        expect(dealt.filter((cardId) => cardId === role).length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps L'Ange-Gardien out of tables under four", () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const state = draftTable(3);
      expect(state.players.flatMap((_, index) => offersOf(state, index))).not.toContain("guardian-angel");
    }
  });

  it("moves on to the passifs once everybody picked an actif, then plays with both cards", () => {
    let state = draftTable(2);
    const [first, second] = state.players;
    state = reduceGame(state, { type: "pickPassive", playerId: first.id, passiveId: offersOf(state, 0)[0] });
    state = reduceGame(state, { type: "pickPassive", playerId: first.id, passiveId: offersOf(state, 0)[1] });
    expect(state.draft?.stage).toBe("actif");
    // A card that was not dealt to the player is refused.
    const foreign = offersOf(state, 1)[0];
    expect(reduceGame(state, { type: "pickPassive", playerId: first.id, passiveId: foreign })).toBe(state);

    const firstActif = offersOf(state, 0)[1];
    const secondActif = offersOf(state, 1)[0];
    state = reduceGame(state, { type: "pickPassive", playerId: second.id, passiveId: secondActif });
    expect(state.phase).toBe("draft");
    expect(state.draft?.stage).toBe("passif");
    expect(state.draft?.picks).toEqual({});
    expect(state.draft?.actifs).toEqual({ [first.id]: firstActif, [second.id]: secondActif });
    // One passif each, drawn at random, and never the same one for two players.
    const dealtPassifs = state.players.flatMap((_, index) => offersOf(state, index));
    expect(dealtPassifs).toHaveLength(2);
    expect(dealtPassifs.every((card) => CARD_KINDS[card] === "passif")).toBe(true);
    expect(new Set(dealtPassifs).size).toBe(2);

    const passifs = state.players.map((_, index) => offersOf(state, index)[0]);
    state = pickFirst(state);
    expect(state).toMatchObject({ phase: "playing", turnStage: "move", draft: null });
    expect(state.players.map((player) => player.passifId)).toEqual(passifs);
    expect(state.players.map((player) => player.passiveId)).toEqual(
      [firstActif, secondActif].map((cardId) => (cardId === "guardian-angel" ? "lambda" : cardId)),
    );
    for (const player of state.players) {
      expect(player.currency).toBe(getStartingCurrency(player.passiveId, player.passifId));
    }
  });

  it("online, a minute to pick the actif, a random one for whoever did not, a short reveal of the passifs, then the countdown", () => {
    const state = draftTable(3, true);
    expect(state.draft?.deadline).toBe(DRAFT_TIME_MS);
    expect(reduceGame(state, { type: "expireClock" }, { now: DRAFT_TIME_MS - 1 })).toBe(state);

    const second = reduceGame(state, { type: "expireClock" }, { now: DRAFT_TIME_MS });
    expect(second.phase).toBe("draft");
    expect(second.draft?.stage).toBe("passif");
    expect(second.draft?.deadline).toBe(DRAFT_TIME_MS + PASSIF_REVEAL_TIME_MS);

    const closeAt = DRAFT_TIME_MS + PASSIF_REVEAL_TIME_MS;
    const closed = reduceGame(second, { type: "expireClock" }, { now: closeAt });
    expect(closed.phase).toBe("playing");
    closed.players.forEach((player, index) => {
      expect(offersOf(state, index).includes(player.passiveId) || player.passiveId === "lambda").toBe(true);
      expect(offersOf(second, index).includes(player.passifId as PassiveId)).toBe(true);
    });
    // The first turn's clock waits for the five-second countdown.
    expect(closed.turnClock?.runningSince).toBe(closeAt + GAME_COUNTDOWN_MS + CLOCK_GRACE_MS);
  });

  it("draws a different passif for every player of the table, whatever the table size or the actifs", () => {
    expect(getStageOfferSize("actif")).toBe(2);
    expect(getStageOfferSize("passif")).toBe(1);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
      const pool = getDraftPool("passif", ids.length);
      // Seven seats play an actif that refuses nothing, one is L'Ange-Gardien: no harmful passif for them.
      const dealt = dealUniquePassifs(ids, pool, (id) => getRefusedPassifs(id === "p5" ? "guardian-angel" : "greedy"));
      const cards = ids.map((id) => dealt[id][0]);
      expect(cards.every(Boolean)).toBe(true);
      expect(new Set(cards).size).toBe(ids.length);
      expect(getRefusedPassifs("guardian-angel")).not.toContain(dealt.p5[0]);
      expect(cards.every((cardId) => CARD_KINDS[cardId] === "passif")).toBe(true);
    }
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
