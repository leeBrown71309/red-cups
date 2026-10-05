import { afterEach, describe, expect, it, vi } from "vitest";
import { withPassives } from "./forced-passives";
import { canPlayerSendAction } from "./action-permissions";
import { countItemUnits, getDecidingPlayer } from "./rules";
import { getShopItems, getTheftPenalty, getTheftRisk } from "./passive-rules";
import { useGameStore } from "./store";
import type { InventoryEntry, ItemId, PassiveId, Player } from "./types";
import { HELL_NODE_ID, MADE_IN_HEAVEN_CUP_NODE_ID, MUD_PENALTY, STARTING_CURRENCY, START_NODE_ID } from "./types";

/**
 * Double or nothing, Chance aveugle with Made In Heaven, and the Voleur on the
 * classic board. Tile 2 neighbours the start and spins no wheel; tile 3 is a
 * shop.
 */

function startTable(passives: PassiveId[]): void {
  useGameStore.getState().startGame(passives.map((_, index) => `Joueur ${index + 1}`));
  useGameStore.setState((state) => withPassives(state, passives));
}

function editPlayer(index: number, changes: Partial<Player>): void {
  useGameStore.setState((state) => ({
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  }));
}

const store = () => useGameStore.getState();
const playerId = (index: number) => store().players[index].id;
const item = (id: string, itemId: ItemId, count?: number): InventoryEntry => ({
  id,
  kind: "item",
  itemId,
  ...(count ? { count } : {}),
});
/** A mud trap on tile 2, laid by the player seated at `ownerIndex`. */
const mudOnTwo = (ownerIndex: number) =>
  useGameStore.setState({ mudTraps: [{ id: "trap", nodeId: 2, ownerId: playerId(ownerIndex) }] });

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Double or nothing", () => {
  it("offers a loss once the walk is over, then doubles it or wipes it out", () => {
    startTable(["double-or-nothing", "lambda"]);
    mudOnTwo(1);
    store().movePlayer(2);
    expect(store()).toMatchObject({
      turnStage: "gamble",
      gambleResumeStage: "turn-end",
      pendingGambles: [{ playerId: playerId(0), amount: -MUD_PENALTY }],
    });

    // Below one half the amount happens again.
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    store().resolveGamble(true);
    expect(store()).toMatchObject({ turnStage: "turn-end", pendingGambles: [] });
    expect(store().players[0].currency).toBe(STARTING_CURRENCY - 2 * MUD_PENALTY);

    startTable(["double-or-nothing", "lambda"]);
    mudOnTwo(1);
    store().movePlayer(2);
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    store().resolveGamble(true);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY);
  });

  it("keeps the amount when the holder declines", () => {
    startTable(["double-or-nothing", "lambda"]);
    mudOnTwo(1);
    store().movePlayer(2);
    store().resolveGamble(false);
    expect(store()).toMatchObject({ turnStage: "turn-end", pendingGambles: [] });
    expect(store().players[0].currency).toBe(STARTING_CURRENCY - MUD_PENALTY);
  });

  it("is decided by its holder, even on another player's turn", () => {
    startTable(["lambda", "double-or-nothing"]);
    mudOnTwo(1);
    store().movePlayer(2);
    expect(store().turnStage).toBe("gamble");
    expect(getDecidingPlayer(store())?.id).toBe(playerId(1));
    expect(canPlayerSendAction(store(), { type: "resolveGamble", accept: true }, playerId(0))).toBe(false);
    expect(canPlayerSendAction(store(), { type: "resolveGamble", accept: true }, playerId(1))).toBe(true);
  });

  it("never stakes a purchase", () => {
    startTable(["double-or-nothing", "lambda"]);
    editPlayer(0, { position: 3 });
    useGameStore.setState({ turnStage: "shop" });
    store().buyItem("tomato");
    expect(store()).toMatchObject({ turnStage: "shop", pendingGambles: [] });
  });
});

