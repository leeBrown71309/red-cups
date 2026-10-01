import { afterEach, describe, expect, it, vi } from "vitest";
import { canPlayerSendAction } from "./action-permissions";
import { FREE_ITEM_POOL, ITEM_CATALOG, WHEEL_RESULTS } from "./catalog";
import { reduceGame, type GameAction } from "./game-actions";
import { countItemUnits } from "./rules";
import type { GameState, InventoryEntry, ItemId, Player, TurnStage, WheelId, WheelOutcomeId } from "./types";
import { EMPTY_GAME_STATE, FREE_TOMATOES, HELL_NODE_ID, MAXIMUM_BOOT_PRICE, STARTING_CURRENCY } from "./types";

/**
 * Wheels of patch 0.1.4 on the classic board: 0 start, 1 green, 2 neutral,
 * 3 shop, 4 red, 6 red, 7 green, 8 shop (8 → 0), 10 red. Nobody holds a
 * passive that reacts, so every outcome lands at once.
 */
function startTable(): GameState {
  const state = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["Ana", "Bo"], seed: 3 });
  return { ...state, seededRandom: null, players: state.players.map((player) => ({ ...player, passiveId: "troll" })) };
}

function editPlayer(state: GameState, index: number, changes: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  };
}

/** The wheel has stopped on `outcomeId` for player `index`; resolving it is the next action. */
function landWheel(
  state: GameState,
  wheelId: WheelId,
  outcomeId: WheelOutcomeId,
  index = 0,
  resumeStage: TurnStage = "turn-end",
): GameState {
  const result = WHEEL_RESULTS[wheelId].find((candidate) => candidate.id === outcomeId)!;
  return {
    ...state,
    turnStage: "wheel-result",
    pendingWheel: {
      id: `wheel-${outcomeId}`,
      wheelId,
      playerId: state.players[index].id,
      result: { id: result.id, label: result.label, amount: result.amount },
      resumeStage,
    },
  };
}

