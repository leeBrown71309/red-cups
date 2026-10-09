import { afterEach, describe, expect, it, vi } from "vitest";
import { hasCard } from "./cards";
import { getEnergyCapacity } from "./energy";
import { withPassives } from "./forced-passives";
import { advanceBulletBill } from "./bullet-bill";
import { getBoard } from "./board";
import { canTeleport } from "./mage-queries";
import { regainMageLuck } from "./mage-luck";
import { getMimeTargets } from "./mime";
import { isInvisible } from "./mist";
import { advanceMist } from "./mist-cycle";
import { applyCurrencyChange } from "./state-utils";
import { isHermitPrimeActive, canTargetPlayer } from "./passive-rules";
import { assignGuardian } from "./guardian";
import { canSwap, getSisterNode, mirrorStep } from "./sister";
import { getFog } from "../ui/fog";
import { useGameStore } from "./store";
import { planItemUse } from "./turn-actions";
import type { GameState, NodeId, PassiveId, Player } from "./types";
import { HELL_NODE_ID, START_NODE_ID } from "./types";

/**
 * The Cups Power and passifs of patch 0.2.3: Mime, Taupe, Mage noir, Mi-vu Mi-vue, Sœur Fantôme, L'Ermite and
 * L'Assureur. Played on the classic board: tile 0 is the start (arrows to 2 and 4), 4 and 7 stand on the left, 8 holds
 * the first Red Cup.
 */

const store = () => useGameStore.getState();

function startTable(passives: (PassiveId | PassiveId[])[]): void {
  store().startGame(passives.map((_, index) => `Joueur ${index + 1}`));
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

/** A turn that opens normally for the first seat: move stage, a full gauge. */
function openTurn(seat = 0): void {
  const player = store().players[seat];
  edit({ activePlayerIndex: seat, turnStage: "move", energyLeft: getEnergyCapacity(player, store()), diceRoll: null });
}

const player = (seat: number): Player => store().players[seat];

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Mime", () => {
  it("copie le Cups Power d’un autre joueur, sans énergie", () => {
    startTable(["mime", "tomato-enjoyer", "lambda"]);
    store().mimeCopy("p2");
    expect(hasCard(player(0), "tomato-enjoyer")).toBe(true);
    expect(player(0).passiveId).toBe("mime");
    expect(store().energyLeft).toBe(3);
    expect(store().turnActionTaken).toBe(false);
    expect(player(0).mimeReadyRound).toBe(store().round + 3);
  });

  it("copie le passif d’un joueur, au choix, et la table lit lequel", () => {
    startTable(["mime", ["lambda", "goblin"]]);
    store().mimeCopy("p2", "passif");
    expect(player(0).mimicId).toBe("goblin");
    expect(hasCard(player(0), "goblin")).toBe(true);
    expect(store().log[0].text).toContain("passif de Joueur 2");
    expect(store().log[0].secret).toBeUndefined();
    expect(player(0).mimeReadyRound).toBe(store().round + 3);
  });

  it("ne copie ni Non merci, ni L’Ermite, ni L’Assureur, et un joueur sans passif n’en offre pas", () => {
    startTable(["mime", ["lambda", "no-thanks"], ["lambda", "hermit"], ["lambda", "insurer"], "lambda"]);
    const before = store().players;
    store().mimeCopy("p2", "passif");
    store().mimeCopy("p3", "passif");
    store().mimeCopy("p4", "passif");
    store().mimeCopy("p5", "passif");
    expect(store().players).toBe(before);
  });

  it("garde secret le Cups Power copié : la table n’apprend que le nom du joueur", () => {
    startTable(["mime", "tomato-enjoyer"]);
    store().mimeCopy("p2");
    const entry = store().log[0];
    expect(entry.text).toContain("Tomato Enjoyer");
    expect(entry.secret?.ownerId).toBe("p1");
    expect(entry.secret?.publicText).not.toContain("Tomato Enjoyer");
    expect(entry.secret?.publicText).toContain("Joueur 2");
  });

  it("recopier Red Bull ajoute son point d’énergie tout de suite", () => {
    startTable(["mime", "red-bull"]);
    store().mimeCopy("p2");
    expect(store().energyLeft).toBe(4);
  });

  it("une seule copie tous les 3 tours de table", () => {
    startTable(["mime", "tomato-enjoyer", "eshop"]);
    store().mimeCopy("p2");
    const copied = store();
    store().mimeCopy("p3");
    expect(store().players).toBe(copied.players);
    // Round 1 copy: ready again at round 4, not before.
    edit({ round: 3, turnStage: "move" });
    editPlayer(0, { mimicId: null });
    expect(getMimeTargets(store(), player(0))).toHaveLength(0);
    edit({ round: 4 });
    expect(getMimeTargets(store(), player(0))).toHaveLength(2);
  });

  it("ne copie ni les rôles, ni les CP à état propre", () => {
    startTable(["mime", "devil", "black-mage", "ghost-sister", "half-seen"]);
    expect(getMimeTargets(store(), player(0))).toHaveLength(0);
    const before = store().players;
    store().mimeCopy("p2");
    expect(store().players).toBe(before);
  });

  it("la copie s’arrête avec le tour", () => {
    startTable(["mime", "tomato-enjoyer"]);
    store().mimeCopy("p2");
    edit({ turnActionTaken: true });
    store().endTurn();
    expect(store().activePlayerIndex).toBe(1);
    expect(player(0).mimicId).toBeUndefined();
    expect(hasCard(player(0), "tomato-enjoyer")).toBe(false);
  });

  it("on ne copie pas un joueur invisible", () => {
    startTable(["mime", "ghost-sister", "lambda"]);
    editPlayer(1, { passiveId: "half-seen", mistTurns: 2, position: 4 });
    edit({ redCupNodeId: 8 });
    expect(isInvisible(store(), player(1))).toBe(true);
    expect(getMimeTargets(store(), player(0)).map((other) => other.id)).toEqual(["p3"].filter(() => false));
  });
});

