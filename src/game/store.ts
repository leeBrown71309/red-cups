import { create } from "zustand";
import { BOARD_NODES, NORMAL_NODE_IDS, getPathsOfLength, getShortestPath } from "./board";
import { ITEM_CATALOG, ITEM_ORDER, PASSIVE_ORDER, chooseWheelResult } from "./catalog";
import {
  canAddItem,
  countRedCups,
  findLegalPath,
  getInventoryCapacity,
  getItemPrice,
  getUniqueLegalDestinations,
} from "./rules";
import type {
  DuelMode,
  GameLogEntry,
  GameState,
  InventoryEntry,
  ItemId,
  NodeId,
  PendingWheel,
  Player,
  PlayerId,
  RpsChoice,
  TurnStage,
  WheelId,
} from "./types";
import {
  BASE_INVENTORY_CAPACITY,
  CURRENCY_RESET_THRESHOLD,
  EMPTY_GAME_STATE,
  HELL_NODE_ID,
  INITIAL_RED_CUP_NODE_ID,
  PLAYER_COLORS,
  RED_CUP_GOAL,
  STARTING_CURRENCY,
  START_NODE_ID,
} from "./types";

const DELINQUENT_COST = 200;

const WHEEL_LOG_NAMES: Record<WheelId, string> = {
  hell: "de l’Enfer",
  fortune: "du bonheur",
  misfortune: "du malheur",
};

interface GameActions {
  startGame: (playerNames: string[]) => void;
  resetGame: () => void;
  movePlayer: (destination: NodeId, ignoreArrows?: boolean) => void;
  prepareBoot: (entryId: string) => void;
  buyItem: (itemId: ItemId) => void;
  useItem: (entryId: string, targetPlayerId?: PlayerId) => void;
  endTurn: () => void;
  spinHellWheel: () => void;
  spinWheel: (wheelId: WheelId, playerId: PlayerId, resumeStage: TurnStage, sourceItemId?: ItemId) => void;
  resolveWheel: () => void;
  cancelWheel: () => void;
  challengePlayer: (targetPlayerId: PlayerId) => void;
  resolveDuel: (winnerId: PlayerId) => void;
  discardInventoryEntry: (entryId: string) => void;
  repositionBeforeCup: (destination: NodeId) => void;
  resolveCalmDown: (useEffect: boolean) => void;
  resolvePassiveVote: (playerId: PlayerId, cancelAction: boolean) => void;
}

export type GameStore = GameState & GameActions;

function makeLog(text: string, tone: GameLogEntry["tone"] = "neutral"): GameLogEntry {
  return { id: crypto.randomUUID(), text, tone };
}

function addLog(state: GameState, text: string, tone: GameLogEntry["tone"] = "neutral"): GameState {
  return { ...state, log: [makeLog(text, tone), ...state.log].slice(0, 60) };
}

function randomChoice<T>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  return values[Math.floor(Math.random() * values.length)];
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function updatePlayer(state: GameState, playerId: PlayerId, updater: (player: Player) => Player): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? updater(player) : player)),
  };
}

function appendItem(player: Player, itemId: ItemId): Player {
  const entry: InventoryEntry = {
    id: crypto.randomUUID(),
    kind: "item",
    itemId,
  };
  return { ...player, inventory: [...player.inventory, entry] };
}

function removeInventoryEntry(player: Player, entryId: string): Player {
  return {
    ...player,
    inventory: player.inventory.filter((entry) => entry.id !== entryId),
  };
}

function applyCurrencyChange(state: GameState, playerId: PlayerId, amount: number): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || amount === 0) return state;

  let nextState = state;
  let nextCurrency = player.currency + amount;
  let nextInventory = player.inventory;

  if (amount < 0 && nextCurrency < 0) {
    const helmet = player.inventory.find((entry) => entry.kind === "item" && entry.itemId === "helmet");

    if (helmet) {
      nextCurrency = 0;
      nextInventory = player.inventory.filter((entry) => entry.id !== helmet.id);
      nextState = addLog(nextState, `${player.name} active son Casque et évite de passer sous zéro.`, "good");
    }
  }

  const reachedResetThreshold = nextCurrency <= CURRENCY_RESET_THRESHOLD;
  if (reachedResetThreshold) nextCurrency = 0;

  nextState = updatePlayer(nextState, playerId, (currentPlayer) => ({
    ...currentPlayer,
    currency: nextCurrency,
    inventory: nextInventory,
    skippedTurns: currentPlayer.skippedTurns + Number(reachedResetThreshold),
  }));

  if (reachedResetThreshold) {
    nextState = addLog(
      nextState,
      `${player.name} tombe à −300 pièces : son solde revient à 0 et son prochain tour sera sauté.`,
      "bad",
    );
  } else {
    const sign = amount > 0 ? "+" : "−";
    nextState = addLog(nextState, `${player.name} ${sign}${Math.abs(amount)} pièces.`, amount > 0 ? "good" : "bad");
  }

  return nextState;
}

