import { afterEach, describe, expect, it, vi } from "vitest";
import { isRestorableGame, migrateGameSave, pickGameState } from "./game-save";
import { useGameStore } from "./store";
import type { PassiveId, Player } from "./types";
import { EMPTY_GAME_STATE, HELL_EXIT_TOLL, HELL_NODE_ID, HELL_TURN_LIMIT, START_BONUS } from "./types";

/** Hand-written situations for the rules that matter most at the table. */

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

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Non merci reaction window", () => {
  it("asks the holder, not the active player, before a move happens", () => {
    startTable(["built-like-a-tank", "no-thanks"]);
    store().movePlayer(2);

    expect(store().turnStage).toBe("reaction");
    expect(store().pendingReaction?.reactorIds).toEqual([store().players[1].id]);
    expect(store().players[0].position).toBe(0);
  });

  it("cancels the move and spends the passive for the current Red Cup cycle", () => {
    startTable(["built-like-a-tank", "no-thanks"]);
    store().movePlayer(2);
    store().resolveReaction(store().players[1].id);

    expect(store().players[0].position).toBe(0);
    expect(store().turnStage).toBe("turn-end");
    expect(store().players[1].noThanksUsedCycle).toBe(store().redCupCycle);
  });

  it("lets the move happen when nobody reacts", () => {
    startTable(["built-like-a-tank", "no-thanks"]);
    store().movePlayer(2);
    store().resolveReaction(null);

    expect(store().players[0].position).toBe(2);
    expect(store().pendingReaction).toBeNull();
  });

  it("does not open for the holder's own actions", () => {
    startTable(["no-thanks", "built-like-a-tank"]);
    store().movePlayer(2);
    expect(store().players[0].position).toBe(2);
  });

  it("stays closed once used, until a new Red Cup appears", () => {
    startTable(["built-like-a-tank", "no-thanks"]);
    editPlayer(1, { noThanksUsedCycle: 0 });
    store().movePlayer(2);
    expect(store().turnStage).not.toBe("reaction");

    useGameStore.setState({ redCupCycle: 1, turnStage: "move", activePlayerIndex: 0 });
    editPlayer(0, { position: 0 });
    store().movePlayer(4);
    expect(store().turnStage).toBe("reaction");
  });

  it("refuses a cancel from a player who was not offered the reaction", () => {
    startTable(["built-like-a-tank", "no-thanks", "troll"]);
    store().movePlayer(2);
    store().resolveReaction(store().players[2].id);
    expect(store().turnStage).toBe("reaction");
  });

  it("can cancel an item: the item is spent and its effect never happens", () => {
    startTable(["built-like-a-tank", "no-thanks"]);
    editPlayer(0, { inventory: [{ id: "purple-1", kind: "item", itemId: "hollow-purple" }] });
    store().useItem("purple-1", store().players[1].id);
    expect(store().turnStage).toBe("reaction");

    store().resolveReaction(store().players[1].id);
    expect(store().players[1].position).toBe(0);
    expect(store().players[0].inventory).toHaveLength(0);
  });
});

describe("green and red tile wheels", () => {
  it("spins the wheel of fortune after stopping on a green tile", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: 4 });
    store().movePlayer(7);

    expect(store().turnStage).toBe("tile-wheel");
    store().spinTileWheel();
    expect(store().pendingWheel?.wheelId).toBe("fortune");
  });

  it("spins the wheel of misfortune after stopping on a red tile", () => {
    startTable(["built-like-a-tank", "troll"]);
    store().movePlayer(4);
    store().spinTileWheel();
    expect(store().pendingWheel?.wheelId).toBe("misfortune");
  });

  it("does not spin when only passing over a colored tile with the Botte", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { inventory: [{ id: "boot-1", kind: "item", itemId: "boot" }] });
    store().prepareBoot("boot-1");
    store().movePlayer(3);

    const path = store().lastMovement?.path;
    expect(path).toHaveLength(2);
    expect(store().turnStage).toBe("shop");
  });

  it("collects the Red Cup first, then spins the tile wheel", () => {
    startTable(["built-like-a-tank", "troll"]);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    useGameStore.setState({ redCupNodeId: 4 });
    store().movePlayer(4);

    expect(store().players[0].inventory.filter((entry) => entry.kind === "red-cup")).toHaveLength(1);
    expect(store().turnStage).toBe("tile-wheel");
  });

  it("does not spin the wheel on a neutral, shop or start tile", () => {
    startTable(["built-like-a-tank", "troll"]);
    store().movePlayer(2);
    expect(store().turnStage).toBe("turn-end");
  });
});

