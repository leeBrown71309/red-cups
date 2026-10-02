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

describe("green and red tile wheels", () => {
  it("spins the wheel of fortune after stopping on a green tile", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: 4 });
    store().movePlayer(7);

    expect(store().turnStage).toBe("tile-wheel");
    store().spinTileWheel();
    expect(store().pendingWheel?.wheelId).toBe("fortune");
  });

  it("spins the wheel of misfortune after stopping on a red tile", () => {
    startTable(["built-like-a-tank", "goblin"]);
    store().movePlayer(4);
    store().spinTileWheel();
    expect(store().pendingWheel?.wheelId).toBe("misfortune");
  });

  it("does not spin when only passing over a colored tile with the Botte", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { inventory: [{ id: "boot-1", kind: "item", itemId: "boot" }] });
    store().prepareBoot("boot-1");
    store().movePlayer(3);

    const path = store().lastMovement?.path;
    expect(path).toHaveLength(2);
    expect(store().turnStage).toBe("shop");
  });

  it("collects the Red Cup first, then spins the tile wheel", () => {
    startTable(["built-like-a-tank", "goblin"]);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    useGameStore.setState({ redCupNodeId: 4 });
    store().movePlayer(4);

    expect(store().players[0].inventory.filter((entry) => entry.kind === "red-cup")).toHaveLength(1);
    expect(store().turnStage).toBe("tile-wheel");
  });

  it("does not spin the wheel on a neutral, shop or start tile", () => {
    startTable(["built-like-a-tank", "goblin"]);
    store().movePlayer(2);
    expect(store().turnStage).toBe("turn-end");
  });
});

describe("arrow tiles and the start bonus", () => {
  it("lets a player walk into an arrow tile backwards, then forces its exit", () => {
    startTable(["built-like-a-tank", "goblin"]);
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
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: 8, currency: 500 });
    store().movePlayer(0);
    expect(store().players[0].currency).toBe(700);
  });

  it("lets a player step back from 4 to the start without the bonus", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: 4, currency: 500 });
    store().movePlayer(0);

    expect(store().players[0].position).toBe(0);
    expect(store().players[0].currency).toBe(500);
  });
});

describe("tile wheels after being moved by someone else", () => {
  it("spins no wheel for a player pulled onto a red tile by the Corde", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: 4, inventory: [{ id: "rope-1", kind: "item", itemId: "rope" }] });
    editPlayer(1, { position: 2 });
    useGameStore.setState({ turnStage: "move" });
    store().useItem("rope-1", store().players[1].id);

    expect(store().players[1].position).toBe(4);
    expect(store().pendingTileWheels).toEqual([]);
    // The turn goes on: the Corde cost 2 of the 3 points, one is left to move.
    expect(store().turnStage).toBe("move");
  });

  it("gives neither player a wheel nor the shop after a Monopoly Man swap", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: 5, inventory: [{ id: "swap-1", kind: "item", itemId: "monopoly-man" }] });
    editPlayer(1, { position: 9 });
    useGameStore.setState({ turnStage: "move" });
    store().useItem("swap-1", store().players[1].id);

    expect(store().players.map((player) => player.position)).toEqual([9, 5]);
    expect(store().pendingTileWheels).toEqual([]);
    expect(store().turnStage).toBe("move");
  });

  it("still spins the wheel when the Bouteille d’eau lands on a colored tile", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: HELL_NODE_ID, inventory: [{ id: "bottle-1", kind: "item", itemId: "water-bottle" }] });
    useGameStore.setState({ turnStage: "hell" });
    // Tile 4 (red) is the fifth of the eleven walkable tiles.
    vi.spyOn(Math, "random").mockReturnValue(4.5 / 11);
    store().useItem("bottle-1");

    expect(store().players[0].position).toBe(4);
    expect(store().turnStage).toBe("tile-wheel");
  });

  it("does not spin for a player sent to Hell", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { inventory: [{ id: "purple-1", kind: "item", itemId: "hollow-purple" }] });
    editPlayer(1, { position: 4 });
    store().useItem("purple-1", store().players[1].id);
    expect(store().pendingTileWheels).toEqual([]);
    expect(store().turnStage).toBe("move");
  });
});