function startDuel(state: GameState, playerOneId: PlayerId, playerTwoId: PlayerId, resumeStage: TurnStage): GameState {
  const playerOne = state.players.find((player) => player.id === playerOneId);
  const playerTwo = state.players.find((player) => player.id === playerTwoId);
  if (!playerOne || !playerTwo || playerOneId === playerTwoId) return state;

  const otherPlayers = state.players.filter((player) => player.id !== playerOneId && player.id !== playerTwoId);
  const availableModes: DuelMode[] = ["coin-flip", "rock-paper-scissors"];
  if (otherPlayers.length > 0) availableModes.push("player-vote");
  const mode = randomChoice(availableModes) ?? "coin-flip";
  const coinWinnerId = mode === "coin-flip" ? randomChoice([playerOneId, playerTwoId]) : undefined;

  let nextState: GameState = {
    ...state,
    pendingDuel: {
      playerOneId,
      playerTwoId,
      mode,
      coinWinnerId,
      resumeStage,
    },
    turnStage: "duel",
    duelResumeStage: resumeStage,
  };
  nextState = addLog(
    nextState,
    `${playerOne.name} et ${playerTwo.name} s’affrontent en ${
      mode === "coin-flip" ? "pile ou face" : mode === "rock-paper-scissors" ? "pierre-feuille-ciseaux" : "vote"
    }.`,
    "event",
  );
  return nextState;
}

function maybeStartHellDuel(state: GameState, resumeStage: TurnStage): GameState {
  if (
    state.pendingDuel ||
    state.pendingDiscard ||
    state.pendingCalmDown ||
    state.pendingChallenge ||
    state.pendingCupRepositionPlayerId
  ) {
    return state;
  }
  const hellPlayers = state.players.filter((player) => player.position === HELL_NODE_ID);
  if (hellPlayers.length < 2) return { ...state, turnStage: resumeStage };
  return startDuel(state, hellPlayers[0].id, hellPlayers[1].id, resumeStage);
}

function createCupNode(previousNodeId: NodeId): NodeId {
  const candidates = NORMAL_NODE_IDS.filter((nodeId) => nodeId !== START_NODE_ID && nodeId !== previousNodeId);
  return randomChoice(candidates) ?? 1;
}

function applyTrollEffects(state: GameState): GameState {
  let nextState = state;
  const trolls = state.players.filter((player) => player.passiveId === "troll");

  for (const troll of trolls) {
    const targets = shuffle(state.players.filter((player) => player.id !== troll.id)).slice(0, 2);

    for (const target of targets) {
      nextState = applyCurrencyChange(nextState, target.id, -100);
      nextState = applyCurrencyChange(nextState, troll.id, 100);
    }
  }

  return nextState;
}

function finishCupCollection(state: GameState, playerId: PlayerId, cupNodeId: NodeId): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return state;

  let nextState = updatePlayer(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    inventory: [...currentPlayer.inventory, { id: crypto.randomUUID(), kind: "red-cup" }],
  }));
  const totalCups = countRedCups(nextState.players.find((candidate) => candidate.id === playerId) ?? player);
  nextState = addLog(nextState, `${player.name} récupère une Red Cup (${totalCups}/${RED_CUP_GOAL}).`, "good");

  if (totalCups >= RED_CUP_GOAL) {
    nextState = {
      ...nextState,
      phase: "finished",
      turnStage: "finished",
      redCupNodeId: null,
      winnerId: playerId,
      pendingCalmDown: null,
    };
    return addLog(nextState, `${player.name} remporte la partie !`, "good");
  }

  const nextCupNodeId = createCupNode(cupNodeId);
  const repositioner = nextState.players.find((candidate) => candidate.passiveId === "new-cup-new-me");
  const resumeStage = state.turnStage === "discard" ? "turn-end" : state.turnStage;

  nextState = {
    ...nextState,
    previousRedCupNodeId: cupNodeId,
    redCupCycle: nextState.redCupCycle + 1,
    redCupNodeId: repositioner ? null : nextCupNodeId,
    pendingCupRepositionPlayerId: repositioner?.id ?? null,
    pendingCupRevealNodeId: repositioner ? nextCupNodeId : null,
    pendingCupRepositionResumeStage: repositioner ? resumeStage : null,
    pendingCupCollectorId: repositioner ? playerId : null,
    turnStage: repositioner ? "reposition" : resumeStage,
  };

  nextState = applyTrollEffects(nextState);
  nextState = addLog(nextState, "Une nouvelle Red Cup apparaît sur le plateau.", "event");
  if (!repositioner) nextState = addCupCycleEffects(nextState, playerId);
  return nextState;
}

function collectCupOrRequestDiscard(state: GameState, playerId: PlayerId, nodeId: NodeId): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || state.redCupNodeId !== nodeId) return state;

  if (player.inventory.length >= getInventoryCapacity(player)) {
    return {
      ...state,
      turnStage: "discard",
      pendingDiscard: {
        playerId,
        reason: "red-cup",
        cupNodeId: nodeId,
        resumeStage: state.turnStage,
      },
    };
  }

  return finishCupCollection(state, playerId, nodeId);
}

function randomNormalNode(excludeNodeId?: NodeId): NodeId {
  const nodes = NORMAL_NODE_IDS.filter((nodeId) => nodeId !== HELL_NODE_ID && nodeId !== excludeNodeId);
  return randomChoice(nodes) ?? START_NODE_ID;
}

function itemCopyForPassive(state: GameState, targetPlayerId: PlayerId, itemId: ItemId): GameState {
  const target = state.players.find((player) => player.id === targetPlayerId);
  if (!target || target.passiveId !== "i-take-notes") return state;

  if (canAddItem(target, itemId)) {
    const nextState = updatePlayer(state, targetPlayerId, (player) => appendItem(player, itemId));
    return addLog(nextState, `${target.name} récupère aussi ${ITEM_CATALOG[itemId].name}.`, "event");
  }

  const discardable = target.inventory.find((entry) => entry.kind === "item");
  if (!discardable) return state;

  return {
    ...state,
    turnStage: "discard",
    pendingDiscard: {
      playerId: targetPlayerId,
      reason: "forced-item",
      itemId,
      resumeStage: state.turnStage,
    },
  };
}

