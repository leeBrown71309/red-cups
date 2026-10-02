import { afterEach, describe, expect, it, vi } from "vitest";
import { getSimplePaths, type Board } from "./board";
import { canAddItem, countItemUnits, getItemPrice } from "./rules";
import { getStartingCurrency } from "./passive-rules";
import { useGameStore } from "./store";
import type { InventoryEntry, ItemId, PassiveId, Player } from "./types";
import { BASE_ENERGY, GREEDY_CUP_REWARD, GREEDY_GOAL, GREEDY_STUN_THEFT, STARTING_CURRENCY } from "./types";

/**
 * The simple passives of patch 0.1.4 on the classic board. Roads (arrows
 * aside): 0–2, 0–4, 0–8, 1–6, 1–7, 1–10, 2–5, 3–4, 3–6, 3–7, 4–7, 4–9, 5–9,
 * 8–10; the start leaves only towards 2 and 4.
 */

function startTable(passives: PassiveId[]): void {
  useGameStore.getState().startGame(passives.map((_, index) => `Joueur ${index + 1}`));
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

const store = () => useGameStore.getState();
const playerId = (index: number) => store().players[index].id;
const item = (id: string, itemId: ItemId): InventoryEntry => ({ id, kind: "item", itemId });
const tomatoes = (id: string, count: number): InventoryEntry => ({ id, kind: "item", itemId: "tomato", count });

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Nepo Baby, eShop and Red Bull", () => {
  it("start with their own balance", () => {
    expect(getStartingCurrency("nepo-baby")).toBe(3_000);
    expect(getStartingCurrency("eshop")).toBe(1_000);
    expect(getStartingCurrency("lambda")).toBe(STARTING_CURRENCY);
  });

  it("gives Red Bull four points of energy on its turn", () => {
    startTable(["lambda", "red-bull"]);
    useGameStore.setState({ turnStage: "turn-end" });
    store().endTurn();
    expect(store()).toMatchObject({ activePlayerIndex: 1, energyLeft: BASE_ENERGY + 1 });
  });

  it("opens eShop's shop wherever its move ends", () => {
    startTable(["eshop", "lambda"]);
    store().movePlayer(2);
    expect(store().turnStage).toBe("shop");
    store().buyItem("tomato");
    expect(countItemUnits(store().players[0], "tomato")).toBe(1);
  });
});

describe("Tomato Enjoyer", () => {
  it("holds a stack of five in every slot", () => {
    startTable(["tomato-enjoyer", "lambda"]);
    const enjoyer: Player = { ...store().players[0], inventory: [1, 2, 3].map((n) => tomatoes(`t${n}`, 5)) };
    expect(canAddItem(enjoyer, "tomato")).toBe(true);
    expect(canAddItem({ ...enjoyer, passiveId: "lambda" }, "tomato")).toBe(false);
  });

  it("knocks out five times in a hundred, and earns 5 coins per Tomate received", () => {
    startTable(["tomato-enjoyer", "lambda"]);
    // 0.03: below the enjoyer's 5 %, above everyone else's 2 %.
    vi.spyOn(Math, "random").mockReturnValue(0.03);
    editPlayer(0, { inventory: [tomatoes("mine", 1)] });
    store().useItem("mine", playerId(1));
    expect(store().players[1].skippedTurns).toBe(1);

    startTable(["lambda", "tomato-enjoyer"]);
    vi.spyOn(Math, "random").mockReturnValue(0.03);
    editPlayer(0, { inventory: [tomatoes("theirs", 3)] });
    store().useItem("theirs", playerId(1), 3);
    expect(store().players[1]).toMatchObject({ skippedTurns: 0, currency: STARTING_CURRENCY + 15 });
  });
});

describe("Roller", () => {
  it("throws a die, then walks exactly that far without coming back to a tile", () => {
    startTable(["roller", "lambda"]);
    editPlayer(0, { inventory: [item("finger", "middle-finger")] });
    // 0.4 throws a 3.
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    store().rollDice();
    expect(store().diceRoll).toBe(3);
    // The die is thrown: only the move is left.
    const rolled = store();
    store().useItem("finger", playerId(1));
    expect(store()).toBe(rolled);
    store().movePlayer(2);
    expect(store()).toBe(rolled);

    store().movePlayer(9);
    expect(store().players[0].position).toBe(9);
    expect(store().lastMovement?.path).toEqual([2, 5, 9]);
    expect(store()).toMatchObject({ diceRoll: null, energyLeft: 0 });
  });

  it("goes as far as it can when no road is that long", () => {
    const deadEnd = {
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
      ],
    } as unknown as Board;
    expect(getSimplePaths(deadEnd, 0, 6)).toEqual([[1, 2]]);
  });

  it("has no use for the Botte: neither prepared nor bought", () => {
    startTable(["roller", "lambda"]);
    editPlayer(0, { inventory: [item("boot", "boot")] });
    const state = store();
    store().prepareBoot("boot");
    expect(store()).toBe(state);

    editPlayer(0, { position: 3, inventory: [] });
    useGameStore.setState({ turnStage: "shop" });
    store().buyItem("boot");
    expect(store().players[0].inventory).toEqual([]);
  });
});

describe("Cupide", () => {
  it("turns a Red Cup into 1 000 coins, and the next one appears as usual", () => {
    startTable(["greedy", "lambda"]);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    useGameStore.setState({ redCupNodeId: 2 });
    store().movePlayer(2);
    expect(store().players[0]).toMatchObject({ inventory: [], currency: STARTING_CURRENCY + GREEDY_CUP_REWARD });
    expect(store().redCupCycle).toBe(1);
    expect(store().redCupNodeId).not.toBe(2);
  });

  it(`wins as soon as its balance reaches ${GREEDY_GOAL}`, () => {
    startTable(["greedy", "lambda"]);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    editPlayer(0, { currency: GREEDY_GOAL - GREEDY_CUP_REWARD });
    useGameStore.setState({ redCupNodeId: 2 });
    store().movePlayer(2);
    expect(store()).toMatchObject({ phase: "finished", winnerId: playerId(0), winReason: "greedy" });
  });

  it(`takes ${GREEDY_STUN_THEFT} coins from a knocked-out player on the tile it walks onto`, () => {
    startTable(["greedy", "lambda"]);
    editPlayer(1, { position: 2, skippedTurns: 1 });
    store().movePlayer(2);
    expect(store().players[1].currency).toBe(STARTING_CURRENCY - GREEDY_STUN_THEFT);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY + GREEDY_STUN_THEFT);
  });

  it("buys the mud for 100 and earns 200 when somebody steps in it", () => {
    startTable(["greedy", "lambda"]);
    expect(getItemPrice("mud", 100, store().players[0])).toBe(100);
    expect(getItemPrice("mud", 100, store().players[1])).toBe(200);

    useGameStore.setState({ activePlayerIndex: 1, mudTraps: [{ id: "trap", nodeId: 2, ownerId: playerId(0) }] });
    store().movePlayer(2);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY + 200);
  });

  it("gets back what its Ndoye makes the target lose", () => {
    startTable(["greedy", "lambda"]);
    editPlayer(0, { inventory: [item("ndoye", "ndoye")] });
    store().useItem("ndoye", playerId(1));
    useGameStore.setState((state) => ({
      pendingWheel: state.pendingWheel && {
        ...state.pendingWheel,
        result: { id: "lose-300", label: "−300", amount: 300 },
      },
    }));
    store().resolveWheel();
    expect(store().players[1].currency).toBe(STARTING_CURRENCY - 300);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY + 300);
  });
});
