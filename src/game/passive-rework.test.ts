import { afterEach, describe, expect, it, vi } from "vitest";
import { addRedGreenBonuses, getCalmDownTiles } from "./game-effects";
import { migrateGameSave, pickGameState } from "./game-save";
import { useGameStore } from "./store";
import type { InventoryEntry, ItemId, PassiveId, Player, WheelOutcomeId } from "./types";
import { BASE_ENERGY, HELL_NODE_ID, NO_THANKS_COOLDOWN_ROUNDS, START_BONUS, STARTING_CURRENCY } from "./types";
import { withPassives } from "./forced-passives";

/**
 * Passives reworked by patch 0.1.4 on the classic board. Roads (arrows aside):
 * 0–2, 0–4, 0–8, 1–6, 1–7, 1–10, 2–5, 3–4, 3–6, 3–7, 4–7, 4–9, 5–9, 8–10.
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
const item = (id: string, itemId: ItemId): InventoryEntry => ({ id, kind: "item", itemId });
const playerId = (index: number) => store().players[index].id;

/** The wheel has stopped on `outcomeId` for player `index`. */
function landWheel(index: number, outcomeId: WheelOutcomeId, amount?: number): void {
  useGameStore.setState({
    turnStage: "wheel-result",
    pendingWheel: {
      id: `wheel-${outcomeId}`,
      wheelId: "misfortune",
      playerId: playerId(index),
      result: { id: outcomeId, label: outcomeId, amount },
      resumeStage: "turn-end",
    },
  });
}

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Non merci on items", () => {
  it("never holds a move", () => {
    startTable(["lambda", "no-thanks"]);
    store().movePlayer(2);
    expect(store()).toMatchObject({ turnStage: "turn-end", pendingReaction: null });
    expect(store().players[0].position).toBe(2);
  });

  it("asks the holder before an item aimed at them applies, and stays out of the others", () => {
    startTable(["lambda", "no-thanks", "lambda"]);
    editPlayer(0, { inventory: [item("finger", "middle-finger"), item("purple", "hollow-purple")] });
    store().useItem("finger", playerId(2));
    expect(store().pendingReaction).toBeNull();
    expect(store().players[2].skippedTurns).toBe(1);

    useGameStore.setState({ energyLeft: BASE_ENERGY });
    store().useItem("purple", playerId(1));
    expect(store().turnStage).toBe("reaction");
    expect(store().pendingReaction?.reactorIds).toEqual([playerId(1)]);
    expect(store().players[1].position).toBe(0);
  });

  it(`cancels it: spent with its energy, the turn goes on, and it recharges in ${NO_THANKS_COOLDOWN_ROUNDS} rounds`, () => {
    startTable(["lambda", "no-thanks"]);
    editPlayer(0, { inventory: [item("rope", "rope")] });
    editPlayer(1, { position: 5 });
    store().useItem("rope", playerId(1));
    store().resolveReaction(playerId(1));

    expect(store().players[1].position).toBe(5);
    expect(store().players[0].inventory).toEqual([]);
    expect(store()).toMatchObject({ turnStage: "move", energyLeft: BASE_ENERGY - 2 });
    expect(store().players[1].noThanksReadyRound).toBe(store().round + NO_THANKS_COOLDOWN_ROUNDS);
  });

  it("lets the item happen when the holder lets it, and never opens for the holder's own items", () => {
    startTable(["lambda", "no-thanks"]);
    editPlayer(0, { inventory: [item("purple", "hollow-purple")] });
    store().useItem("purple", playerId(1));
    store().resolveReaction(null);
    expect(store().players[1].position).toBe(HELL_NODE_ID);

    startTable(["no-thanks", "lambda"]);
    editPlayer(0, { inventory: [item("finger", "middle-finger")] });
    store().useItem("finger", playerId(1));
    expect(store().pendingReaction).toBeNull();
  });

  it("refuses a cancel from a player who was not offered it", () => {
    startTable(["lambda", "no-thanks", "lambda"]);
    editPlayer(0, { inventory: [item("purple", "hollow-purple")] });
    store().useItem("purple", playerId(1));
    store().resolveReaction(playerId(2));
    expect(store().turnStage).toBe("reaction");
  });

  it("spares only its holder from Draven", () => {
    startTable(["lambda", "no-thanks", "lambda"]);
    editPlayer(0, { inventory: [item("draven", "draven")] });
    store().useItem("draven");
    expect(store().pendingReaction?.reactorIds).toEqual([playerId(1)]);

    store().resolveReaction(playerId(1));
    expect(store().players.map((player) => player.position)).toEqual([HELL_NODE_ID, 0, HELL_NODE_ID]);
  });

  it("never answers a Tomate, only thrown for fun", () => {
    startTable(["lambda", "no-thanks"]);
    editPlayer(0, { inventory: [{ id: "tomatoes", kind: "item", itemId: "tomato", count: 2 }] });
    store().useItem("tomatoes", playerId(1));
    expect(store().pendingReaction).toBeNull();
    expect(store().lastTomatoThrow?.targetId).toBe(playerId(1));
  });

  it(`stays closed ${NO_THANKS_COOLDOWN_ROUNDS} rounds once used`, () => {
    startTable(["lambda", "no-thanks"]);
    editPlayer(0, { inventory: [item("finger-1", "middle-finger"), item("finger-2", "middle-finger")] });
    store().useItem("finger-1", playerId(1));
    store().resolveReaction(playerId(1));

    useGameStore.setState({ round: NO_THANKS_COOLDOWN_ROUNDS, energyLeft: BASE_ENERGY });
    store().useItem("finger-2", playerId(1));
    expect(store().pendingReaction).toBeNull();
    expect(store().players[1].skippedTurns).toBe(1);
  });
});

