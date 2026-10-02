import { afterEach, describe, expect, it, vi } from "vitest";
import { ITEM_CATALOG } from "./catalog";
import { useGameStore } from "./store";
import type { PassiveId, Player } from "./types";
import { BASE_ENERGY, BULLET_BILL_DAMAGE, HELL_NODE_ID, STARTING_CURRENCY } from "./types";

/** Patch 0.1.1: Bullet Bill, the Tour de Bénédiction and players leaving a game. */

function startTable(passives: PassiveId[]): void {
  useGameStore.getState().startGame(passives.map((_, index) => `Joueur ${index + 1}`));
  useGameStore.setState((state) => ({
    players: state.players.map((player, index) => ({ ...player, passiveId: passives[index] })),
  }));
}

function editPlayer(index: number, changes: Partial<Player>): void {
  useGameStore.setState((state) => ({
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  }));
}

const store = () => useGameStore.getState();

/** Ends turns until the table reaches the given round. */
function playUntilRound(round: number): void {
  while (store().round < round) {
    if (store().turnStage !== "turn-end") useGameStore.setState({ turnStage: "turn-end" });
    store().endTurn();
  }
}

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Bullet Bill", () => {
  /** The first player launches it from the bag, on their turn. */
  function launchBulletBill(entryId = "bill-1"): void {
    editPlayer(0, { inventory: [{ id: entryId, kind: "item", itemId: "bullet-bill" }] });
    store().useItem(entryId);
  }

  it("goes into the bag when bought: nothing flies yet", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: 8 });
    useGameStore.setState({ turnStage: "shop" });
    store().buyItem("bullet-bill");

    expect(store().bulletBill).toBeNull();
    expect(store().players[0].inventory).toEqual([expect.objectContaining({ itemId: "bullet-bill" })]);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY - ITEM_CATALOG["bullet-bill"].price);
  });

  it("waits on the start once launched, for 2 energy, and flies alone", () => {
    startTable(["built-like-a-tank", "goblin"]);
    launchBulletBill();
    expect(store().bulletBill).toEqual({ status: "waiting", position: 0, spawnRound: 2 });
    expect(store()).toMatchObject({ turnStage: "move", energyLeft: BASE_ENERGY - 2 });

    useGameStore.setState({ energyLeft: BASE_ENERGY });
    launchBulletBill("bill-2");
    expect(store().players[0].inventory).toHaveLength(1);
    expect(store().energyLeft).toBe(BASE_ENERGY);
  });

  it("wakes up and charges the nearest player at the start of the next round", () => {
    startTable(["built-like-a-tank", "goblin"]);
    launchBulletBill();
    // Both players three tiles away: the first seat is chased, one tile at a time.
    editPlayer(0, { position: 6 });
    editPlayer(1, { position: 1 });
    playUntilRound(2);

    expect(store().bulletBill).toEqual(expect.objectContaining({ status: "active", position: 4 }));
    expect(store().lastBulletFlight).toEqual(
      expect.objectContaining({ from: 0, path: [4], targetId: store().players[0].id, victimId: null }),
    );
  });

  it("only closes in on a player two tiles away: one tile per charge", () => {
    startTable(["built-like-a-tank", "goblin"]);
    // Tile 9 is two tiles from the start (0 → 4 → 9), tile 6 three.
    editPlayer(0, { position: 6 });
    editPlayer(1, { position: 9 });
    useGameStore.setState({
      activePlayerIndex: 1,
      turnStage: "turn-end",
      bulletBill: { status: "active", position: 0, spawnRound: 1 },
    });
    store().endTurn();

    const target = store().players[1];
    expect(store().lastBulletFlight).toEqual(expect.objectContaining({ from: 0, path: [4], victimId: null }));
    expect(store().bulletBill).toEqual(expect.objectContaining({ position: 4 }));
    expect(target.currency).toBe(STARTING_CURRENCY);
  });

  it("records the hit so the board can play the explosion", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(1, { position: 5 });
    useGameStore.setState({
      activePlayerIndex: 1,
      turnStage: "turn-end",
      bulletBill: { status: "active", position: 2, spawnRound: 1 },
    });
    editPlayer(0, { position: 4 });
    store().endTurn();

    const victim = store().players[1];
    expect(store().lastBulletFlight).toEqual(
      expect.objectContaining({ from: 2, path: [5], victimId: victim.id, targetId: victim.id }),
    );
    expect(store().bulletBill).toBeNull();
    expect(victim.currency).toBe(STARTING_CURRENCY - BULLET_BILL_DAMAGE);
    expect(victim.skippedTurns).toBe(1);
  });
});

