import { afterEach, describe, expect, it, vi } from "vitest";
import {
  earnsStartBonus,
  getBlizzardCandidates,
  getNeighbors,
  getShortestPath,
  getSlideExits,
  resolveBoard,
  type Board,
} from "../board";
import { migrateGameSave, pickGameState } from "../game-save";
import { useGameStore } from "../store";
import type { MapId, PassiveId, Player } from "../types";
import { HELL_NODE_ID, START_NODE_ID } from "../types";
import { MAP_ORDER, getBoardMap, resolveMapChoice } from "./map-registry";
import { getStartingCurrency } from "../passive-rules";

const sorted = (values: number[]) => [...values].sort((left, right) => left - right);

describe("every map", () => {
  describe.each(MAP_ORDER)("%s", (mapId) => {
    const map = getBoardMap(mapId);
    const boards = [resolveBoard(mapId, false), resolveBoard(mapId, true)];

    it("keeps the start on tile 0 and Hell on tile 11", () => {
      expect(map.nodes.find((node) => node.id === START_NODE_ID)?.kind).toBe("start");
      expect(map.nodes.find((node) => node.id === HELL_NODE_ID)?.kind).toBe("hell");
      expect(new Set(map.nodes.map((node) => node.id)).size).toBe(map.nodes.length);
    });

    it("only links tiles that exist, never Hell", () => {
      const ids = new Set(map.nodes.map((node) => node.id));
      for (const edge of map.edges) {
        expect(ids.has(edge.from) && ids.has(edge.to)).toBe(true);
        expect([edge.from, edge.to]).not.toContain(HELL_NODE_ID);
      }
    });

    it("puts the first Red Cup on a walkable tile other than the start", () => {
      expect(boards[0].normalNodeIds).toContain(map.initialCupNodeId);
      expect(map.initialCupNodeId).not.toBe(START_NODE_ID);
    });

    it.each([false, true])("leaves no tile without an exit and every tile within reach (reversed: %s)", (reversed) => {
      const board = boards[Number(reversed)];
      for (const nodeId of board.normalNodeIds) {
        expect(getNeighbors(board, nodeId).length).toBeGreaterThan(0);
        for (const targetId of board.normalNodeIds) {
          expect(getShortestPath(board, nodeId, targetId, false)).not.toBeNull();
        }
      }
    });

    it("pays the start bonus through at least one road", () => {
      const bonusRoads = map.edges.filter((edge) => edge.arrow && edge.to === START_NODE_ID);
      expect(bonusRoads.length).toBeGreaterThan(0);
    });
  });
});

describe("Luna Park board", () => {
  const board = resolveBoard("luna-park", false);
  const reversed = resolveBoard("luna-park", true);

  // Written down from the validated sketch, independently from the map data.
  const EXITS_FORWARD: Record<number, number[]> = {
    0: [1, 12],
    1: [0, 2],
    2: [3, 10],
    3: [4, 5],
    4: [1, 7],
    5: [3],
    6: [7, 8],
    7: [4, 5, 6, 12],
    8: [0],
    9: [5, 10],
    10: [2, 9, 12],
    12: [0, 10],
  };
  const EXITS_REVERSED: Record<number, number[]> = { ...EXITS_FORWARD, 1: [0, 4], 2: [1, 10], 3: [2, 5], 4: [3, 7] };

  it.each(Object.entries(EXITS_FORWARD))("leaves tile %s towards %j while the carousel turns 1 → 2", (id, exits) => {
    expect(sorted(getNeighbors(board, Number(id)))).toEqual(exits);
  });

  it.each(Object.entries(EXITS_REVERSED))("leaves tile %s towards %j once the carousel is reversed", (id, exits) => {
    expect(sorted(getNeighbors(reversed, Number(id)))).toEqual(exits);
  });

  it("lets Corrupteur ride the carousel and the ghost train backwards", () => {
    expect(sorted(getNeighbors(board, 1, true))).toEqual([0, 2, 4]);
    expect(sorted(getNeighbors(board, 12, true))).toEqual([0, 7, 10]);
    expect(sorted(getNeighbors(board, 5, true))).toEqual([3, 7, 9]);
  });

  it("pays the start bonus only when entering the start from 8", () => {
    expect(earnsStartBonus(board, 8, [0])).toBe(true);
    expect(earnsStartBonus(board, 6, [8, 0])).toBe(true);
    expect(earnsStartBonus(board, 12, [0])).toBe(false);
    expect(earnsStartBonus(board, 1, [0])).toBe(false);
    expect(earnsStartBonus(board, 7, [12, 0])).toBe(false);
  });

  it("makes the loop six steps one way round and eight the other", () => {
    const loopLength = (current: Board) => {
      const toEight = getShortestPath(current, START_NODE_ID, 8, false);
      return (toEight?.length ?? 99) + 1;
    };
    expect(loopLength(reversed)).toBe(6);
    expect(loopLength(board)).toBe(8);
  });

  it("puts the first Cup on the farthest tile: seven steps at first, five once the carousel flips", () => {
    expect(getShortestPath(board, START_NODE_ID, 8, false)).toHaveLength(7);
    expect(getShortestPath(reversed, START_NODE_ID, 8, false)).toHaveLength(5);
    const distances = board.normalNodeIds.map(
      (nodeId) => getShortestPath(board, START_NODE_ID, nodeId, false)?.length ?? 0,
    );
    expect(Math.max(...distances)).toBe(7);
  });
});

