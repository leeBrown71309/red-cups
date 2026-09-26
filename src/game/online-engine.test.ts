import { afterEach, describe, expect, it } from "vitest";
import { createSeededRandom } from "../utils/seeded-random";
import { canPlayerSendAction } from "./action-permissions";
import { reduceGame, type GameAction } from "./game-actions";
import { pickGameState } from "./game-save";
import { chooseBotAction } from "./simulation/bot-player";
import { setActionRelay, useGameStore } from "./store";
import type { GameState, PendingDuel } from "./types";
import { EMPTY_GAME_STATE } from "./types";

/** What an online game relies on: same seed + same actions = same game, on every device. */

const store = () => useGameStore.getState();

afterEach(() => {
  setActionRelay(null);
  store().resetGame();
});

/** Plays a seeded bot game through the store and records every action it sends. */
function recordBotGame(seed: number, playerCount: number, steps: number): { actions: GameAction[]; final: GameState } {
  const actions: GameAction[] = [];
  setActionRelay((action) => {
    actions.push(action);
    store().applyLocally(action);
  });
  store().startGame(
    Array.from({ length: playerCount }, (_, index) => `Bot ${index + 1}`),
    seed,
  );
  const botRandom = createSeededRandom(seed + 1);
  for (let step = 0; step < steps && store().phase === "playing"; step += 1) {
    chooseBotAction(store(), botRandom)?.perform(store());
  }
  return { actions, final: pickGameState(store()) };
}

function replay(start: GameState, actions: GameAction[]): GameState {
  return actions.reduce(reduceGame, start);
}

describe("seeded games", () => {
  it("reach the exact same state when another device replays the same actions", () => {
    const { actions, final } = recordBotGame(2024, 4, 400);
    const fromSeed = reduceGame(EMPTY_GAME_STATE, {
      type: "startGame",
      playerNames: ["Bot 1", "Bot 2", "Bot 3", "Bot 4"],
      seed: 2024,
    });
    expect(fromSeed.seededRandom).not.toBeNull();
    expect(actions.length).toBeGreaterThan(50);
    expect(replay(fromSeed, actions)).toEqual(final);
  });

  it("continue identically from a JSON snapshot, as after a reconnection", () => {
    const { actions, final } = recordBotGame(77, 5, 300);
    const start = reduceGame(EMPTY_GAME_STATE, {
      type: "startGame",
      playerNames: ["Bot 1", "Bot 2", "Bot 3", "Bot 4", "Bot 5"],
      seed: 77,
    });
    const half = Math.floor(actions.length / 2);
    const snapshot = JSON.parse(JSON.stringify(replay(start, actions.slice(0, half)))) as GameState;
    expect(replay(snapshot, actions.slice(half))).toEqual(final);
  });

  it("leave a refused action without any change", () => {
    const start = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["A", "B"], seed: 5 });
    expect(reduceGame(start, { type: "buyItem", itemId: "rope" })).toBe(start);
  });
});

function duelState(mode: PendingDuel["mode"], playerCount = 2): GameState {
  const start = reduceGame(EMPTY_GAME_STATE, {
    type: "startGame",
    playerNames: Array.from({ length: playerCount }, (_, index) => `J${index + 1}`),
    seed: 9,
  });
  const pendingDuel: PendingDuel = {
    playerOneId: "p1",
    playerTwoId: "p2",
    mode,
    coinWinnerId: mode === "coin-flip" ? "p2" : undefined,
    resumeStage: "turn-end",
    rpsChoices: {},
    rpsTiedRound: null,
    rpsTies: 0,
    votes: {},
    voteTieBroken: false,
    winnerId: null,
  };
  return { ...start, turnStage: "duel", pendingDuel };
}

