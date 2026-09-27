import { afterEach, describe, expect, it, vi } from "vitest";
import { earnsStartBonus, getNeighbors, getShortestPath, resolveBoard, type Board } from "../board";
import { migrateGameSave, pickGameState } from "../game-save";
import { useGameStore } from "../store";
import type { MapId, PassiveId, Player } from "../types";
import { HELL_NODE_ID, START_NODE_ID } from "../types";
import { MAP_ORDER, getBoardMap, resolveMapChoice } from "./map-registry";

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
    3: [4, 8],
    4: [1, 7],
    5: [0],
    6: [5, 7],
    7: [4, 6, 8, 12],
    8: [3],
    9: [8, 10],
    10: [2, 9, 12],
    12: [0, 10],
  };
  const EXITS_REVERSED: Record<number, number[]> = { ...EXITS_FORWARD, 1: [0, 4], 2: [1, 10], 3: [2, 8], 4: [3, 7] };

  it.each(Object.entries(EXITS_FORWARD))("leaves tile %s towards %j while the carousel turns 1 → 2", (id, exits) => {
    expect(sorted(getNeighbors(board, Number(id)))).toEqual(exits);
  });

  it.each(Object.entries(EXITS_REVERSED))("leaves tile %s towards %j once the carousel is reversed", (id, exits) => {
    expect(sorted(getNeighbors(reversed, Number(id)))).toEqual(exits);
  });

  it("lets Délinquant ride the carousel and the ghost train backwards", () => {
    expect(sorted(getNeighbors(board, 1, true))).toEqual([0, 2, 4]);
    expect(sorted(getNeighbors(board, 12, true))).toEqual([0, 7, 10]);
    expect(sorted(getNeighbors(board, 8, true))).toEqual([3, 7, 9]);
  });

  it("pays the start bonus only when entering the start from 5", () => {
    expect(earnsStartBonus(board, 5, [0])).toBe(true);
    expect(earnsStartBonus(board, 6, [5, 0])).toBe(true);
    expect(earnsStartBonus(board, 12, [0])).toBe(false);
    expect(earnsStartBonus(board, 1, [0])).toBe(false);
    expect(earnsStartBonus(board, 7, [12, 0])).toBe(false);
  });

  it("makes the loop six steps one way round and eight the other", () => {
    const loopLength = (current: Board) => {
      const toFive = getShortestPath(current, START_NODE_ID, 5, false);
      return (toFive?.length ?? 99) + 1;
    };
    expect(loopLength(reversed)).toBe(6);
    expect(loopLength(board)).toBe(8);
  });

  it("keeps the first Cup four steps away both ways round", () => {
    expect(getShortestPath(board, START_NODE_ID, 8, false)).toHaveLength(4);
    expect(getShortestPath(reversed, START_NODE_ID, 8, false)).toHaveLength(4);
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
    players: state.players.map((player, index) => ({ ...player, passiveId: passives[index] })),
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
    startTable("luna-park", ["built-like-a-tank", "troll"]);
    expect(store().mapId).toBe("luna-park");
    expect(store().redCupNodeId).toBe(8);
    expect(store().carouselReversed).toBe(false);
    expect(store().log[0].text).toContain("Luna Park");
  });

  it("flips the carousel when a new Red Cup appears", () => {
    startTable("luna-park", ["built-like-a-tank", "troll"]);
    editPlayer(0, { position: 3 });
    store().movePlayer(8);

    expect(store().players[0].inventory.filter((entry) => entry.kind === "red-cup")).toHaveLength(1);
    expect(store().carouselReversed).toBe(true);
    expect(store().log.some((entry) => entry.text === "Le carrousel change de sens !")).toBe(true);
  });

  it("walks the carousel the new way after the flip", () => {
    startTable("luna-park", ["built-like-a-tank", "troll"]);
    useGameStore.setState({ carouselReversed: true });
    editPlayer(0, { position: 1 });

    store().movePlayer(2);
    expect(store().players[0].position).toBe(1);
    store().movePlayer(4);
    expect(store().players[0].position).toBe(4);
  });

  it("never flips anything on the classic board", () => {
    startTable("classic", ["built-like-a-tank", "troll"]);
    editPlayer(0, { position: 10 });
    store().movePlayer(8);

    expect(store().redCupCycle).toBe(1);
    expect(store().carouselReversed).toBe(false);
  });

  it("restores a save from before the map choice on the classic board", () => {
    startTable("classic", ["built-like-a-tank", "troll"]);
    const { mapId: _map, carouselReversed: _carousel, ...legacy } = pickGameState(store());
    const upgraded = migrateGameSave(legacy, 6);

    expect(upgraded.phase).toBe("playing");
    expect(upgraded.mapId).toBe("classic");
    expect(upgraded.carouselReversed).toBe(false);
  });
});