describe("Non merci on wheels", () => {
  it("cancels a wheel spun for its holder, after the result", () => {
    startTable(["no-thanks", "lambda"]);
    landWheel(0, "lose-400", 400);
    store().cancelWheel(true);

    expect(store().players[0].currency).toBe(STARTING_CURRENCY);
    expect(store().pendingWheel).toBeNull();
    expect(store().players[0].noThanksReadyRound).toBe(store().round + NO_THANKS_COOLDOWN_ROUNDS);
  });

  it("is refused while recharging, or for a wheel spun for somebody else", () => {
    startTable(["no-thanks", "lambda"]);
    editPlayer(0, { noThanksReadyRound: 4 });
    landWheel(0, "lose-400", 400);
    const recharging = store();
    store().cancelWheel(true);
    expect(store().pendingWheel).toBe(recharging.pendingWheel);

    landWheel(1, "lose-400", 400);
    store().cancelWheel(true);
    expect(store().pendingWheel).not.toBeNull();
  });
});

describe("Non merci on Bullet Bill", () => {
  /** Player 2 holds Non merci on tile 5, right where Bullet Bill waits; the round is about to end. */
  function chargeTheHolder(): void {
    startTable(["lambda", "no-thanks"]);
    editPlayer(1, { position: 5 });
    useGameStore.setState({
      activePlayerIndex: 1,
      turnStage: "turn-end",
      bulletBill: { status: "active", position: 5, spawnRound: 1 },
    });
    store().endTurn();
  }

  it("holds the turn change until its victim answers", () => {
    chargeTheHolder();
    expect(store()).toMatchObject({ turnStage: "reaction", round: 1, activePlayerIndex: 1 });
    expect(store().pendingReaction).toMatchObject({
      actorId: null,
      action: { type: "bullet-bill", victimId: playerId(1) },
      reactorIds: [playerId(1)],
    });
  });

  it("fizzles out when the victim says Non merci, and the round goes on", () => {
    chargeTheHolder();
    store().resolveReaction(playerId(1));

    expect(store().bulletBill).toBeNull();
    expect(store().lastBulletFlight).toMatchObject({ victimId: null, dodgedBy: playerId(1) });
    expect(store().players[1]).toMatchObject({ currency: STARTING_CURRENCY, skippedTurns: 0 });
    expect(store()).toMatchObject({ round: 2, activePlayerIndex: 0, turnStage: "move" });
    expect(store().players[1].noThanksReadyRound).toBe(2 + NO_THANKS_COOLDOWN_ROUNDS);
  });

  it("hits as usual when the victim lets it", () => {
    chargeTheHolder();
    store().resolveReaction(null);

    expect(store().bulletBill).toBeNull();
    expect(store().players[1]).toMatchObject({ currency: STARTING_CURRENCY - 200, skippedTurns: 1 });
    expect(store()).toMatchObject({ round: 2, activePlayerIndex: 0 });
  });
});

