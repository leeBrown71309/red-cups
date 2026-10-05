import { afterEach, describe, expect, it } from "vitest";
import { withPassives } from "./forced-passives";
import { getEnergyCapacity } from "./energy";
import { getHellTurnLimit } from "./passive-rules";
import { getPriceFor } from "./rules";
import { useGameStore } from "./store";
import type { InventoryEntry, PassiveId, Player } from "./types";
import { GOBLIN_THEFT, HELL_NODE_ID, STARTING_CURRENCY } from "./types";

/** The passifs of patch 0.1.6 that change prices, energy, Hell and coins. */

function startTable(cards: (PassiveId | PassiveId[])[]): void {
  useGameStore.getState().startGame(cards.map((_, index) => `Joueur ${index + 1}`));
  useGameStore.setState((state) => withPassives(state, cards));
}

function editPlayer(index: number, changes: Partial<Player>): void {
  useGameStore.setState((state) => ({
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  }));
}

const store = () => useGameStore.getState();
const cup: InventoryEntry = { id: "cup-1", kind: "red-cup" };

afterEach(() => store().resetGame());

describe("Goblin", () => {
  it("takes 150 coins from every other player at a new Red Cup, the first one included", () => {
    startTable(["goblin", "lambda", "lambda"]);
    useGameStore.setState({ redCupNodeId: 2 });
    store().movePlayer(2);
    const [goblin, second, third] = store().players;
    expect(goblin.currency).toBe(STARTING_CURRENCY + 2 * GOBLIN_THEFT);
    expect(second.currency).toBe(STARTING_CURRENCY - GOBLIN_THEFT);
    expect(third.currency).toBe(STARTING_CURRENCY - GOBLIN_THEFT);
  });
});

describe("Dernier de la classe", () => {
  it("gains a point of energy and a tenth off while strictly behind every rival", () => {
    startTable(["last-in-class", "lambda", "lambda"]);
    const [me] = store().players;
    // Everybody at zero Cups: tied, not behind.
    expect(getEnergyCapacity(me, store())).toBe(3);
    expect(getPriceFor(store(), "helmet", me)).toBe(200);

    editPlayer(1, { inventory: [cup] });
    // One rival still has none: not behind everybody.
    expect(getEnergyCapacity(store().players[0], store())).toBe(3);
    editPlayer(2, { inventory: [{ ...cup, id: "cup-2" }] });
    expect(getEnergyCapacity(store().players[0], store())).toBe(4);
    expect(getPriceFor(store(), "helmet", store().players[0])).toBe(180);
    expect(getPriceFor(store(), "tomato", store().players[0])).toBe(10);
    // The others pay the full price.
    expect(getPriceFor(store(), "helmet", store().players[1])).toBe(200);
  });

  it("ignores rivals who never keep a Cup", () => {
    startTable(["last-in-class", "greedy", "lambda"]);
    editPlayer(2, { inventory: [cup] });
    expect(getEnergyCapacity(store().players[0], store())).toBe(4);
  });
});

describe("Habitué de l'Enfer", () => {
  it("is paid 150 coins for each descent and serves three turns instead of five", () => {
    startTable(["hell-regular", "lambda"]);
    expect(getHellTurnLimit(store().players[0])).toBe(3);
    expect(getHellTurnLimit(store().players[1])).toBe(5);

    editPlayer(1, { inventory: [{ id: "purple", kind: "item", itemId: "hollow-purple" }] });
    useGameStore.setState({ activePlayerIndex: 1, turnStage: "move", energyLeft: 3 });
    store().useItem("purple", store().players[0].id);
    expect(store().players[0]).toMatchObject({ position: HELL_NODE_ID, currency: STARTING_CURRENCY + 150 });
  });

  it("is let out after three turns, with the toll", () => {
    startTable([["hell-regular"], "lambda"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: 3 });
    useGameStore.setState({ turnStage: "turn-end" });
    store().endTurn();
    expect(store().players[0].position).toBe(0);
  });
});

describe("Piégeur", () => {
  it("lays mud for 100 coins, one patch at a time", () => {
    startTable(["trapper", "lambda"]);
    expect(getPriceFor(store(), "mud", store().players[0])).toBe(100);
    editPlayer(0, {
      inventory: [
        { id: "mud-1", kind: "item", itemId: "mud" },
        { id: "mud-2", kind: "item", itemId: "mud" },
      ],
    });
    store().useItem("mud-1");
    expect(store().mudTraps).toHaveLength(1);
    // Next turn of theirs, with the first patch still waiting: refused.
    useGameStore.setState({ mudPlacedThisTurn: false, energyLeft: 3 });
    store().useItem("mud-2");
    expect(store().mudTraps).toHaveLength(1);
  });
});