describe("arrow tiles and the start bonus", () => {
  it("lets a player walk into an arrow tile backwards, then forces its exit", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: 6 });
    store().movePlayer(3);
    expect(store().players[0].position).toBe(3);

    store().endTurn();
    store().endTurn();
    editPlayer(0, { position: 3 });
    store().movePlayer(4);
    expect(store().players[0].position).toBe(3);
  });

  it("pays the 200 coins when entering the start from 8", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: 8, currency: 500 });
    store().movePlayer(0);
    expect(store().players[0].currency).toBe(700);
  });

  it("lets a player step back from 4 to the start without the bonus", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: 4, currency: 500 });
    store().movePlayer(0);

    expect(store().players[0].position).toBe(0);
    expect(store().players[0].currency).toBe(500);
  });
});

describe("tile wheels after being moved by someone else", () => {
  it("makes a player pulled onto a red tile by the Corde spin the wheel of misfortune", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: 4, inventory: [{ id: "rope-1", kind: "item", itemId: "rope" }] });
    editPlayer(1, { position: 2 });
    useGameStore.setState({ turnStage: "move" });
    store().useItem("rope-1", store().players[1].id);

    expect(store().turnStage).toBe("tile-wheel");
    store().spinTileWheel();
    expect(store().pendingWheel).toEqual(
      expect.objectContaining({ wheelId: "misfortune", playerId: store().players[1].id }),
    );
  });

  it("spins one wheel per player after a Monopoly Man swap between two colored tiles", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: 5, inventory: [{ id: "swap-1", kind: "item", itemId: "monopoly-man" }] });
    editPlayer(1, { position: 6 });
    useGameStore.setState({ turnStage: "move" });
    store().useItem("swap-1", store().players[1].id);

    const [user, target] = store().players;
    expect(
      store()
        .pendingTileWheels.map((entry) => entry.playerId)
        .sort(),
    ).toEqual([user.id, target.id].sort());
    store().spinTileWheel();
    store().resolveWheel();
    while (store().turnStage !== "tile-wheel" && store().pendingWheel) store().resolveWheel();
    expect(store().turnStage).toBe("tile-wheel");
  });

  it("does not spin for a player sent to Hell", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { inventory: [{ id: "purple-1", kind: "item", itemId: "hollow-purple" }] });
    editPlayer(1, { position: 4 });
    store().useItem("purple-1", store().players[1].id);
    expect(store().pendingTileWheels).toEqual([]);
    expect(store().turnStage).toBe("turn-end");
  });
});

describe("Hell sentence", () => {
  /** Ends player 2's turn so that player 1's next turn begins. */
  function passToFirstPlayer(): void {
    useGameStore.setState({ activePlayerIndex: 1, turnStage: "turn-end" });
    store().endTurn();
  }

  it("counts every turn a player starts in Hell", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: 0 });
    passToFirstPlayer();

    expect(store().turnStage).toBe("hell");
    expect(store().players[0].hellTurns).toBe(1);
  });

  it(`releases the player at the start, with the start bonus, for ${HELL_EXIT_TOLL} coins after 5 turns`, () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: HELL_TURN_LIMIT, currency: 1_000 });
    useGameStore.setState({ activePlayerIndex: 0, turnStage: "turn-end" });
    store().endTurn();

    const released = store().players[0];
    expect(released.position).toBe(0);
    expect(released.currency).toBe(1_000 + START_BONUS - HELL_EXIT_TOLL);
    expect(released.hellTurns).toBe(0);
    expect(store().log.some((entry) => entry.text.includes("a purgé"))).toBe(true);
  });

  it("keeps a player in Hell before the last turn", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: HELL_TURN_LIMIT - 1 });
    useGameStore.setState({ activePlayerIndex: 0, turnStage: "turn-end" });
    store().endTurn();
    expect(store().players[0].position).toBe(HELL_NODE_ID);
  });

  it("counts a turn skipped in Hell towards the sentence", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: HELL_TURN_LIMIT - 1, skippedTurns: 1 });
    passToFirstPlayer();

    expect(store().players[0].position).toBe(0);
    expect(store().activePlayerIndex).toBe(1);
  });

  it("cushions the toll with the start bonus before the usual −300 reset", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: HELL_TURN_LIMIT, currency: 100 });
    useGameStore.setState({ activePlayerIndex: 0, turnStage: "turn-end" });
    store().endTurn();
    expect(store().players[0].currency).toBe(-200);
    expect(store().players[0].skippedTurns).toBe(0);

    store().resetGame();
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: HELL_TURN_LIMIT, currency: -100 });
    useGameStore.setState({ activePlayerIndex: 0, turnStage: "turn-end" });
    store().endTurn();
    expect(store().players[0].currency).toBe(0);
    expect(store().players[0].skippedTurns).toBe(1);
  });

  it("gives no start bonus to Je suis Cups on the way out", () => {
    startTable(["im-cups", "troll"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: HELL_TURN_LIMIT, currency: 1_000 });
    useGameStore.setState({ activePlayerIndex: 0, turnStage: "turn-end" });
    store().endTurn();
    expect(store().players[0].currency).toBe(1_000 - HELL_EXIT_TOLL);
  });

  it("restarts the countdown on a new trip to Hell, but not for a player already there", () => {
    startTable(["built-like-a-tank", "troll", "troll"]);
    editPlayer(0, { position: 4, hellTurns: 3 });
    editPlayer(1, { position: HELL_NODE_ID, hellTurns: 2 });
    editPlayer(2, { inventory: [{ id: "draven-1", kind: "item", itemId: "draven" }] });
    useGameStore.setState({ activePlayerIndex: 2, turnStage: "move" });
    store().useItem("draven-1");
    if (store().turnStage === "reaction") store().resolveReaction(null);

    expect(store().players[0].hellTurns).toBe(0);
    expect(store().players[1].hellTurns).toBe(2);
  });
});