describe("Tour de Bénédiction", () => {
  function breakTheBank(): void {
    useGameStore.setState((state) => ({
      players: state.players.map((player) => ({ ...player, currency: 0 })),
      turnStage: "turn-end",
    }));
  }

  it("makes everybody spin the wheel of fortune, starting after the player whose turn ends", () => {
    startTable(["built-like-a-tank", "goblin", "lambda"]);
    const [first, second, third] = store().players;
    breakTheBank();
    store().endTurn();

    expect(store().turnStage).toBe("blessing");
    expect(store().activePlayerIndex).toBe(0);
    expect(store().blessingQueue).toEqual([second.id, third.id, first.id]);

    store().spinBlessingWheel();
    expect(store().pendingWheel).toEqual(expect.objectContaining({ wheelId: "fortune", playerId: second.id }));
  });

  it("hands the turn on once the whole table has spun", () => {
    startTable(["built-like-a-tank", "goblin"]);
    breakTheBank();
    store().endTurn();
    // Every wheel lands on its first wedge: +100 on the wheel of fortune.
    vi.spyOn(Math, "random").mockReturnValue(0);

    store().spinBlessingWheel();
    store().resolveWheel();
    expect(store().turnStage).toBe("blessing");
    store().spinBlessingWheel();
    store().resolveWheel();

    expect(store().blessingQueue).toEqual([]);
    expect(store().turnStage).toBe("move");
    expect(store().activePlayerIndex).toBe(1);
    expect(store().players.map((player) => player.currency)).toEqual([100, 100]);
  });

  it("does not start while a single player still has coins", () => {
    startTable(["built-like-a-tank", "goblin"]);
    breakTheBank();
    editPlayer(1, { currency: 1 });
    store().endTurn();

    expect(store().turnStage).toBe("move");
    expect(store().activePlayerIndex).toBe(1);
  });
});

describe("abandoning a game", () => {
  it("lets another player leave without interrupting the current turn", () => {
    startTable(["built-like-a-tank", "goblin", "lambda"]);
    const [active, leaver, third] = store().players;
    store().abandonGame(leaver.id);

    expect(store().players.map((player) => player.id)).toEqual([active.id, third.id]);
    expect(store().abandonedPlayers.map((player) => player.id)).toEqual([leaver.id]);
    expect(store().activePlayerIndex).toBe(0);
    expect(store().turnStage).toBe("move");
    expect(store().phase).toBe("playing");
  });

  it("passes the turn to the next seat when the active player leaves", () => {
    startTable(["built-like-a-tank", "goblin", "lambda"]);
    const [, second, third] = store().players;
    useGameStore.setState({ activePlayerIndex: 1 });
    store().abandonGame(second.id);

    expect(store().players[store().activePlayerIndex].id).toBe(third.id);
    expect(store().turnStage).toBe("move");
    expect(store().round).toBe(1);
  });

  it("starts a new round when the last seat leaves on their turn", () => {
    startTable(["built-like-a-tank", "goblin", "lambda"]);
    const [first, , third] = store().players;
    useGameStore.setState({ activePlayerIndex: 2 });
    store().abandonGame(third.id);

    expect(store().players[store().activePlayerIndex].id).toBe(first.id);
    expect(store().round).toBe(2);
  });

  it("keeps pointing at the active player when an earlier seat leaves", () => {
    startTable(["built-like-a-tank", "goblin", "lambda"]);
    const [first, , third] = store().players;
    useGameStore.setState({ activePlayerIndex: 2, turnStage: "shop" });
    editPlayer(2, { position: 8 });
    store().abandonGame(first.id);

    expect(store().players[store().activePlayerIndex].id).toBe(third.id);
    expect(store().turnStage).toBe("shop");
  });

  it("crowns the last player standing", () => {
    startTable(["built-like-a-tank", "goblin"]);
    const [first, second] = store().players;
    store().abandonGame(first.id);

    expect(store().phase).toBe("finished");
    expect(store().winnerId).toBe(second.id);
    expect(store().winReason).toBe("forfeit");
  });

  it("waits until no wheel, duel or decision is pending", () => {
    startTable(["built-like-a-tank", "goblin", "lambda"]);
    editPlayer(0, { position: 9 });
    store().movePlayer(4);
    expect(store().turnStage).toBe("tile-wheel");

    store().abandonGame(store().players[1].id);
    expect(store().players).toHaveLength(3);
  });

  it("frees the leaver's seat in Hell too", () => {
    startTable(["built-like-a-tank", "goblin", "lambda"]);
    editPlayer(1, { position: HELL_NODE_ID });
    store().abandonGame(store().players[1].id);
    expect(store().players.some((player) => player.position === HELL_NODE_ID)).toBe(false);
  });
});
