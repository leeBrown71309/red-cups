import { describe, expect, it } from "vitest";
import { canEndTurn } from "./energy";
import { reduceGame, type GameAction } from "./game-actions";
import { migrateGameSave } from "./game-save";
import type { GameState, InventoryEntry, ItemId, PassiveId, Player } from "./types";
import { BASE_ENERGY, EMPTY_GAME_STATE, HELL_NODE_ID } from "./types";
import { withPassives } from "./forced-passives";

/**
 * Energy (patch 0.1.4) on the classic board: from the start, roads lead to
 * tiles 2 (neutral) and 4 (red), and 9 lies two tiles away (0 → 4 → 9).
 */
function startTable(passives: PassiveId[] = ["goblin", "goblin"]): GameState {
  const state = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["Ana", "Bo"], seed: 3 });
  return withPassives({ ...state, seededRandom: null }, passives);
}

function editPlayer(state: GameState, index: number, changes: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  };
}

const act = (state: GameState, action: GameAction) => reduceGame(state, action);
const item = (id: string, itemId: ItemId): InventoryEntry => ({ id, kind: "item", itemId });
const walk = (destination: number): GameAction => ({ type: "movePlayer", destination, ignoreArrows: false });

describe("the energy of a turn", () => {
  it("opens every turn with a full gauge, which the move uses up", () => {
    const state = startTable();
    expect(state.energyLeft).toBe(BASE_ENERGY);

    const moved = act(state, walk(2));
    expect(moved).toMatchObject({ turnStage: "turn-end", energyLeft: 0 });
    expect(act(moved, { type: "endTurn" })).toMatchObject({
      activePlayerIndex: 1,
      energyLeft: BASE_ENERGY,
      turnActionTaken: false,
    });
  });

  it("charges each item its own cost, and the turn goes on until the move", () => {
    const bag = [item("finger", "middle-finger"), item("mud", "mud")];
    let state = act(editPlayer(startTable(), 0, { inventory: bag }), {
      type: "useItem",
      entryId: "finger",
      targetPlayerId: "p2",
    });
    expect(state).toMatchObject({ turnStage: "move", energyLeft: 1, turnActionTaken: true });

    // The last point still moves the player.
    const moved = act(state, walk(2));
    expect(moved).toMatchObject({ turnStage: "turn-end", energyLeft: 0 });

    // Spent on the mud instead, it leaves nothing to move with.
    state = act(state, { type: "useItem", entryId: "mud" });
    expect(state).toMatchObject({ turnStage: "move", energyLeft: 0 });
    expect(state.mudTraps).toHaveLength(1);
    expect(act(state, walk(2))).toBe(state);
  });

  it("refuses an item the gauge cannot pay for", () => {
    const bag = [item("finger", "middle-finger"), item("purple", "hollow-purple")];
    const state = act(editPlayer(startTable(), 0, { inventory: bag }), {
      type: "useItem",
      entryId: "finger",
      targetPlayerId: "p2",
    });
    expect(act(state, { type: "useItem", entryId: "purple", targetPlayerId: "p2" })).toBe(state);
  });

  it("throws Tomates for free", () => {
    const tomatoes: InventoryEntry = { id: "tomatoes", kind: "item", itemId: "tomato", count: 2 };
    const state = act(editPlayer(startTable(), 0, { inventory: [tomatoes] }), {
      type: "useItem",
      entryId: "tomatoes",
      targetPlayerId: "p2",
    });
    expect(state.energyLeft).toBe(BASE_ENERGY);
  });
});

describe("ending a turn before moving", () => {
  it("is refused while nothing was done and the player can still move", () => {
    const state = startTable();
    expect(canEndTurn(state)).toBe(false);
    expect(act(state, { type: "endTurn" })).toBe(state);
  });

  it("is allowed once an item was used, or when the gauge is too low to move", () => {
    const withMud = act(editPlayer(startTable(), 0, { inventory: [item("mud", "mud")] }), {
      type: "useItem",
      entryId: "mud",
    });
    expect(act(withMud, { type: "endTurn" }).activePlayerIndex).toBe(1);

    const tired: GameState = { ...startTable(), energyLeft: 0 };
    expect(act(tired, { type: "endTurn" }).activePlayerIndex).toBe(1);
  });

  it("is still refused after a free item: a Tomate is no action of the turn (author's answer)", () => {
    const tomatoes: InventoryEntry = { id: "tomatoes", kind: "item", itemId: "tomato", count: 1 };
    const thrown = act(editPlayer(startTable(), 0, { inventory: [tomatoes] }), {
      type: "useItem",
      entryId: "tomatoes",
      targetPlayerId: "p2",
    });
    expect(canEndTurn(thrown)).toBe(false);
  });
});