describe("Hell sentence after a Monopoly Man swap", () => {
  it("starts a fresh countdown for a player swapped back into Hell", () => {
    startTable(["built-like-a-tank", "troll"]);
    // Player 2 left Hell by a swap with 5 turns served, then gets swapped back in before their turn.
    editPlayer(1, { position: 5, hellTurns: HELL_TURN_LIMIT });
    useGameStore.setState({ activePlayerIndex: 1, turnStage: "turn-end" });
    store().endTurn();
    editPlayer(1, { position: HELL_NODE_ID });
    useGameStore.setState({ turnStage: "turn-end" });
    store().endTurn();

    expect(store().players[1].position).toBe(HELL_NODE_ID);
    expect(store().players[1].hellTurns).toBe(1);
  });
});

describe("Je note and the no-stacking rule", () => {
  it("never copies Draven, even for its own user", () => {
    startTable(["i-take-notes", "troll"]);
    editPlayer(0, { inventory: [{ id: "draven-1", kind: "item", itemId: "draven" }] });
    store().useItem("draven-1");
    expect(store().players[0].inventory).toHaveLength(0);
  });

  it("never gives a third copy of an item", () => {
    startTable(["built-like-a-tank", "i-take-notes"]);
    editPlayer(0, { inventory: [{ id: "finger-1", kind: "item", itemId: "middle-finger" }] });
    editPlayer(1, {
      inventory: [
        { id: "copy-1", kind: "item", itemId: "middle-finger" },
        { id: "copy-2", kind: "item", itemId: "middle-finger" },
      ],
    });
    store().useItem("finger-1", store().players[1].id);

    const copies = store().players[1].inventory.filter(
      (entry) => entry.kind === "item" && entry.itemId === "middle-finger",
    );
    expect(copies).toHaveLength(2);
    expect(store().pendingDiscard).toBeNull();
  });
});

describe("Bullet Bill", () => {
  it("hits a player standing on its own tile at the end of the round", () => {
    startTable(["built-like-a-tank", "troll"]);
    editPlayer(1, { position: 5 });
    useGameStore.setState({
      activePlayerIndex: 1,
      turnStage: "turn-end",
      bulletBill: { status: "active", position: 5, spawnRound: 1 },
    });
    store().endTurn();

    expect(store().bulletBill).toBeNull();
    expect(store().players[1].currency).toBe(1_800);
    expect(store().players[1].skippedTurns).toBe(1);
  });
});

describe("game save", () => {
  it("upgrades a version 3 save by starting everybody's Hell countdown at zero", () => {
    startTable(["built-like-a-tank", "troll"]);
    const legacy = pickGameState(store());
    const upgraded = migrateGameSave(
      { ...legacy, players: legacy.players.map(({ hellTurns: _unused, ...player }) => player) },
      3,
    );

    expect(upgraded.phase).toBe("playing");
    expect(upgraded.players.every((player) => player.hellTurns === 0)).toBe(true);
  });

  it("only restores a game in progress", () => {
    startTable(["built-like-a-tank", "troll"]);
    expect(isRestorableGame(pickGameState(store()))).toBe(true);
    expect(isRestorableGame({ ...EMPTY_GAME_STATE })).toBe(false);
    expect(isRestorableGame({ ...pickGameState(store()), phase: "finished" })).toBe(false);
    expect(isRestorableGame({ phase: "playing", players: [] })).toBe(false);
    expect(isRestorableGame("corrupted")).toBe(false);
  });

  it("saves only game data, never the store actions", () => {
    startTable(["built-like-a-tank", "troll"]);
    const saved = pickGameState(store());
    expect(Object.values(saved).some((value) => typeof value === "function")).toBe(false);
    expect(JSON.parse(JSON.stringify(saved)).players).toHaveLength(2);
  });
});
