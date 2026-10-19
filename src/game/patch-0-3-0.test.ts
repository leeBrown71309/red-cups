import { afterEach, describe, expect, it, vi } from "vitest";
import { getBoard, isIce } from "./board";
import { getEnergyCapacity } from "./energy";
import { withPassives } from "./forced-passives";
import { reduceGame } from "./game-actions";
import { isBlinded, isInvisible } from "./mist";
import { ITEM_ORDER } from "./catalog";
import { startDoomsday } from "./devil";
import { advanceMist } from "./mist-cycle";
import { canBeChallenged, canTargetPlayer } from "./passive-rules";
import { countItemUnits, countRedCups } from "./rules";
import { getMaxPurchaseCount } from "./shopping";
import { useGameStore } from "./store";
import type { GameState, MapId, NodeId, PassiveId, Player } from "./types";
import {
  EMPTY_GAME_STATE,
  FOOL_CUP_FINE,
  FOOL_GOAL,
  RED_GREEN_GAIN,
  RED_GREEN_PENALTY,
  STARTING_CURRENCY,
} from "./types";
import { getPurchaseStatus } from "../ui/display/item-availability";
import { computeLegalMoves } from "../ui/game-hooks";
import { getFog } from "../ui/fog";

/**
 * The reports of patch 0.3.0 (the nine signalements of 2026-10-15 and 2026-10-16). Played on the classic board
 * unless said otherwise: tile 0 is the start, 3 and 8 and 9 are shops, 8 holds the first Red Cup.
 */

const store = () => useGameStore.getState();
const pick = (): GameState => store() as GameState;

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

function edit(changes: Partial<GameState>): void {
  useGameStore.setState(changes);
}

function openTurn(seat = 0): void {
  const active = store().players[seat];
  edit({ activePlayerIndex: seat, turnStage: "move", energyLeft: getEnergyCapacity(active, store()), diceRoll: null });
}

const player = (seat: number): Player => store().players[seat];

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Boutique : le bouton Acheter dit toujours la vérité (signalement « Achat impossible »)", () => {
  function openShop(changes: Partial<Player>): void {
    startTable(["ghost-sister", "lambda"], "banquise");
    // Banquise: tile 12 is a shop.
    editPlayer(0, { position: 12, ...changes });
    edit({ turnStage: "shop", redCupNodeId: 13, iceTileNodeId: null });
  }

  it("après une Botte à 300 pièces, le Miroir à 700 s’achète avec les 800 pièces restantes", () => {
    openShop({
      currency: 1_100,
      inventory: [
        { id: "boot", kind: "item", itemId: "boot" },
        { id: "gum", kind: "item", itemId: "eraser" },
      ],
    });
    edit({ bootPrice: 300 });
    store().buyItem("boot");
    expect(player(0).currency).toBe(800);
    expect(getPurchaseStatus("mirror", pick(), player(0))).toEqual({ price: 700, canBuy: true });
    store().buyItem("mirror");
    expect(countItemUnits(player(0), "mirror")).toBe(1);
    expect(player(0).currency).toBe(100);
  });

  it("un Miroir déjà utilisé n’est plus vendu : le bouton est grisé et dit pourquoi, au lieu de ne rien faire", () => {
    openShop({ currency: 1_100, inventory: [], mirrorUsed: true });
    expect(getMaxPurchaseCount(pick(), "mirror")).toBe(0);
    expect(getPurchaseStatus("mirror", pick(), player(0))).toMatchObject({ canBuy: false, reason: "Déjà utilisé" });
    const before = pick();
    store().buyItem("mirror");
    expect(store()).toBe(before);
  });

  it("l’étal et le moteur sont d’accord pour chaque objet : jamais de bouton actif qui ne vend rien", () => {
    const bags: Partial<Player>[] = [
      { inventory: [] },
      { inventory: [], mirrorUsed: true },
      {
        inventory: [
          { id: "a", kind: "item", itemId: "boot" },
          { id: "b", kind: "item", itemId: "boot" },
          { id: "c", kind: "item", itemId: "eraser" },
        ],
      },
      { inventory: Array.from({ length: 4 }, (_, index) => ({ id: `cup-${index}`, kind: "red-cup" as const })) },
    ];
    for (const passive of ["lambda", "roller", "thief", "guardian-angel", "devil"] as PassiveId[]) {
      for (const bag of bags) {
        startTable([passive, "lambda"]);
        editPlayer(0, { position: 3, currency: 5_000, ...bag });
        edit({ turnStage: "shop", redCupNodeId: 8 });
        for (const itemId of ITEM_ORDER) {
          const status = getPurchaseStatus(itemId, pick(), player(0));
          const sellable = getMaxPurchaseCount(pick(), itemId) > 0;
          expect(status.canBuy, `${passive} / ${itemId}`).toBe(sellable);
        }
      }
    }
  });
});

