import { afterEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "./store";

function startDeterministicGame(): void {
  useGameStore.getState().startGame(["Ada", "Benoît"]);
  useGameStore.setState((state) => ({
    players: state.players.map((player) => ({
      ...player,
      passiveId: "built-like-a-tank",
    })),
  }));
}

describe("Red Cups game store", () => {
  afterEach(() => {
    useGameStore.getState().resetGame();
    vi.restoreAllMocks();
  });

  it("starts players with 2,000 coins and the first Cup on case 8", () => {
    startDeterministicGame();
    const state = useGameStore.getState();

    expect(state.players).toHaveLength(2);
    expect(state.players.every((player) => player.currency === 2_000)).toBe(true);
    expect(state.players.every((player) => player.position === 0)).toBe(true);
    expect(state.redCupNodeId).toBe(8);
  });

  it("collects the starting Cup and opens the shop on a blue space", () => {
    startDeterministicGame();
    useGameStore.getState().movePlayer(8);
    const state = useGameStore.getState();

    expect(state.players[0].inventory.filter((entry) => entry.kind === "red-cup")).toHaveLength(1);
    expect(state.players[0].position).toBe(8);
    expect(state.turnStage).toBe("shop");
    expect(state.redCupCycle).toBe(1);
    expect(state.redCupNodeId).not.toBe(8);
  });

  it("allows multiple affordable purchases during one shop visit", () => {
    startDeterministicGame();
    useGameStore.getState().movePlayer(8);
    useGameStore.getState().buyItem("boot");
    useGameStore.getState().buyItem("ndoye");

    const state = useGameStore.getState();
    const activePlayer = state.players[0];
    expect(activePlayer.currency).toBe(1_600);
    expect(activePlayer.inventory.filter((entry) => entry.kind === "item")).toHaveLength(2);
    expect(state.turnStage).toBe("shop");
  });

  it("applies a wheel result to its selected player", () => {
    startDeterministicGame();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const targetId = useGameStore.getState().players[1].id;

    useGameStore.getState().spinWheel("misfortune", targetId, "turn-end");
    useGameStore.getState().resolveWheel();

    const state = useGameStore.getState();
    expect(state.players[1].currency).toBe(1_900);
    expect(state.turnStage).toBe("turn-end");
    expect(state.pendingWheel).toBeNull();
  });

  it("requires a player to choose an item to discard before collecting a Cup", () => {
    startDeterministicGame();
    const player = useGameStore.getState().players[0];
    const fullInventory = [
      { id: "rope-1", kind: "item" as const, itemId: "rope" as const },
      { id: "mud-1", kind: "item" as const, itemId: "mud" as const },
      { id: "ndoye-1", kind: "item" as const, itemId: "ndoye" as const },
      { id: "boot-1", kind: "item" as const, itemId: "boot" as const },
    ];
    useGameStore.setState({
      redCupNodeId: 4,
      players: useGameStore.getState().players.map((candidate) =>
        candidate.id === player.id
          ? { ...candidate, inventory: fullInventory }
          : candidate,
      ),
    });

    useGameStore.getState().movePlayer(4);
    expect(useGameStore.getState().turnStage).toBe("discard");
    useGameStore.getState().discardInventoryEntry("boot-1");

    const updatedPlayer = useGameStore.getState().players[0];
    expect(updatedPlayer.inventory).toHaveLength(4);
    expect(updatedPlayer.inventory.some((entry) => entry.kind === "red-cup")).toBe(true);
    expect(updatedPlayer.inventory.some((entry) => entry.id === "boot-1")).toBe(false);
  });

  it("resets a balance at −300 and cancels the next turn", () => {
    startDeterministicGame();
    const playerId = useGameStore.getState().players[1].id;
    useGameStore.setState((state) => ({
      players: state.players.map((player) =>
        player.id === playerId ? { ...player, currency: -200 } : player,
      ),
    }));
    vi.spyOn(Math, "random").mockReturnValue(0);

    useGameStore.getState().spinWheel("misfortune", playerId, "turn-end");
    useGameStore.getState().resolveWheel();

    const player = useGameStore.getState().players.find((candidate) => candidate.id === playerId);
    expect(player?.currency).toBe(0);
    expect(player?.skippedTurns).toBe(1);
  });

  it("lets the Bouteille d’eau free a player from Hell", () => {
    startDeterministicGame();
    const playerId = useGameStore.getState().players[0].id;
    useGameStore.setState((state) => ({
      turnStage: "hell",
      players: state.players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              position: 11,
              inventory: [{ id: "bottle-1", kind: "item", itemId: "water-bottle" }],
            }
          : player,
      ),
    }));
    vi.spyOn(Math, "random").mockReturnValue(0);

    useGameStore.getState().useItem("bottle-1");

    const player = useGameStore.getState().players[0];
    expect(player.position).not.toBe(11);
    expect(player.inventory).toHaveLength(0);
    expect(useGameStore.getState().turnStage).toBe("turn-end");
  });

  it("sends Draven’s table to Hell and resolves the winner back to case 0", () => {
    startDeterministicGame();
    const playerIds = useGameStore.getState().players.map((player) => player.id);
    useGameStore.setState((state) => ({
      players: state.players.map((player) =>
        player.id === playerIds[0]
          ? { ...player, inventory: [{ id: "draven-1", kind: "item", itemId: "draven" }] }
          : player,
      ),
    }));

    useGameStore.getState().useItem("draven-1");
    const duel = useGameStore.getState().pendingDuel;
    expect(useGameStore.getState().players.every((player) => player.position === 11)).toBe(true);
    expect(duel).not.toBeNull();

    const winnerId = duel?.mode === "coin-flip" ? duel.coinWinnerId! : playerIds[0];
    useGameStore.getState().resolveDuel(winnerId);
    expect(useGameStore.getState().players.find((player) => player.id === winnerId)?.position).toBe(0);
    expect(useGameStore.getState().players.filter((player) => player.position === 11)).toHaveLength(1);
  });

  it("offers Calme-toi as an optional reaction after a Cup spawns nearby", () => {
    startDeterministicGame();
    const players = useGameStore.getState().players;
    useGameStore.setState({
      players: players.map((player, index) => ({
        ...player,
        passiveId: index === 1 ? "calm-down" : "built-like-a-tank",
      })),
    });
    vi.spyOn(Math, "random").mockReturnValue(0);

    useGameStore.getState().movePlayer(8);
    const state = useGameStore.getState();
    expect(state.turnStage).toBe("passive-choice");
    expect(state.pendingCalmDown?.passivePlayerId).toBe(players[1].id);

    state.resolveCalmDown(false);
    expect(useGameStore.getState().turnStage).toBe("shop");
    expect(useGameStore.getState().pendingCalmDown).toBeNull();
  });

  it("lets Je note copy the object that triggers a wheel", () => {
    startDeterministicGame();
    const players = useGameStore.getState().players;
    const targetId = players[1].id;
    useGameStore.setState({
      players: players.map((player, index) => ({
        ...player,
        passiveId: index === 1 ? "i-take-notes" : "built-like-a-tank",
        inventory: index === 0
          ? [{ id: "ndoye-1", kind: "item", itemId: "ndoye" }]
          : player.inventory,
      })),
    });
    vi.spyOn(Math, "random").mockReturnValue(0);

    useGameStore.getState().useItem("ndoye-1", targetId);
    useGameStore.getState().resolveWheel();

    expect(useGameStore.getState().players[1].inventory).toContainEqual(
      expect.objectContaining({ kind: "item", itemId: "ndoye" }),
    );
  });
});
