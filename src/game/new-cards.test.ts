import { afterEach, describe, expect, it, vi } from "vitest";
import { withPassives } from "./forced-passives";
import { getEnergyCapacity } from "./energy";
import { getActionActorIds } from "./action-permissions";
import { getDefaultAction } from "./clock-defaults";
import { startDuel, startWheel } from "./game-effects";
import { getHellTurnLimit } from "./passive-rules";
import { getPriceFor } from "./rules";
import { getResalePrice } from "./shopping";
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

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

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

describe("the wheel cards", () => {
  /** The wedge picked by a draw: the wheel has eight wedges of equal weight. */
  const draw = (wedge: number) => (wedge + 0.5) / 8;

  it("Main verte spins two wheels of fortune side by side and lets the player keep one result", () => {
    startTable(["green-hand", "lambda"]);
    // Wedge 0 is +100 pièces, wedge 7 « Va au Départ ».
    vi.spyOn(Math, "random").mockReturnValueOnce(draw(0)).mockReturnValueOnce(draw(7));
    useGameStore.setState(startWheel(store(), "fortune", store().players[0].id, "move"));
    expect(store().pendingWheel?.choices?.map((result) => result.id)).toEqual(["gain-100", "go-to-start"]);
    // Whoever lets the clock run out keeps the better of the two.
    expect(store().pendingWheel?.result.id).toBe("go-to-start");

    expect(getActionActorIds(store(), { type: "pickWheelResult", index: 0 })).toEqual([store().players[0].id]);
    store().pickWheelResult(0);
    expect(store().pendingWheel).toMatchObject({ chosen: 0, result: { id: "gain-100" } });
    store().resolveWheel();
    expect(store().players[0].currency).toBe(STARTING_CURRENCY + 100);
  });

  it("Main rouge offers two misfortunes, and nobody else spins two wheels", () => {
    startTable(["red-hand", "lambda"]);
    // Wedge 6 is « Direction l'Enfer », wedge 3 « Retourne d'où tu viens ».
    vi.spyOn(Math, "random").mockReturnValueOnce(draw(6)).mockReturnValueOnce(draw(3));
    const state = startWheel(store(), "misfortune", store().players[0].id, "move");
    expect(state.pendingWheel?.choices?.map((result) => result.id)).toEqual(["go-to-hell", "go-back"]);
    expect(state.pendingWheel?.result.id).toBe("go-back");

    const other = startWheel(store(), "misfortune", store().players[1].id, "move");
    expect(other.pendingWheel?.choices).toBeUndefined();
    expect(startWheel(store(), "fortune", store().players[0].id, "move").pendingWheel?.choices).toBeUndefined();
  });

  it("Touché angélique spins two wheels of fortune together, and both results apply one after the other", () => {
    startTable(["angelic-touch", "lambda"]);
    vi.spyOn(Math, "random").mockReturnValueOnce(draw(1)).mockReturnValueOnce(draw(3));
    useGameStore.setState(startWheel(store(), "fortune", store().players[0].id, "move"));
    // Both results are known from the start: the second wheel has spun beside the first.
    expect(store().pendingWheel?.result.id).toBe("gain-200");
    expect(store().pendingWheel?.repeats?.map((queued) => [queued.wheelId, queued.result.id])).toEqual([
      ["fortune", "gain-400"],
    ]);
    // One click applies both, in the same turn, before anything else goes on.
    store().resolveWheel();
    expect(store().players[0].currency).toBe(STARTING_CURRENCY + 200 + 400);
    expect(store().pendingWheel).toBeNull();
    expect(store().queuedWheels).toEqual([]);
    expect(store().turnStage).toBe("move");
  });

  it("Main du diable spins the wheel of Hell twice, and not the wheel of fortune", () => {
    startTable(["devils-hand", "lambda"]);
    const hell = startWheel(store(), "hell", store().players[0].id, "turn-end", { origin: "hell" });
    expect(hell.pendingWheel?.repeats?.map((queued) => queued.wheelId)).toEqual(["hell"]);
    const fortune = startWheel(store(), "fortune", store().players[0].id, "move");
    expect(fortune.pendingWheel?.repeats).toBeUndefined();
  });
});

describe("Meneur de jeu", () => {
  it("lets its holder pick the mini-game of a duel among two", () => {
    startTable(["game-master", "lambda", "lambda"]);
    const [master, other] = store().players;
    const state = startDuel(store(), master.id, other.id, "turn-end");
    expect(state.turnStage).toBe("duel-choice");
    expect(state.pendingDuel).toBeNull();
    const choice = state.pendingDuelChoice!;
    expect(choice.chooserId).toBe(master.id);
    expect(new Set(choice.modes).size).toBe(2);
    expect(getActionActorIds(state, { type: "chooseDuelMode", mode: choice.modes[1] })).toEqual([master.id]);
    expect(getDefaultAction(state)).toEqual({ type: "chooseDuelMode", mode: choice.modes[0] });

    useGameStore.setState(state);
    store().chooseDuelMode(choice.modes[1]);
    expect(store()).toMatchObject({ turnStage: "duel", pendingDuelChoice: null });
    expect(store().pendingDuel?.mode).toBe(choice.modes[1]);
  });

  it("changes nothing for a duel without them, nor accepts a game that was not offered", () => {
    startTable(["lambda", "lambda", "game-master"]);
    const [first, second] = store().players;
    const state = startDuel(store(), first.id, second.id, "turn-end");
    expect(state.turnStage).toBe("duel");
    expect(state.pendingDuelChoice).toBeNull();

    startTable(["game-master", "lambda"]);
    const choice = startDuel(store(), store().players[0].id, store().players[1].id, "turn-end");
    useGameStore.setState(choice);
    const offered = choice.pendingDuelChoice!.modes;
    const refused = (["coin-flip", "rock-paper-scissors", "basket", "blackjack", "player-vote"] as const).find(
      (mode) => !offered.includes(mode),
    )!;
    store().chooseDuelMode(refused);
    expect(store().turnStage).toBe("duel-choice");
  });
});

describe("Brocanteur", () => {
  it("sells an item of the bag back for sixty per cent of its price, from the shop only", () => {
    startTable(["junk-dealer", "lambda"]);
    editPlayer(0, { position: 3, inventory: [{ id: "purple", kind: "item", itemId: "hollow-purple" }] });
    store().sellItem("purple");
    expect(store().players[0].inventory).toHaveLength(1);

    useGameStore.setState({ turnStage: "shop" });
    expect(getResalePrice(store(), "hollow-purple", store().players[0])).toBe(360);
    store().sellItem("purple");
    expect(store().players[0].inventory).toHaveLength(0);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY + 360);
  });

  it("sells one Tomate at a time and never a Red Cup, and others cannot sell", () => {
    startTable(["junk-dealer", "lambda"]);
    editPlayer(0, {
      position: 3,
      inventory: [
        { id: "tomatoes", kind: "item", itemId: "tomato", count: 3 },
        { id: "cup", kind: "red-cup" },
      ],
    });
    useGameStore.setState({ turnStage: "shop" });
    store().sellItem("tomatoes");
    expect(store().players[0].inventory[0]).toMatchObject({ count: 2 });
    store().sellItem("cup");
    expect(store().players[0].inventory).toHaveLength(2);

    startTable(["lambda", "junk-dealer"]);
    editPlayer(0, { position: 3, inventory: [{ id: "purple", kind: "item", itemId: "hollow-purple" }] });
    useGameStore.setState({ turnStage: "shop" });
    store().sellItem("purple");
    expect(store().players[0].inventory).toHaveLength(1);
  });
});
