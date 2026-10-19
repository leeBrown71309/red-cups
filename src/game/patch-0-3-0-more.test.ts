import { afterEach, describe, expect, it, vi } from "vitest";
import { getBoard, getNeighbors } from "./board";
import { getHandValue, hasSoftAce } from "./blackjack";
import { ITEM_CATALOG, WHEEL_RESULTS } from "./catalog";
import { canEndTurn, getEnergyCapacity } from "./energy";
import { withPassives } from "./forced-passives";
import { reduceGame } from "./game-actions";
import { startGhostDuel } from "./ghost";
import { shouldEndTurnAutomatically } from "./idle-turn";
import { mirrorStep } from "./sister";
import { useGameStore } from "./store";
import { doArrowsRestrictMove } from "./rules";
import type { GameState, InventoryEntry, ItemId, MapId, PassiveId, PlayingCard, Player } from "./types";
import { EMPTY_GAME_STATE, GOBLIN_THEFT, GOBLIN_VICTIMS, HELL_NODE_ID, STARTING_CURRENCY } from "./types";

/**
 * The reports of patch 0.3.0. Played on the classic board unless said otherwise: tile 0 is the start, 2 a plain tile
 * reached from it by an arrow, 3 and 8 and 9 shops, 11 Hell.
 */

const store = () => useGameStore.getState();
const pick = (): GameState => store() as GameState;
const item = (id: string, itemId: ItemId, count?: number): InventoryEntry => ({
  id,
  kind: "item",
  itemId,
  ...(count ? { count } : {}),
});
const card = (rank: number): PlayingCard => ({ rank, suit: 0 });

function startTable(passives: (PassiveId | PassiveId[])[], mapId?: MapId): void {
  store().startGame(
    passives.map((_, index) => `Joueur ${index + 1}`),
    undefined,
    mapId,
  );
  useGameStore.setState((state) => withPassives(state, passives));
}

function editPlayer(index: number, changes: Partial<Player>): void {
  useGameStore.setState((state) => ({
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  }));
}

function openTurn(seat = 0): void {
  const active = store().players[seat];
  useGameStore.setState({
    activePlayerIndex: seat,
    turnStage: "move",
    energyLeft: getEnergyCapacity(active, store()),
    diceRoll: null,
  });
}

const player = (seat: number): Player => store().players[seat];

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Blackjack : un as qui retombe à 1 n'est pas une soustraction", () => {
  it("l'as compte 11 tant que ça ne dépasse pas 21, puis 1 : le total baisse de dix sans soustraire la carte", () => {
    const soft = [card(1), card(5)];
    expect(getHandValue(soft)).toBe(16);
    expect(hasSoftAce(soft)).toBe(true);
    const drawn = [...soft, card(9)];
    // 16 → 15, because the ace now counts 1: 1 + 5 + 9.
    expect(getHandValue(drawn)).toBe(15);
    expect(hasSoftAce(drawn)).toBe(false);
  });

  it("sans as, un tirage ne fait jamais baisser le total", () => {
    expect(hasSoftAce([card(10), card(7)])).toBe(false);
    expect(getHandValue([card(10), card(7), card(2)])).toBe(19);
  });
});

describe("Fantôme de Luna Park : un objet propre à une CP n'est pas rendu à un autre", () => {
  function ghostState(passive: PassiveId, itemId: ItemId): GameState {
    const state = reduceGame(EMPTY_GAME_STATE, {
      type: "startGame",
      playerNames: ["A", "B", "C"],
      seed: 42,
      mapId: "luna-park",
    });
    return {
      ...state,
      ghost: { nodeId: 1, returnsAtRound: 1, loot: { coins: 0, items: [{ id: "stolen", itemId }] }, metPlayerIds: [] },
      players: state.players.map((entry, index) =>
        index === 1 ? { ...entry, passiveId: passive, position: 1 } : { ...entry, passiveId: "lambda" },
      ),
    };
  }

  it.each(["black-cup", "made-in-heaven", "shield"] as ItemId[])(
    "%s volé : le vainqueur ordinaire touche sa valeur en pièces et l'objet disparaît",
    (itemId) => {
      const reward = startGhostDuel(ghostState("lambda", itemId), "p2", "turn-end").pendingDuel?.ghost?.reward;
      expect(reward).toEqual({
        kind: "coins",
        amount: ITEM_CATALOG[itemId].price,
        fromLoot: false,
        replacesEntryId: "stolen",
      });
    },
  );

  it("celui à qui l'objet appartient le récupère", () => {
    const reward = startGhostDuel(ghostState("devil", "black-cup"), "p2", "turn-end").pendingDuel?.ghost?.reward;
    expect(reward).toEqual({ kind: "item", entryId: "stolen", itemId: "black-cup" });
  });
});