describe("Taupe", () => {
  /** La Taupe at tile 4 with every tile of the loop visited, the Red Cup far away on tile 5. */
  function moleAtFour(): void {
    startTable(["mole", "lambda", "lambda"]);
    edit({ redCupNodeId: 5 });
    editPlayer(0, { position: 4, visitedNodeIds: [0, 2, 4, 7] });
    openTurn(0);
  }

  it("creuse un tunnel vers une case visitée et s’y déplace", () => {
    moleAtFour();
    store().digTunnel(2);
    expect(player(0).position).toBe(2);
    expect(store().moleTunnels).toHaveLength(1);
    expect(store().moleTunnels[0]).toMatchObject({ a: 4, b: 2, ownerId: "p1", crossingsLeft: 1 });
    expect(store().energyLeft).toBe(0);
    expect(player(0).moleReadyRound).toBe(store().round + 3);
    expect(store().lastMovement?.tunnel?.dug).toBe(true);
  });

  it("un tunnel ne rapporte pas le bonus du départ, même sur la route fléchée 8 → 0", () => {
    startTable(["mole", "lambda"]);
    edit({ redCupNodeId: 5 });
    editPlayer(0, { position: 8, visitedNodeIds: [0, 8] });
    openTurn(0);
    const coins = player(0).currency;
    store().digTunnel(0);
    expect(player(0).position).toBe(0);
    expect(player(0).currency).toBe(coins);
  });

  it.each([
    ["une case jamais visitée", (): NodeId => 9],
    ["la case où elle se tient", (): NodeId => 4],
    ["la case de la Red Cup", (): NodeId => 7],
    ["une case piégée", (): NodeId => 2],
  ])("refuse de creuser vers %s", (_label, destination) => {
    moleAtFour();
    if (destination() === 7) edit({ redCupNodeId: 7 });
    if (destination() === 2) edit({ mudTraps: [{ id: "m", nodeId: 2, ownerId: "p2" }] });
    const before = store().players;
    store().digTunnel(destination());
    expect(store().players).toBe(before);
    expect(store().moleTunnels).toHaveLength(0);
  });

  it("refuse de creuser sans 3 énergie ou pendant l’attente", () => {
    moleAtFour();
    edit({ energyLeft: 2 });
    store().digTunnel(2);
    expect(store().moleTunnels).toHaveLength(0);
    edit({ energyLeft: 3 });
    editPlayer(0, { moleReadyRound: store().round + 1 });
    store().digTunnel(2);
    expect(store().moleTunnels).toHaveLength(0);
  });

  it("les autres traversent pour 3 énergie, le tunnel se referme", () => {
    moleAtFour();
    store().digTunnel(2);
    // Joueur 2 stands at the other end with a full gauge.
    editPlayer(1, { position: 4 });
    openTurn(1);
    edit({ energyLeft: 2 });
    store().crossTunnel(store().moleTunnels[0].id);
    expect(player(1).position).toBe(4);
    edit({ energyLeft: 3 });
    store().crossTunnel(store().moleTunnels[0].id);
    expect(player(1).position).toBe(2);
    expect(store().moleTunnels).toHaveLength(0);
  });

  it("la Taupe traverse son propre tunnel pour 2 énergie", () => {
    moleAtFour();
    store().digTunnel(2);
    openTurn(0);
    edit({ energyLeft: 2 });
    store().crossTunnel(store().moleTunnels[0].id);
    expect(player(0).position).toBe(4);
    expect(store().moleTunnels).toHaveLength(0);
  });

  it("une case traversée en marchant compte comme visitée", () => {
    startTable(["mole", "lambda"]);
    edit({ redCupNodeId: 5 });
    openTurn(0);
    store().movePlayer(2);
    expect(player(0).visitedNodeIds).toEqual(expect.arrayContaining([0, 2]));
  });

  it("une Red Cup au bout du tunnel est ramassée à l’arrivée", () => {
    moleAtFour();
    store().digTunnel(2);
    openTurn(0);
    edit({ redCupNodeId: 4, energyLeft: 2 });
    store().crossTunnel(store().moleTunnels[0].id);
    expect(player(0).inventory.filter((entry) => entry.kind === "red-cup")).toHaveLength(1);
  });
});