describe("Chance aveugle", () => {
  it("is never a target, and Draven spares them", () => {
    startTable(["lambda", "blind-luck"]);
    editPlayer(0, { inventory: [item("purple", "hollow-purple"), item("draven", "draven")] });
    const state = store();
    store().useItem("purple", playerId(1));
    expect(store()).toBe(state);

    store().useItem("draven");
    expect(store().players.map((player) => player.position)).toEqual([HELL_NODE_ID, START_NODE_ID]);
  });

  it("steps back out of the mud without losing a coin, and pays nobody", () => {
    startTable(["blind-luck", "lambda"]);
    mudOnTwo(1);
    store().movePlayer(2);
    expect(store().mudTraps).toEqual([]);
    expect(store().players[0]).toMatchObject({ position: START_NODE_ID, currency: STARTING_CURRENCY });
    expect(store().players[1].currency).toBe(STARTING_CURRENCY);
  });

  it("alone finds Made In Heaven at the shop, while the Red Cup stands away from tile 8", () => {
    startTable(["blind-luck", "lambda"]);
    expect(getShopItems(store().players[0])).toContain("made-in-heaven");
    expect(getShopItems(store().players[1])).not.toContain("made-in-heaven");

    editPlayer(0, { position: 3 });
    useGameStore.setState({ turnStage: "shop", redCupNodeId: MADE_IN_HEAVEN_CUP_NODE_ID });
    const state = store();
    store().buyItem("made-in-heaven");
    expect(store()).toBe(state);

    useGameStore.setState({ redCupNodeId: 5 });
    store().buyItem("made-in-heaven");
    expect(countItemUnits(store().players[0], "made-in-heaven")).toBe(1);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY - 1_300);
    // One at a time.
    editPlayer(0, { currency: 5_000 });
    store().buyItem("made-in-heaven");
    expect(countItemUnits(store().players[0], "made-in-heaven")).toBe(1);
  });

  it("uses Made In Heaven: everybody else back on the start, Hell included, and the Cup on tile 8", () => {
    startTable(["blind-luck", "lambda", "lambda"]);
    editPlayer(0, { position: 2, inventory: [item("heaven", "made-in-heaven")] });
    editPlayer(1, { position: 9 });
    editPlayer(2, { position: HELL_NODE_ID, hellTurns: 2 });
    useGameStore.setState({ redCupNodeId: 5 });
    store().useItem("heaven");
    expect(store().players.map((player) => player.position)).toEqual([2, START_NODE_ID, START_NODE_ID]);
    expect(store().players[2].hellTurns).toBe(0);
    // Nobody earns the start bonus on the way.
    expect(store().players.map((player) => player.currency)).toEqual([
      STARTING_CURRENCY,
      STARTING_CURRENCY,
      STARTING_CURRENCY,
    ]);
    expect(store()).toMatchObject({ redCupNodeId: MADE_IN_HEAVEN_CUP_NODE_ID, energyLeft: 0, turnStage: "move" });
  });

  it("melts Banquise's blizzard ice on tile 8 rather than set the Cup down on it", () => {
    useGameStore.getState().startGame(["Joueur 1", "Joueur 2"], undefined, "banquise");
    useGameStore.setState((state) => ({
      players: state.players.map((player, index) => ({
        ...player,
        passiveId: index === 0 ? "blind-luck" : "lambda",
        ...(index === 0 ? { inventory: [item("heaven", "made-in-heaven")] } : {}),
      })),
      redCupNodeId: 5,
      iceTileNodeId: MADE_IN_HEAVEN_CUP_NODE_ID,
    }));
    store().useItem("heaven");
    expect(store()).toMatchObject({ redCupNodeId: MADE_IN_HEAVEN_CUP_NODE_ID, iceTileNodeId: null });
  });
});

describe("Voleur", () => {
  function openShop(inventory: InventoryEntry[] = []): void {
    startTable(["thief", "lambda"]);
    editPlayer(0, { position: 3, inventory });
    useGameStore.setState({ turnStage: "shop" });
  }

  it("risks 1 % per 10 coins, and owes 1.5 times the price when caught", () => {
    expect(getTheftRisk(10)).toBe(0.01);
    expect(getTheftRisk(250)).toBeCloseTo(0.25);
    expect(getTheftPenalty(250)).toBe(375);
  });

  it("walks off with the item, once per visit", () => {
    openShop();
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    store().stealItem("rope");
    expect(countItemUnits(store().players[0], "rope")).toBe(1);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY);
    expect(store()).toMatchObject({ theftAttempted: true, turnStage: "shop" });

    const state = store();
    store().stealItem("ndoye");
    expect(store()).toBe(state);
    // Buying is still allowed.
    store().buyItem("ndoye");
    expect(countItemUnits(store().players[0], "ndoye")).toBe(1);
  });

  it("caught, goes to Hell and gives up the dearest items first", () => {
    openShop([item("tomatoes", "tomato", 3), item("ndoye", "ndoye"), item("rope", "rope")]);
    vi.spyOn(Math, "random").mockReturnValue(0);
    // 400 × 1.5 = 600: the Corde (400), then the Ndoye (250); the Tomates stay.
    store().stealItem("middle-finger");
    expect(store().players[0]).toMatchObject({ position: HELL_NODE_ID, currency: STARTING_CURRENCY });
    expect(store().players[0].inventory.map((entry) => entry.id)).toEqual(["tomatoes"]);
    expect(store().turnStage).toBe("turn-end");
  });

  it("caught with an empty bag, pays in coins", () => {
    openShop();
    vi.spyOn(Math, "random").mockReturnValue(0);
    store().stealItem("ndoye");
    expect(store().players[0]).toMatchObject({ position: HELL_NODE_ID, currency: STARTING_CURRENCY - 375 });
  });

  it("is the only one who may steal", () => {
    startTable(["lambda", "thief"]);
    editPlayer(0, { position: 3 });
    useGameStore.setState({ turnStage: "shop" });
    const state = store();
    store().stealItem("rope");
    expect(store()).toBe(state);
  });
});