describe("Ange-Gardien : le Bouclier contre une Tomate lancée sur son protégé", () => {
  function tomatoTable(count: number): void {
    startTable(["lambda", "guardian-angel", "lambda", "lambda"]);
    useGameStore.setState({ guardian: { angelId: "p2", protegeId: "p1" } });
    editPlayer(1, { inventory: [item("shield", "shield")] });
    editPlayer(2, { inventory: [item("tom", "tomato", count)] });
    openTurn(2);
  }

  it("ouvre une réaction pour l'ange, même si la Tomate allait assommer", () => {
    tomatoTable(3);
    store().useItem("tom", "p1", 3);
    expect(store()).toMatchObject({ turnStage: "reaction", pendingReaction: { reactorIds: ["p2"] } });
    // Nothing has been thrown yet.
    expect(player(0).skippedTurns).toBe(0);
  });

  it("lever le Bouclier bloque toute la volée et l'ange perd son Bouclier", () => {
    tomatoTable(3);
    store().useItem("tom", "p1", 3);
    store().resolveReaction("p2");
    expect(player(1).inventory).toEqual([]);
    expect(player(2).inventory).toEqual([]);
    expect(store().turnStage).toBe("move");
    expect(store().pendingReaction).toBeNull();
  });

  it("sans réponse de l'ange, la volée part comme avant (les 3 Tomates)", () => {
    tomatoTable(3);
    store().useItem("tom", "p1", 3);
    store().resolveReaction(null);
    expect(store().lastTomatoThrow).toMatchObject({ count: 3, targetId: "p1" });
    expect(player(2).inventory).toEqual([]);
  });

  it("contre un autre joueur que le protégé, la Tomate part tout de suite", () => {
    tomatoTable(1);
    store().useItem("tom", "p4", 1);
    expect(store().turnStage).not.toBe("reaction");
    expect(store().lastTomatoThrow).toMatchObject({ targetId: "p4" });
  });
});

describe("Barrière : elle tombe aussi au tour sauté de son poseur", () => {
  it("un poseur assommé ne la garde pas debout", () => {
    startTable(["lambda", "lambda", "lambda"]);
    useGameStore.setState({
      barriers: [{ ownerId: "p2", a: 3, b: 6, turnsLeft: 1 }],
      activePlayerIndex: 0,
      turnStage: "turn-end",
    });
    editPlayer(1, { skippedTurns: 1, knockedOut: true });
    // Player 1 ends their turn: player 2 skips theirs, and their Barrière wears down with it.
    store().endTurn();
    expect(store().players[store().activePlayerIndex].id).toBe("p3");
    expect(store().barriers).toEqual([]);
  });
});

describe("Goblin : deux joueurs au hasard", () => {
  it("vole 150 pièces à deux joueurs seulement, tirés parmi les autres", () => {
    startTable(["goblin", "lambda", "lambda", "lambda", "lambda"]);
    useGameStore.setState({ redCupNodeId: 2 });
    const before = store().players.map((entry) => entry.currency);
    editPlayer(0, { position: 0 });
    openTurn(0);
    store().movePlayer(2);
    const lost = store().players.map((entry, index) => before[index] - entry.currency);
    const robbed = lost.filter((gone, index) => index > 0 && gone === GOBLIN_THEFT).length;
    expect(GOBLIN_VICTIMS).toBe(2);
    expect(robbed).toBe(2);
    expect(player(0).currency).toBeGreaterThanOrEqual(before[0] + 2 * GOBLIN_THEFT);
  });

  it("à trois joueurs, les deux autres y passent", () => {
    startTable(["goblin", "lambda", "lambda"]);
    useGameStore.setState({ redCupNodeId: 2 });
    openTurn(0);
    store().movePlayer(2);
    expect(player(1).currency).toBe(STARTING_CURRENCY - GOBLIN_THEFT);
    expect(player(2).currency).toBe(STARTING_CURRENCY - GOBLIN_THEFT);
  });
});

describe("Mage noir : poser son pentagramme ne finit pas le tour", () => {
  it("après avoir posé son pentagramme, avec de l'énergie, le tour ne peut pas se terminer", () => {
    startTable(["black-mage", "lambda"]);
    useGameStore.setState({ redCupNodeId: 10 });
    openTurn(0);
    expect(canEndTurn(pick())).toBe(false);
    store().placeMark();
    expect(store().blackMarks).toHaveLength(1);
    expect(canEndTurn(pick())).toBe(false);
  });
});

