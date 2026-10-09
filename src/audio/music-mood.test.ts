import { afterEach, describe, expect, it } from "vitest";
import { MAP_ORDER, getBoardMap } from "../game/maps/map-registry";
import { useGameStore } from "../game/store";
import { HELL_NODE_ID } from "../game/types";
import { getMusicMood } from "./music-mood";

const store = () => useGameStore.getState();

function moveActivePlayer(position: number): void {
  useGameStore.setState((state) => ({
    players: state.players.map((player, index) =>
      index === state.activePlayerIndex ? { ...player, position } : player,
    ),
  }));
}

afterEach(() => store().resetGame());

describe("music mood", () => {
  it("stays calm outside a game", () => {
    expect(getMusicMood(store())).toBe("calm");
  });

  it.each(MAP_ORDER)("darkens on %s while the player whose turn it is sits in Hell", (mapId) => {
    // A large map only seats a full table.
    const seats = Array.from({ length: getBoardMap(mapId).minPlayers ?? 2 }, (_, index) => `Joueur ${index + 1}`);
    store().startGame(seats, undefined, mapId);
    expect(getMusicMood(store())).toBe("calm");

    moveActivePlayer(HELL_NODE_ID);
    expect(getMusicMood(store())).toBe("tense");
  });

  it("stays calm when only another player is in Hell", () => {
    store().startGame(["Ana", "Bo"], undefined, "banquise");
    useGameStore.setState((state) => ({
      players: state.players.map((player, index) =>
        index === state.activePlayerIndex ? player : { ...player, position: HELL_NODE_ID },
      ),
    }));
    expect(getMusicMood(store())).toBe("calm");
  });
});