describe("duels decided by the engine", () => {
  it("reveals the coin flipped at the start of the duel", () => {
    const state = reduceGame(duelState("coin-flip"), { type: "flipDuelCoin" });
    expect(state.pendingDuel?.winnerId).toBe("p2");
  });

  it("replays a tied rock-paper-scissors round, then settles the winner", () => {
    let state = duelState("rock-paper-scissors");
    state = reduceGame(state, { type: "pickDuelHand", playerId: "p1", choice: "rock" });
    state = reduceGame(state, { type: "pickDuelHand", playerId: "p2", choice: "rock" });
    expect(state.pendingDuel).toMatchObject({ rpsChoices: {}, rpsTies: 1, winnerId: null });
    expect(state.pendingDuel?.rpsTiedRound).toEqual({ p1: "rock", p2: "rock" });

    state = reduceGame(state, { type: "pickDuelHand", playerId: "p1", choice: "paper" });
    state = reduceGame(state, { type: "pickDuelHand", playerId: "p2", choice: "rock" });
    expect(state.pendingDuel?.winnerId).toBe("p1");
  });

  it("refuses a second hand from the same duellist", () => {
    const state = reduceGame(duelState("rock-paper-scissors"), {
      type: "pickDuelHand",
      playerId: "p1",
      choice: "rock",
    });
    expect(reduceGame(state, { type: "pickDuelHand", playerId: "p1", choice: "paper" })).toBe(state);
  });

  it("counts the votes of the other players and breaks a tie with a coin", () => {
    let state = duelState("player-vote", 4);
    state = reduceGame(state, { type: "castDuelVote", voterId: "p3", candidateId: "p1" });
    expect(state.pendingDuel?.winnerId).toBeNull();
    state = reduceGame(state, { type: "castDuelVote", voterId: "p4", candidateId: "p2" });
    expect(state.pendingDuel?.voteTieBroken).toBe(true);
    expect(["p1", "p2"]).toContain(state.pendingDuel?.winnerId);
  });

  it("only settles the duel with the winner the engine decided", () => {
    const decided = reduceGame(duelState("coin-flip"), { type: "flipDuelCoin" });
    expect(reduceGame(decided, { type: "resolveDuel", winnerId: "p1" })).toBe(decided);
    const settled = reduceGame(decided, { type: "resolveDuel", winnerId: "p2" });
    expect(settled.pendingDuel).toBeNull();
  });
});

describe("online permissions", () => {
  const start = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["A", "B", "C"], seed: 3 });

  it("lets only the active player play the turn", () => {
    const move: GameAction = { type: "movePlayer", destination: 1, ignoreArrows: false };
    expect(canPlayerSendAction(start, move, "p1")).toBe(true);
    expect(canPlayerSendAction(start, move, "p2")).toBe(false);
  });

  it("lets players abandon only for themselves", () => {
    expect(canPlayerSendAction(start, { type: "abandonGame", playerId: "p2" }, "p2")).toBe(true);
    expect(canPlayerSendAction(start, { type: "abandonGame", playerId: "p2" }, "p1")).toBe(false);
  });

  it("never lets a player restart or reset the room's game", () => {
    expect(canPlayerSendAction(start, { type: "resetGame" }, "p1")).toBe(false);
    expect(canPlayerSendAction(start, { type: "startGame", playerNames: ["A", "B"] }, "p1")).toBe(false);
  });

  it("refuses a duel result that the engine has not decided", () => {
    const duel = duelState("rock-paper-scissors", 3);
    expect(canPlayerSendAction(duel, { type: "resolveDuel", winnerId: "p1" }, "p1")).toBe(false);
    expect(canPlayerSendAction(duel, { type: "pickDuelHand", playerId: "p1", choice: "rock" }, "p1")).toBe(true);
    expect(canPlayerSendAction(duel, { type: "pickDuelHand", playerId: "p1", choice: "rock" }, "p2")).toBe(false);
    expect(
      canPlayerSendAction(
        duelState("player-vote", 3),
        { type: "castDuelVote", voterId: "p3", candidateId: "p1" },
        "p3",
      ),
    ).toBe(true);
  });
});
