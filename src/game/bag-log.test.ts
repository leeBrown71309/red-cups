import { afterEach, describe, expect, it } from "vitest";
import { useGameStore } from "./store";

/** A line about a bag keeps its owner and a public version (patch 0.1.6). */

const store = () => useGameStore.getState();

afterEach(() => store().resetGame());

describe("bag lines of the journal", () => {
  it("name the owner and hide the item from the others when something is bought", () => {
    store().startGame(["Léa", "Malik"]);
    useGameStore.setState({ turnStage: "shop" });
    useGameStore.setState((state) => ({
      players: state.players.map((player, index) => (index === 0 ? { ...player, position: 3 } : player)),
    }));
    store().buyItem("tomato");
    const [line] = store().log;
    expect(line.text).toContain("achète");
    expect(line.text).toContain("Tomate");
    expect(line.secret).toEqual({ ownerId: store().players[0].id, publicText: "Léa achète un objet." });
  });
});