const act = (state: GameState, action: GameAction) => reduceGame(state, action);
const resolve = (state: GameState) => act(state, { type: "resolveWheel" });
const item = (id: string, itemId: ItemId): InventoryEntry => ({ id, kind: "item", itemId });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the wheels of patch 0.1.4", () => {
  it("have eight equal wedges, as the game's author listed them", () => {
    const outcomes = (wheelId: WheelId) => WHEEL_RESULTS[wheelId].map((result) => result.id);
    expect(outcomes("fortune")).toEqual([
      "gain-100",
      "gain-200",
      "gain-300",
      "gain-400",
      "advance-one",
      "spin-misfortune",
      "free-item",
      "go-to-start",
    ]);
    expect(outcomes("misfortune")).toEqual([
      "lose-200",
      "lose-300",
      "lose-400",
      "go-back",
      "spin-fortune",
      "lose-item",
      "go-to-hell",
      "skip-turn",
    ]);
    for (const wheelId of ["fortune", "misfortune"] as const) {
      expect(WHEEL_RESULTS[wheelId].every((result) => result.weight === 1)).toBe(true);
    }
  });

  it("gives away only items of 400 coins or less", () => {
    const pricier = FREE_ITEM_POOL.filter((itemId) => ITEM_CATALOG[itemId].price > 400);
    expect(pricier).toEqual([]);
    expect(MAXIMUM_BOOT_PRICE).toBeLessThanOrEqual(400);
  });

  it("hands a free Tomate as a whole stack of five", () => {
    // Fifth item of the pool: the Tomate.
    vi.spyOn(Math, "random").mockReturnValue(4.5 / FREE_ITEM_POOL.length);
    expect(FREE_ITEM_POOL[4]).toBe("tomato");
    const state = resolve(landWheel(startTable(), "fortune", "free-item"));
    expect(countItemUnits(state.players[0], "tomato")).toBe(FREE_TOMATOES);
    expect(state.players[0].inventory).toHaveLength(1);
  });

  it("fills a started stack of Tomates up to five when nothing else fits", () => {
    const fullBag: InventoryEntry[] = [
      item("a", "rope"),
      item("b", "ndoye"),
      item("c", "boot"),
      { id: "tomatoes", kind: "item", itemId: "tomato", count: 2 },
    ];
    const state = resolve(landWheel(editPlayer(startTable(), 0, { inventory: fullBag }), "fortune", "free-item"));
    expect(countItemUnits(state.players[0], "tomato")).toBe(5);
  });

  it("takes 200 coins from an empty bag on the wheel of misfortune, 100 on the wheel of Hell", () => {
    const misfortune = resolve(landWheel(startTable(), "misfortune", "lose-item"));
    expect(misfortune.players[0].currency).toBe(STARTING_CURRENCY - 200);

    const inHell = editPlayer(startTable(), 0, { position: HELL_NODE_ID, hellTurns: 1 });
    const hell = resolve(landWheel({ ...inHell, turnStage: "hell" }, "hell", "lose-item", 0, "turn-end"));
    expect(hell.players[0].currency).toBe(STARTING_CURRENCY - 100);
  });

  it("never takes a Red Cup, but an item", () => {
    const bag: InventoryEntry[] = [{ id: "cup", kind: "red-cup" }, item("a", "rope")];
    const state = resolve(landWheel(editPlayer(startTable(), 0, { inventory: bag }), "misfortune", "lose-item"));
    expect(state.players[0].inventory).toEqual([{ id: "cup", kind: "red-cup" }]);
    expect(state.players[0].currency).toBe(STARTING_CURRENCY);
  });

  it("costs 300 coins on its new wedge", () => {
    const state = resolve(landWheel(startTable(), "misfortune", "lose-300"));
    expect(state.players[0].currency).toBe(STARTING_CURRENCY - 300);
  });

  it("sends the player to the start with 200 coins, out of Hell too", () => {
    const fromTile = resolve(landWheel(editPlayer(startTable(), 0, { position: 7 }), "fortune", "go-to-start"));
    expect(fromTile.players[0]).toMatchObject({ position: 0, currency: STARTING_CURRENCY + 200 });

    const inHell = editPlayer(startTable(), 0, { position: HELL_NODE_ID, hellTurns: 2 });
    const fromHell = resolve(landWheel(inHell, "fortune", "go-to-start", 0, "turn-end"));
    expect(fromHell.players[0]).toMatchObject({ position: 0, currency: STARTING_CURRENCY + 200 });
  });
});

describe("« Retourne d’où tu viens »", () => {
  it("remembers the tile a player left, whatever moved them", () => {
    const state = act(startTable(), { type: "movePlayer", destination: 4, ignoreArrows: false });
    expect(state.players[0]).toMatchObject({ position: 4, previousNodeId: 0 });
  });

  it("sends the player back there, where the tile's wheel spins", () => {
    // Ana walked 7 → 4 (red); back on 7 (green), she owes its wheel of fortune.
    const state = editPlayer(startTable(), 0, { position: 4, previousNodeId: 7 });
    const back = resolve(landWheel(state, "misfortune", "go-back"));
    expect(back.players[0].position).toBe(7);
    expect(back.turnStage).toBe("tile-wheel");
    expect(back.pendingTileWheels).toEqual([{ playerId: "p1", nodeId: 7 }]);
  });

  it("opens the shop of a blue tile when the player's turn was over", () => {
    const state = editPlayer(startTable(), 0, { position: 6, previousNodeId: 3 });
    const back = resolve(landWheel(state, "misfortune", "go-back"));
    expect(back.players[0].position).toBe(3);
    expect(back.turnStage).toBe("shop");
  });

  it("does not let a player out of Hell, nor send anybody into it", () => {
    const inHell = editPlayer(startTable(), 0, { position: HELL_NODE_ID, hellTurns: 1, previousNodeId: 3 });
    expect(resolve(landWheel(inHell, "misfortune", "go-back")).players[0].position).toBe(HELL_NODE_ID);

    const outOfHell = editPlayer(startTable(), 0, { position: 0, previousNodeId: HELL_NODE_ID });
    expect(resolve(landWheel(outOfHell, "misfortune", "go-back")).players[0].position).toBe(0);
  });
});