describe("Banquise board", () => {
  const board = resolveBoard("banquise");
  // Written down from the reworked layout: both halves mirror each other.
  const EXITS: Record<number, number[]> = {
    0: [1, 2],
    1: [0, 3, 5],
    2: [0, 7, 12],
    3: [1, 4, 6, 8],
    4: [0],
    5: [1, 6],
    6: [3, 5, 13],
    7: [2, 4, 8, 10],
    8: [3, 7, 9, 13],
    9: [8, 10],
    10: [7, 9, 12],
    12: [2, 10],
    13: [6, 8],
  };

  it.each(Object.entries(EXITS))("leaves tile %s towards %j", (id, exits) => {
    expect(sorted(getNeighbors(board, Number(id)))).toEqual(exits);
  });

  it("gives both sides of the board the same tiles", () => {
    const kinds = (ids: number[]) => ids.map((id) => board.nodes.find((node) => node.id === id)?.kind);
    expect(kinds([1, 5, 6, 13, 3])).toEqual(kinds([2, 12, 10, 9, 7]));
  });

  it("slides off the ice along any other real road", () => {
    expect(sorted(getSlideExits(board, 1, 3))).toEqual([4, 6, 8]);
    expect(sorted(getSlideExits(board, 6, 3))).toEqual([1, 4, 8]);
    expect(sorted(getSlideExits(board, 2, 7))).toEqual([4, 8, 10]);
    expect(getSlideExits(board, 1, 5)).toEqual([]);
  });

  it("follows the arrows of an ice tile: one road left means a forced slide", () => {
    const frozenMiddle = resolveBoard("banquise", false, 4);
    expect(getSlideExits(frozenMiddle, 3, 4)).toEqual([0]);
  });

  it("pays the start bonus only through 4 → 0, and never while the start is frozen", () => {
    expect(earnsStartBonus(board, 4, [0])).toBe(true);
    expect(earnsStartBonus(board, 1, [0])).toBe(false);
    expect(earnsStartBonus(resolveBoard("banquise", false, 0), 4, [0])).toBe(false);
  });

  it("lets the blizzard freeze any tile but ice, Hell and the Red Cup's, the start included", () => {
    const candidates = getBlizzardCandidates(board, [8]);
    expect(candidates).toContain(0);
    expect(candidates).not.toContain(3);
    expect(candidates).not.toContain(7);
    expect(candidates).not.toContain(8);
    expect(candidates).not.toContain(11);
  });
});

describe("map choice", () => {
  it("keeps a picked map and draws a random one from the list", () => {
    expect(resolveMapChoice("luna-park")).toBe("luna-park");
    expect(resolveMapChoice("random", () => 0)).toBe(MAP_ORDER[0]);
    expect(resolveMapChoice("random", () => 0.999)).toBe(MAP_ORDER[MAP_ORDER.length - 1]);
  });
});

const store = () => useGameStore.getState();

function startTable(mapId: MapId, passives: PassiveId[]): void {
  store().startGame(
    passives.map((_, index) => `Joueur ${index + 1}`),
    undefined,
    mapId,
  );
  useGameStore.setState((state) => ({
    players: state.players.map((player, index) => ({
      ...player,
      passiveId: passives[index],
      currency: getStartingCurrency(passives[index]),
    })),
  }));
}

