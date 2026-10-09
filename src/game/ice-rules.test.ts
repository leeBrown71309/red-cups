import { afterEach, describe, expect, it, vi } from "vitest";
import { getBlizzardCandidates, getBoard, isIce } from "./board";
import { WHEEL_RESULTS } from "./catalog";
import { openPortals } from "./devil";
import { reduceGame } from "./game-actions";
import { getCalmDownTiles } from "./game-effects";
import { blowBlizzard } from "./ice";
import type { GameState, MapId, NodeId, PassiveId, Player, WheelOutcomeId } from "./types";
import { EMPTY_GAME_STATE, HELL_NODE_ID, START_BONUS, STARTING_CURRENCY } from "./types";

/**
 * Banquise: nobody stays on ice, whatever brings them there (rule of the
 * game's author, patch 0.1.4). Tiles: 0 start (arrows to 1 and 2), 1, 2 and 4
 * green, 3 and 7 ice, 6 and 10 red, 5, 8 and 12 shops, 9 and 13 neutral,
 * 11 Hell. The Red Cup waits on 13, away from every slide.
 */
function startOn(mapId: MapId, positions: NodeId[], passives: PassiveId[] = []): GameState {
  const state = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["Ana", "Bo", "Cy"], mapId });
  return {
    ...state,
    iceTileNodeId: null,
    redCupNodeId: mapId === "banquise" ? 13 : state.redCupNodeId,
    players: state.players.map((player, index) => ({
      ...player,
      passiveId: passives[index] ?? "lambda",
      currency: STARTING_CURRENCY,
      position: positions[index] ?? player.position,
    })),
  };
}

function editPlayer(state: GameState, index: number, changes: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  };
}

/** The wheel of fortune stopped on `outcomeId` for Ana; resolving it is the next action. */
function landFortune(state: GameState, outcomeId: WheelOutcomeId): GameState {
  const result = WHEEL_RESULTS.fortune.find((candidate) => candidate.id === outcomeId)!;
  return {
    ...state,
    turnStage: "wheel-result",
    pendingWheel: {
      id: `wheel-${outcomeId}`,
      wheelId: "fortune",
      playerId: state.players[0].id,
      result: { id: result.id, label: result.label, amount: result.amount },
      resumeStage: "turn-end",
    },
  };
}

const logged = (state: GameState, text: string) => state.log.some((entry) => entry.text === text);

afterEach(() => vi.restoreAllMocks());

