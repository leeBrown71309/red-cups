import { afterEach, describe, expect, it } from "vitest";
import { skipBenchedTurns } from "./game-effects";
import { withPassives } from "./forced-passives";
import { useGameStore } from "./store";

/** A player put to sleep as their turn opens does not play it (patch 0.1.5). */

const store = () => useGameStore.getState();

function startTable(): void {
  useGameStore.getState().startGame(["Joueur 1", "Joueur 2", "Joueur 3"]);
  useGameStore.setState((state) => withPassives(state, ["lambda", "lambda", "lambda"]));
}

afterEach(() => store().resetGame());

describe("A benched player", () => {
  it("loses the turn that opens, once, and the next player plays", () => {
    startTable();
    const benched = { ...store(), players: store().players.map((p, i) => (i === 0 ? { ...p, skippedTurns: 1 } : p)) };
    const next = skipBenchedTurns(benched);
    expect(next.activePlayerIndex).toBe(1);
    expect(next.players[0].skippedTurns).toBe(0);
    expect(next.log.some((entry) => entry.text === "Joueur 1 passe son tour.")).toBe(true);
  });

  it("keeps the turn they are in when they fell asleep after acting", () => {
    startTable();
    const acted = {
      ...store(),
      turnActionTaken: true,
      players: store().players.map((p, i) => (i === 0 ? { ...p, skippedTurns: 1 } : p)),
    };
    expect(skipBenchedTurns(acted)).toBe(acted);
  });
});