describe("Mage noir", () => {
  function mageAtTwo(): void {
    startTable(["black-mage", "lambda", "lambda"]);
    edit({ redCupNodeId: 5 });
    editPlayer(0, { position: 2 });
    openTurn(0);
  }

  it("pose un pentagramme sur sa case, un seul à la fois, jamais sur de la Boue", () => {
    mageAtTwo();
    store().placeMark();
    expect(store().blackMarks).toEqual([{ ownerId: "p1", nodeId: 2 }]);
    const marked = store().blackMarks;
    store().placeMark();
    expect(store().blackMarks).toBe(marked);

    store().resetGame();
    mageAtTwo();
    edit({ mudTraps: [{ id: "m", nodeId: 2, ownerId: "p2" }] });
    store().placeMark();
    expect(store().blackMarks).toHaveLength(0);
  });

  it("se téléporte sur sa marque en perdant une chance, et la marque disparaît", () => {
    mageAtTwo();
    store().placeMark();
    editPlayer(0, { position: 9 });
    openTurn(0);
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    store().teleportToMark();
    expect(player(0).position).toBe(2);
    expect(player(0).luck).toBe(2);
    expect(player(0).luckReturnRound).toBe(store().round + 15);
    expect(store().blackMarks).toHaveLength(0);
    expect(store().lastPowerEvent).toMatchObject({ kind: "mark-teleport", reason: "turn", victimIds: [] });
  });

  it("ignore Barrières et flèches, et sort de l’Enfer", () => {
    mageAtTwo();
    store().placeMark();
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: 1 });
    edit({ turnStage: "hell", energyLeft: 3 });
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    store().teleportToMark();
    expect(player(0).position).toBe(2);
    expect(store().turnStage).toBe("move");
  });

  it("un joueur sur la marque risque l’Enfer, et la marque reste", () => {
    mageAtTwo();
    store().placeMark();
    editPlayer(0, { position: 9 });
    editPlayer(1, { position: 2 });
    openTurn(0);
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    store().teleportToMark();
    expect(player(1).position).toBe(HELL_NODE_ID);
    expect(store().blackMarks).toHaveLength(1);
    expect(store().lastPowerEvent).toMatchObject({ victimIds: ["p2"], kept: true });
  });

  it("à 20 % d’être épargné, le joueur reste et la marque s’éteint", () => {
    mageAtTwo();
    store().placeMark();
    editPlayer(0, { position: 9 });
    editPlayer(1, { position: 2 });
    openTurn(0);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    store().teleportToMark();
    expect(player(1).position).toBe(2);
    expect(store().blackMarks).toHaveLength(0);
  });

  it("la Boue sur la marque peut faire tomber le mage en Enfer", () => {
    mageAtTwo();
    store().placeMark();
    editPlayer(0, { position: 9 });
    edit({ mudTraps: [{ id: "m", nodeId: 2, ownerId: "p2" }] });
    openTurn(0);
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    store().teleportToMark();
    expect(player(0).position).toBe(HELL_NODE_ID);
    expect(store().mudTraps).toHaveLength(0);
  });

  it("à zéro pentagramme, le mage reste en jeu mais ne peut plus se téléporter", () => {
    mageAtTwo();
    store().placeMark();
    editPlayer(0, { position: 9, luck: 1, luckReturnRound: 9 });
    openTurn(0);
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    store().teleportToMark();
    expect(store().players.map((other) => other.id)).toEqual(["p1", "p2", "p3"]);
    expect(player(0).luck).toBe(0);
    expect(store().phase).toBe("playing");
    // Out of pentagrams: no more teleport, whatever the mark.
    store().placeMark();
    editPlayer(0, { position: 9 });
    openTurn(0);
    const before = store().players;
    store().teleportToMark();
    expect(store().players).toBe(before);
    expect(canTeleport(store(), player(0))).toBe(false);
    // One comes back after fifteen rounds.
    expect(regainMageLuck(store(), 9).players[0].luck).toBe(1);
  });

  it("récupère une chance tous les 15 tours de table", () => {
    mageAtTwo();
    editPlayer(0, { luck: 1, luckReturnRound: 16 });
    const early = regainMageLuck(pick(), 15);
    expect(early.players[0].luck).toBe(1);
    const due = regainMageLuck(pick(), 16);
    expect(due.players[0].luck).toBe(2);
    expect(due.players[0].luckReturnRound).toBe(31);
    expect(regainMageLuck(due, 31).players[0].luck).toBe(3);
  });

  it("arrive sur sa marque même en esquivant : la Red Cup qui s’y trouve est ramassée", () => {
    startTable(["black-mage", "lambda"]);
    edit({ redCupNodeId: 2 });
    editPlayer(0, { position: 2 });
    openTurn(0);
    store().placeMark();
    edit({ redCupNodeId: 2 });
    editPlayer(0, { position: 9 });
    editPlayer(1, {
      inventory: [{ id: "hp", kind: "item", itemId: "hollow-purple" }],
      currency: 5000,
    });
    openTurn(1);
    store().useItem("hp", "p1");
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    store().resolveReaction("p1", true);
    expect(player(0).position).toBe(2);
    expect(store().redCupNodeId).not.toBe(2);
  });

  it("esquive un objet qui le vise en se téléportant", () => {
    startTable(["black-mage", "lambda"]);
    edit({ redCupNodeId: 5 });
    editPlayer(0, { position: 2 });
    openTurn(0);
    store().placeMark();
    editPlayer(0, { position: 9 });
    editPlayer(1, {
      inventory: [{ id: "hp", kind: "item", itemId: "hollow-purple" }],
      currency: 5000,
    });
    openTurn(1);
    store().useItem("hp", "p1");
    expect(store().turnStage).toBe("reaction");
    expect(store().pendingReaction?.reactorIds).toContain("p1");
    // Without a Non merci, answering without teleporting is refused.
    const pending = store().pendingReaction;
    store().resolveReaction("p1");
    expect(store().pendingReaction).toBe(pending);
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    store().resolveReaction("p1", true);
    expect(player(0).position).toBe(2);
    expect(player(0).position).not.toBe(HELL_NODE_ID);
    expect(player(1).inventory).toHaveLength(0);
  });

  it("remplace un déplacement de roue par la téléportation", () => {
    mageAtTwo();
    store().placeMark();
    editPlayer(0, { position: 9 });
    openTurn(0);
    edit({
      turnStage: "wheel-result",
      pendingWheel: {
        id: "w",
        wheelId: "misfortune",
        playerId: "p1",
        result: { id: "go-to-hell", label: "Direction l’Enfer" },
        resumeStage: "turn-end",
      },
    });
    expect(canTeleport(store(), player(0))).toBe(true);
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    store().cancelWheel(false, true);
    expect(player(0).position).toBe(2);
    expect(store().pendingWheel).toBeNull();
  });

  /** The state as the reducer sees it. */
  function pick(): GameState {
    return useGameStore.getState() as GameState;
  }
});

