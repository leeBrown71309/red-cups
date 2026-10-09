import { afterEach, describe, expect, it, vi } from "vitest";
import { withPassives } from "./forced-passives";
import { reduceGame } from "./game-actions";
import { canEndTurn } from "./energy";
import { drawSlide } from "./ice";
import { getBarrierRoads } from "./turn-actions";
import { getBoard, isBlockedRoad } from "./board";
import { canBuyItemKind } from "./passive-rules";
import { countItemUnits } from "./rules";
import { loseTurns, placeInHell } from "./state-utils";
import { useGameStore } from "./store";
import type { GameState, ItemId, Player } from "./types";
import { BARRIER_TURNS, EMPTY_GAME_STATE, HELL_NODE_ID } from "./types";

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
        ? {
            ...player,
            inventory: [
              ...player.inventory,
              { id: `${itemId}-${index}-${player.inventory.length}`, kind: "item", itemId },
            ],
          }
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

  it("sends Middle Finger back: its user skips a turn and can only end this one", () => {
    startTable();
    giveItem(0, "middle-finger");
    giveItem(1, "mirror");
    const entryId = store().players[0].inventory.find((entry) => entry.kind === "item")!.id;
    store().useItem(entryId, store().players[1].id);
    expect(store().turnStage).toBe("turn-end");
    expect(store().players[0].skippedTurns).toBe(1);
    // No move and no other item are left: only the end of the turn.
    const before = store().players;
    store().movePlayer(store().players[0].position === 0 ? 2 : 0);
    expect(store().players).toBe(before);
    expect(canEndTurn(store())).toBe(true);
  });
});

describe("Barrière", () => {
  const entryOf = (index: number) => store().players[index].inventory.find((candidate) => candidate.kind === "item")!;
  const placeFor = (index: number, road: [number, number]) => {
    useGameStore.setState({ activePlayerIndex: index, turnStage: "move", energyLeft: 4 });
    store().useItem(entryOf(index).id, undefined, 1, road);
  };

  it("closes any road of the board, however far, and holds it for one table turn", () => {
    startTable();
    giveItem(0, "barrier");
    const roads = getBarrierRoads(store());
    const far = roads.find((road) => !road.includes(store().players[0].position))!;
    expect(far).toBeDefined();
    store().useItem(entryOf(0).id, undefined, 1, far);
    const [barrier] = store().barriers;
    expect(barrier).toMatchObject({ ownerId: store().players[0].id, turnsLeft: BARRIER_TURNS });
    expect(isBlockedRoad(getBoard(store()), far[0], far[1])).toBe(true);
    expect(getBarrierRoads(store()).some(([a, b]) => a === far[0] && b === far[1])).toBe(false);

    // A table turn is three passes: it stands while the others play, and is gone when its owner's turn comes again.
    for (let pass = 0; pass < 2; pass += 1) passTurn();
    expect(store().barriers).toHaveLength(1);
    passTurn();
    expect(store().barriers).toHaveLength(0);
  });

  it("allows one per player and two on the board", () => {
    startTable();
    for (const index of [0, 1, 2]) giveItem(index, "barrier");
    giveItem(0, "barrier");
    const [first, second, third] = getBarrierRoads(store());
    placeFor(0, first);
    placeFor(0, second);
    expect(store().barriers).toHaveLength(1);
    placeFor(1, second);
    expect(store().barriers).toHaveLength(2);
    placeFor(2, third);
    expect(store().barriers).toHaveLength(2);
  });

  it("refuses a road the board does not have", () => {
    startTable();
    giveItem(0, "barrier");
    store().useItem(entryOf(0).id, undefined, 1, [9998, 9999]);
    expect(store().barriers).toHaveLength(0);
  });

  it("makes a slide bounce off the barred road and slide on another way", () => {
    const base = reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["A", "B"], mapId: "banquise" });
    // The ice on tile 3 leads on to 6, 4 and 8: the road to 4 is barred.
    const state: GameState = { ...base, iceTileNodeId: null, barriers: [{ ownerId: "p2", a: 3, b: 4, turnsLeft: 2 }] };
    let bumped = 0;
    for (let draw = 0; draw < 60; draw += 1) {
      const outcome = drawSlide(state, 1, [3], false);
      expect(outcome.slide[0]).not.toBe(4);
      expect(outcome.slide.length).toBeGreaterThan(0);
      bumped += outcome.bumps.length;
      for (const bump of outcome.bumps) expect(bump).toEqual({ step: 0, toward: 4 });
    }
    expect(bumped).toBeGreaterThan(0);
  });
});