describe("eShop : la boutique s'ouvre aussi à la sortie de l'Enfer", () => {
  function leaveHellByWheel(seat: number, changes: Partial<Player>): void {
    const escape = WHEEL_RESULTS.hell.find((entry) => entry.id === "escape")!;
    editPlayer(seat, { position: HELL_NODE_ID, ...changes });
    useGameStore.setState({
      activePlayerIndex: seat,
      turnStage: "wheel-result",
      pendingWheel: {
        id: "w",
        wheelId: "hell",
        playerId: player(seat).id,
        result: { id: escape.id, label: escape.label, amount: escape.amount },
        resumeStage: "turn-end",
        origin: "hell",
      },
    });
    store().resolveWheel();
  }

  it("eShop libéré par la roue de l'Enfer ouvre sa boutique au Départ", () => {
    startTable(["lambda", "eshop", "lambda"]);
    leaveHellByWheel(1, {});
    expect(player(1).position).toBe(0);
    expect(store().turnStage).toBe("shop");
  });

  it("le Mime qui a copié eShop aussi", () => {
    startTable(["mime", "lambda", "lambda"]);
    leaveHellByWheel(0, { mimicId: "eshop" });
    expect(store().turnStage).toBe("shop");
  });

  it("sans eShop, rien ne s'ouvre au Départ", () => {
    startTable(["lambda", "lambda", "lambda"]);
    leaveHellByWheel(0, {});
    expect(store().turnStage).toBe("turn-end");
  });
});

describe("Corrupteur : pas de bouton quand aucune flèche ne gêne", () => {
  it("le bouton n'est proposé que là où ignorer le sens ouvre une route de plus", () => {
    startTable(["corrupter", "lambda"]);
    useGameStore.setState({ redCupNodeId: 10 });
    openTurn(0);
    // The start forces its exits by arrows: ignoring them opens the way back.
    editPlayer(0, { position: 0 });
    expect(doArrowsRestrictMove(pick(), player(0))).toBe(true);
    const free = getBoard(pick()).nodes.find((node) => {
      editPlayer(0, { position: node.id });
      return node.id !== HELL_NODE_ID && !doArrowsRestrictMove(pick(), player(0));
    });
    expect(free).toBeDefined();
  });
});

describe("Sœur Fantôme : les flèches ne la retiennent pas", () => {
  it("au moins un pas de sa joueuse la fait prendre, à contresens d'une flèche, la route qui lui répond", () => {
    startTable(["ghost-sister", "lambda"]);
    const board = getBoard(pick());
    const ids = board.nodes.map((node) => node.id);
    // A step she only finds because the arrow of her tile no longer binds her.
    const found = ids.flatMap((sister) =>
      ids.flatMap((from) =>
        getNeighbors(board, from, true).flatMap((to) => {
          const reached = mirrorStep(board, sister, from, to);
          return reached !== null && !getNeighbors(board, sister).includes(reached)
            ? [[sister, from, to, reached]]
            : [];
        }),
      ),
    );
    expect(found.length).toBeGreaterThan(0);
  });
});

describe("Fin de tour automatique : plus rien à faire", () => {
  function tiredTurn(): void {
    startTable(["lambda", "lambda", "lambda"]);
    useGameStore.setState({ redCupNodeId: 10, turnStage: "turn-end", energyLeft: 0, turnActionTaken: true });
  }

  it("se termine seul quand le joueur a joué, n'a plus d'énergie et rien d'utilisable", () => {
    tiredTurn();
    expect(shouldEndTurnAutomatically(pick())).toBe(true);
  });

  it("jamais avant d'avoir joué, ni avec de l'énergie, ni pendant un choix en cours", () => {
    tiredTurn();
    useGameStore.setState({ turnActionTaken: false });
    expect(shouldEndTurnAutomatically(pick())).toBe(false);
    useGameStore.setState({ turnActionTaken: true, energyLeft: 1 });
    expect(shouldEndTurnAutomatically(pick())).toBe(false);
    useGameStore.setState({ energyLeft: 0, turnStage: "shop" });
    expect(shouldEndTurnAutomatically(pick())).toBe(false);
  });

  it("reste ouvert tant qu'un objet gratuit peut servir (une Tomate)", () => {
    tiredTurn();
    useGameStore.setState({ turnStage: "move" });
    editPlayer(0, { inventory: [item("tom", "tomato", 2)] });
    expect(shouldEndTurnAutomatically(pick())).toBe(false);
  });

  it("reste ouvert tant que le Mage noir peut poser son pentagramme", () => {
    startTable(["black-mage", "lambda"]);
    useGameStore.setState({ redCupNodeId: 10, turnStage: "turn-end", energyLeft: 0, turnActionTaken: true });
    expect(shouldEndTurnAutomatically(pick())).toBe(false);
  });
});
