import { afterEach, describe, expect, it, vi } from "vitest";
import { reduceGame } from "./game-actions";
import { throwSnowball } from "./snowballs";
import type { GameState, MapId, Player } from "./types";
import { EMPTY_GAME_STATE, HELL_NODE_ID, SNOWBALL_HITS_TO_FREEZE, STARTING_CURRENCY } from "./types";

function startOn(mapId: MapId): GameState {
  const state = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["Ana", "Bo", "Cy"], mapId });
  // Goblin only acts when a Cup is taken: nobody reacts to a turn change.
  return {
    ...state,
    players: state.players.map((player) => ({ ...player, passiveId: "goblin" as const, currency: STARTING_CURRENCY })),
  };
}

function editPlayer(state: GameState, index: number, changes: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  };
}

/** Math.random answers in turn: the target's draw, then whether the snowball hits. */
function scriptRandom(...values: number[]): void {
  const queue = [...values];
  vi.spyOn(Math, "random").mockImplementation(() => queue.shift() ?? 0);
}

afterEach(() => vi.restoreAllMocks());

describe("Banquise snowballs", () => {
  it("wait for the first Red Cup, and only fly at Banquise", () => {
    const banquise = startOn("banquise");
    expect(throwSnowball(banquise)).toBe(banquise);
    const classic = { ...startOn("classic"), redCupCycle: 1 };
    expect(throwSnowball(classic)).toBe(classic);
    expect(throwSnowball({ ...banquise, redCupCycle: 1 }).lastSnowball).not.toBeNull();
  });

  it("miss one time in three and count the hits", () => {
    const state = { ...startOn("banquise"), redCupCycle: 1 };
    scriptRandom(0, 0.9);
    const missed = throwSnowball(state);
    expect(missed.lastSnowball).toMatchObject({ targetId: "p1", hit: false, frozen: false });
    expect(missed.snowballHits.p1 ?? 0).toBe(0);

    scriptRandom(0, 0.1);
    const hit = throwSnowball(missed);
    expect(hit.lastSnowball).toMatchObject({ targetId: "p1", hit: true, frozen: false });
    expect(hit.snowballHits.p1).toBe(1);
  });

  it("freeze a player on the third hit, who loses their next turn and then thaws", () => {
    let state: GameState = {
      ...startOn("banquise"),
      redCupCycle: 1,
      snowballHits: { p2: SNOWBALL_HITS_TO_FREEZE - 1 },
    };
    state = { ...state, turnStage: "turn-end", turnActionTaken: true };
    // Bo is aimed at (second of three) and hit, right as Ana's turn ends: his turn is skipped at once.
    scriptRandom(0.4, 0.1);
    const after = reduceGame(state, { type: "endTurn" });
    expect(after.lastSnowball).toMatchObject({ targetId: "p2", hit: true, frozen: true });
    expect(after.snowballHits.p2).toBe(0);
    expect(after.players[after.activePlayerIndex].id).toBe("p3");
    expect(after.players[1].skippedTurns).toBe(0);
    expect(after.snowFrozenPlayerIds).toEqual([]);
    expect(after.log.map((entry) => entry.text)).toContain("Bo se dégèle.");
  });

  it("stay frozen until the lost turn comes round", () => {
    let state: GameState = {
      ...startOn("banquise"),
      redCupCycle: 1,
      snowballHits: { p1: SNOWBALL_HITS_TO_FREEZE - 1 },
    };
    scriptRandom(0, 0.1);
    state = throwSnowball(state);
    expect(state.snowFrozenPlayerIds).toEqual(["p1"]);
    expect(state.players[0].skippedTurns).toBe(1);
    // Frozen players are not aimed at again.
    for (let draw = 0; draw < 10; draw += 1) {
      expect(throwSnowball(state).lastSnowball?.targetId).not.toBe("p1");
    }
  });

  it("never reach a player down in Hell", () => {
    let state: GameState = { ...startOn("banquise"), redCupCycle: 1 };
    state = editPlayer(editPlayer(state, 0, { position: HELL_NODE_ID }), 1, { position: HELL_NODE_ID });
    for (let draw = 0; draw < 10; draw += 1) {
      expect(throwSnowball(state).lastSnowball?.targetId).toBe("p3");
    }
  });
});
