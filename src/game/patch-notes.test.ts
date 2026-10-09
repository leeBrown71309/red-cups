import { afterEach, describe, expect, it, vi } from "vitest";
import { getBoard, getNeighbors } from "./board";
import { advanceBulletBill } from "./bullet-bill";
import { ITEM_CATALOG, PASSIVE_CATALOG } from "./catalog";
import { canUseItemKind } from "./passive-rules";
import { getRefusedPassifs } from "./draft";
import { triggerPortal } from "./devil";
import { canEndTurn } from "./energy";
import { withPassives } from "./forced-passives";
import { canWalkWithBoot, getForwardTiles } from "./game-actions";
import { getTurnMoveOptions } from "./rules";
import { offerGamble } from "./gamble";
import { startWheel, triggerMud } from "./game-effects";
import { applyCurrencyChange } from "./state-utils";
import { useGameStore } from "./store";
import type { InventoryEntry, ItemId, PassiveId, Player } from "./types";
import {
  BARRIER_TURNS,
  BULLET_BILL_DAMAGE,
  HELL_NODE_ID,
  MUD_PENALTY,
  START_NODE_ID,
  STARTING_CURRENCY,
} from "./types";

/** The second patch note of 0.1.6: prices, Barrière and Botte, Bullet Bill, Calme-toi, Double or nothing. */