describe("Mi-vu, Mi-vue", () => {
  it("est visible un tour sur trois, invisible les deux autres", () => {
    startTable(["half-seen", "lambda"]);
    edit({ redCupNodeId: 5 });
    editPlayer(0, { position: 4 });
    const phases = [0, 1, 2, 3, 4, 5, 6, 7].map((turns) => {
      editPlayer(0, { mistTurns: turns });
      return isInvisible(store(), player(0));
    });
    expect(phases).toEqual([false, false, true, true, false, true, true, false]);
  });

  it("à une case de la Red Cup, il redevient visible", () => {
    startTable(["half-seen", "lambda"]);
    editPlayer(0, { position: 4, mistTurns: 2 });
    edit({ redCupNodeId: 7 });
    expect(isInvisible(store(), player(0))).toBe(false);
    edit({ redCupNodeId: 2 });
    expect(isInvisible(store(), player(0))).toBe(true);
  });

  it("annonce à toute la table quand il devient invisible", () => {
    startTable(["half-seen", "lambda"]);
    editPlayer(0, { mistTurns: 1 });
    const next = advanceMist(store() as GameState, "p1");
    expect(next.players[0].mistTurns).toBe(2);
    expect(next.log[0]).toMatchObject({ open: true });
    expect(next.log[0].text).toContain("devient invisible");
  });

  it("ne cible personne et n’est ciblé par personne", () => {
    startTable(["half-seen", "lambda"]);
    edit({ redCupNodeId: 2 });
    editPlayer(0, { position: 9, mistTurns: 2 });
    editPlayer(1, { inventory: [{ id: "n", kind: "item", itemId: "ndoye" }], currency: 5000 });
    openTurn(1);
    expect(canTargetPlayer(store(), player(1), player(0))).toBe(false);
    expect(planItemUse(store(), "n", "p1")).toBeNull();
    // Hidden themselves, nobody is within their reach either.
    editPlayer(0, { inventory: [{ id: "n", kind: "item", itemId: "ndoye" }], currency: 5000 });
    openTurn(0);
    editPlayer(1, { position: 4 });
    expect(planItemUse(store(), "n", "p2")).toBeNull();
  });

  it("Draven l’épargne", () => {
    startTable(["half-seen", "lambda", "lambda"]);
    edit({ redCupNodeId: 2 });
    editPlayer(0, { position: 9, mistTurns: 2 });
    editPlayer(1, { inventory: [{ id: "d", kind: "item", itemId: "draven" }] });
    openTurn(1);
    store().useItem("d");
    expect(player(0).position).toBe(9);
    expect(player(2).position).toBe(HELL_NODE_ID);
  });

  it("Bullet Bill ne le traque plus mais l’assomme s’il explose sur sa case", () => {
    startTable(["half-seen", "lambda", "lambda"]);
    edit({ redCupNodeId: 8 });
    // The invisible player stands next to Bullet Bill, a visible one two tiles away.
    editPlayer(0, { position: 2, mistTurns: 2 });
    editPlayer(1, { position: 5 });
    editPlayer(2, { position: 5 });
    edit({ bulletBill: { status: "active", position: 0, spawnRound: 1 } });
    const charged = advanceBulletBill(pickState(), 2);
    expect(charged.lastBulletFlight?.targetId).not.toBe("p1");
    // Now the visible players stand on the invisible player's tile: the blast reaches them all.
    editPlayer(1, { position: 2 });
    editPlayer(2, { position: 2 });
    edit({ bulletBill: { status: "active", position: 2, spawnRound: 1 } });
    const blast = advanceBulletBill(pickState(), 2);
    expect(blast.players[0].skippedTurns).toBeGreaterThan(0);
  });

  function pickState(): GameState {
    return useGameStore.getState() as GameState;
  }
});