describe("the Botte", () => {
  it("costs a point and keeps another for the two-tile move, once a turn", () => {
    const bag = [item("boot", "boot"), item("boot-2", "boot"), item("finger", "middle-finger"), item("mud", "mud")];
    let state = act(editPlayer(startTable(), 0, { inventory: bag }), { type: "prepareBoot", entryId: "boot" });
    expect(state).toMatchObject({ moveDistance: 2, energyLeft: BASE_ENERGY - 1 });
    expect(act(state, { type: "prepareBoot", entryId: "boot-2" })).toBe(state);

    // Two points left, one kept for the move: the Middle Finger no longer fits, the mud does.
    expect(act(state, { type: "useItem", entryId: "finger", targetPlayerId: "p2" })).toBe(state);
    state = act(state, { type: "useItem", entryId: "mud" });
    expect(state.energyLeft).toBe(1);

    state = act(state, walk(9));
    expect(state.players[0].position).toBe(9);
    expect(state.energyLeft).toBe(0);
  });

  it("cannot be prepared with a single point left", () => {
    const state: GameState = { ...editPlayer(startTable(), 0, { inventory: [item("boot", "boot")] }), energyLeft: 1 };
    expect(act(state, { type: "prepareBoot", entryId: "boot" })).toBe(state);
  });
});

describe("in Hell", () => {
  const inHell = (energyLeft: number): GameState => ({
    ...editPlayer(startTable(), 0, {
      position: HELL_NODE_ID,
      hellTurns: 1,
      inventory: [item("finger", "middle-finger")],
    }),
    turnStage: "hell",
    energyLeft,
  });

  it("spins the wheel in place of the move, after items while the gauge allows", () => {
    let state = act(inHell(BASE_ENERGY), { type: "useItem", entryId: "finger", targetPlayerId: "p2" });
    expect(state).toMatchObject({ turnStage: "hell", energyLeft: 1 });
    state = act(state, { type: "spinHellWheel" });
    expect(state).toMatchObject({ turnStage: "wheel-result", energyLeft: 0 });
  });

  it("leaves the wheel for the next turn once the gauge is empty", () => {
    const state = inHell(0);
    expect(act(state, { type: "spinHellWheel" })).toBe(state);
    expect(act(state, { type: "endTurn" }).activePlayerIndex).toBe(1);
  });
});

describe("energy and the rest of the turn", () => {
  it("still spends the energy of an item that Non merci cancels, and the turn goes on", () => {
    const state = editPlayer(startTable(["goblin", "no-thanks"]), 0, { inventory: [item("rope", "rope")] });
    const declared = act(state, { type: "useItem", entryId: "rope", targetPlayerId: "p2" });
    expect(declared.turnStage).toBe("reaction");

    const cancelled = act(declared, { type: "resolveReaction", reactorId: "p2" });
    expect(cancelled).toMatchObject({ turnStage: "move", energyLeft: 1 });
    expect(cancelled.players[0].inventory).toEqual([]);
  });

  it("keeps an item bought at the shop for a later turn", () => {
    const shopping: GameState = {
      ...editPlayer(startTable(), 0, { position: 3, inventory: [item("finger", "middle-finger")] }),
      turnStage: "shop",
      energyLeft: 0,
    };
    const bought = act(shopping, { type: "buyItem", itemId: "tomato" });
    expect(bought.players[0].inventory).toHaveLength(2);
    expect(bought.energyLeft).toBe(0);
    expect(act(bought, { type: "useItem", entryId: "finger", targetPlayerId: "p2" })).toBe(bought);
  });

  it("gives a game saved before the energy a full gauge", () => {
    const { energyLeft: _dropped, ...oldSave } = startTable();
    expect(migrateGameSave(oldSave, 12).energyLeft).toBe(BASE_ENERGY);
  });
});