function startTable(passives: (PassiveId | PassiveId[])[]): void {
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

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("prices and the Barrière", () => {
  it("sells the Parachute for 650, the Barrière for 400 and Doomsday for 555", () => {
    expect(ITEM_CATALOG.parachute.price).toBe(650);
    expect(ITEM_CATALOG.barrier.price).toBe(400);
    expect(ITEM_CATALOG.doomsday.price).toBe(555);
  });

  it("closes a road for a single table turn", () => {
    expect(BARRIER_TURNS).toBe(1);
  });
});

describe("the Botte against a Barrière", () => {
  function startWithBarrier(): { from: number; across: number } {
    startTable(["lambda", "lambda"]);
    const from = store().players[0].position;
    const across = getNeighbors(getBoard(store()), from)[0];
    useGameStore.setState({
      barriers: [{ ownerId: store().players[1].id, a: from, b: across, turnsLeft: 1 }],
      energyLeft: 4,
    });
    return { from, across };
  }

  it("hops over the Barrière right in front, one tile only", () => {
    const { across } = startWithBarrier();
    const player = store().players[0];
    // On foot, the barred road stays shut.
    expect(getTurnMoveOptions({ ...store(), moveDistance: 1 }, player).some((path) => path[0] === across)).toBe(false);
    // With the Botte on, it can be hopped, and only for a single step.
    const jump = getTurnMoveOptions({ ...store(), moveDistance: 2 }, player).find((path) => path[0] === across);
    expect(jump).toEqual([across]);
  });

  it("moves the player across the Barrière and ends the walk there", () => {
    const { across } = startWithBarrier();
    editPlayer(0, { inventory: [item("boot", "boot")] });
    store().prepareBoot("boot");
    expect(store().moveDistance).toBe(2);
    store().movePlayer(across);
    expect(store().players[0].position).toBe(across);
  });
});

describe("the Botte", () => {
  it("cannot be put on, then left unused: the turn only ends after the walk", () => {
    startTable(["lambda", "lambda"]);
    editPlayer(0, { inventory: [item("boot", "boot")] });
    expect(canEndTurn(store())).toBe(false);
    store().prepareBoot("boot");
    expect(store().moveDistance).toBe(2);
    expect(canEndTurn(store())).toBe(false);
    store().endTurn();
    expect(store().activePlayerIndex).toBe(0);
    store().movePlayer(getTurnMoveOptions(store(), store().players[0])[0].at(-1)!);
    expect(store().activePlayerIndex).toBe(0);
    // The walk is played: the Botte is spent and the turn goes on to its tile (wheel, shop or end).
    expect(store().turnStage).not.toBe("move");
    expect(store().moveDistance).toBe(1);
  });

  it("is refused when no road is open for it", () => {
    startTable(["lambda", "lambda"]);
    editPlayer(0, { inventory: [item("boot", "boot")] });
    const board = getBoard(store());
    const from = store().players[0].position;
    // Every road out of the tile is barred, the Botte included: nothing is open for a walk of two tiles.
    const roads = getNeighbors(board, from);
    useGameStore.setState({
      barriers: roads.map((road) => ({ ownerId: store().players[1].id, a: from, b: road, turnsLeft: 1 })),
    });
    // Barred roads can still be hopped, so the Botte is allowed there; bar the whole neighbourhood in Hell instead.
    expect(canWalkWithBoot(store(), store().players[0])).toBe(true);
    editPlayer(0, { position: HELL_NODE_ID });
    expect(canWalkWithBoot(store(), store().players[0])).toBe(false);
    store().prepareBoot("boot");
    expect(store().moveDistance).toBe(1);
    expect(store().players[0].inventory).toHaveLength(1);
  });
});

describe("the cards a table is dealt", () => {
  it("never deals L'Ange-Gardien the Piégeur, nor Cupide the Nepo Baby", () => {
    expect(getRefusedPassifs("guardian-angel")).toContain("trapper");
    expect(getRefusedPassifs("greedy")).toContain("nepo-baby");
    expect(getRefusedPassifs("lambda")).toEqual([]);
  });

  it("never gives L'Ange-Gardien an item that harms through a wheel", () => {
    startTable(["guardian-angel", "lambda", "lambda", "lambda"]);
    for (let attempt = 0; attempt < 60; attempt += 1) {
      editPlayer(0, { inventory: [] });
      useGameStore.setState({
        turnStage: "wheel-result",
        pendingWheel: {
          id: `wheel-${attempt}`,
          wheelId: "fortune",
          playerId: store().players[0].id,
          result: { id: "free-item", label: "Objet gratuit" },
          resumeStage: "turn-end",
        },
      });
      vi.spyOn(Math, "random").mockReturnValue((attempt + 0.5) / 60);
      store().resolveWheel();
      for (const entry of store().players[0].inventory) {
        if (entry.kind === "item") expect(canUseItemKind(store().players[0], entry.itemId)).toBe(true);
      }
      vi.restoreAllMocks();
    }
  });
});

describe("Bullet Bill", () => {
  it("hurts everybody standing on the tile it explodes on", () => {
    startTable(["lambda", "lambda", "lambda"]);
    useGameStore.setState((state) => ({
      bulletBill: { status: "active", position: 5, spawnRound: state.round },
      players: state.players.map((player, index) => ({ ...player, position: index < 2 ? 5 : 9 })),
    }));
    const next = advanceBulletBill(store(), store().round);
    const [first, second, third] = next.players;
    expect(first.currency).toBe(STARTING_CURRENCY - BULLET_BILL_DAMAGE);
    expect(second.currency).toBe(STARTING_CURRENCY - BULLET_BILL_DAMAGE);
    expect(third.currency).toBe(STARTING_CURRENCY);
    expect(first.skippedTurns).toBeGreaterThan(0);
    expect(second.skippedTurns).toBeGreaterThan(0);
    expect(third.skippedTurns).toBe(0);
    expect(next.bulletBill).toBeNull();
  });
});

describe("Calme-toi", () => {
  it("sets down one player of the holder's choice and lets the others be", () => {
    startTable(["calm-down", "lambda", "lambda", "lambda"]);
    const ids = store().players.map((player) => player.id);
    useGameStore.setState({
      turnStage: "passive-choice",
      pendingCalmDown: { passivePlayerId: ids[0], targetIds: [ids[1], ids[2]], resumeStage: "turn-end" },
    });
    const before = store().players.map((player) => player.position);
    store().resolveCalmDown(null, ids[2]);
    expect(store().pendingCalmDown).toBeNull();
    expect(store().players.map((player) => player.position)).toEqual(before);
  });

  it("refuses a target that was not offered, and keeps the choice open", () => {
    startTable(["calm-down", "lambda", "lambda"]);
    const ids = store().players.map((player) => player.id);
    useGameStore.setState({
      turnStage: "passive-choice",
      pendingCalmDown: { passivePlayerId: ids[0], targetIds: [ids[1]], resumeStage: "turn-end" },
    });
    store().resolveCalmDown(null, ids[2]);
    expect(store().pendingCalmDown).not.toBeNull();
  });
});

describe("Double or nothing", () => {
  it("pays the owner of a Boue double when the loss is doubled, and nothing when it is wiped out", () => {
    for (const [roll, doubled] of [
      [0.1, true],
      [0.9, false],
    ] as const) {
      startTable(["double-or-nothing", "lambda"]);
      const [victim, owner] = store().players;
      useGameStore.setState((state) => ({
        mudTraps: [{ id: "mud", nodeId: 3, ownerId: owner.id }],
        players: state.players.map((player) => (player.id === victim.id ? { ...player, position: 3 } : player)),
      }));
      const after = triggerMud(store(), victim.id, 3, 1);
      expect(after.pendingGambles[0]).toMatchObject({ playerId: victim.id, amount: -MUD_PENALTY });
      expect(after.pendingGambles[0].linked?.playerId).toBe(owner.id);
      const reward = after.pendingGambles[0].linked!.amount;
      const ownerBefore = after.players[1].currency;

      useGameStore.setState(offerGamble({ ...after, turnStage: "turn-end" }));
      vi.spyOn(Math, "random").mockReturnValue(roll);
      store().resolveGamble(true);
      expect(store().players[1].currency).toBe(doubled ? ownerBefore + reward : ownerBefore - reward);
      expect(store().players[0].currency).toBe(
        doubled ? STARTING_CURRENCY_FOR_DOUBLE - 2 * MUD_PENALTY : STARTING_CURRENCY_FOR_DOUBLE,
      );
      expect(store().lastGambleResult).toMatchObject({ playerId: victim.id, doubled });
      vi.restoreAllMocks();
      store().resetGame();
    }
  });

  it("lets a loss that would knock the holder out be staked first, and wiped out for good", () => {
    startTable(["double-or-nothing", "lambda"]);
    const holder = store().players[0];
    editPlayer(0, { currency: -250 });
    const lost = applyCurrencyChange(store(), holder.id, -100);
    // Not knocked out yet: the balance waits for the gamble.
    expect(lost.players[0].currency).toBe(-350);
    expect(lost.players[0].skippedTurns).toBe(0);
    expect(lost.pendingGambles[0].knockout).toBe(true);

    useGameStore.setState(offerGamble({ ...lost, turnStage: "turn-end" }));
    expect(store().turnStage).toBe("gamble");
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    store().resolveGamble(true);
    expect(store().players[0].currency).toBe(-250);
    expect(store().players[0].skippedTurns).toBe(0);
  });

  it("knocks the holder out once the stake is lost or refused", () => {
    for (const accept of [true, false]) {
      startTable(["double-or-nothing", "lambda"]);
      const holder = store().players[0];
      editPlayer(0, { currency: -250 });
      useGameStore.setState(offerGamble({ ...applyCurrencyChange(store(), holder.id, -100), turnStage: "turn-end" }));
      vi.spyOn(Math, "random").mockReturnValue(0.1);
      store().resolveGamble(accept);
      expect(store().players[0].currency).toBe(0);
      expect(store().players[0].skippedTurns).toBeGreaterThan(0);
      vi.restoreAllMocks();
      store().resetGame();
    }
  });
});

/** The gambler's purse when the table starts: the card changes nothing. */
const STARTING_CURRENCY_FOR_DOUBLE = STARTING_CURRENCY;

// Silence the unused import of the start tile: the Botte tests rely on the table's own start position.
void START_NODE_ID;

describe("the second wheel of a pair", () => {
  const draw = (wedge: number) => (wedge + 0.5) / 8;

  it("waits for the decision the first result opened, then applies in the same turn", () => {
    startTable(["angelic-touch", "lambda"]);
    const [holder] = store().players;
    // Wedge 4 is « Avance d’une case », wedge 3 is +400 pièces.
    vi.spyOn(Math, "random").mockReturnValueOnce(draw(4)).mockReturnValueOnce(draw(3));
    useGameStore.setState(startWheel(store(), "fortune", holder.id, "move"));
    store().resolveWheel();
    expect(store().turnStage).toBe("advance");
    expect(store().queuedWheels).toHaveLength(1);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY);

    const step = getForwardTiles(store(), store().players[0])[0];
    store().advanceOneTile(step);
    expect(store().queuedWheels).toEqual([]);
    expect(store().players[0].currency).toBeGreaterThanOrEqual(STARTING_CURRENCY + 400);
  });
});