describe("Sœur Fantôme", () => {
  it("fait le pas opposé du joueur quand une route y mène", () => {
    const board = getBoard({ mapId: "classic", carouselReversed: false, iceTileNodeId: null });
    // The player goes 4 → 7, towards the top of the screen (z grows): from the start, the sister goes 0 → 2.
    expect(mirrorStep(board, 0, 4, 7)).toBe(2);
    // And back: 7 → 4 mirrors as a step the other way, which 2 cannot take (2 → 5 heads left, not up).
    expect(mirrorStep(board, 0, 7, 4)).toBeNull();
  });

  it("reste sur place quand aucune route ne va dans l’autre sens", () => {
    const board = getBoard({ mapId: "classic", carouselReversed: false, iceTileNodeId: null });
    expect(mirrorStep(board, 3, 4, 7)).toBeNull();
  });

  it("suit le joueur pas à pas, et sa marche est enregistrée", () => {
    startTable(["ghost-sister", "lambda"]);
    edit({ redCupNodeId: 5 });
    editPlayer(0, { position: 4 });
    openTurn(0);
    store().movePlayer(7);
    expect(getSisterNode(player(0))).toBe(2);
    expect(store().lastMovement?.sister).toEqual({ playerId: "p1", from: START_NODE_ID, path: [2] });
  });

  it("retourne au Départ quand le joueur tombe en Enfer", () => {
    startTable(["ghost-sister", "lambda"]);
    editPlayer(0, { position: 4, sisterNodeId: 2 });
    openTurn(0);
    edit({
      turnStage: "wheel-result",
      pendingWheel: {
        id: "w",
        wheelId: "misfortune",
        playerId: "p1",
        result: { id: "go-to-hell", label: "Direction l’Enfer" },
        resumeStage: "turn-end",
      },
    });
    store().resolveWheel();
    expect(player(0).position).toBe(HELL_NODE_ID);
    expect(getSisterNode(player(0))).toBe(START_NODE_ID);
  });

  it("reste où elle est quand le joueur est téléporté", () => {
    startTable(["ghost-sister", "lambda"]);
    editPlayer(0, { position: 4, sisterNodeId: 2 });
    openTurn(0);
    edit({
      turnStage: "wheel-result",
      pendingWheel: {
        id: "w",
        wheelId: "fortune",
        playerId: "p1",
        result: { id: "go-to-start", label: "Va au Départ" },
        resumeStage: "turn-end",
      },
    });
    store().resolveWheel();
    expect(player(0).position).toBe(START_NODE_ID);
    expect(getSisterNode(player(0))).toBe(2);
  });

  it("Swap : échange les places, emporte Boue, Red Cup et Bullet Bill, sans rien déclencher", () => {
    startTable(["ghost-sister", "lambda"]);
    // The sister floats on the green tile 5, with the Red Cup, a mud and Bullet Bill on it.
    editPlayer(0, { position: 4, sisterNodeId: 5 });
    edit({
      redCupNodeId: 5,
      mudTraps: [{ id: "m", nodeId: 5, ownerId: "p2" }],
      bulletBill: { status: "active", position: 5, spawnRound: 1 },
    });
    openTurn(0);
    store().swapWithSister();
    expect(player(0).position).toBe(5);
    expect(getSisterNode(player(0))).toBe(4);
    expect(store().redCupNodeId).toBe(4);
    expect(store().mudTraps[0].nodeId).toBe(4);
    expect(store().bulletBill?.position).toBe(4);
    // Nothing was picked up, nothing sprang, and the green tile spun no wheel.
    expect(player(0).inventory).toHaveLength(0);
    expect(player(0).currency).toBe(2000);
    expect(store().turnStage).toBe("move");
    expect(store().energyLeft).toBe(0);
  });

  it("Swap : une fois tous les 4 tours seulement", () => {
    startTable(["ghost-sister", "lambda"]);
    editPlayer(0, { position: 4, sisterNodeId: 5 });
    edit({ round: 3 });
    openTurn(0);
    store().swapWithSister();
    expect(player(0).position).toBe(5);
    expect(player(0).swapReadyRound).toBe(7);
    // Back on a tile away from the sister, with a full gauge, in each round until the seventh.
    for (const round of [4, 5, 6]) {
      editPlayer(0, { position: 4, sisterNodeId: 5 });
      edit({ round });
      openTurn(0);
      expect(canSwap(store(), player(0))).toBe(false);
    }
    edit({ round: 7 });
    openTurn(0);
    expect(canSwap(store(), player(0))).toBe(true);
  });

  it("Swap : refusé en Enfer, sur la même case ou sans 3 énergie", () => {
    startTable(["ghost-sister", "lambda"]);
    editPlayer(0, { position: 4, sisterNodeId: 4 });
    openTurn(0);
    const same = store().players;
    store().swapWithSister();
    expect(store().players).toBe(same);
    editPlayer(0, { sisterNodeId: 2 });
    edit({ energyLeft: 2 });
    store().swapWithSister();
    expect(player(0).position).toBe(4);
    editPlayer(0, { position: HELL_NODE_ID });
    edit({ energyLeft: 3, turnStage: "hell" });
    store().swapWithSister();
    expect(player(0).position).toBe(HELL_NODE_ID);
  });
});

