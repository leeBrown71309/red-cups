import { afterEach, describe, expect, it } from "vitest";
import { withPassives } from "./forced-passives";
import { useGameStore } from "./store";
import type { PassiveId } from "./types";
import { estimateMovementMs, MUD_SLIP_MS } from "../theme/timing";
import { getBoard } from "./board";

/**
 * Chance aveugle in the mud (patch 0.2.2): the engine still puts them back a tile at once, but the move records
 * that they slipped, so the board can show them setting foot on the mud first and being thrown back.
 */

function startTable(passives: PassiveId[]): void {
  useGameStore.getState().startGame(passives.map((_, index) => `Joueur ${index + 1}`));
  useGameStore.setState((state) => withPassives(state, passives));
}

const store = () => useGameStore.getState();

afterEach(() => store().resetGame());

describe("Chance aveugle : la glissade dans la Boue", () => {
  it("le déplacement garde la case de Boue, marqué comme une glissade, et le joueur recule d'une case", () => {
    startTable(["blind-luck", "lambda"]);
    useGameStore.setState({
      activePlayerIndex: 0,
      turnStage: "move",
      energyLeft: 3,
      mudTraps: [{ id: "trap", nodeId: 8, ownerId: store().players[1].id }],
      players: store().players.map((player, index) => (index === 0 ? { ...player, position: 10 } : player)),
    });
    store().movePlayer(8);
    const movement = store().lastMovement;
    expect(movement?.path[movement.path.length - 1]).toBe(8);
    expect(movement?.slippedInMud).toBe(true);
    expect(store().players[0].position).toBe(10);
    expect(store().mudTraps).toEqual([]);
  });

  it("l'estimation de l'animation compte la glissade, pour que la Boue reste jusqu'à la fin", () => {
    startTable(["blind-luck", "lambda"]);
    const board = getBoard(store());
    const plain = estimateMovementMs(board, { from: 10, path: [8] });
    const slipped = estimateMovementMs(board, { from: 10, path: [8], slippedInMud: true });
    expect(slipped - plain).toBe(MUD_SLIP_MS);
  });

  it("un joueur ordinaire dans la Boue n'est pas marqué : il reste sur la case", () => {
    startTable(["lambda", "lambda"]);
    useGameStore.setState({
      activePlayerIndex: 0,
      turnStage: "move",
      energyLeft: 3,
      mudTraps: [{ id: "trap", nodeId: 8, ownerId: store().players[1].id }],
      players: store().players.map((player, index) => (index === 0 ? { ...player, position: 10 } : player)),
    });
    store().movePlayer(8);
    expect(store().lastMovement?.slippedInMud).toBeUndefined();
    expect(store().players[0].position).toBe(8);
  });
});
