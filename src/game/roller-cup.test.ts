import { afterEach, describe, expect, it, vi } from "vitest";
import { withPassives } from "./forced-passives";
import { useGameStore } from "./store";
import type { PassiveId, Player } from "./types";

/**
 * Roller (patch 0.2.2): reaching the Red Cup is not enough, the die must show a six. Two throws; two misses leave
 * the Cup in place and the Roller on its tile, and the next turn asks nothing but another try.
 */

const SIX = 0.99;
const MISS = 0.1;

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
const cupsOf = (index: number) => store().players[index].inventory.filter((entry) => entry.kind === "red-cup").length;

/** The next throws of the die, in order, then misses. */
function throws(...values: number[]): void {
  const random = vi.spyOn(Math, "random").mockReturnValue(MISS);
  for (const value of values) random.mockReturnValueOnce(value);
}

/** Roller on tile 10, Red Cup on tile 8 (one road apart), the die already thrown to a single step. */
function rollerNextToTheCup(): void {
  startTable(["roller", "lambda"]);
  useGameStore.setState({ redCupNodeId: 8, activePlayerIndex: 0, turnStage: "move", energyLeft: 3, diceRoll: 1 });
  editPlayer(0, { position: 10 });
}

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Roller : la Red Cup se mérite", () => {
  it("un 6 du premier coup : la Red Cup est ramassée", () => {
    rollerNextToTheCup();
    throws(SIX);
    store().movePlayer(8);
    expect(cupsOf(0)).toBe(1);
    expect(store().lastCupRoll).toMatchObject({ playerId: store().players[0].id, rolls: [6], success: true });
  });

  it("un raté puis un 6 : deuxième chance réussie", () => {
    rollerNextToTheCup();
    throws(MISS, SIX);
    store().movePlayer(8);
    expect(cupsOf(0)).toBe(1);
    expect(store().lastCupRoll?.rolls).toHaveLength(2);
    expect(store().lastCupRoll?.success).toBe(true);
  });

  it("deux ratés : la Red Cup reste là et le Roller aussi", () => {
    rollerNextToTheCup();
    throws(MISS, MISS);
    store().movePlayer(8);
    expect(cupsOf(0)).toBe(0);
    expect(store().redCupNodeId).toBe(8);
    expect(store().players[0].position).toBe(8);
    expect(store().lastCupRoll).toMatchObject({ rolls: [1, 1], success: false });
  });

  it("au tour suivant, il retente sans avoir à bouger : le dé vise la Red Cup", () => {
    rollerNextToTheCup();
    throws(MISS, MISS);
    store().movePlayer(8);
    // The table goes round: the Roller's next turn begins on the Cup's tile.
    useGameStore.setState({ activePlayerIndex: 0, turnStage: "move", energyLeft: 3, diceRoll: null });
    throws(SIX);
    store().rollDice();
    expect(store().diceRoll).toBeNull();
    expect(store().players[0].position).toBe(8);
    expect(cupsOf(0)).toBe(1);
    expect(store().lastCupRoll?.seq).toBe(2);
  });

  it("un autre joueur ramasse la Red Cup sans lancer de dé", () => {
    startTable(["lambda", "roller"]);
    useGameStore.setState({ redCupNodeId: 8, activePlayerIndex: 0, turnStage: "move", energyLeft: 3 });
    editPlayer(0, { position: 10 });
    store().movePlayer(8);
    expect(cupsOf(0)).toBe(1);
    expect(store().lastCupRoll).toBeNull();
  });
});
