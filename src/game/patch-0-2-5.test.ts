import { afterEach, describe, expect, it, vi } from "vitest";
import { ITEM_CATALOG } from "./catalog";
import { getEnergyCapacity } from "./energy";
import { withPassives } from "./forced-passives";
import { isInvisible } from "./mist";
import { advanceMist } from "./mist-cycle";
import { applyCurrencyChange, loseTurns } from "./state-utils";
import { canTargetPlayer } from "./passive-rules";
import { advanceBulletBill } from "./bullet-bill";
import { useGameStore } from "./store";
import { planItemUse } from "./turn-actions";
import type { GameState, PassiveId, Player } from "./types";
import { FOOL_GOAL, FOOL_STUN_FINE, SMOKE_BOMB_HIDDEN_TURNS } from "./types";

/**
 * The reports of patch 0.2.5: Le Fou, la Bombe de fumée. (Disparaître and the Taupe's recent tiles are tested with
 * their cards in `cups-power.test.ts`.) Played on the classic board: tile 0 is the start, 8 holds the first Red Cup.
 */

const store = () => useGameStore.getState();
const pick = (): GameState => store() as GameState;

function startTable(passives: (PassiveId | PassiveId[])[]): void {
  store().startGame(passives.map((_, index) => `Joueur ${index + 1}`));
  useGameStore.setState((state) => withPassives(state, passives));
}

function editPlayer(index: number, changes: Partial<Player>): void {
  useGameStore.setState((state) => ({
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  }));
}

function edit(changes: Partial<GameState>): void {
  useGameStore.setState(changes);
}

function openTurn(seat = 0): void {
  const active = store().players[seat];
  edit({ activePlayerIndex: seat, turnStage: "move", energyLeft: getEnergyCapacity(active, store()), diceRoll: null });
}

const player = (seat: number): Player => store().players[seat];

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Le Fou", () => {
  it("gagne dès que son solde tombe à −2 500 pièces, au tour de qui que ce soit", () => {
    startTable(["fool", "lambda"]);
    edit({ redCupNodeId: 8 });
    editPlayer(0, { currency: FOOL_GOAL + 50 });
    editPlayer(1, { inventory: [{ id: "m", kind: "item", itemId: "middle-finger" }], currency: 1000 });
    openTurn(1);
    expect(store().phase).toBe("playing");
    // The opponent's Middle Finger costs the Fool its fine, which is just what takes it past the goal.
    store().useItem("m", "p1");
    expect(player(0).currency).toBe(FOOL_GOAL - 50);
    expect(store()).toMatchObject({ phase: "finished", winnerId: "p1", winReason: "fool" });
  });

  it("n’est pas remis à zéro à −300 pièces et ne saute aucun tour", () => {
    startTable(["fool", "lambda"]);
    editPlayer(0, { currency: -250 });
    const next = applyCurrencyChange(pick(), "p1", -200);
    expect(next.players[0].currency).toBe(-450);
    expect(next.players[0].skippedTurns).toBe(0);
    expect(next.players[0].knockedOut).toBe(false);
    // A player without the card is reset all the same.
    editPlayer(1, { currency: -250 });
    const other = applyCurrencyChange(pick(), "p2", -200);
    expect(other.players[1].currency).toBe(0);
    expect(other.players[1].skippedTurns).toBe(1);
  });

  it("ne peut pas être assommé : il perd 100 pièces à la place", () => {
    startTable(["fool", "lambda"]);
    const stunned = loseTurns(player(0));
    expect(stunned.skippedTurns).toBe(0);
    expect(stunned.knockedOut).toBe(false);
    expect(stunned.currency).toBe(player(0).currency - FOOL_STUN_FINE);
    // The others lose their turn as usual.
    expect(loseTurns(player(1)).skippedTurns).toBe(1);
  });

  it("un Middle Finger lui coûte 100 pièces, annoncées au journal, et le Réveil reste dans le sac", () => {
    startTable(["lambda", "fool"]);
    edit({ redCupNodeId: 8 });
    editPlayer(0, { inventory: [{ id: "m", kind: "item", itemId: "middle-finger" }], currency: 3000 });
    editPlayer(1, { inventory: [{ id: "w", kind: "item", itemId: "wake-up" }], currency: 1000 });
    openTurn(0);
    store().useItem("m", "p2");
    expect(player(1).currency).toBe(1000 - FOOL_STUN_FINE);
    expect(player(1).skippedTurns).toBe(0);
    expect(player(1).inventory.some((entry) => entry.kind === "item" && entry.itemId === "wake-up")).toBe(true);
    expect(store().log[0].text).toBe(
      `Joueur 2 ne peut pas être assommé : il perd ${FOOL_STUN_FINE} pièces à la place.`,
    );
    expect(player(1).stunsDodged).toBeUndefined();
  });

  it("Bullet Bill le touche (−200) sans lui faire sauter de tour, et l’amende s’ajoute", () => {
    startTable(["fool", "lambda"]);
    edit({ redCupNodeId: 8 });
    editPlayer(0, { position: 2, currency: 1000 });
    editPlayer(1, { position: 5 });
    edit({ bulletBill: { status: "active", position: 2, spawnRound: 1 } });
    const blast = advanceBulletBill(pick(), 2);
    expect(blast.players[0].skippedTurns).toBe(0);
    expect(blast.players[0].currency).toBe(1000 - 200 - FOOL_STUN_FINE);
  });
});