describe("« Avance d’une case »", () => {
  it("lets the spinner pick a neighbouring tile, arrows obeyed", () => {
    // From 10 the roads lead to 1 and 8; tile 1's arrow points at 10 but binds only tile 1.
    const state = resolve(landWheel(editPlayer(startTable(), 1, { position: 10 }), "fortune", "advance-one", 1));
    expect(state.turnStage).toBe("advance");
    expect(state.pendingAdvance).toEqual({ playerId: "p2", resumeStage: "turn-end" });

    const step: GameAction = { type: "advanceOneTile", destination: 8 };
    expect(canPlayerSendAction(state, step, "p2")).toBe(true);
    expect(canPlayerSendAction(state, step, "p1")).toBe(false);
    expect(act(state, { type: "advanceOneTile", destination: 4 })).toBe(state);

    const stepped = act(state, step);
    expect(stepped.players[1]).toMatchObject({ position: 8, previousNodeId: 10 });
    expect(stepped.pendingAdvance).toBeNull();
    expect(stepped.lastMovement).toMatchObject({ playerId: "p2", from: 10, path: [8] });
  });

  it("reaches the tile like a walk: its wheel spins", () => {
    const state = resolve(landWheel(editPlayer(startTable(), 0, { position: 3 }), "fortune", "advance-one"));
    // Tile 3 must be left by its arrow, towards 6 (red).
    const stepped = act(state, { type: "advanceOneTile", destination: 6 });
    expect(stepped.turnStage).toBe("tile-wheel");
    expect(stepped.pendingTileWheels).toEqual([{ playerId: "p1", nodeId: 6 }]);
  });

  it("opens the shop of a blue tile for the active player, and pays the start bonus through an arrow", () => {
    const toShop = resolve(landWheel(editPlayer(startTable(), 0, { position: 10 }), "fortune", "advance-one"));
    expect(act(toShop, { type: "advanceOneTile", destination: 8 }).turnStage).toBe("shop");

    const toStart = resolve(landWheel(editPlayer(startTable(), 0, { position: 8 }), "fortune", "advance-one"));
    const stepped = act(toStart, { type: "advanceOneTile", destination: 0 });
    expect(stepped.players[0]).toMatchObject({ position: 0, currency: STARTING_CURRENCY + 200 });
  });

  it("does nothing in Hell, where no road leads anywhere", () => {
    const inHell = editPlayer(startTable(), 0, { position: HELL_NODE_ID, hellTurns: 1 });
    const state = resolve(landWheel(inHell, "fortune", "advance-one"));
    expect(state.pendingAdvance).toBeNull();
    expect(state.players[0].position).toBe(HELL_NODE_ID);
  });
});

describe("the shop of patch 0.1.4", () => {
  it("charges the new prices", () => {
    const prices = Object.fromEntries(Object.values(ITEM_CATALOG).map((entry) => [entry.id, entry.price]));
    expect(prices).toMatchObject({
      ndoye: 250,
      "hollow-purple": 600,
      rope: 400,
      boot: 100,
      mud: 200,
      tomato: 10,
      eraser: 200,
      "bullet-bill": 550,
      "middle-finger": 400,
      "monopoly-man": 600,
      "water-bottle": 600,
      helmet: 200,
      draven: 700,
    });
  });

  it("stops raising the Botte's price at 400", () => {
    let state: GameState = {
      ...startTable(),
      bootPrice: 350,
      bootFirstPurchased: true,
      bootLastPriceRound: 1,
      turnStage: "turn-end",
    };
    for (let turn = 0; turn < 8; turn += 1) state = act({ ...state, turnStage: "turn-end" }, { type: "endTurn" });
    expect(state.round).toBeGreaterThan(3);
    expect(state.bootPrice).toBe(400);
  });
});