describe("Déplacement : pas de flèche quand il ne reste pas assez d’énergie", () => {
  it("n’affiche aucune route quand les objets ont pris toute l’énergie", () => {
    startTable(["lambda", "lambda"]);
    openTurn(0);
    expect(computeLegalMoves(pick(), false).paths.size).toBeGreaterThan(0);
    edit({ energyLeft: 0 });
    expect(computeLegalMoves(pick(), false).paths.size).toBe(0);
  });

  it("garde la route de la Botte : un point reste pour marcher", () => {
    startTable(["lambda", "lambda"]);
    openTurn(0);
    edit({ moveDistance: 2, energyLeft: 1 });
    expect(computeLegalMoves(pick(), false).paths.size).toBeGreaterThan(0);
  });
});

describe("Banquise : le dégel rejoue la glissade, barrière comprise", () => {
  function startOn(positions: NodeId[]): GameState {
    const state = reduceGame(EMPTY_GAME_STATE, {
      type: "startGame",
      playerNames: ["Ana", "Bo", "Cy"],
      mapId: "banquise",
    });
    return {
      ...state,
      iceTileNodeId: null,
      redCupNodeId: 13,
      players: state.players.map((entry, index) => ({
        ...entry,
        passiveId: "lambda",
        currency: STARTING_CURRENCY,
        position: positions[index] ?? entry.position,
      })),
    };
  }

  it("raconte le choc contre la barrière avant la glissade vers l’autre case", () => {
    let state = startOn([3, 5, 12]);
    state = {
      ...state,
      frozenSlides: [{ playerId: state.players[0].id, from: 3, to: 8 }],
      barriers: [{ ownerId: state.players[1].id, a: 3, b: 8, turnsLeft: 2 }],
      activePlayerIndex: 2,
      turnStage: "turn-end",
    };
    vi.spyOn(Math, "random").mockReturnValue(0);
    const next = reduceGame(state, { type: "endTurn" });

    const movement = next.lastMovement!;
    expect(movement).toMatchObject({ thawed: true, from: 3, slideStart: 0 });
    // Ana stood on 3 when the barred road to 8 stopped her: the bump is told before her first step.
    expect(movement.bumps).toContainEqual({ index: -1, toward: 8 });
    expect(movement.path[0]).not.toBe(8);
    expect(movement.path).toHaveLength(1 + (movement.path.length - 1));
    expect(next.players[0].position).toBe(movement.path[movement.path.length - 1]);
    expect(isIce(getBoard(next), next.players[0].position)).toBe(false);
  });

  it("sans barrière, le dégel garde sa route d’origine et n’annonce aucun choc", () => {
    let state = startOn([3, 5, 12]);
    state = {
      ...state,
      frozenSlides: [{ playerId: state.players[0].id, from: 3, to: 8 }],
      activePlayerIndex: 2,
      turnStage: "turn-end",
    };
    const next = reduceGame(state, { type: "endTurn" });
    expect(next.lastMovement).toMatchObject({ thawed: true, from: 3, slideStart: 0 });
    expect(next.lastMovement?.path[0]).toBe(8);
    expect(next.lastMovement?.bumps).toBeUndefined();
  });
});

describe("Doomsday : toutes les cases sont rouges pour Red light, Green light", () => {
  /** Tile 6 is red, 1 is green: the walk from one to the other crosses a green tile. */
  function walkToGreen(doomed: boolean): number {
    startTable(["red-light-green-light", "devil"]);
    edit({ redCupNodeId: 8 });
    editPlayer(0, { position: 6, currency: 1_000 });
    if (doomed) edit(startDoomsdayPatch());
    openTurn(0);
    store().movePlayer(1);
    return player(0).currency - 1_000;
  }

  function startDoomsdayPatch(): Partial<GameState> {
    return { doomsday: startDoomsday(pick(), "p2").doomsday };
  }

  it("une case verte rapporte 100 pièces en temps normal", () => {
    expect(walkToGreen(false)).toBe(RED_GREEN_GAIN);
  });

  it("sous Doomsday, la même case verte compte comme rouge : −50 pièces au lieu de +100", () => {
    expect(walkToGreen(true)).toBe(-RED_GREEN_PENALTY);
  });
});