function sendPlayerToHell(state: GameState, playerId: PlayerId): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return state;
  let nextState = updatePlayer(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    position: HELL_NODE_ID,
  }));
  nextState = addLog(nextState, `${player.name} est envoyé en Enfer.`, "bad");
  return nextState;
}

function getItemEntry(player: Player, entryId: string): ItemId | undefined {
  const entry = player.inventory.find((item) => item.id === entryId);
  return entry?.kind === "item" ? entry.itemId : undefined;
}

function addStartBonus(state: GameState, playerId: PlayerId): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || player.passiveId === "im-cups") return state;
  return applyCurrencyChange(state, playerId, 200);
}

function addRedGreenBonuses(state: GameState, playerId: PlayerId, path: NodeId[]): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || player.passiveId !== "red-light-green-light") return state;

  let nextState = state;
  for (const nodeId of path) {
    const node = BOARD_NODES.find((candidate) => candidate.id === nodeId);
    if (node?.kind === "green") nextState = applyCurrencyChange(nextState, playerId, 100);
    if (node?.kind === "red") nextState = applyCurrencyChange(nextState, playerId, -100);
  }
  return nextState;
}

function triggerMud(state: GameState, playerId: PlayerId, nodeId: NodeId): GameState {
  const trap = state.mudTraps.find((candidate) => candidate.nodeId === nodeId);
  if (!trap) return state;

  let nextState = {
    ...state,
    mudTraps: state.mudTraps.filter((candidate) => candidate.id !== trap.id),
  };
  const player = nextState.players.find((candidate) => candidate.id === playerId);
  if (!player) return nextState;
  nextState = applyCurrencyChange(nextState, playerId, -200);
  nextState = addLog(nextState, `${player.name} tombe dans la Boue et perd 200 pièces.`, "bad");
  if (nextState.redCupNodeId !== nodeId) {
    nextState = itemCopyForPassive(nextState, playerId, "mud");
  }
  return nextState;
}

function addCupCycleEffects(state: GameState, collectorId: PlayerId): GameState {
  let nextState = state;
  const calmDownPlayer = nextState.players.find((player) => player.passiveId === "calm-down");
  if (calmDownPlayer && nextState.redCupNodeId !== null) {
    const collector = nextState.players.find((player) => player.id === collectorId);
    const distance = collector
      ? (getShortestPath(nextState.redCupNodeId, collector.position, true)?.length ?? Infinity)
      : Infinity;
    if (!collector || distance < 1 || distance >= 3) return nextState;

    const retreatPath = getPathsOfLength(collector.position, 3, true).sort((left, right) => {
      const leftDistance = getShortestPath(nextState.redCupNodeId!, left[left.length - 1], true)?.length ?? 0;
      const rightDistance = getShortestPath(nextState.redCupNodeId!, right[right.length - 1], true)?.length ?? 0;
      return rightDistance - leftDistance;
    })[0];

    const retreatNode = retreatPath?.[retreatPath.length - 1];
    if (retreatNode === undefined) return nextState;

    nextState = {
      ...nextState,
      turnStage: "passive-choice",
      pendingCalmDown: {
        passivePlayerId: calmDownPlayer.id,
        collectorId: collector.id,
        retreatNodeId: retreatNode,
        resumeStage: state.turnStage,
      },
    };
    nextState = addLog(nextState, `${calmDownPlayer.name} peut utiliser Calme-toi contre ${collector.name}.`, "event");
  }
  return nextState;
}

function moveBulletBill(state: GameState, round: number): GameState {
  if (!state.bulletBill) return state;

  if (state.bulletBill.status === "waiting") {
    if (state.bulletBill.spawnRound > round) return state;
    const spawnedState = {
      ...state,
      bulletBill: { status: "active" as const, position: START_NODE_ID, spawnRound: round },
    };
    return addLog(spawnedState, "Bullet Bill apparaît au départ.", "event");
  }

  const target = state.players
    .filter((player) => player.position !== HELL_NODE_ID)
    .map((player) => ({
      player,
      path: getShortestPath(state.bulletBill!.position, player.position, true),
    }))
    .filter((entry) => entry.path !== null)
    .sort((left, right) => (left.path?.length ?? Infinity) - (right.path?.length ?? Infinity))[0];

  if (!target?.path || target.path.length === 0) return state;
  const steps = target.path.length <= 2 ? 1 : 2;
  const position = target.path[Math.min(steps, target.path.length) - 1];
  let nextState: GameState = {
    ...state,
    bulletBill: { ...state.bulletBill, position },
  };
  nextState = addLog(nextState, "Bullet Bill avance vers le joueur le plus proche.", "event");

  if (position === target.player.position) {
    nextState = applyCurrencyChange(nextState, target.player.id, -200);
    nextState = updatePlayer(nextState, target.player.id, (player) => ({
      ...player,
      skippedTurns: player.skippedTurns + 1,
    }));
    nextState = addLog(nextState, `Bullet Bill percute ${target.player.name} : −200 pièces et un tour sauté.`, "bad");
    nextState = { ...nextState, bulletBill: null };
  }

  return nextState;
}

