import { afterEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "./store";
import type { PassiveId, Player } from "./types";
import { DELINQUENT_COST, MUD_OWNER_REWARD, MUD_PENALTY, STARTING_CURRENCY } from "./types";

/** Patch 0.1.1: Délinquant, Boue, New Cup, New Me and the wheel of fortune. */

function startTable(passives: PassiveId[]): void {
  useGameStore.getState().startGame(passives.map((_, index) => `Joueur ${index + 1}`));
  useGameStore.setState((state) => ({
    players: state.players.map((player, index) => ({ ...player, passiveId: passives[index] })),
  }));
}

function editPlayer(index: number, changes: Partial<Player>): void {
  useGameStore.setState((state) => ({
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  }));
}

const store = () => useGameStore.getState();

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Délinquant", () => {
  it(`pays ${DELINQUENT_COST} coins per ignored arrow`, () => {
    startTable(["delinquent", "penta"]);
    editPlayer(0, { position: 3 });
    store().movePlayer(4, true);

    expect(store().players[0].position).toBe(4);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY - DELINQUENT_COST);
  });

  it("cannot break out of the start towards the first Cup on the first round", () => {
    startTable(["delinquent", "penta"]);
    store().movePlayer(8, true);

    expect(store().players[0].position).toBe(0);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY);
    expect(store().turnStage).toBe("move");
  });

  it("may leave the start against its arrow from the second round on", () => {
    startTable(["delinquent", "penta"]);
    useGameStore.setState({ round: 2 });
    store().movePlayer(8, true);

    expect(store().players[0].position).toBe(8);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY - DELINQUENT_COST);
  });

  it("can still ignore arrows elsewhere on the first round", () => {
    startTable(["delinquent", "penta"]);
    editPlayer(0, { position: 9 });
    store().movePlayer(5, true);
    expect(store().players[0].position).toBe(5);
  });
});

describe("Boue", () => {
  it("is laid before the turn's move", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { inventory: [{ id: "mud-1", kind: "item", itemId: "mud" }] });
    store().useItem("mud-1");

    expect(store().mudTraps).toEqual([expect.objectContaining({ nodeId: 0, ownerId: store().players[0].id })]);
    expect(store().turnStage).toBe("move");
    store().movePlayer(2);
    expect(store().players[0].position).toBe(2);
    expect(store().turnStage).toBe("turn-end");
  });

  it("can be laid only once per turn", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, {
      inventory: [
        { id: "mud-1", kind: "item", itemId: "mud" },
        { id: "mud-2", kind: "item", itemId: "mud" },
      ],
    });
    store().useItem("mud-1");
    store().useItem("mud-2");

    expect(store().mudTraps).toHaveLength(1);
    expect(store().players[0].inventory).toHaveLength(1);

    store().movePlayer(2);
    store().endTurn();
    expect(store().mudPlacedThisTurn).toBe(false);
  });

  it(`pays ${MUD_OWNER_REWARD} coins to whoever laid it when somebody else steps in`, () => {
    startTable(["built-like-a-tank", "troll"]);
    const ownerId = store().players[1].id;
    useGameStore.setState({ mudTraps: [{ id: "trap", nodeId: 2, ownerId }] });
    store().movePlayer(2);

    expect(store().players[0].currency).toBe(STARTING_CURRENCY - MUD_PENALTY);
    expect(store().players[1].currency).toBe(STARTING_CURRENCY + MUD_OWNER_REWARD);
    expect(store().mudTraps).toEqual([]);
  });

  it("pays nobody when its owner steps in it", () => {
    startTable(["built-like-a-tank", "troll"]);
    const ownerId = store().players[0].id;
    useGameStore.setState({ mudTraps: [{ id: "trap", nodeId: 2, ownerId }] });
    store().movePlayer(2);

    expect(store().players[0].currency).toBe(STARTING_CURRENCY - MUD_PENALTY);
    expect(store().log.some((entry) => entry.text.includes("grâce à sa Boue"))).toBe(false);
  });
});

describe("New Cup, New Me", () => {
  /** Player 1 collects the Cup on tile 8 (a shop) while player 2 holds New Cup, New Me. */
  function collectCupWithRepositioner(repositionerIndex: number): void {
    const passives: PassiveId[] = ["built-like-a-tank", "troll"];
    passives[repositionerIndex] = "new-cup-new-me";
    startTable(passives);
    editPlayer(0, { position: 10 });
    store().movePlayer(8);
    expect(store().turnStage).toBe("reposition");
  }

  it("spins no wheel on the tile chosen before the Cup appears", () => {
    collectCupWithRepositioner(1);
    store().repositionBeforeCup(4);

    expect(store().players[1].position).toBe(4);
    expect(store().pendingTileWheels).toEqual([]);
    // The collector, still on the shop tile, keeps the shop they walked to.
    expect(store().turnStage).toBe("shop");
  });

  it("does not open the shop of the tile the collector repositions onto", () => {
    collectCupWithRepositioner(0);
    store().repositionBeforeCup(3);

    expect(store().players[0].position).toBe(3);
    expect(store().turnStage).toBe("turn-end");
  });

  it("keeps the shop when the collector stays on their tile", () => {
    collectCupWithRepositioner(0);
    store().repositionBeforeCup(8);
    expect(store().turnStage).toBe("shop");
  });

  it("drops the wheel of a colored tile left behind", () => {
    startTable(["new-cup-new-me", "troll"]);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    useGameStore.setState({ redCupNodeId: 4 });
    store().movePlayer(4);
    expect(store().turnStage).toBe("reposition");

    store().repositionBeforeCup(2);
    expect(store().pendingTileWheels).toEqual([]);
    expect(store().turnStage).toBe("turn-end");
  });
});

describe("wheel of fortune", () => {
  it("can send its spinner to the wheel of misfortune", () => {
    startTable(["built-like-a-tank", "troll"]);
    const playerId = store().players[0].id;
    useGameStore.setState({
      turnStage: "wheel-result",
      pendingWheel: {
        id: "wheel-1",
        wheelId: "fortune",
        playerId,
        result: { id: "spin-misfortune", label: "Tourne la roue du malheur" },
        resumeStage: "turn-end",
      },
    });
    store().resolveWheel();

    expect(store().pendingWheel).toEqual(
      expect.objectContaining({ wheelId: "misfortune", playerId, origin: "chain", resumeStage: "turn-end" }),
    );
  });
});
