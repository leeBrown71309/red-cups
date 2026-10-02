import { afterEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "./store";
import type { PassiveId, Player } from "./types";
import { CORRUPTER_COST, MUD_OWNER_REWARD, MUD_PENALTY, STARTING_CURRENCY } from "./types";

/** Patch 0.1.1: Corrupteur, Boue and the wheel of fortune (New Cup, New Me: see passive-rework.test.ts). */

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

describe("Corrupteur", () => {
  it(`pays ${CORRUPTER_COST} coins per ignored arrow`, () => {
    startTable(["corrupter", "lambda"]);
    editPlayer(0, { position: 3 });
    store().movePlayer(4, true);

    expect(store().players[0].position).toBe(4);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY - CORRUPTER_COST);
  });

  it("cannot break out of the start towards the first Cup on the first round", () => {
    startTable(["corrupter", "lambda"]);
    store().movePlayer(8, true);

    expect(store().players[0].position).toBe(0);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY);
    expect(store().turnStage).toBe("move");
  });

  it("may leave the start against its arrow from the second round on", () => {
    startTable(["corrupter", "lambda"]);
    useGameStore.setState({ round: 2 });
    store().movePlayer(8, true);

    expect(store().players[0].position).toBe(8);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY - CORRUPTER_COST);
  });

  it("can still ignore arrows elsewhere on the first round", () => {
    startTable(["corrupter", "lambda"]);
    editPlayer(0, { position: 9 });
    store().movePlayer(5, true);
    expect(store().players[0].position).toBe(5);
  });
});

describe("Boue", () => {
  it("is laid before the turn's move", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { inventory: [{ id: "mud-1", kind: "item", itemId: "mud" }] });
    store().useItem("mud-1");

    expect(store().mudTraps).toEqual([expect.objectContaining({ nodeId: 0, ownerId: store().players[0].id })]);
    expect(store().turnStage).toBe("move");
    store().movePlayer(2);
    expect(store().players[0].position).toBe(2);
    expect(store().turnStage).toBe("turn-end");
  });

  it("can be laid only once per turn", () => {
    startTable(["built-like-a-tank", "goblin"]);
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
    startTable(["built-like-a-tank", "goblin"]);
    const ownerId = store().players[1].id;
    useGameStore.setState({ mudTraps: [{ id: "trap", nodeId: 2, ownerId }] });
    store().movePlayer(2);

    expect(store().players[0].currency).toBe(STARTING_CURRENCY - MUD_PENALTY);
    expect(store().players[1].currency).toBe(STARTING_CURRENCY + MUD_OWNER_REWARD);
    expect(store().mudTraps).toEqual([]);
  });

  it("pays nobody when its owner steps in it", () => {
    startTable(["built-like-a-tank", "goblin"]);
    const ownerId = store().players[0].id;
    useGameStore.setState({ mudTraps: [{ id: "trap", nodeId: 2, ownerId }] });
    store().movePlayer(2);

    expect(store().players[0].currency).toBe(STARTING_CURRENCY - MUD_PENALTY);
    expect(store().log.some((entry) => entry.text.includes("grâce à sa Boue"))).toBe(false);
  });
});

describe("wheel of fortune", () => {
  it("can send its spinner to the wheel of misfortune", () => {
    startTable(["built-like-a-tank", "goblin"]);
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