describe("L'Ermite", () => {
  it("seul, il a 1 énergie de plus et 100 pièces de plus au Départ", () => {
    startTable(["lambda", "lambda", ["lambda", "hermit"]]);
    editPlayer(0, { position: 4 });
    editPlayer(1, { position: 4 });
    editPlayer(2, { position: 10 });
    expect(isHermitPrimeActive(store(), player(2))).toBe(true);
    expect(getEnergyCapacity(player(2), store())).toBe(4);
    openTurn(2);
    edit({ redCupNodeId: 5 });
    // From tile 8, along the arrow into the start, with the others three roads away from it.
    editPlayer(0, { position: 6 });
    editPlayer(1, { position: 1 });
    editPlayer(2, { position: 8 });
    const coins = player(2).currency;
    store().movePlayer(0);
    expect(player(2).currency).toBe(coins + 300);
  });

  it("avec quelqu’un à 2 cases ou moins, pas de prime", () => {
    startTable(["lambda", ["lambda", "hermit"]]);
    editPlayer(0, { position: 7 });
    editPlayer(1, { position: 4 });
    expect(isHermitPrimeActive(store(), player(1))).toBe(false);
    expect(getEnergyCapacity(player(1), store())).toBe(3);
  });

  it("quelqu’un qui arrive sur sa case lui retire la prime jusqu’à la fin de son prochain tour", () => {
    startTable(["lambda", ["lambda", "hermit"]]);
    edit({ redCupNodeId: 5 });
    editPlayer(0, { position: 9 });
    editPlayer(1, { position: 4 });
    openTurn(0);
    store().movePlayer(4);
    expect(player(0).position).toBe(4);
    // The hermit plays after: their next turn is this round's.
    expect(player(1).hermitLostUntilRound).toBe(store().round);
    editPlayer(0, { position: 10 });
    expect(isHermitPrimeActive(store(), player(1))).toBe(false);
    edit({ round: store().round + 1 });
    expect(isHermitPrimeActive(store(), player(1))).toBe(true);
  });
});