describe("shop purchases in the journal", () => {
  it("never write the price, so a toast gives nothing away", () => {
    startTable(["lambda", "lambda"]);
    editPlayer(0, { position: 3 });
    useGameStore.setState({ turnStage: "shop" });
    store().buyItem("eraser");
    const texts = store().log.map((entry) => entry.secret?.publicText ?? entry.text);
    expect(texts.some((text) => text.includes("pièces"))).toBe(false);
    expect(texts.some((text) => text.includes("a effectué un achat"))).toBe(true);
  });
});

describe("patch 0.2.0: the players' reports", () => {
  const drawFortuneStart = (7 + 0.5) / 8;

  it("says Nepo Baby starts with 1 000 coins more, and New Cup, New Me never frees from Hell", () => {
    expect(PASSIVE_CATALOG["nepo-baby"].description).toContain("1 000 pièces de plus");
    expect(PASSIVE_CATALOG["new-cup-new-me"].description).toContain("Enfer");
  });

  it("lets the wheel of fortune's « Va au Départ » be refused for nothing instead", () => {
    startTable(["lambda", "lambda"]);
    const holder = store().players[1];
    vi.spyOn(Math, "random").mockReturnValue(drawFortuneStart);
    useGameStore.setState(startWheel(store(), "fortune", holder.id, "turn-end"));
    expect(store().pendingWheel).toMatchObject({ result: { id: "go-to-start" }, randomFallback: true });
    expect(store().pendingWheel?.choices?.[1].id).toBe("nothing");

    store().pickWheelResult(1);
    store().resolveWheel();
    expect(store().players[1]).toMatchObject({ position: 0, currency: STARTING_CURRENCY });
    vi.restoreAllMocks();
  });

  it("settles the Départ/rien choice left to the clock at 50/50", () => {
    for (const [roll, goesToStart] of [
      [0.2, true],
      [0.9, false],
    ] as const) {
      startTable(["lambda", "lambda"]);
      const holder = store().players[1];
      vi.spyOn(Math, "random").mockReturnValueOnce(drawFortuneStart);
      useGameStore.setState(startWheel(store(), "fortune", holder.id, "turn-end"));
      vi.spyOn(Math, "random").mockReturnValue(roll);
      store().resolveWheel();
      expect(store().players[1].currency).toBe(goesToStart ? STARTING_CURRENCY + 200 : STARTING_CURRENCY);
      expect(store().pendingWheel).toBeNull();
      vi.restoreAllMocks();
      store().resetGame();
    }
  });

  it("leaves Main verte's two-wheel choice on top of the Départ/rien choice", () => {
    startTable(["green-hand", "lambda"]);
    const holder = store().players[0];
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(drawFortuneStart)
      .mockReturnValueOnce(0.5 / 8);
    useGameStore.setState(startWheel(store(), "fortune", holder.id, "turn-end"));
    expect(store().pendingWheel).toMatchObject({ result: { id: "go-to-start" } });
    expect(store().pendingWheel?.choices?.[1].id).toBe("gain-100");
    expect(store().pendingWheel?.randomFallback).toBeUndefined();
  });

  it("keeps the knocked-out mark past the skipped turn, so le diable's Toucher d'Enfer still strikes", () => {
    startTable(["devil", "lambda", "lambda"]);
    editPlayer(0, { position: 4, inventory: [item("touch", "hell-touch")] });
    editPlayer(2, { position: 9, skippedTurns: 1, knockedOut: true });
    useGameStore.setState({ activePlayerIndex: 0, turnStage: "turn-end", energyLeft: 3 });
    store().endTurn(); // the second lambda plays
    useGameStore.setState({ turnStage: "turn-end" });
    store().endTurn(); // the skipped player is passed over, le diable sits down
    expect(store().activePlayerIndex).toBe(0);
    expect(store().players[2]).toMatchObject({ skippedTurns: 0, knockedOut: true });

    store().movePlayer(9); // the devil steps onto the still-marked victim
    expect(store().players[2].position).toBe(HELL_NODE_ID);
    expect(store().players[0].inventory.some((entry) => entry.kind === "item" && entry.itemId === "hell-touch")).toBe(
      false,
    );
  });

  it("frees the knocked-out mark when the player sits down to play again", () => {
    startTable(["lambda", "lambda"]);
    editPlayer(1, { skippedTurns: 1, knockedOut: true });
    useGameStore.setState({ turnStage: "turn-end" });
    store().endTurn(); // the skipped turn goes by: the mark stays
    expect(store().players[1]).toMatchObject({ skippedTurns: 0, knockedOut: true });
    useGameStore.setState({ turnStage: "turn-end" });
    store().endTurn(); // seated to play at last
    expect(store().players[1].knockedOut).toBe(false);
    expect(store().activePlayerIndex).toBe(1);
  });
});