describe("Je note", () => {
  it("keeps a copy of a single-target item one time in three", () => {
    startTable(["lambda", "i-take-notes"]);
    editPlayer(0, { inventory: [item("finger-1", "middle-finger"), item("finger-2", "middle-finger")] });
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    store().useItem("finger-1", playerId(1));
    expect(store().players[1].inventory).toEqual([]);

    vi.spyOn(Math, "random").mockReturnValue(0.1);
    useGameStore.setState({ energyLeft: BASE_ENERGY });
    store().useItem("finger-2", playerId(1));
    expect(store().players[1].inventory).toEqual([expect.objectContaining({ itemId: "middle-finger" })]);
  });

  it("never copies a mud", () => {
    startTable(["lambda", "i-take-notes"]);
    vi.spyOn(Math, "random").mockReturnValue(0);
    useGameStore.setState({ activePlayerIndex: 1, mudTraps: [{ id: "trap", nodeId: 2, ownerId: playerId(0) }] });
    store().movePlayer(2);
    expect(store().players[1].inventory).toEqual([]);
  });
});

describe("Red light, Green light", () => {
  it("pays on two green tiles and charges two red ones per Red Cup", () => {
    startTable(["red-light-green-light", "lambda"]);
    const holder = playerId(0);
    let state = addRedGreenBonuses(store(), holder, [1, 5, 7]);
    expect(state.players[0].currency).toBe(STARTING_CURRENCY + 200);
    state = addRedGreenBonuses(state, holder, [4, 6, 10]);
    expect(state.players[0].currency).toBe(STARTING_CURRENCY + 100);
    expect(state.redGreenTriggers).toEqual({ green: 2, red: 2 });
    expect(addRedGreenBonuses(state, holder, [1, 4]).players[0].currency).toBe(STARTING_CURRENCY + 100);
  });

  it("counts afresh with every new Red Cup", () => {
    startTable(["red-light-green-light", "lambda"]);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    useGameStore.setState({ redCupNodeId: 2, redGreenTriggers: { green: 2, red: 2 } });
    store().movePlayer(2);
    expect(store().redGreenTriggers).toEqual({ green: 0, red: 0 });
  });
});

