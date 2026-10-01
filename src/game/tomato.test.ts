import { describe, expect, it } from "vitest";
import { getBoard } from "./board";
import { reduceGame, type GameAction } from "./game-actions";
import { canAddItem, countItemCopies, countItemUnits } from "./rules";
import type { GameState, InventoryEntry, Player } from "./types";
import { BASE_ENERGY, EMPTY_GAME_STATE, HELL_NODE_ID } from "./types";

/** A classic table where nobody holds Non merci, Je note or Penta: a throw lands at once, the bag holds 4. */
function startTable(): GameState {
  const state = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["Ana", "Bo", "Cy"], seed: 7 });
  return { ...state, players: state.players.map((player) => ({ ...player, passiveId: "troll" as const })) };
}

function editPlayer(state: GameState, index: number, changes: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  };
}

const tomatoes = (count: number): InventoryEntry => ({ id: "tomatoes", kind: "item", itemId: "tomato", count });
const act = (state: GameState, action: GameAction) => reduceGame(state, action);

describe("the Tomate", () => {
  it("costs 10 coins and piles up to 5 per slot, two stacks at most", () => {
    const shop = getBoard(startTable()).nodes.find((node) => node.kind === "shop")!;
    let state = editPlayer(startTable(), 0, { position: shop.id });
    state = { ...state, turnStage: "shop" };
    for (let bought = 1; bought <= 10; bought += 1) {
      state = act(state, { type: "buyItem", itemId: "tomato" });
      expect(countItemUnits(state.players[0], "tomato")).toBe(bought);
      // A stack counts as one copy: the sixth Tomate starts the second one.
      expect(countItemCopies(state.players[0], "tomato")).toBe(bought <= 5 ? 1 : 2);
    }
    expect(state.players[0].currency).toBe(2_000 - 100);
    expect(act(state, { type: "buyItem", itemId: "tomato" })).toBe(state);
  });

  it("needs a free slot to start a stack", () => {
    const fullBag: InventoryEntry[] = ["mud", "boot", "helmet", "rope"].map((itemId, index) => ({
      id: `own-${index}`,
      kind: "item",
      itemId: itemId as "mud",
    }));
    const player = startTable().players[0];
    expect(canAddItem({ ...player, inventory: fullBag }, "tomato")).toBe(false);
    expect(canAddItem({ ...player, inventory: [...fullBag.slice(0, 3), tomatoes(4)] }, "tomato")).toBe(true);
    expect(canAddItem({ ...player, inventory: [...fullBag.slice(0, 3), tomatoes(5)] }, "tomato")).toBe(false);
    expect(canAddItem({ ...player, inventory: [fullBag[0], tomatoes(5)] }, "tomato")).toBe(true);
    const twoStacks = [tomatoes(5), { ...tomatoes(5), id: "more-tomatoes" }];
    expect(canAddItem({ ...player, inventory: twoStacks }, "tomato")).toBe(false);
  });

  it("is thrown from a single stack per turn, the other one waiting for the next turn", () => {
    const second: InventoryEntry = { ...tomatoes(5), id: "more-tomatoes" };
    let state = editPlayer(startTable(), 0, { inventory: [tomatoes(5), second] });
    state = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2", count: 2 });
    state = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p3", count: 3 });
    expect(state.players[0].inventory).toEqual([second]);
    expect(act(state, { type: "useItem", entryId: "more-tomatoes", targetPlayerId: "p2" })).toBe(state);

    do {
      state = act({ ...state, turnStage: "turn-end" }, { type: "endTurn" });
    } while (state.activePlayerIndex !== 0);
    const nextTurn = act(
      { ...state, turnStage: "move" },
      { type: "useItem", entryId: "more-tomatoes", targetPlayerId: "p2" },
    );
    expect(countItemUnits(nextTurn.players[0], "tomato")).toBe(4);
  });

  it("is thrown for free before the move, as often as the stack allows", () => {
    let state = editPlayer(startTable(), 0, { inventory: [tomatoes(3)] });
    state = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2" });
    state = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p3" });
    expect(state.turnStage).toBe("move");
    expect(state.energyLeft).toBe(BASE_ENERGY);
    expect(state.players[0].inventory).toEqual([tomatoes(1)]);
    expect(state.lastTomatoThrow).toMatchObject({ seq: 2, throwerId: "p1", targetId: "p3" });

    state = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2" });
    expect(state.players[0].inventory).toEqual([]);
  });

  it("throws a whole volley in one go, never more than the stack holds", () => {
    const state = editPlayer(startTable(), 0, { inventory: [tomatoes(4)] });
    const volley = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2", count: 3 });
    expect(volley.players[0].inventory).toEqual([tomatoes(1)]);
    expect(volley.lastTomatoThrow).toMatchObject({ targetId: "p2", count: 3 });
    expect(volley.log[0].text).toContain("3 Tomates");
    expect(volley.turnStage).toBe("move");

    expect(act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2", count: 5 })).toBe(state);
    expect(act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2", count: 0 })).toBe(state);
    expect(act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2", count: 1.5 })).toBe(state);
    const everything = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p3", count: 4 });
    expect(everything.players[0].inventory).toEqual([]);
  });

  it("skips a single turn however many Tomates of the volley knock the target out", () => {
    let knockedOut = 0;
    for (let seed = 0; seed < 600; seed += 1) {
      let state = editPlayer(startTable(), 0, { inventory: [tomatoes(5)] });
      state = { ...state, seededRandom: { rngState: seed * 2_654_435_761, nextId: 0 } };
      const after = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2", count: 5 });
      expect(after.players[1].skippedTurns).toBe(after.lastTomatoThrow?.stunned ? 1 : 0);
      if (after.lastTomatoThrow?.stunned) knockedOut += 1;
    }
    // Five Tomates at 2 % each: close to one volley in ten.
    expect(knockedOut).toBeGreaterThan(600 * 0.05);
    expect(knockedOut).toBeLessThan(600 * 0.16);
  });

  it("flies at anyone but the thrower, into Hell and out of it", () => {
    let state = editPlayer(startTable(), 0, { inventory: [tomatoes(2)] });
    expect(act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p1" })).toBe(state);

    const withBoInHell = editPlayer(state, 1, { position: HELL_NODE_ID });
    const intoHell = act(withBoInHell, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2" });
    expect(intoHell.lastTomatoThrow?.targetId).toBe("p2");

    const fromHell = editPlayer({ ...state, turnStage: "hell" }, 0, { position: HELL_NODE_ID, hellTurns: 1 });
    const thrown = act(fromHell, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p3" });
    expect(thrown.lastTomatoThrow?.targetId).toBe("p3");
    expect(thrown.turnStage).toBe("hell");
  });

  it("knocks the target out about twice in a hundred throws", () => {
    let stuns = 0;
    const throws = 2_000;
    for (let seed = 0; seed < throws; seed += 1) {
      let state = editPlayer(startTable(), 0, { inventory: [tomatoes(1)] });
      state = { ...state, seededRandom: { rngState: seed * 2_654_435_761, nextId: 0 } };
      const after = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2" });
      const stunned = after.lastTomatoThrow?.stunned === true;
      expect(after.players[1].skippedTurns).toBe(stunned ? 1 : 0);
      if (stunned) stuns += 1;
    }
    expect(stuns).toBeGreaterThan(throws * 0.01);
    expect(stuns).toBeLessThan(throws * 0.035);
  });

  it("goes past Non merci, which cannot cancel it", () => {
    let state = editPlayer(startTable(), 0, { inventory: [tomatoes(1)] });
    state = editPlayer(state, 1, { passiveId: "no-thanks" });
    const after = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p3" });
    expect(after.pendingReaction).toBeNull();
    expect(after.lastTomatoThrow?.targetId).toBe("p3");
  });

  it("hands Je note one Tomate per Tomate of the volley, starting a second stack once the first is full", () => {
    let state = editPlayer(startTable(), 0, { inventory: [tomatoes(5)] });
    state = editPlayer(state, 1, { passiveId: "i-take-notes", inventory: [{ ...tomatoes(3), id: "bo-tomatoes" }] });
    state = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2", count: 4 });
    expect(countItemUnits(state.players[1], "tomato")).toBe(7);
    expect(countItemCopies(state.players[1], "tomato")).toBe(2);
  });

  it("asks a full bag to make room for a second stack, like any second copy", () => {
    const others: InventoryEntry[] = ["ndoye", "boot", "rope"].map((itemId, index) => ({
      id: `bo-${index}`,
      kind: "item",
      itemId: itemId as "ndoye",
    }));
    let state = editPlayer(startTable(), 0, { inventory: [tomatoes(2)] });
    state = editPlayer(state, 1, {
      passiveId: "i-take-notes",
      inventory: [...others, { ...tomatoes(4), id: "bo-tomatoes" }],
    });
    state = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2", count: 2 });
    expect(state.pendingDiscard).toMatchObject({ playerId: "p2", reason: "forced-item", itemId: "tomato" });

    state = act(state, { type: "discardInventoryEntry", entryId: "bo-0" });
    expect(countItemCopies(state.players[1], "tomato")).toBe(2);
    expect(countItemUnits(state.players[1], "tomato")).toBe(6);
  });

  it("hands Je note one Tomate per hit, on its stack", () => {
    let state = editPlayer(startTable(), 0, { inventory: [tomatoes(2)] });
    state = editPlayer(state, 1, { passiveId: "i-take-notes", inventory: [{ ...tomatoes(1), id: "bo-tomatoes" }] });
    state = act(state, { type: "useItem", entryId: "tomatoes", targetPlayerId: "p2" });
    expect(countItemUnits(state.players[1], "tomato")).toBe(2);
    expect(countItemCopies(state.players[1], "tomato")).toBe(1);
  });

  it("loses a single one to a bad wheel or the ghost, not the whole stack", () => {
    let state = editPlayer(startTable(), 0, { inventory: [tomatoes(4)] });
    state = act(state, { type: "spinWheel", wheelId: "misfortune", playerId: "p1", resumeStage: "turn-end" });
    state = {
      ...state,
      pendingWheel: state.pendingWheel && {
        ...state.pendingWheel,
        result: { id: "lose-item", label: "Perds un objet" },
      },
    };
    state = act(state, { type: "resolveWheel" });
    expect(countItemUnits(state.players[0], "tomato")).toBe(3);
  });
});