describe("Bombe de fumée", () => {
  it("coûte 500 pièces et 2 points d’énergie, et se désigne soi-même", () => {
    expect(ITEM_CATALOG["smoke-bomb"]).toMatchObject({ price: 500, energyCost: 2, target: "self" });
  });

  it("rend invisible pendant 1 tour : nul ne peut le cibler, Bullet Bill ne le traque pas", () => {
    startTable(["lambda", "lambda", "lambda"]);
    edit({ redCupNodeId: 8 });
    editPlayer(0, { position: 4, inventory: [{ id: "s", kind: "item", itemId: "smoke-bomb" }], currency: 2000 });
    editPlayer(1, { inventory: [{ id: "n", kind: "item", itemId: "ndoye" }], currency: 2000 });
    openTurn(0);
    store().useItem("s");
    expect(store().energyLeft).toBe(getEnergyCapacity(player(0), store()) - 2);
    expect(player(0).hiddenTurns).toBe(SMOKE_BOMB_HIDDEN_TURNS);
    expect(player(0).inventory).toHaveLength(0);
    expect(isInvisible(store(), player(0))).toBe(true);
    expect(store().log[0]).toMatchObject({ open: true });
    expect(store().log[0].text).toContain("devient invisible pour un tour");
    openTurn(1);
    expect(canTargetPlayer(store(), player(1), player(0))).toBe(false);
    expect(planItemUse(store(), "n", "p1")).toBeNull();
    // At the start of their next turn the smoke is gone.
    const after = advanceMist(pick(), "p1");
    expect(after.players[0].hiddenTurns).toBeUndefined();
    expect(isInvisible(after, after.players[0])).toBe(false);
    expect(after.log[0].text).toContain("redevient visible");
  });

  it("ne se lance pas déjà invisible, ni sans 2 points d’énergie", () => {
    startTable(["lambda", "lambda"]);
    edit({ redCupNodeId: 8 });
    editPlayer(0, { inventory: [{ id: "s", kind: "item", itemId: "smoke-bomb" }], currency: 2000, hiddenTurns: 1 });
    openTurn(0);
    expect(planItemUse(store(), "s")).toBeNull();
    editPlayer(0, { hiddenTurns: undefined });
    edit({ energyLeft: 1 });
    expect(planItemUse(store(), "s")).toBeNull();
    edit({ energyLeft: 2 });
    expect(planItemUse(store(), "s")).not.toBeNull();
  });

  it("la Red Cup ne la trahit pas, contrairement à Mi-vu, Mi-vue", () => {
    startTable(["lambda", "lambda"]);
    editPlayer(0, { position: 4, hiddenTurns: 1 });
    edit({ redCupNodeId: 7 });
    expect(isInvisible(store(), player(0))).toBe(true);
  });
});