describe("New Cup, New Me", () => {
  /** Player 1 walks 10 → 8 for the Cup (a shop) while the player at `holderIndex` holds New Cup, New Me. */
  function collectCup(holderIndex: number): void {
    const passives: PassiveId[] = ["lambda", "lambda"];
    passives[holderIndex] = "new-cup-new-me";
    startTable(passives);
    editPlayer(0, { position: 10 });
    editPlayer(1, { position: 4 });
    store().movePlayer(8);
    expect(store()).toMatchObject({ turnStage: "reposition", redCupNodeId: null });
  }

  it("sends its holder to the start with the start bonus before the Cup appears, without a wheel", () => {
    collectCup(1);
    store().resolveNewCup(true);

    expect(store().players[1]).toMatchObject({ position: 0, currency: STARTING_CURRENCY + START_BONUS });
    expect(store().redCupNodeId).not.toBeNull();
    expect(store().pendingTileWheels).toEqual([]);
    // The collector, still on the shop tile, keeps the shop they walked to.
    expect(store().turnStage).toBe("shop");
  });

  it("lets its holder stay where they are", () => {
    collectCup(1);
    store().resolveNewCup(false);
    expect(store().players[1]).toMatchObject({ position: 4, currency: STARTING_CURRENCY });
    expect(store().turnStage).toBe("shop");
  });

  it("closes the shop the collector leaves for the start", () => {
    collectCup(0);
    store().resolveNewCup(true);
    expect(store().players[0].position).toBe(0);
    expect(store().turnStage).toBe("turn-end");
  });

  it("drops the wheel of a coloured tile left behind, for good", () => {
    startTable(["new-cup-new-me", "lambda"]);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    useGameStore.setState({ redCupNodeId: 4 });
    store().movePlayer(4);
    store().resolveNewCup(true);
    expect(store().pendingTileWheels).toEqual([]);
    expect(store().turnStage).toBe("turn-end");
  });

  it("takes its holder out of Hell", () => {
    collectCup(1);
    useGameStore.setState({ redCupNodeId: null });
    editPlayer(1, { position: HELL_NODE_ID, hellTurns: 2 });
    store().resolveNewCup(true);
    expect(store().players[1].position).toBe(0);
  });
});

describe("Calme-toi", () => {
  /**
   * Player 1 walks 0 → 2 for the Cup; the next one lands on 8. Player 2, the
   * holder, stands 3 steps from it on 6; player 3 one step away on 10, player
   * 1 two steps away on 2.
   */
  function newCupOnEight(): void {
    startTable(["lambda", "calm-down", "lambda"]);
    editPlayer(1, { position: 6 });
    editPlayer(2, { position: 10 });
    useGameStore.setState({ redCupNodeId: 2 });
    // Candidates for the next Cup: 1, 3, 4, 5, 6, 7, 8, 9, 10.
    vi.spyOn(Math, "random").mockReturnValue(6.5 / 9);
    store().movePlayer(2);
  }

  it("offers every player one or two steps from the new Cup, closer to it than the holder", () => {
    newCupOnEight();
    expect(store().redCupNodeId).toBe(8);
    expect(store().turnStage).toBe("passive-choice");
    expect(store().pendingCalmDown?.targetIds).toEqual([playerId(0), playerId(2)]);
    expect(getCalmDownTiles(store())).toEqual([3, 5, 6, 7, 9]);
  });

  it("sets them down three steps from the Cup, one after the other, without a wheel", () => {
    newCupOnEight();
    const before = store();
    store().resolveCalmDown(4);
    expect(store()).toBe(before);

    store().resolveCalmDown(5);
    expect(store().players[0].position).toBe(5);
    expect(store().pendingCalmDown?.targetIds).toEqual([playerId(2)]);

    store().resolveCalmDown(null);
    expect(store().players[2].position).toBe(10);
    expect(store()).toMatchObject({ turnStage: "turn-end", pendingCalmDown: null, pendingTileWheels: [] });
  });

  it("spares players farther from the Cup than its holder", () => {
    startTable(["lambda", "calm-down", "lambda"]);
    editPlayer(1, { position: 10 });
    useGameStore.setState({ redCupNodeId: 2 });
    vi.spyOn(Math, "random").mockReturnValue(6.5 / 9);
    store().movePlayer(2);
    expect(store().pendingCalmDown).toBeNull();
  });
});

describe("saves from before the passive rework", () => {
  it("renames old passives and turns removed ones into Lambda", () => {
    startTable(["lambda", "goblin", "corrupter", "lambda"]);
    const saved = pickGameState(store());
    const legacy = {
      ...saved,
      players: saved.players.map((player, index) => ({
        ...player,
        passiveId: ["penta", "troll", "delinquent", "im-cups"][index],
      })),
    };
    const upgraded = migrateGameSave(legacy, 13);
    expect(upgraded.players.map((player) => player.passiveId)).toEqual(["lambda", "goblin", "corrupter", "lambda"]);
    expect(upgraded.redGreenTriggers).toEqual({ green: 0, red: 0 });
  });
});