describe("L'Assureur", () => {
  it("touche 20 % de ce qu’un autre perd, payés par la banque", () => {
    startTable(["lambda", ["lambda", "insurer"]]);
    const total = player(0).currency + player(1).currency;
    const next = applyCurrencyChange(store() as GameState, "p1", -200);
    expect(next.players[0].currency).toBe(1800);
    expect(next.players[1].currency).toBe(2040);
    // The bank paid: the coins of the table went up.
    expect(next.players[0].currency + next.players[1].currency).toBe(total - 160);
  });

  it("n’est pas payé pour ses propres pertes ni pour les achats", () => {
    startTable(["lambda", ["lambda", "insurer"]]);
    const own = applyCurrencyChange(store() as GameState, "p2", -200);
    expect(own.players[1].currency).toBe(1800);
    const bought = applyCurrencyChange(store() as GameState, "p1", -200, { gamble: false, silent: true });
    expect(bought.players[1].currency).toBe(2000);
  });

  it("au plus 150 pièces par tour de table", () => {
    startTable(["lambda", ["lambda", "insurer"]]);
    let state = store() as GameState;
    for (let loss = 0; loss < 4; loss += 1) state = applyCurrencyChange(state, "p1", -300);
    expect(state.players[1].currency).toBe(2000 + 150);
    // A new round, a new cap.
    const later = applyCurrencyChange({ ...state, round: state.round + 1 }, "p1", -300);
    expect(later.players[1].currency).toBe(2000 + 150 + 60);
  });

  it("chaque descente en Enfer d’un autre lui rapporte 50 pièces", () => {
    startTable(["lambda", ["lambda", "insurer"]]);
    edit({
      turnStage: "wheel-result",
      pendingWheel: {
        id: "w",
        wheelId: "misfortune",
        playerId: "p1",
        result: { id: "go-to-hell", label: "Direction l’Enfer" },
        resumeStage: "turn-end",
      },
    });
    store().resolveWheel();
    expect(player(0).position).toBe(HELL_NODE_ID);
    expect(player(1).currency).toBe(2050);
  });
});