describe("patch 0.2.1: the players' reports of October 8th", () => {
  it("says Hollow Purple never aims at a player already in Hell, and Portails pick the Cup before the fall", () => {
    expect(ITEM_CATALOG["hollow-purple"].description).toContain("déjà");
    expect(ITEM_CATALOG.portal.description).toContain("ne s’active pas");
    expect(ITEM_CATALOG.portal.description).toContain("ramassée");
  });

  it("swallows the queued wheel and the shop with the player who falls into a Portail", () => {
    startTable(["devil", "lambda"]);
    const victim = store().players[1];
    useGameStore.setState({
      activePlayerIndex: 1,
      turnStage: "shop",
      hellPortals: [{ id: "p1", nodeId: 1, casterId: playerId(0), untilRound: 99 }],
      pendingTileWheels: [{ playerId: victim.id, nodeId: 1 }],
    });
    editPlayer(1, { position: 1 });
    const fallen = triggerPortal(store(), victim.id);
    expect(fallen.players[1].position).toBe(HELL_NODE_ID);
    expect(fallen.pendingTileWheels).toEqual([]);
    expect(fallen.turnStage).toBe("turn-end");
  });

  it("leaves a Parachuted player's wheel and shop alone", () => {
    startTable(["devil", "lambda"]);
    const victim = store().players[1];
    editPlayer(1, { position: 1, inventory: [item("para", "parachute")] });
    useGameStore.setState({
      activePlayerIndex: 1,
      turnStage: "shop",
      hellPortals: [{ id: "p1", nodeId: 1, casterId: playerId(0), untilRound: 99 }],
      pendingTileWheels: [{ playerId: victim.id, nodeId: 1 }],
    });
    const saved = triggerPortal(store(), victim.id);
    expect(saved.players[1].position).toBe(1);
    expect(saved.turnStage).toBe("shop");
    // Tile 1 is green: the owed wheel stands while the player got away with the Parachute.
    expect(saved.pendingTileWheels).toEqual([{ playerId: victim.id, nodeId: 1 }]);
  });
});
