import { afterEach, describe, expect, it, vi } from "vitest";
import { getWheelResults } from "./catalog";
import { expireDevilSpells, isPortalVisible } from "./devil";
import { withPassives } from "./forced-passives";
import { getDevilGoal, getShopItems } from "./passive-rules";
import { countRedCups, getInventoryCapacity } from "./rules";
import { useGameStore } from "./store";
import type { InventoryEntry, ItemId, PassiveId, Player } from "./types";
import { HELL_NODE_ID, PORTAL_ROUNDS, STARTING_CURRENCY, START_NODE_ID } from "./types";

/**
 * Le diable and L'Ange-Gardien (patch 0.1.4) on the classic board. Tile 2
 * spins no wheel and is reached from the start; tile 3 is a shop; the start
 * is reached from tile 8.
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
const playerId = (index: number) => store().players[index].id;
const item = (id: string, itemId: ItemId): InventoryEntry => ({ id, kind: "item", itemId });

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Le diable", () => {
  it("needs ⌊4N − N/2⌋ entries into Hell", () => {
    expect([2, 4, 8].map(getDevilGoal)).toEqual([7, 14, 28]);
  });

  it("counts every turn the others begin in Hell, and wins at the goal", () => {
    startTable(["devil", "lambda", "lambda"]);
    editPlayer(0, { inventory: [item("purple", "hollow-purple")] });
    store().useItem("purple", playerId(1));
    // The entry counts a point, and pays le diable 50 coins (patch 0.1.5).
    expect(store().devilHellTurns).toBe(1);
    expect(store().players[0].currency).toBe(STARTING_CURRENCY + 50);

    useGameStore.setState({ devilHellTurns: getDevilGoal(3) - 1, turnStage: "turn-end" });
    store().endTurn();
    expect(store()).toMatchObject({ phase: "finished", winnerId: playerId(0), winReason: "devil" });
  });

  it("counts a turn skipped in Hell, but never their own", () => {
    startTable(["devil", "lambda", "lambda"]);
    editPlayer(1, { position: HELL_NODE_ID, skippedTurns: 1 });
    useGameStore.setState({ turnStage: "turn-end" });
    store().endTurn();
    // Player 2 skipped their turn in Hell, then player 3 plays outside it.
    expect(store().activePlayerIndex).toBe(2);
    expect(store().devilHellTurns).toBe(1);

    editPlayer(0, { position: HELL_NODE_ID });
    useGameStore.setState({ turnStage: "turn-end" });
    store().endTurn();
    expect(store().activePlayerIndex).toBe(0);
    expect(store().devilHellTurns).toBe(1);
  });

  it("pays le diable 100 coins for their own trips to Hell, and 50 with a point for the others'", () => {
    startTable(["devil", "lambda"]);
    editPlayer(0, { inventory: [item("draven", "draven")] });
    store().useItem("draven");
    expect(store().players[0]).toMatchObject({ position: HELL_NODE_ID, currency: STARTING_CURRENCY + 150 });
    expect(store().devilHellTurns).toBe(1);
  });

  it("walks past the Red Cup, and leaves Hell whenever they please", () => {
    startTable(["devil", "lambda"]);
    useGameStore.setState({ redCupNodeId: 2 });
    store().movePlayer(2);
    expect(countRedCups(store().players[0])).toBe(0);
    expect(store().redCupNodeId).toBe(2);

    startTable(["devil", "lambda"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: 1 });
    useGameStore.setState({ turnStage: "hell" });
    store().leaveHell();
    expect(store().players[0]).toMatchObject({ position: START_NODE_ID, currency: STARTING_CURRENCY });
    expect(store()).toMatchObject({ turnStage: "move", energyLeft: 2 });
  });

  it("pays a point of energy to leave Hell, and cannot without one (author's answer)", () => {
    startTable(["devil", "lambda"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: 1 });
    useGameStore.setState({ turnStage: "hell", energyLeft: 0 });
    store().leaveHell();
    expect(store().players[0].position).toBe(HELL_NODE_ID);
  });

  it("has a shop of their own, never holding the same item twice", () => {
    startTable(["devil", "lambda"]);
    expect(getShopItems(store().players[0])).toEqual(expect.arrayContaining(["portal", "doomsday", "tomato"]));
    expect(getShopItems(store().players[1])).not.toContain("portal");

    editPlayer(0, { position: 3 });
    useGameStore.setState({ turnStage: "shop" });
    store().buyItem("tomato");
    store().buyItem("tomato");
    store().buyItem("sentence");
    store().buyItem("sentence");
    expect(store().players[0].inventory.map((entry) => entry.kind === "item" && entry.itemId)).toEqual([
      "tomato",
      "sentence",
    ]);
    expect(store().players[0].inventory[0]).toMatchObject({ count: 2 });
  });

  it("opens two hidden Portails, into which anybody stopping falls, le diable included, closing both", () => {
    startTable(["devil", "lambda"]);
    editPlayer(0, { inventory: [item("portal", "portal")] });
    store().useItem("portal");
    const [portal, other] = store().hellPortals;
    expect(store().hellPortals).toHaveLength(2);
    expect(portal.nodeId).not.toBe(other.nodeId);
    expect([START_NODE_ID, HELL_NODE_ID, store().redCupNodeId]).not.toContain(portal.nodeId);

    useGameStore.setState({ hellPortals: [{ ...portal, nodeId: 2 }, other] });
    store().movePlayer(2);
    expect(store().players[0].position).toBe(HELL_NODE_ID);
    expect(store().hellPortals).toEqual([]);
  });

  it("shows the first Portail the second round and both the third, then closes them after three", () => {
    startTable(["devil", "lambda"]);
    editPlayer(0, { inventory: [item("portal", "portal")] });
    store().useItem("portal");
    const [first, second] = store().hellPortals;
    const visible = (round: number) =>
      [first, second].filter((portal) => isPortalVisible({ ...store(), round }, portal)).map((portal) => portal.id);
    const cast = store().round;
    expect(visible(cast)).toEqual([]);
    expect(visible(cast + 1)).toEqual([first.id]);
    expect(visible(cast + 2)).toEqual([first.id, second.id]);

    useGameStore.setState({ round: cast + PORTAL_ROUNDS, activePlayerIndex: 0 });
    expect(expireDevilSpells(store()).hellPortals).toEqual([]);
  });

  it("sends the knocked-out players of their tile to Hell with the Toucher d'Enfer", () => {
    startTable(["devil", "lambda", "lambda"]);
    editPlayer(0, { inventory: [item("touch", "hell-touch")] });
    editPlayer(1, { position: 2, skippedTurns: 1 });
    editPlayer(2, { position: 2 });
    store().movePlayer(2);
    expect(store().players.map((player) => player.position)).toEqual([2, HELL_NODE_ID, 2]);
    expect(store().players[0].inventory).toEqual([]);
  });

  it("never lets the Hell wheel's duel call Chance aveugle or L'Ange-Gardien", () => {
    startTable(["lambda", "blind-luck", "guardian-angel", "lambda"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: 1 });
    useGameStore.setState({
      turnStage: "target",
      pendingChallenge: { playerId: playerId(0), resumeStage: "turn-end" },
    });
    store().challengePlayer(playerId(1));
    store().challengePlayer(playerId(2));
    expect(store().pendingChallenge).not.toBeNull();
    store().challengePlayer(playerId(3));
    expect(store().players[3].position).toBe(HELL_NODE_ID);
  });

  it("strikes with the Toucher d'Enfer before a knocked-out player's turn is skipped", () => {
    startTable(["lambda", "devil", "lambda"]);
    editPlayer(1, { position: 5, inventory: [item("touch", "hell-touch")] });
    editPlayer(2, { position: 5, skippedTurns: 1 });
    useGameStore.setState({ turnStage: "turn-end" });
    store().endTurn();
    expect(store().players[2].position).toBe(HELL_NODE_ID);
    expect(store().players[1].inventory).toEqual([]);
  });

  it("strikes with the Toucher d'Enfer as soon as a player is knocked out on le diable's tile", () => {
    startTable(["lambda", "devil", "lambda"]);
    editPlayer(0, { inventory: [item("finger", "middle-finger")] });
    editPlayer(1, { position: 5, inventory: [item("touch", "hell-touch")] });
    editPlayer(2, { position: 5 });
    store().useItem("finger", playerId(2));
    expect(store().players[2].position).toBe(HELL_NODE_ID);
  });

  it("drops the Red Cup into Hell, for whoever arrives there next", () => {
    startTable(["devil", "lambda", "lambda"]);
    editPlayer(0, { inventory: [item("black", "black-cup"), item("purple", "hollow-purple")] });
    editPlayer(2, { position: HELL_NODE_ID, hellTurns: 1 });
    useGameStore.setState({ redCupNodeId: 5 });
    store().useItem("black");
    expect(store()).toMatchObject({ redCupNodeId: HELL_NODE_ID, blackCup: { returnNodeId: 5 } });
    // Already in Hell: no pick-up.
    expect(countRedCups(store().players[2])).toBe(0);

    vi.spyOn(Math, "random").mockReturnValue(0.5);
    useGameStore.setState({ energyLeft: 3 });
    store().useItem("purple", playerId(1));
    expect(countRedCups(store().players[1])).toBe(1);
    expect(store().blackCup).toBeNull();
    expect(store().redCupNodeId).not.toBe(HELL_NODE_ID);
  });

  it("brings the Black Cup back to its tile once its two rounds are over", () => {
    startTable(["devil", "lambda"]);
    useGameStore.setState({
      round: 3,
      redCupNodeId: HELL_NODE_ID,
      blackCup: { casterId: playerId(0), untilRound: 3, returnNodeId: 5, bystanderIds: [] },
    });
    expect(expireDevilSpells(store())).toMatchObject({ redCupNodeId: 5, blackCup: null });
  });

  it("passes Sentence on the broke", () => {
    startTable(["devil", "lambda", "lambda"]);
    editPlayer(0, { inventory: [item("sentence", "sentence")] });
    editPlayer(1, { currency: 0 });
    editPlayer(2, { currency: 100 });
    store().useItem("sentence");
    expect(store().players.map((player) => player.position)).toEqual([0, HELL_NODE_ID, 0]);
  });

  it("turns every tile into a wheel of misfortune with Doomsday: no start bonus, no shop", () => {
    startTable(["devil", "lambda"]);
    editPlayer(0, { inventory: [item("doom", "doomsday")] });
    store().useItem("doom");
    expect(store().doomsday).toMatchObject({ casterId: playerId(0) });

    useGameStore.setState({ activePlayerIndex: 1, turnStage: "move", energyLeft: 3 });
    editPlayer(1, { position: 8 });
    store().movePlayer(0);
    expect(store().players[1].currency).toBe(STARTING_CURRENCY);
    expect(store()).toMatchObject({ turnStage: "tile-wheel", tileWheelResumeStage: "turn-end" });
  });
});

describe("L'Ange-Gardien", () => {
  it("protects a player who is no malefactor, or becomes Lambda", () => {
    startTable(["guardian-angel", "devil", "thief", "lambda"]);
    expect(store().guardian).toEqual({ angelId: playerId(0), protegeId: playerId(3) });

    startTable(["guardian-angel", "devil", "goblin", "corrupter"]);
    expect(store().guardian).toBeNull();
    expect(store().players[0].passiveId).toBe("lambda");
  });

  it("starts with 800 coins and two slots, picks up no Red Cup and spins a two-wedge wheel of misfortune", () => {
    startTable(["guardian-angel", "lambda"]);
    const angel = store().players[0];
    expect(angel.currency).toBe(800);
    expect(getInventoryCapacity(angel)).toBe(2);
    expect(getWheelResults("misfortune", angel).map((result) => result.id)).toEqual(["skip-turn", "nothing"]);

    useGameStore.setState({ redCupNodeId: 2 });
    store().movePlayer(2);
    expect(countRedCups(store().players[0])).toBe(0);
  });

  it("never goes to Hell: they lose their next turn instead", () => {
    startTable(["lambda", "guardian-angel"]);
    editPlayer(0, { inventory: [item("purple", "hollow-purple")] });
    store().useItem("purple", playerId(1));
    expect(store().players[1]).toMatchObject({ position: START_NODE_ID, skippedTurns: 1 });
  });

  it("loses their next turn in the mud, rather than coins", () => {
    startTable(["guardian-angel", "lambda"]);
    useGameStore.setState({ mudTraps: [{ id: "trap", nodeId: 2, ownerId: playerId(1) }] });
    store().movePlayer(2);
    expect(store().players[0]).toMatchObject({ currency: 800, skippedTurns: 1 });
    expect(store().players[1].currency).toBe(STARTING_CURRENCY + 100);
  });

  it("aims only at their protégé", () => {
    startTable(["guardian-angel", "lambda", "lambda"]);
    const protegeIndex = store().players.findIndex((player) => player.id === store().guardian?.protegeId);
    const otherIndex = protegeIndex === 1 ? 2 : 1;
    editPlayer(0, { inventory: [item("rope", "rope")] });
    const state = store();
    store().useItem("rope", playerId(otherIndex));
    expect(store()).toBe(state);
    store().useItem("rope", playerId(protegeIndex));
    expect(store().players[0].inventory).toEqual([]);
  });

  it("gives up two turns to pull their protégé out of Hell", () => {
    startTable(["guardian-angel", "lambda"]);
    editPlayer(0, { position: 2 });
    editPlayer(1, { position: HELL_NODE_ID, hellTurns: 2 });
    store().rescueProtege();
    expect(store().players[1]).toMatchObject({ position: 2, hellTurns: 0 });
    expect(store().players[0].skippedTurns).toBe(2);
    // Freeing the protégé ends the angel's turn (author's answer).
    expect(store()).toMatchObject({ turnStage: "turn-end", energyLeft: 0 });
  });

  it("stops Bullet Bill charging at their protégé with the Bouclier (author's answer)", () => {
    startTable(["lambda", "guardian-angel"]);
    useGameStore.setState({
      guardian: { angelId: playerId(1), protegeId: playerId(0) },
      activePlayerIndex: 1,
      turnStage: "turn-end",
      bulletBill: { status: "active", position: 5, spawnRound: 1 },
    });
    editPlayer(0, { position: 5 });
    editPlayer(1, { position: 2, inventory: [item("shield", "shield")] });
    store().endTurn();
    expect(store().pendingReaction).toMatchObject({
      action: { type: "bullet-bill", victimId: playerId(0) },
      reactorIds: [playerId(1)],
    });

    store().resolveReaction(playerId(1));
    expect(store().bulletBill).toBeNull();
    expect(store().players[0]).toMatchObject({ currency: STARTING_CURRENCY, skippedTurns: 0 });
    expect(store().players[1].inventory).toEqual([]);
  });

  it("blocks an item aimed at their protégé with the Bouclier", () => {
    startTable(["lambda", "guardian-angel", "lambda"]);
    useGameStore.setState({ guardian: { angelId: playerId(1), protegeId: playerId(0) } });
    editPlayer(1, { inventory: [item("shield", "shield")] });
    editPlayer(2, { inventory: [item("purple", "hollow-purple")] });
    useGameStore.setState({ activePlayerIndex: 2 });

    store().useItem("purple", playerId(0));
    expect(store()).toMatchObject({ turnStage: "reaction", pendingReaction: { reactorIds: [playerId(1)] } });
    store().resolveReaction(playerId(1));
    expect(store().players[0].position).toBe(START_NODE_ID);
    expect(store().players[1].inventory).toEqual([]);
    expect(store().players[2].inventory).toEqual([]);
  });

  it("wins along with their protégé", () => {
    startTable(["lambda", "guardian-angel"]);
    useGameStore.setState({ guardian: { angelId: playerId(1), protegeId: playerId(0) }, redCupNodeId: 2 });
    editPlayer(0, {
      inventory: [
        { id: "c1", kind: "red-cup" },
        { id: "c2", kind: "red-cup" },
      ],
    });
    store().movePlayer(2);
    expect(store()).toMatchObject({ phase: "finished", winnerId: playerId(0), coWinnerId: playerId(1) });
  });

  it("takes the place of a protégé who leaves, from Hell", () => {
    startTable(["lambda", "guardian-angel", "lambda"]);
    useGameStore.setState({ guardian: { angelId: playerId(1), protegeId: playerId(2) } });
    editPlayer(2, { passiveId: "red-bull", currency: 1_234, inventory: [{ id: "cup", kind: "red-cup" }] });
    store().abandonGame(playerId(2));
    expect(store().players[1]).toMatchObject({
      passiveId: "red-bull",
      currency: 1_234,
      position: HELL_NODE_ID,
      inventory: [{ id: "cup", kind: "red-cup" }],
    });
    expect(store().guardian).toBeNull();
  });
});
