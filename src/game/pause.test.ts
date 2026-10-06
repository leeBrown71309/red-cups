import { describe, expect, it } from "vitest";
import { buildOnlineGame, getPlayerIdOfUser } from "../net/room-protocol";
import { canPlayerSendAction } from "./action-permissions";
import { reduceGame, type GameAction } from "./game-actions";
import { getHostPlayerId, PAUSE_TAKEOVER_MS } from "./pause";
import { CLOCK_GRACE_MS, getClockDeadline, TURN_TIME_MS } from "./turn-clock";
import type { GameState } from "./types";
import { EMPTY_GAME_STATE } from "./types";

/** The host's pause: every clock stops, nothing is played, and the deadlines come back whole. */

function onlineTable(playerCount = 3): GameState {
  const playerNames = Array.from({ length: playerCount }, (_, index) => `Joueur ${index + 1}`);
  const started = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames, seed: 7 }, { now: 0 });
  return { ...started, hostPlayerId: started.players[1].id };
}

function play(state: GameState, action: GameAction, now: number): GameState {
  return reduceGame(state, action, { now });
}

const firstDeadline = CLOCK_GRACE_MS + TURN_TIME_MS;

describe("host pause", () => {
  it("remembers the room's host as a player of the game", () => {
    const seat = (userId: string, name: string) => ({ userId, seat: null, name, avatar: 0, absent: false });
    const players = [seat("u-1", "Léa"), seat("u-2", "Malik")];
    const { state, seatOrder } = buildOnlineGame(players, 3, "classic", 0, "u-2");
    expect(state.hostPlayerId).toBe(getPlayerIdOfUser(seatOrder, "u-2"));
  });

  it("only lets the host pause, and stops the clock that counts", () => {
    const state = onlineTable();
    const host = state.players[1].id;
    expect(play(state, { type: "pauseGame", playerId: state.players[0].id }, 10_000)).toBe(state);

    const paused = play(state, { type: "pauseGame", playerId: host }, 10_000);
    expect(paused.pause).toEqual({ byPlayerId: host, since: 10_000 });
    expect(getClockDeadline(paused)).toBeNull();
    // The clock never runs out while paused, however long it lasts.
    expect(play(paused, { type: "expireClock" }, firstDeadline + 60_000)).toBe(paused);
  });

  it("refuses every move while paused", () => {
    const state = onlineTable();
    const paused = play(state, { type: "pauseGame", playerId: state.players[1].id }, 5_000);
    expect(play(paused, { type: "endTurn" }, 6_000)).toBe(paused);
    expect(play(paused, { type: "pauseGame", playerId: state.players[1].id }, 6_000)).toBe(paused);
  });

  it("gives the time spent paused back to the turn on resume", () => {
    const state = onlineTable();
    const host = state.players[1].id;
    const paused = play(state, { type: "pauseGame", playerId: host }, 20_000);
    const resumed = play(paused, { type: "resumeGame", playerId: host }, 80_000);
    expect(resumed.pause).toBeNull();
    expect(getClockDeadline(resumed)).toBe(firstDeadline + 60_000);
    expect(resumed.activePlayerIndex).toBe(state.activePlayerIndex);
  });

  it("lets anybody resume once the host has been gone too long", () => {
    const state = onlineTable();
    const paused = play(state, { type: "pauseGame", playerId: state.players[1].id }, 0);
    const other = state.players[2].id;
    expect(play(paused, { type: "resumeGame", playerId: other }, PAUSE_TAKEOVER_MS - 1)).toBe(paused);
    expect(play(paused, { type: "resumeGame", playerId: other }, PAUSE_TAKEOVER_MS).pause).toBeNull();
  });

  it("still lets a player leave, and hands the host's role on when the host leaves", () => {
    const state = onlineTable();
    const host = state.players[1].id;
    const paused = play(state, { type: "pauseGame", playerId: host }, 0);
    const left = play(paused, { type: "abandonGame", playerId: host }, 30_000);
    expect(left.players.map((player) => player.id)).not.toContain(host);
    expect(left.pause).not.toBeNull();
    expect(getHostPlayerId(left)).toBe(left.players[0].id);
    expect(play(left, { type: "resumeGame", playerId: left.players[0].id }, 31_000).pause).toBeNull();
  });

  it("is sent by the player it names only", () => {
    const state = onlineTable();
    const action: GameAction = { type: "pauseGame", playerId: state.players[1].id };
    expect(canPlayerSendAction(state, action, state.players[1].id)).toBe(true);
    expect(canPlayerSendAction(state, action, state.players[0].id)).toBe(false);
  });

  it("waits for a live Basket round to end", () => {
    const state = onlineTable();
    const basket = { id: "b", shooterId: state.players[0].id, scores: {}, ghostShots: [], tieBroken: false };
    const duelling = {
      ...state,
      turnStage: "duel" as const,
      pendingDuel: { ...(state.pendingDuel ?? {}), basket } as GameState["pendingDuel"],
    };
    expect(play(duelling, { type: "pauseGame", playerId: state.players[1].id }, 0)).toBe(duelling);
  });
});

describe("a paused game that ends", () => {
  it("is no longer paused once the last abandonment ends it", () => {
    const table = onlineTable(2);
    const paused = play(table, { type: "pauseGame", playerId: table.hostPlayerId! }, 1_000);
    expect(paused.pause).not.toBeNull();
    const ended = play(paused, { type: "abandonGame", playerId: paused.players[0].id }, 2_000);
    expect(ended).toMatchObject({ phase: "finished", pause: null });
  });
});