function beginNextTurn(state: GameState): GameState {
  if (state.players.length === 0) return state;
  let nextState = state;
  let nextIndex = state.activePlayerIndex;
  let nextRound = state.round;
  let attempts = 0;

  do {
    nextIndex += 1;
    if (nextIndex >= state.players.length) {
      nextIndex = 0;
      nextRound += 1;
      nextState = moveBulletBill(nextState, nextRound);
      if (nextState.bootFirstPurchased && nextRound > state.bootLastPriceRound) {
        nextState = {
          ...nextState,
          bootPrice: Math.min(500, nextState.bootPrice + 50),
          bootLastPriceRound: nextRound,
        };
      }
    }

    const nextPlayer = nextState.players[nextIndex];
    if (nextPlayer.skippedTurns > 0) {
      nextState = updatePlayer(nextState, nextPlayer.id, (player) => ({
        ...player,
        skippedTurns: player.skippedTurns - 1,
      }));
      nextState = addLog(nextState, `${nextPlayer.name} passe son tour.`, "bad");
      attempts += 1;
    } else {
      break;
    }
  } while (attempts < state.players.length * 3);

  const activePlayer = nextState.players[nextIndex];
  const turnStage = activePlayer.position === HELL_NODE_ID ? "hell" : "move";
  nextState = {
    ...nextState,
    activePlayerIndex: nextIndex,
    round: nextRound,
    turnStage,
    turnActionTaken: false,
    moveDistance: 1,
    pendingWheel: null,
    pendingChallenge: null,
    pendingDiscard: null,
    pendingCupRepositionPlayerId: null,
    pendingCupRevealNodeId: null,
    pendingCupRepositionResumeStage: null,
    pendingCupCollectorId: null,
    pendingCalmDown: null,
  };
  return addLog(nextState, `Tour de ${activePlayer.name}.`, "event");
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...EMPTY_GAME_STATE,

  startGame: (playerNames) => {
    const names = playerNames.slice(0, 8).map((name, index) => name.trim() || `Joueur ${index + 1}`);
    if (names.length < 2) return;

    const passives = shuffle(PASSIVE_ORDER).slice(0, names.length);
    const players: Player[] = names.map((name, index) => ({
      id: crypto.randomUUID(),
      name,
      color: PLAYER_COLORS[index],
      position: START_NODE_ID,
      currency: STARTING_CURRENCY,
      inventory: [],
      passiveId: passives[index],
      skippedTurns: 0,
      noThanksUsedCycle: -1,
    }));

    set({
      ...EMPTY_GAME_STATE,
      phase: "playing",
      turnStage: "move",
      players,
      activePlayerIndex: 0,
      redCupNodeId: INITIAL_RED_CUP_NODE_ID,
      round: 1,
      log: [makeLog("La partie commence. La première Red Cup est en case 8.", "event")],
    });
  },

  resetGame: () => set({ ...EMPTY_GAME_STATE }),

  movePlayer: (destination, ignoreArrows = false) => {
    const state = get();
    const player = state.players[state.activePlayerIndex];
    if (state.phase !== "playing" || state.turnStage !== "move" || !player) return;

    // Délinquant only pays when the chosen destination really requires going against an arrow.
    const regularPath = findLegalPath(player, destination, state.moveDistance, false);
    const rebelPath =
      ignoreArrows && canUseDelinquent(player) ? findLegalPath(player, destination, state.moveDistance, true) : null;
    const path = regularPath ?? rebelPath;
    if (!path) return;

    let nextState: GameState = state;
    if (!regularPath && rebelPath) {
      nextState = applyCurrencyChange(nextState, player.id, -DELINQUENT_COST);
      nextState = addLog(nextState, `${player.name} ignore les flèches grâce à Délinquant.`, "event");
    }

    nextState = updatePlayer(nextState, player.id, (currentPlayer) => ({
      ...currentPlayer,
      position: destination,
    }));
    nextState = addLog(nextState, `${player.name} se déplace en case ${destination}.`);
    nextState = addRedGreenBonuses(nextState, player.id, path);

    if (path.includes(START_NODE_ID) && player.passiveId !== "im-cups") {
      nextState = addLog(nextState, `${player.name} passe par le départ.`, "good");
      nextState = addStartBonus(nextState, player.id);
    }

    nextState = {
      ...nextState,
      moveDistance: 1,
      turnActionTaken: true,
      pendingCupRepositionPlayerId: null,
      lastMovement: {
        seq: (state.lastMovement?.seq ?? 0) + 1,
        playerId: player.id,
        from: player.position,
        path,
      },
    };

    const finalPlayer = nextState.players.find((candidate) => candidate.id === player.id);
    nextState = {
      ...nextState,
      turnStage:
        nextState.phase === "finished"
          ? "finished"
          : BOARD_NODES.find((node) => node.id === finalPlayer?.position)?.kind === "shop"
            ? "shop"
            : "turn-end",
    };
    nextState = triggerMud(nextState, player.id, destination);

    if (nextState.redCupNodeId === destination) {
      nextState = collectCupOrRequestDiscard(nextState, player.id, destination);
    }

    if (
      nextState.turnStage === "discard" ||
      nextState.turnStage === "reposition" ||
      nextState.turnStage === "passive-choice"
    ) {
      set(nextState);
      return;
    }

    nextState = maybeStartHellDuel(nextState, nextState.turnStage);
    set(nextState);
  },

  prepareBoot: (entryId) => {
    const state = get();
    const player = state.players[state.activePlayerIndex];
    if (!player || state.turnStage !== "move" || state.moveDistance !== 1) return;
    const itemId = getItemEntry(player, entryId);
    if (itemId !== "boot") return;

    let nextState = updatePlayer(state, player.id, (currentPlayer) => removeInventoryEntry(currentPlayer, entryId));
    nextState = {
      ...nextState,
      moveDistance: 2,
      turnActionTaken: false,
    };
    nextState = addLog(nextState, `${player.name} prépare la Botte pour un déplacement de deux cases.`, "event");
    set(nextState);
  },

  buyItem: (itemId) => {
    const state = get();
    const player = state.players[state.activePlayerIndex];
    if (
      !player ||
      state.turnStage !== "shop" ||
      BOARD_NODES.find((node) => node.id === player.position)?.kind !== "shop"
    ) {
      return;
    }

    const price = getItemPrice(itemId, state.bootPrice);
    if (player.currency < price) return;

    if (itemId === "bullet-bill") {
      if (state.bulletBill) return;
      let nextState = applyCurrencyChange(state, player.id, -price);
      nextState = {
        ...nextState,
        bulletBill: {
          status: "waiting",
          position: START_NODE_ID,
          spawnRound: state.round + 1,
        },
      };
      nextState = addLog(nextState, `${player.name} achète Bullet Bill pour ${price} pièces.`, "event");
      set(nextState);
      return;
    }

    if (!canAddItem(player, itemId)) return;

    let nextState = applyCurrencyChange(state, player.id, -price);
    nextState = updatePlayer(nextState, player.id, (currentPlayer) => appendItem(currentPlayer, itemId));
    if (itemId === "boot" && !state.bootFirstPurchased) {
      nextState = {
        ...nextState,
        bootFirstPurchased: true,
        bootLastPriceRound: state.round,
      };
    }
    nextState = addLog(nextState, `${player.name} achète ${ITEM_CATALOG[itemId].name} pour ${price} pièces.`, "good");
    set(nextState);
  },

  useItem: (entryId, targetPlayerId) => {
    const state = get();
    const player = state.players[state.activePlayerIndex];
    if (!player || state.phase !== "playing") return;

    const inHell = player.position === HELL_NODE_ID;
    if (inHell && state.turnStage !== "hell") return;
    if (!inHell && state.turnStage !== "move") return;

    const itemId = getItemEntry(player, entryId);
    if (!itemId || itemId === "eraser" || itemId === "helmet" || itemId === "bullet-bill") return;
    if (itemId === "boot") return;
    if (itemId === "water-bottle" && !inHell) return;

    const target = targetPlayerId ? state.players.find((candidate) => candidate.id === targetPlayerId) : undefined;
    const itemDefinition = ITEM_CATALOG[itemId];
    if (itemDefinition.target === "player") {
      if (!target) return;
      if (target.id === player.id && !itemDefinition.canTargetSelf) return;
    }

    let nextState = updatePlayer(state, player.id, (currentPlayer) => removeInventoryEntry(currentPlayer, entryId));
    nextState = { ...nextState, turnActionTaken: true };

    switch (itemId) {
      case "ndoye":
        nextState = addLog(nextState, `${player.name} active Ndoye sur ${target?.name}.`, "event");
        {
          const result = chooseWheelResult("misfortune", Math.random());
          nextState = {
            ...nextState,
            pendingWheel: {
              id: crypto.randomUUID(),
              wheelId: "misfortune",
              playerId: target!.id,
              result,
              resumeStage: "turn-end",
              sourceItemId: "ndoye",
            },
            turnStage: "wheel-result",
          };
          nextState = addLog(nextState, `La roue du malheur indique : ${result.label}.`, "event");
        }
        break;
      case "hollow-purple":
        nextState = sendPlayerToHell(nextState, target!.id);
        nextState = { ...nextState, turnStage: "turn-end" };
        nextState = itemCopyForPassive(nextState, target!.id, itemId);
        if (!nextState.pendingDiscard) {
          nextState = maybeStartHellDuel(nextState, "turn-end");
          if (!nextState.pendingDuel) nextState = { ...nextState, turnStage: "turn-end" };
        }
        break;
      case "rope": {
        if (target!.passiveId === "built-like-a-tank") {
          const path = getShortestPath(target!.position, player.position, true) ?? [];
          const steps = Math.ceil(path.length / 2);
          nextState = updatePlayer(nextState, target!.id, (currentPlayer) => ({
            ...currentPlayer,
            position: steps > 0 ? path[steps - 1] : currentPlayer.position,
          }));
          nextState = addLog(nextState, `${target!.name} résiste à la Corde grâce à Baraqué.`, "event");
        } else {
          nextState = updatePlayer(nextState, target!.id, (currentPlayer) => ({
            ...currentPlayer,
            position: player.position,
          }));
          nextState = addLog(nextState, `${target!.name} est tiré sur la case de ${player.name}.`, "event");
        }
        nextState = { ...nextState, turnStage: "turn-end" };
        nextState = itemCopyForPassive(nextState, target!.id, itemId);
        nextState = {
          ...nextState,
          turnStage: nextState.pendingDiscard ? "discard" : "turn-end",
        };
        break;
      }
      case "mud":
        nextState = {
          ...nextState,
          mudTraps: [...nextState.mudTraps, { id: crypto.randomUUID(), nodeId: player.position, ownerId: player.id }],
          turnStage: "turn-end",
        };
        nextState = addLog(nextState, `${player.name} pose de la Boue en case ${player.position}.`, "event");
        break;
      case "middle-finger":
        nextState = updatePlayer(nextState, target!.id, (currentPlayer) => ({
          ...currentPlayer,
          skippedTurns: currentPlayer.skippedTurns + 1,
        }));
        nextState = { ...nextState, turnStage: "turn-end" };
        nextState = itemCopyForPassive(nextState, target!.id, itemId);
        nextState = addLog(nextState, `${target!.name} devra passer son prochain tour.`, "bad");
        nextState = {
          ...nextState,
          turnStage: nextState.pendingDiscard ? "discard" : "turn-end",
        };
        break;
      case "monopoly-man":
        if (target!.passiveId === "built-like-a-tank") {
          nextState = addLog(nextState, `Baraqué annule l’effet du Monopoly Man sur ${target!.name}.`, "event");
        } else {
          nextState = {
            ...nextState,
            players: nextState.players.map((candidate) => {
              if (candidate.id === player.id) return { ...candidate, position: target!.position };
              if (candidate.id === target!.id) return { ...candidate, position: player.position };
              return candidate;
            }),
          };
          nextState = addLog(nextState, `${player.name} échange sa place avec ${target!.name}.`, "event");
          nextState = { ...nextState, turnStage: "turn-end" };
          nextState = itemCopyForPassive(nextState, target!.id, itemId);
        }
        nextState = {
          ...nextState,
          turnStage: nextState.pendingDiscard ? "discard" : "turn-end",
        };
        break;
      case "water-bottle": {
        const destination = randomNormalNode();
        nextState = updatePlayer(nextState, player.id, (currentPlayer) => ({
          ...currentPlayer,
          position: destination,
        }));
        nextState = addLog(nextState, `${player.name} sort de l’Enfer et atterrit en case ${destination}.`, "good");
        nextState = { ...nextState, turnStage: "turn-end" };
        if (nextState.redCupNodeId === destination) {
          nextState = collectCupOrRequestDiscard(nextState, player.id, destination);
        }
        break;
      }
      case "draven":
        nextState = {
          ...nextState,
          turnStage: "turn-end",
          players: nextState.players.map((candidate) => ({
            ...candidate,
            position: HELL_NODE_ID,
          })),
        };
        nextState = addLog(nextState, "Draven envoie toute la table en Enfer.", "bad");
        {
          const noteHolder = nextState.players.find((candidate) => candidate.passiveId === "i-take-notes");
          if (noteHolder) nextState = itemCopyForPassive(nextState, noteHolder.id, itemId);
        }
        if (!nextState.pendingDiscard) nextState = maybeStartHellDuel(nextState, "turn-end");
        break;
      default:
        break;
    }

    set(nextState);
  },

  endTurn: () => {
    const state = get();
    if (state.phase !== "playing") return;
    const activePlayer = state.players[state.activePlayerIndex];
    const noLegalMove =
      state.turnStage === "move" &&
      activePlayer !== undefined &&
      getUniqueLegalDestinations(activePlayer, state.moveDistance, activePlayer.passiveId === "delinquent").length ===
        0;
    if (!["shop", "turn-end"].includes(state.turnStage) && !noLegalMove) return;
    set(beginNextTurn({ ...state, turnStage: "turn-end" }));
  },

  spinHellWheel: () => {
    const state = get();
    const player = state.players[state.activePlayerIndex];
    if (!player || state.turnStage !== "hell" || player.position !== HELL_NODE_ID) return;
    get().spinWheel("hell", player.id, "turn-end");
  },

  spinWheel: (wheelId, playerId, resumeStage, sourceItemId) => {
    const state = get();
    const result = chooseWheelResult(wheelId, Math.random());
    const nextState: GameState = {
      ...state,
      pendingWheel: {
        id: crypto.randomUUID(),
        wheelId,
        playerId,
        result,
        resumeStage,
        sourceItemId,
      } satisfies PendingWheel,
      turnStage: "wheel-result",
    };
    set(addLog(nextState, `La roue ${WHEEL_LOG_NAMES[wheelId]} indique : ${result.label}.`, "event"));
  },

  resolveWheel: () => {
    const state = get();
    const pending = state.pendingWheel;
    if (!pending) return;

    const player = state.players.find((candidate) => candidate.id === pending.playerId);
    if (!player) return;

    if (pending.result.id === "spin-fortune") {
      get().spinWheel("fortune", pending.playerId, pending.resumeStage, pending.sourceItemId);
      return;
    }

    if (pending.result.id === "challenge") {
      let nextState: GameState = {
        ...state,
        pendingWheel: null,
        pendingChallenge: { playerId: pending.playerId, resumeStage: pending.resumeStage },
        turnStage: "target",
      };
      if (pending.sourceItemId) {
        nextState = itemCopyForPassive(nextState, pending.playerId, pending.sourceItemId);
      }
      set(nextState);
      return;
    }

    let nextState: GameState = {
      ...state,
      pendingWheel: null,
      turnStage: pending.resumeStage,
    };
    const amount = pending.result.amount ?? 0;

    switch (pending.result.id) {
      case "lose-100":
      case "lose-200":
      case "lose-400":
        nextState = applyCurrencyChange(nextState, player.id, -amount);
        break;
      case "gain-100":
      case "gain-200":
      case "gain-300":
      case "gain-400":
      case "gain-500":
        nextState = applyCurrencyChange(nextState, player.id, amount);
        break;
      case "lose-item": {
        const removable = player.inventory.filter((entry) => entry.kind === "item");
        const entry = randomChoice(removable);
        if (entry) {
          nextState = updatePlayer(nextState, player.id, (currentPlayer) =>
            removeInventoryEntry(currentPlayer, entry.id),
          );
          nextState = addLog(nextState, `${player.name} perd un objet.`, "bad");
        } else {
          nextState = applyCurrencyChange(nextState, player.id, -100);
        }
        break;
      }
      case "skip-turn":
      case "hell-skip":
        nextState = updatePlayer(nextState, player.id, (currentPlayer) => ({
          ...currentPlayer,
          skippedTurns: currentPlayer.skippedTurns + 1,
        }));
        nextState = addLog(nextState, `${player.name} devra passer son prochain tour.`, "bad");
        break;
      case "go-to-hell":
        nextState = sendPlayerToHell(nextState, player.id);
        break;
      case "escape":
        if (pending.wheelId === "fortune" && player.position !== HELL_NODE_ID) {
          nextState = applyCurrencyChange(nextState, player.id, amount);
        } else {
          nextState = updatePlayer(nextState, player.id, (currentPlayer) => ({
            ...currentPlayer,
            position: START_NODE_ID,
          }));
          nextState = addLog(nextState, `${player.name} sort de l’Enfer et revient en case 0.`, "good");
          if (player.passiveId !== "im-cups") {
            nextState = applyCurrencyChange(nextState, player.id, 200);
          }
        }
        break;
      case "free-item": {
        const options = ITEM_ORDER.filter(
          (itemId) => itemId !== "bullet-bill" && ITEM_CATALOG[itemId].price <= 300 && canAddItem(player, itemId),
        );
        const freeItem = randomChoice(options);
        if (freeItem) {
          nextState = updatePlayer(nextState, player.id, (currentPlayer) => appendItem(currentPlayer, freeItem));
          nextState = addLog(nextState, `${player.name} reçoit ${ITEM_CATALOG[freeItem].name} gratuitement.`, "good");
        } else {
          nextState = applyCurrencyChange(nextState, player.id, 200);
        }
        break;
      }
      case "nothing":
        nextState = addLog(nextState, "La roue ne produit aucun effet.");
        break;
    }

    if (pending.sourceItemId) {
      nextState = itemCopyForPassive(nextState, pending.playerId, pending.sourceItemId);
    }
    if (nextState.pendingDiscard || nextState.pendingCupRepositionPlayerId || nextState.pendingCalmDown) {
      set(nextState);
      return;
    }
    nextState = maybeStartHellDuel(nextState, pending.resumeStage);
    set(nextState);
  },

  cancelWheel: () => {
    const state = get();
    const pending = state.pendingWheel;
    if (!pending) return;
    const player = state.players.find((candidate) => candidate.id === pending.playerId);
    const eraser = player?.inventory.find((entry) => entry.kind === "item" && entry.itemId === "eraser");
    if (!player || !eraser) return;

    let nextState = updatePlayer(state, player.id, (currentPlayer) => removeInventoryEntry(currentPlayer, eraser.id));
    nextState = {
      ...nextState,
      pendingWheel: null,
      turnStage: pending.resumeStage,
    };
    nextState = addLog(nextState, `${player.name} utilise la Gomme et annule l’effet.`, "good");
    set(maybeStartHellDuel(nextState, pending.resumeStage));
  },

  challengePlayer: (targetPlayerId) => {
    const state = get();
    const pending = state.pendingChallenge;
    if (!pending || pending.playerId === targetPlayerId) return;
    const target = state.players.find((player) => player.id === targetPlayerId);
    if (!target) return;

    let nextState = updatePlayer(state, targetPlayerId, (player) => ({
      ...player,
      position: HELL_NODE_ID,
    }));
    nextState = { ...nextState, pendingChallenge: null };
    nextState = addLog(nextState, `${target.name} est appelé en Enfer pour un duel.`, "event");
    nextState = startDuel(nextState, pending.playerId, targetPlayerId, pending.resumeStage);
    set(nextState);
  },

  resolveDuel: (winnerId) => {
    const state = get();
    const duel = state.pendingDuel;
    if (!duel || ![duel.playerOneId, duel.playerTwoId].includes(winnerId)) return;
    if (duel.mode === "coin-flip" && duel.coinWinnerId !== winnerId) return;
    const loserId = winnerId === duel.playerOneId ? duel.playerTwoId : duel.playerOneId;
    const winner = state.players.find((player) => player.id === winnerId);
    const loser = state.players.find((player) => player.id === loserId);
    if (!winner || !loser) return;

    let nextState = updatePlayer(state, winnerId, (player) => ({
      ...player,
      position: START_NODE_ID,
    }));
    nextState = {
      ...nextState,
      pendingDuel: null,
      turnStage: duel.resumeStage,
    };
    nextState = addLog(
      nextState,
      `${winner.name} gagne le duel et retourne en case 0. ${loser.name} reste en Enfer.`,
      "good",
    );
    const hellPlayers = nextState.players.filter((player) => player.position === HELL_NODE_ID);
    if (hellPlayers.length >= 2) {
      nextState = startDuel(nextState, hellPlayers[0].id, hellPlayers[1].id, duel.resumeStage);
    }
    set(nextState);
  },

  discardInventoryEntry: (entryId) => {
    const state = get();
    const pending = state.pendingDiscard;
    if (!pending) return;
    const player = state.players.find((candidate) => candidate.id === pending.playerId);
    const entry = player?.inventory.find((candidate) => candidate.id === entryId);
    if (!player || !entry || entry.kind === "red-cup") return;

    let nextState = updatePlayer(state, player.id, (currentPlayer) => removeInventoryEntry(currentPlayer, entryId));
    nextState = {
      ...nextState,
      pendingDiscard: null,
      turnStage: pending.resumeStage,
    };
    nextState = addLog(nextState, `${player.name} abandonne ${ITEM_CATALOG[entry.itemId].name}.`, "bad");

    if (pending.reason === "red-cup" && pending.cupNodeId !== undefined) {
      nextState = finishCupCollection(nextState, player.id, pending.cupNodeId);
    } else if (pending.reason === "forced-item" && pending.itemId) {
      nextState = updatePlayer(nextState, player.id, (currentPlayer) => appendItem(currentPlayer, pending.itemId!));
      nextState = { ...nextState, turnStage: pending.resumeStage };
      nextState = addLog(
        nextState,
        `${player.name} reçoit ${ITEM_CATALOG[pending.itemId].name} grâce à Je note.`,
        "event",
      );
    }
    if (nextState.phase === "playing") {
      nextState = maybeStartHellDuel(nextState, pending.resumeStage);
    }
    set(nextState);
  },

  repositionBeforeCup: (destination) => {
    const state = get();
    const playerId = state.pendingCupRepositionPlayerId;
    const collectorId = state.pendingCupCollectorId;
    const resumeStage = state.pendingCupRepositionResumeStage ?? "turn-end";
    if (!playerId || state.pendingCupRevealNodeId === null || !NORMAL_NODE_IDS.includes(destination)) {
      return;
    }

    const player = state.players.find((candidate) => candidate.id === playerId);
    let nextState = updatePlayer(state, playerId, (currentPlayer) => ({
      ...currentPlayer,
      position: destination,
    }));
    nextState = {
      ...nextState,
      redCupNodeId: state.pendingCupRevealNodeId,
      pendingCupRepositionPlayerId: null,
      pendingCupRevealNodeId: null,
      pendingCupRepositionResumeStage: null,
      pendingCupCollectorId: null,
      turnStage: resumeStage,
    };
    if (player) {
      nextState = addLog(nextState, `${player.name} se repositionne avant l’apparition de la Cup.`, "event");
    }
    if (collectorId) nextState = addCupCycleEffects(nextState, collectorId);
    set(nextState);
  },

  resolveCalmDown: (useEffect) => {
    const state = get();
    const pending = state.pendingCalmDown;
    if (!pending) return;
    const passivePlayer = state.players.find((player) => player.id === pending.passivePlayerId);
    const collector = state.players.find((player) => player.id === pending.collectorId);
    if (!passivePlayer || !collector) return;

    let nextState: GameState = {
      ...state,
      pendingCalmDown: null,
      turnStage: pending.resumeStage,
    };
    if (useEffect) {
      nextState = updatePlayer(nextState, collector.id, (player) => ({
        ...player,
        position: pending.retreatNodeId,
      }));
      nextState = addLog(
        nextState,
        `${passivePlayer.name} active Calme-toi : ${collector.name} recule de trois cases.`,
        "event",
      );
    } else {
      nextState = addLog(nextState, `${passivePlayer.name} laisse passer Calme-toi.`);
    }

    const activePlayer = nextState.players[nextState.activePlayerIndex];
    if (
      pending.resumeStage === "shop" &&
      activePlayer &&
      BOARD_NODES.find((node) => node.id === activePlayer.position)?.kind !== "shop"
    ) {
      nextState = { ...nextState, turnStage: "turn-end" };
    }
    set(nextState);
  },

  resolvePassiveVote: (playerId, cancelAction) => {
    const state = get();
    const voter = state.players.find((player) => player.id === playerId);
    const activePlayer = getActivePlayer(state);
    if (
      !cancelAction ||
      !voter ||
      voter.passiveId !== "no-thanks" ||
      !activePlayer ||
      activePlayer.id === voter.id ||
      voter.noThanksUsedCycle === state.redCupCycle ||
      state.turnStage !== "move"
    ) {
      return;
    }

    let nextState = updatePlayer(state, voter.id, (player) => ({
      ...player,
      noThanksUsedCycle: state.redCupCycle,
    }));
    nextState = {
      ...nextState,
      turnStage: "turn-end",
      moveDistance: 1,
      turnActionTaken: true,
    };
    nextState = addLog(
      nextState,
      `${voter.name} utilise Non merci : l’action de ${activePlayer.name} est annulée.`,
      "event",
    );
    set(nextState);
  },
}));

/** Délinquant pays 200 coins per ignored arrow, so it is unusable without the funds. */
export function canUseDelinquent(player: Player): boolean {
  return player.passiveId === "delinquent" && player.currency >= DELINQUENT_COST;
}

export function getActivePlayer(state: GameState): Player | undefined {
  return state.players[state.activePlayerIndex];
}

export function getInventoryName(entry: InventoryEntry): string {
  return entry.kind === "red-cup" ? "Red Cup" : ITEM_CATALOG[entry.itemId].name;
}

export function getAvailablePurchaseIds(state: GameState): ItemId[] {
  const player = state.players[state.activePlayerIndex];
  if (!player) return [];
  return ITEM_ORDER.filter((itemId) => {
    if (itemId === "bullet-bill") {
      return !state.bulletBill && player.currency >= ITEM_CATALOG[itemId].price;
    }
    return player.currency >= getItemPrice(itemId, state.bootPrice) && canAddItem(player, itemId);
  });
}

export function getActivePlayerCapacity(player: Player): number {
  return Math.max(BASE_INVENTORY_CAPACITY, getInventoryCapacity(player));
}

export function getCurrentDuelChoices(): RpsChoice[] {
  return ["rock", "paper", "scissors"];
}
