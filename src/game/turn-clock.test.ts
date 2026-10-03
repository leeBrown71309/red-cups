import { describe, expect, it } from "vitest";
import { withPassives } from "./forced-passives";
import { reduceGame, type GameAction } from "./game-actions";
import { isSameRules } from "../net/room-protocol";
import { createDuel } from "./duel-setup";
import {
  CLOCK_GRACE_MS,
  DECISION_TIME_MS,
  getClockMsLeft,
  HELD_CLOCK_SAFETY_MS,
  getClockDeadline,
  TURN_TIME_MS,
  updateClocks,
} from "./turn-clock";
import type { GameState, InventoryEntry, PassiveId, Player } from "./types";
import { EMPTY_GAME_STATE, RULES_VERSION } from "./types";

/** The online turn clock: the time of every action comes with it, as `now`. */

function onlineTable(passives: PassiveId[], now = 0): GameState {
  const started = reduceGame(
    EMPTY_GAME_STATE,
    { type: "startGame", playerNames: passives.map((_, index) => `Joueur ${index + 1}`), seed: 11 },
    { now },
  );
  return withPassives(started, passives);
}

function play(state: GameState, action: GameAction, now: number): GameState {
  return reduceGame(state, action, { now });
}

function editPlayer(state: GameState, index: number, changes: Partial<Player>): GameState {
  return { ...state, players: state.players.map((player, at) => (at === index ? { ...player, ...changes } : player)) };
}

const tomatoes = (count: number): InventoryEntry => ({ id: "tomatoes", kind: "item", itemId: "tomato", count });
const firstDeadline = CLOCK_GRACE_MS + TURN_TIME_MS;

describe("online turn clock", () => {
  it("gives the first player 45 seconds once the opening animations are over; a local game has no clock", () => {
    const state = onlineTable(["lambda", "lambda"]);
    expect(state.turnClock).toEqual({
      playerId: state.players[0].id,
      round: 1,
      remainingMs: TURN_TIME_MS,
      runningSince: CLOCK_GRACE_MS,
    });
    expect(getClockDeadline(state)).toBe(firstDeadline);

    const local = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["A", "B"] }, { now: 0 });
    expect(local.turnClock).toBeNull();
  });

  it("spends only the time thought between actions", () => {
    let state = onlineTable(["lambda", "lambda"]);
    state = editPlayer(state, 0, { inventory: [tomatoes(2)] });
    state = play(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: state.players[1].id }, 10_000);
    expect(state.turnClock).toMatchObject({ remainingMs: TURN_TIME_MS - 7_000, runningSince: 10_000 + CLOCK_GRACE_MS });
  });

  it("ends a turn that ran out, and costs a chance when nothing was done", () => {
    const state = onlineTable(["lambda", "lambda", "lambda"]);
    expect(play(state, { type: "expireClock" }, firstDeadline - 1)).toBe(state);

    const expired = play(state, { type: "expireClock" }, firstDeadline);
    expect(expired.activePlayerIndex).toBe(1);
    expect(expired.idleStrikes).toEqual({ [state.players[0].id]: 1 });
    // The next player starts on a full clock.
    expect(expired.turnClock).toMatchObject({ playerId: state.players[1].id, remainingMs: TURN_TIME_MS });

    const busy = play({ ...state, turnActionTaken: true }, { type: "expireClock" }, firstDeadline);
    expect(busy.activePlayerIndex).toBe(1);
    expect(busy.idleStrikes).toEqual({});
  });

  it("is a forfeit at the third chance lost", () => {
    const state = onlineTable(["lambda", "lambda", "lambda"]);
    const warned = { ...state, idleStrikes: { [state.players[0].id]: 2 } };
    const expired = play(warned, { type: "expireClock" }, firstDeadline);
    expect(expired.players.map((player) => player.id)).toEqual([state.players[1].id, state.players[2].id]);
    expect(expired.abandonedPlayers.map((player) => player.id)).toEqual([state.players[0].id]);
    expect(expired.phase).toBe("playing");
  });

  it("pauses while somebody else decides, who gets a deadline with a default answer", () => {
    let state = onlineTable(["lambda", "no-thanks"]);
    state = editPlayer(state, 0, { inventory: [{ id: "finger", kind: "item", itemId: "middle-finger" }] });
    state = play(state, { type: "useItem", entryId: "finger", targetPlayerId: state.players[1].id }, 5_000);
    expect(state.turnStage).toBe("reaction");
    expect(state.turnClock).toMatchObject({ remainingMs: TURN_TIME_MS - 2_000, runningSince: null });
    expect(getClockDeadline(state)).toBe(5_000 + CLOCK_GRACE_MS + DECISION_TIME_MS);

    // Nobody answered: the item goes through, and the active player's clock runs again.
    const answered = play(state, { type: "expireClock" }, 5_000 + CLOCK_GRACE_MS + DECISION_TIME_MS);
    expect(answered.turnStage).toBe("move");
    expect(answered.players[1].skippedTurns).toBe(1);
    expect(answered.turnClock?.runningSince).not.toBeNull();
  });

  it("refuses a stored game on other rules", () => {
    expect(isSameRules({ ...EMPTY_GAME_STATE, rulesVersion: RULES_VERSION })).toBe(true);
    expect(isSameRules({ ...EMPTY_GAME_STATE, rulesVersion: "0.1.3" })).toBe(false);
    expect(isSameRules(null)).toBe(true);
  });
});

describe("online turn clock during a duel", () => {
  it("holds the turn's clock and gives the duel only a long safety net", () => {
    const state = onlineTable(["lambda", "lambda"]);
    const duel = createDuel(state.players[0].id, state.players[1].id, "coin-flip", "turn-end");
    const duelling = updateClocks({ ...state, turnStage: "duel", pendingDuel: duel }, 10_000);
    expect(duelling.turnClock).toMatchObject({ runningSince: null, remainingMs: TURN_TIME_MS - 7_000 });
    expect(getClockDeadline(duelling)).toBe(10_000 + CLOCK_GRACE_MS + HELD_CLOCK_SAFETY_MS);
  });
});

describe("online turn clock as players see it", () => {
  it("stands still at the full turn until the countdown and the animations are over", () => {
    const state = onlineTable(["lambda", "lambda"]);
    expect(getClockMsLeft(state, 0)).toBe(TURN_TIME_MS);
    expect(getClockMsLeft(state, CLOCK_GRACE_MS - 1)).toBe(TURN_TIME_MS);
    expect(getClockMsLeft(state, CLOCK_GRACE_MS + 5_000)).toBe(TURN_TIME_MS - 5_000);
  });

  it("holds the turn while a tile's wheel spins, but not in the shop", () => {
    const state = onlineTable(["lambda", "lambda"]);
    const wheel = updateClocks({ ...state, turnStage: "tile-wheel" }, 10_000);
    expect(wheel.turnClock?.runningSince).toBeNull();
    expect(getClockDeadline(wheel)).toBe(10_000 + CLOCK_GRACE_MS + HELD_CLOCK_SAFETY_MS);

    const shop = updateClocks({ ...state, turnStage: "shop" }, 10_000);
    expect(shop.turnClock?.runningSince).toBe(10_000 + CLOCK_GRACE_MS);
  });
});