describe("Banquise: nobody stays on ice", () => {
  it("slides on after the wheel's step forward onto ice", () => {
    const state: GameState = {
      ...startOn("banquise", [1, 5, 12]),
      turnStage: "advance",
      pendingAdvance: { playerId: "p1", resumeStage: "turn-end" },
    };
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const next = reduceGame(state, { type: "advanceOneTile", destination: 3 });

    const ana = next.players[0];
    expect([4, 6, 8]).toContain(ana.position);
    expect(next.lastMovement).toMatchObject({ from: 1, path: [3, ana.position], slideStart: 1 });
    expect(logged(next, `Ana glisse sur la glace jusqu’en case ${ana.position}.`)).toBe(true);
  });

  it("carries away whoever stands on the tile the blizzard freezes", () => {
    const state = startOn("banquise", [1, 6, 12]);
    const candidates = getBlizzardCandidates(getBoard(state), [null, state.redCupNodeId, null]);
    // The blizzard's draw picks Bo's tile, then the ice carries him along its first road.
    vi.spyOn(Math, "random")
      .mockReturnValueOnce((candidates.indexOf(6) + 0.5) / candidates.length)
      .mockReturnValue(0);
    const next = blowBlizzard(state);

    const bo = next.players[1];
    expect(next.iceTileNodeId).toBe(6);
    expect(bo.position).not.toBe(6);
    expect(isIce(getBoard(next), bo.position)).toBe(false);
    expect(logged(next, `La glace emporte Bo jusqu’en case ${bo.position}.`)).toBe(true);
  });

  it("never freezes the start as the game begins, where the whole table stands", () => {
    for (let draw = 0; draw < 1; draw += 0.05) {
      vi.spyOn(Math, "random").mockReturnValue(draw);
      const state = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["A", "B"], mapId: "banquise" });
      expect(state.iceTileNodeId).not.toBe(0);
      vi.restoreAllMocks();
    }
  });

  it("slides a player the wheel sends to a frozen start, who arrives where the ice stops", () => {
    const state = landFortune({ ...startOn("banquise", [6, 5, 12]), iceTileNodeId: 0 }, "go-to-start");
    vi.spyOn(Math, "random").mockReturnValue(0);
    const next = reduceGame(state, { type: "resolveWheel" });

    expect([1, 2]).toContain(next.players[0].position);
    expect(next.players[0].currency).toBe(STARTING_CURRENCY + START_BONUS);
    // 1 and 2 are green: the tile the slide stops on is reached, and its wheel is owed.
    expect(next.turnStage).toBe("tile-wheel");
  });

  it("carries le diable off a frozen start as they leave Hell, without an arrival", () => {
    let state = startOn("banquise", [HELL_NODE_ID, 5, 12], ["devil"]);
    state = { ...editPlayer(state, 0, { hellTurns: 1 }), iceTileNodeId: 0, turnStage: "hell" };
    vi.spyOn(Math, "random").mockReturnValue(0);
    const next = reduceGame(state, { type: "leaveHell" });

    const devil = next.players[0];
    expect([1, 2]).toContain(devil.position);
    expect(next.turnStage).toBe("move");
    expect(next.pendingTileWheels).toEqual([]);
    expect(logged(next, `La glace emporte Ana jusqu’en case ${devil.position}.`)).toBe(true);
  });

  it("offers Calme-toi no tile on ice", () => {
    const state = { ...startOn("banquise", [1, 5, 12]), iceTileNodeId: 4 };
    const board = getBoard(state);
    for (const cupNodeId of board.normalNodeIds.filter((nodeId) => !isIce(board, nodeId))) {
      const tiles = getCalmDownTiles({ ...state, redCupNodeId: cupNodeId });
      expect(tiles.filter((nodeId) => isIce(board, nodeId))).toEqual([]);
    }
  });

  it("never opens a Portail on ice, nor lands the water bottle there", () => {
    const state = { ...startOn("banquise", [HELL_NODE_ID, 5, 12], ["devil"]), iceTileNodeId: 12 };
    const board = getBoard(state);
    for (let draw = 0; draw < 1; draw += 0.05) {
      vi.spyOn(Math, "random").mockReturnValue(draw);
      const [portal] = openPortals(state, "p1").hellPortals;
      expect(isIce(board, portal.nodeId)).toBe(false);

      const inHell: GameState = {
        ...editPlayer(state, 0, {
          passiveId: "lambda",
          hellTurns: 1,
          inventory: [{ id: "water", kind: "item", itemId: "water-bottle" }],
        }),
        turnStage: "hell",
        energyLeft: 3,
      };
      const landed = reduceGame(inHell, { type: "useItem", entryId: "water" }).players[0].position;
      expect(isIce(board, landed)).toBe(false);
      vi.restoreAllMocks();
    }
  });
});

describe("turn changes on every map", () => {
  it.each<MapId>(["classic", "banquise", "luna-park"])(
    "send a knocked-out player on le diable's tile to Hell at once on %s",
    (mapId) => {
      let state = startOn(mapId, [2, 5, 2], ["devil"]);
      state = editPlayer(state, 0, { inventory: [{ id: "touch", kind: "item", itemId: "hell-touch" }] });
      state = { ...editPlayer(state, 2, { skippedTurns: 1 }), ghost: null, turnStage: "turn-end" };
      const next = reduceGame(state, { type: "endTurn" });

      expect(next.players[2].position).toBe(HELL_NODE_ID);
      expect(next.players[0].inventory).toEqual([]);
    },
  );
});

describe("a player held by falling ice when a Barrière is set on their road", () => {
  it("bounces back on the ice tile and slides another way once thawed", () => {
    let state = startOn("banquise", [3, 5, 12]);
    state = {
      ...state,
      frozenSlides: [{ playerId: state.players[0].id, from: 3, to: 8 }],
      barriers: [{ ownerId: state.players[1].id, a: 3, b: 8, turnsLeft: 2 }],
      activePlayerIndex: 2,
      turnStage: "turn-end",
    };
    vi.spyOn(Math, "random").mockReturnValue(0);
    const next = reduceGame(state, { type: "endTurn" });

    const ana = next.players[0];
    expect(next.frozenSlides).toEqual([]);
    expect(ana.position).not.toBe(8);
    expect(ana.position).not.toBe(3);
    expect(isIce(getBoard(next), ana.position)).toBe(false);
    expect(next.log.some((entry) => entry.text.startsWith("Ana brise la glace, se heurte à une Barrière"))).toBe(true);
  });
});