describe("L'Ange-Gardien et le Mage noir", () => {
  it("le Mage noir n'est jamais tiré comme protégé", () => {
    startTable(["guardian-angel", "black-mage", "lambda", "lambda"]);
    for (let draw = 0; draw < 24; draw += 1) {
      const guarded = assignGuardian({ ...store(), guardian: null });
      expect(guarded.guardian?.protegeId).not.toBe(store().players[1].id);
    }
    const alone = assignGuardian({ ...store(), players: store().players.slice(0, 2), guardian: null });
    expect(alone.guardian).toBeNull();
  });
});

describe("Mi-vu, Mi-vue : le brouillard", () => {
  it("l'invisible ne voit plus la table pendant son tour seulement", () => {
    startTable(["half-seen", "lambda", "lambda"]);
    edit({ redCupNodeId: 8 });
    editPlayer(0, { position: 4, mistTurns: 2 });
    expect(isInvisible(store(), player(0))).toBe(true);
    // Their own turn: nothing of the table is seen, the Red Cup included.
    openTurn(0);
    expect(getFog(store(), player(0).id).viewerHidden).toBe(true);
    expect(getFog(store(), null).viewerHidden).toBe(true);
    // Somebody else plays: the others still do not see them, but they watch the turn.
    openTurn(1);
    const online = getFog(store(), player(0).id);
    expect(online.viewerHidden).toBe(false);
    expect(online.ghostlyId).toBe(player(0).id);
    expect(getFog(store(), player(1).id).hiddenIds.has(player(0).id)).toBe(true);
    expect(getFog(store(), null).viewerHidden).toBe(false);
  });
});