describe("Le Fou ne garde pas la Red Cup", () => {
  /** Tile 0 leads to the neutral tile 2 by an arrow: the player walks there, onto the Red Cup. */
  function walkOntoCup(passives: PassiveId[]): void {
    startTable(passives);
    edit({ redCupNodeId: 2 });
    editPlayer(0, { position: 0, currency: 1_000 });
    openTurn(0);
    store().movePlayer(2);
  }

  it("perd 1 000 pièces, ne prend aucune place dans son sac et une nouvelle Red Cup apparaît", () => {
    walkOntoCup(["fool", "lambda"]);
    expect(player(0).currency).toBe(1_000 - FOOL_CUP_FINE);
    expect(countRedCups(player(0))).toBe(0);
    expect(player(0).inventory).toHaveLength(0);
    expect(store().redCupNodeId).not.toBe(2);
    expect(store().previousRedCupNodeId).toBe(2);
    expect(store().log.some((entry) => entry.text.includes("ne peut pas garder la Red Cup"))).toBe(true);
  });

  it("gagne en trois Red Cups : 3 × −1 000 passe sous −2 500", () => {
    startTable(["fool", "lambda"]);
    editPlayer(0, { currency: 0 });
    for (let cup = 1; cup <= 3 && store().phase === "playing"; cup += 1) {
      edit({ redCupNodeId: 2 });
      editPlayer(0, { position: 0 });
      openTurn(0);
      store().movePlayer(2);
    }
    expect(player(0).currency).toBe(-3 * FOOL_CUP_FINE);
    expect(player(0).currency).toBeLessThanOrEqual(FOOL_GOAL);
    expect(store()).toMatchObject({ phase: "finished", winnerId: "p1", winReason: "fool" });
  });

  it("les autres joueurs ramassent la Red Cup comme avant", () => {
    walkOntoCup(["lambda", "lambda"]);
    expect(countRedCups(player(0))).toBe(1);
    expect(player(0).currency).toBe(1_000);
  });
});

describe("Red Bull : 5 points d’énergie", () => {
  it("ouvre le tour du joueur à 5 points, contre 3 pour les autres", () => {
    startTable(["red-bull", "lambda"]);
    expect(getEnergyCapacity(player(0))).toBe(5);
    expect(getEnergyCapacity(player(1))).toBe(3);
  });
});

describe("Bombe de fumée : son utilisateur voit toujours la table", () => {
  function smokeTable(): void {
    startTable(["lambda", "lambda", "lambda"]);
    edit({ redCupNodeId: 8 });
    editPlayer(0, { position: 4, inventory: [{ id: "s", kind: "item", itemId: "smoke-bomb" }], currency: 2_000 });
    editPlayer(1, { inventory: [{ id: "n", kind: "item", itemId: "ndoye" }], currency: 2_000 });
    openTurn(0);
    store().useItem("s");
  }

  it("le rend invisible sans l’aveugler, et le remet à voir la table quand la fumée se dissipe", () => {
    smokeTable();
    expect(isInvisible(store(), player(0))).toBe(true);
    expect(isBlinded(store(), player(0))).toBe(false);
    expect(player(0).hiddenSighted).toBe(true);
  });

  it("l’écran de l’utilisateur n’efface aucun autre joueur ; les autres ne le voient plus", () => {
    smokeTable();
    const own = getFog(pick(), "p1");
    expect(own.viewerHidden).toBe(false);
    expect(own.hiddenIds.size).toBe(0);
    expect(own.ghostlyId).toBe("p1");
    const table = getFog(pick(), "p2");
    expect(table.hiddenIds.has("p1")).toBe(true);
    expect(table.viewerHidden).toBe(false);
  });

  it("il peut viser les autres, mais personne ne peut le viser", () => {
    smokeTable();
    editPlayer(0, { inventory: [{ id: "n2", kind: "item", itemId: "ndoye" }] });
    expect(canTargetPlayer(store(), player(0), player(1))).toBe(true);
    expect(canTargetPlayer(store(), player(1), player(0))).toBe(false);
    expect(canBeChallenged("p1", player(1), pick())).toBe(true);
    expect(canBeChallenged("p2", player(0), pick())).toBe(false);
  });

  it("Mi-vu, Mi-vue reste aveugle quand il disparaît", () => {
    startTable(["half-seen", "lambda"]);
    edit({ redCupNodeId: 10 });
    editPlayer(0, { position: 0, hiddenTurns: 2 });
    expect(isInvisible(store(), player(0))).toBe(true);
    expect(isBlinded(store(), player(0))).toBe(true);
    expect(getFog(pick(), "p1").viewerHidden).toBe(true);
  });

  it("la marque « voyant » s’efface avec la fumée, au début du tour suivant de son utilisateur", () => {
    smokeTable();
    const after = advanceMist(pick(), "p1");
    expect(after.players[0].hiddenTurns).toBeUndefined();
    expect(after.players[0].hiddenSighted).toBeUndefined();
    expect(isInvisible(after, after.players[0])).toBe(false);
  });
});