function editPlayer(index: number, changes: Partial<Player>): void {
  useGameStore.setState((state) => ({
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  }));
}

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("a game at Luna Park", () => {
  it("starts on the chosen board with the first Cup on tile 8", () => {
    startTable("luna-park", ["built-like-a-tank", "goblin"]);
    expect(store().mapId).toBe("luna-park");
    expect(store().redCupNodeId).toBe(8);
    expect(store().carouselReversed).toBe(false);
    expect(store().log[0].text).toContain("Luna Park");
  });

  it("flips the carousel when a new Red Cup appears", () => {
    startTable("luna-park", ["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: 6 });
    store().movePlayer(8);

    expect(store().players[0].inventory.filter((entry) => entry.kind === "red-cup")).toHaveLength(1);
    expect(store().carouselReversed).toBe(true);
    expect(store().log.some((entry) => entry.text === "Le carrousel change de sens !")).toBe(true);
  });

  it("walks the carousel the new way after the flip", () => {
    startTable("luna-park", ["built-like-a-tank", "goblin"]);
    useGameStore.setState({ carouselReversed: true });
    editPlayer(0, { position: 1 });

    store().movePlayer(2);
    expect(store().players[0].position).toBe(1);
    store().movePlayer(4);
    expect(store().players[0].position).toBe(4);
  });

  it("never flips anything on the classic board", () => {
    startTable("classic", ["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: 10 });
    store().movePlayer(8);

    expect(store().redCupCycle).toBe(1);
    expect(store().carouselReversed).toBe(false);
  });

  it("opens Banquise with a third ice tile laid by the blizzard", () => {
    startTable("banquise", ["built-like-a-tank", "lambda"]);
    expect(store().iceTileNodeId).not.toBeNull();
    expect([3, 7, 8, 11]).not.toContain(store().iceTileNodeId);
  });

  it("slides at random off the ice and stops on the tile it reaches", () => {
    startTable("banquise", ["built-like-a-tank", "lambda"]);
    useGameStore.setState({ iceTileNodeId: null });
    editPlayer(0, { position: 1 });
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    store().movePlayer(3);

    const movement = store().lastMovement;
    expect(movement?.path[0]).toBe(3);
    expect(movement?.slideStart).toBe(1);
    expect([4, 6]).toContain(store().players[0].position);
  });

  it("freezes a player sliding towards the Red Cup, then finishes the slide on their next turn", () => {
    startTable("banquise", ["built-like-a-tank", "lambda"]);
    const exits = getSlideExits(resolveBoard("banquise"), 1, 3);
    useGameStore.setState({ iceTileNodeId: null, redCupNodeId: exits[0] });
    editPlayer(0, { position: 1 });
    // 0 picks the first exit, where the Cup waits, and is under the 80 % chance of the ice hitting.
    vi.spyOn(Math, "random").mockReturnValue(0);
    store().movePlayer(3);

    expect(store().players[0].position).toBe(3);
    expect(store().frozenSlides).toEqual([{ playerId: store().players[0].id, from: 3, to: exits[0] }]);
    expect(store().lastIceFall).toEqual(expect.objectContaining({ hit: true, to: exits[0] }));
    expect(store().turnStage).toBe("turn-end");

    store().endTurn();
    useGameStore.setState({ turnStage: "turn-end" });
    store().endTurn();

    const player = store().players[0];
    expect(player.position).toBe(exits[0]);
    expect(player.inventory.some((entry) => entry.kind === "red-cup")).toBe(true);
    expect(store().frozenSlides).toEqual([]);
    expect(store().lastMovement).toEqual(expect.objectContaining({ thawed: true, from: 3, path: [exits[0]] }));
  });

  it("lets a sliding player through when the falling ice misses", () => {
    startTable("banquise", ["built-like-a-tank", "lambda"]);
    const exits = getSlideExits(resolveBoard("banquise"), 1, 3);
    useGameStore.setState({ iceTileNodeId: null, redCupNodeId: exits[0] });
    editPlayer(0, { position: 1 });
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.95).mockReturnValue(0.5);
    store().movePlayer(3);

    expect(store().lastIceFall).toEqual(expect.objectContaining({ hit: false }));
    expect(store().frozenSlides).toEqual([]);
    expect(store().players[0].inventory.some((entry) => entry.kind === "red-cup")).toBe(true);
  });

  it("moves the temporary ice with a blizzard every two rounds", () => {
    startTable("banquise", ["built-like-a-tank", "lambda"]);
    const opening = store().iceTileNodeId;
    for (let turn = 0; store().round < 3 && turn < 10; turn += 1) {
      useGameStore.setState({ turnStage: "turn-end" });
      store().endTurn();
    }
    expect(store().round).toBe(3);
    expect(store().lastBlizzard).toEqual(expect.objectContaining({ from: opening }));
    expect(store().iceTileNodeId).not.toBe(opening);
  });

  it("restores a save from before the map choice on the classic board", () => {
    startTable("classic", ["built-like-a-tank", "goblin"]);
    const { mapId: _map, carouselReversed: _carousel, ...legacy } = pickGameState(store());
    const upgraded = migrateGameSave(legacy, 6);

    expect(upgraded.phase).toBe("playing");
    expect(upgraded.mapId).toBe("classic");
    expect(upgraded.carouselReversed).toBe(false);
  });
});
