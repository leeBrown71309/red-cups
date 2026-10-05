import { afterEach, describe, expect, it, vi } from "vitest";
import { withPassives } from "./forced-passives";
import { getBarrierRoads } from "./turn-actions";
import { getBoard, isBlockedRoad } from "./board";
import { canBuyItemKind } from "./passive-rules";
import { countItemUnits } from "./rules";
import { loseTurns, placeInHell } from "./state-utils";
import { useGameStore } from "./store";
import type { ItemId, Player } from "./types";
import { HELL_NODE_ID } from "./types";

/** Réveil, Parachute, Miroir and Barrière: the four items of patch 0.1.6. */

function startTable(names = 3): void {
  useGameStore.getState().startGame(Array.from({ length: names }, (_, index) => `Joueur ${index + 1}`));
  useGameStore.setState((state) => withPassives(state, Array(names).fill("lambda")));
  useGameStore.setState({ turnStage: "move", energyLeft: 4 });
}

function giveItem(index: number, itemId: ItemId): void {
  useGameStore.setState((state) => ({
    players: state.players.map((player, playerIndex) =>
      playerIndex === index
        ? { ...player, inventory: [...player.inventory, { id: `${itemId}-${index}`, kind: "item", itemId }] }
        : player,
    ),
  }));
}

const store = () => useGameStore.getState();
const holder = (itemId: ItemId): Player => {
  startTable();
  giveItem(0, itemId);
  return store().players[0];
};

function passTurn(): void {
  useGameStore.setState({ turnStage: "shop" });
  store().endTurn();
}

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Réveil", () => {
  it("cancels one lost turn, then is gone", () => {
    const player = holder("wake-up");
    const woken = loseTurns(player);
    expect(woken.skippedTurns).toBe(0);
    expect(countItemUnits(woken, "wake-up")).toBe(0);
    expect(loseTurns(woken).skippedTurns).toBe(1);
  });

  it("only saves a single turn out of several", () => {
    expect(loseTurns(holder("wake-up"), 2).skippedTurns).toBe(1);
  });
});

describe("Parachute", () => {
  it("keeps the player out of Hell once", () => {
    const player = holder("parachute");
    const saved = placeInHell(player);
    expect(saved.position).toBe(player.position);
    expect(countItemUnits(saved, "parachute")).toBe(0);
    expect(placeInHell(saved).position).toBe(HELL_NODE_ID);
  });
});

describe("Miroir", () => {
  it("is never sold again once spent", () => {
    const player = holder("mirror");
    expect(canBuyItemKind({ ...player, inventory: [] }, "mirror")).toBe(true);
    expect(canBuyItemKind({ ...player, inventory: [], mirrorUsed: true }, "mirror")).toBe(false);
  });

  it("sends Ndoye back to the thrower", () => {
    startTable();
    giveItem(0, "ndoye");
    giveItem(1, "mirror");
    const entryId = store().players[0].inventory.find((entry) => entry.kind === "item")!.id;
    store().useItem(entryId, store().players[1].id);
    expect(store().pendingReaction).toBeNull();
    expect(countItemUnits(store().players[1], "mirror")).toBe(0);
    expect(store().players[1].mirrorUsed).toBe(true);
    expect(store().log.some((entry) => entry.text.includes("Miroir"))).toBe(true);
  });
});

describe("Barrière", () => {
  it("closes one road at a time, and falls on its owner's next turn", () => {
    startTable();
    giveItem(0, "barrier");
    const entry = store().players[0].inventory.find((candidate) => candidate.kind === "item")!;
    const [road] = getBarrierRoads(store(), store().players[0].position);
    expect(road).toBeDefined();
    store().useItem(entry.id, undefined, 1, road);
    const barrier = store().barrier;
    expect(barrier?.ownerId).toBe(store().players[0].id);
    expect(isBlockedRoad(getBoard(store()), barrier!.a, barrier!.b)).toBe(true);

    passTurn();
    expect(store().barrier).not.toBeNull();
    passTurn();
    expect(store().barrier).not.toBeNull();
    passTurn();
    expect(store().barrier).toBeNull();
  });

  it("refuses a road that does not start under the player's feet", () => {
    startTable();
    giveItem(0, "barrier");
    const entry = store().players[0].inventory.find((candidate) => candidate.kind === "item")!;
    store().useItem(entry.id, undefined, 1, 9999);
    expect(store().barrier).toBeNull();
  });
});