describe("Hell sentence", () => {
  /** Ends player 2's turn so that player 1's next turn begins. */
  function passToFirstPlayer(): void {
    useGameStore.setState({ activePlayerIndex: 1, turnStage: "turn-end" });
    store().endTurn();
  }

  it("counts every turn a player starts in Hell", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: 0 });
    passToFirstPlayer();

    expect(store().turnStage).toBe("hell");
    expect(store().players[0].hellTurns).toBe(1);
  });

  it(`releases the player at the start, with the start bonus, for ${HELL_EXIT_TOLL} coins after 5 turns`, () => {
    startTable(["built-like-a-tank", "goblin"]);
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
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: HELL_TURN_LIMIT - 1 });
    useGameStore.setState({ activePlayerIndex: 0, turnStage: "turn-end" });
    store().endTurn();
    expect(store().players[0].position).toBe(HELL_NODE_ID);
  });

  it("counts a turn skipped in Hell towards the sentence", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: HELL_TURN_LIMIT - 1, skippedTurns: 1 });
    passToFirstPlayer();

    expect(store().players[0].position).toBe(0);
    expect(store().activePlayerIndex).toBe(1);
  });

  it("cushions the toll with the start bonus before the usual −300 reset", () => {
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: HELL_TURN_LIMIT, currency: 100 });
    useGameStore.setState({ activePlayerIndex: 0, turnStage: "turn-end" });
    store().endTurn();
    expect(store().players[0].currency).toBe(-200);
    expect(store().players[0].skippedTurns).toBe(0);

    store().resetGame();
    startTable(["built-like-a-tank", "goblin"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: HELL_TURN_LIMIT, currency: -100 });
    useGameStore.setState({ activePlayerIndex: 0, turnStage: "turn-end" });
    store().endTurn();
    expect(store().players[0].currency).toBe(0);
    expect(store().players[0].skippedTurns).toBe(1);
  });

  it("restarts the countdown on a new trip to Hell, but not for a player already there", () => {
    startTable(["built-like-a-tank", "goblin", "goblin"]);
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
    startTable(["built-like-a-tank", "goblin"]);
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
    startTable(["i-take-notes", "goblin"]);
    editPlayer(0, { inventory: [{ id: "draven-1", kind: "item", itemId: "draven" }] });
    store().useItem("draven-1");
    expect(store().players[0].inventory).toHaveLength(0);
  });

  it("never gives a third copy of an item", () => {
    startTable(["built-like-a-tank", "i-take-notes"]);
    // Below one in three: Je note keeps its copy.
    vi.spyOn(Math, "random").mockReturnValue(0.1);
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

describe("Je note on its own items (patch 0.1.3)", () => {
  it("gives no copy of a Ndoye its holder spins on themselves", () => {
    startTable(["i-take-notes", "goblin"]);
    editPlayer(0, { inventory: [{ id: "ndoye-1", kind: "item", itemId: "ndoye" }] });
    // 0.99 lands on « Perds ton prochain tour » on the wheel of misfortune.
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    store().useItem("ndoye-1", store().players[0].id);
    store().resolveWheel();

    expect(store().players[0].inventory).toHaveLength(0);
  });

  it("gives no copy of a Hollow Purple its holder fires at themselves", () => {
    startTable(["i-take-notes", "goblin"]);
    editPlayer(0, { inventory: [{ id: "purple-1", kind: "item", itemId: "hollow-purple" }] });

    store().useItem("purple-1", store().players[0].id);

    expect(store().players[0].position).toBe(HELL_NODE_ID);
    expect(store().players[0].inventory).toHaveLength(0);
  });

  it("still copies an item somebody else used on its holder", () => {
    startTable(["built-like-a-tank", "i-take-notes"]);
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    editPlayer(0, { inventory: [{ id: "finger-1", kind: "item", itemId: "middle-finger" }] });

    store().useItem("finger-1", store().players[1].id);

    expect(store().players[1].inventory).toContainEqual(
      expect.objectContaining({ kind: "item", itemId: "middle-finger" }),
    );
  });
});

describe("Calme-toi (patch 0.1.3)", () => {
  it("is never offered to the holder against themselves", () => {
    startTable(["calm-down", "goblin"]);
    editPlayer(0, { position: 10 });
    // The next Cup lands on tile 1, two steps from 8.
    vi.spyOn(Math, "random").mockReturnValue(0);

    store().movePlayer(8);

    expect(store().redCupNodeId).toBe(1);
    expect(store().pendingCalmDown).toBeNull();
    expect(store().turnStage).toBe("shop");
  });
});

describe("duel winner (patch 0.1.3)", () => {
  function startDuelInHell(passives: PassiveId[]): void {
    startTable(passives);
    editPlayer(0, { position: HELL_NODE_ID });
    editPlayer(1, { position: HELL_NODE_ID });
    useGameStore.setState({
      turnStage: "duel",
      pendingDuel: {
        playerOneId: store().players[0].id,
        playerTwoId: store().players[1].id,
        mode: "rock-paper-scissors",
        resumeStage: "turn-end",
        rpsChoices: {},
        rpsTiedRound: null,
        rpsTies: 0,
        votes: {},
        voteTieBroken: false,
        winnerId: store().players[0].id,
        basket: null,
        ghost: null,
      },
    });
  }

  it("pays the start bonus to the winner going back to the start", () => {
    startDuelInHell(["built-like-a-tank", "goblin"]);
    store().resolveDuel(store().players[0].id);

    expect(store().players[0].position).toBe(0);
    expect(store().players[0].currency).toBe(2_000 + START_BONUS);
    expect(store().players[1].currency).toBe(2_000);
  });
});

describe("Bullet Bill", () => {
  it("hits a player standing on its own tile at the end of the round", () => {
    startTable(["built-like-a-tank", "goblin"]);
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
    startTable(["built-like-a-tank", "goblin"]);
    const legacy = pickGameState(store());
    const upgraded = migrateGameSave(
      { ...legacy, players: legacy.players.map(({ hellTurns: _unused, ...player }) => player) },
      3,
    );

    expect(upgraded.phase).toBe("playing");
    expect(upgraded.players.every((player) => player.hellTurns === 0)).toBe(true);
  });

  it("upgrades a version 4 save with the patch 0.1.1 fields", () => {
    startTable(["built-like-a-tank", "no-thanks"]);
    const {
      mudPlacedThisTurn: _mud,
      lastBulletFlight: _flight,
      blessingQueue: _blessing,
      abandonedPlayers: _abandoned,
      winReason: _reason,
      ...legacy
    } = pickGameState(store());
    const upgraded = migrateGameSave(
      {
        ...legacy,
        players: legacy.players.map(({ noThanksReadyRound: _ready, ...player }) => ({
          ...player,
          noThanksUsedCycle: -1,
        })),
      },
      4,
    );

    expect(isRestorableGame(upgraded)).toBe(true);
    expect(upgraded.blessingQueue).toEqual([]);
    expect(upgraded.abandonedPlayers).toEqual([]);
    expect(upgraded.players.every((player) => player.noThanksReadyRound === 1)).toBe(true);
    expect(upgraded.players.some((player) => "noThanksUsedCycle" in player)).toBe(false);
  });

  it("only restores a game in progress", () => {
    startTable(["built-like-a-tank", "goblin"]);
    expect(isRestorableGame(pickGameState(store()))).toBe(true);
    expect(isRestorableGame({ ...EMPTY_GAME_STATE })).toBe(false);
    expect(isRestorableGame({ ...pickGameState(store()), phase: "finished" })).toBe(false);
    expect(isRestorableGame({ phase: "playing", players: [] })).toBe(false);
    expect(isRestorableGame("corrupted")).toBe(false);
  });

  it("saves only game data, never the store actions", () => {
    startTable(["built-like-a-tank", "goblin"]);
    const saved = pickGameState(store());
    expect(Object.values(saved).some((value) => typeof value === "function")).toBe(false);
    expect(JSON.parse(JSON.stringify(saved)).players).toHaveLength(2);
  });
});
