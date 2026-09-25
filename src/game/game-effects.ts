import { NORMAL_NODE_IDS, getPathsOfLength, getShortestPath } from "./board";
import { ITEM_CATALOG, chooseWheelResult } from "./catalog";
import {
  canAddItem,
  countItemCopies,
  countRedCups,
  getInventoryCapacity,
  getNodeKind,
  getTileWheel,
  isShopNode,
} from "./rules";
import {
  addLog,
  appendItem,
  applyCurrencyChange,
  findPlayer,
  getActivePlayer,
  randomChoice,
  shuffle,
  placeInHell,
  updatePlayer,
} from "./state-utils";
import type { DuelMode, GameState, ItemId, NodeId, PlayerId, TurnStage, WheelId, WheelOrigin } from "./types";
import {
  HELL_EXIT_TOLL,
  HELL_NODE_ID,
  HELL_TURN_LIMIT,
  MUD_PENALTY,
  RED_CUP_GOAL,
  START_BONUS,
  START_NODE_ID,
} from "./types";

/**
 * Game effects shared by several actions: duels, Red Cup cycles, passives,
 * wheels and turn changes. Every function is pure: state in, state out.
 */

const WHEEL_LOG_NAMES: Record<WheelId, string> = {
  hell: "de l’Enfer",
  fortune: "du bonheur",
  misfortune: "du malheur",
};

const DUEL_MODE_LOG_NAMES: Record<DuelMode, string> = {
  "coin-flip": "pile ou face",
  "rock-paper-scissors": "pierre-feuille-ciseaux",
  "player-vote": "vote",
};

/** Draws the wheel result now; the UI only animates towards it. */
export function startWheel(
  state: GameState,
  wheelId: WheelId,
  playerId: PlayerId,
  resumeStage: TurnStage,
  options: { sourceItemId?: ItemId; origin?: WheelOrigin } = {},
): GameState {
  const result = chooseWheelResult(wheelId, Math.random());
  const nextState: GameState = {
    ...state,
    pendingWheel: { id: crypto.randomUUID(), wheelId, playerId, result, resumeStage, ...options },
    turnStage: "wheel-result",
  };
  return addLog(nextState, `La roue ${WHEEL_LOG_NAMES[wheelId]} indique : ${result.label}.`, "event");
}

/**
 * A stage decided before a side effect may no longer apply afterwards, e.g.
 * the shop after Calme-toi pushed the player off the blue tile.
 */
export function normalizeResumeStage(state: GameState, stage: TurnStage): TurnStage {
  const active = getActivePlayer(state);
  if (!active || state.phase !== "playing") return stage;
  if (stage === "shop" && !isShopNode(active.position)) return "turn-end";
  if (stage === "tile-wheel") return state.tileWheelResumeStage;
  return stage;
}

/**
 * Whoever ends up on a green or red tile spins its wheel, whether they walked
 * there or were pulled, swapped or teleported. One wheel per player: only the
 * tile they finally stand on counts.
 */
export function queueTileWheel(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!player || state.phase !== "playing") return state;
  const others = state.pendingTileWheels.filter((entry) => entry.playerId !== playerId);
  if (getTileWheel(player.position) === null) {
    return others.length === state.pendingTileWheels.length ? state : { ...state, pendingTileWheels: others };
  }
  return { ...state, pendingTileWheels: [...others, { playerId, nodeId: player.position }] };
}

/** Queues a tile wheel for every player whose tile changed between two states. */
export function queueWheelsForMovedPlayers(before: GameState, after: GameState): GameState {
  let nextState = after;
  for (const player of after.players) {
    const previous = findPlayer(before, player.id);
    if (previous && previous.position !== player.position) nextState = queueTileWheel(nextState, player.id);
  }
  return nextState;
}

/** Drops queued wheels whose player has left the tile since, e.g. after a duel or Calme-toi. */
export function validTileWheels(state: GameState): GameState {
  const valid = state.pendingTileWheels.filter(
    (entry) => findPlayer(state, entry.playerId)?.position === entry.nodeId && getTileWheel(entry.nodeId) !== null,
  );
  return valid.length === state.pendingTileWheels.length ? state : { ...state, pendingTileWheels: valid };
}

export function startDuel(
  state: GameState,
  playerOneId: PlayerId,
  playerTwoId: PlayerId,
  resumeStage: TurnStage,
): GameState {
  const playerOne = findPlayer(state, playerOneId);
  const playerTwo = findPlayer(state, playerTwoId);
  if (!playerOne || !playerTwo || playerOneId === playerTwoId) return state;

  const otherPlayers = state.players.filter((player) => player.id !== playerOneId && player.id !== playerTwoId);
  const availableModes: DuelMode[] = ["coin-flip", "rock-paper-scissors"];
  if (otherPlayers.length > 0) availableModes.push("player-vote");
  const mode = randomChoice(availableModes) ?? "coin-flip";
  const coinWinnerId = mode === "coin-flip" ? randomChoice([playerOneId, playerTwoId]) : undefined;

  const nextState: GameState = {
    ...state,
    pendingDuel: { playerOneId, playerTwoId, mode, coinWinnerId, resumeStage },
    turnStage: "duel",
    duelResumeStage: resumeStage,
  };
  return addLog(
    nextState,
    `${playerOne.name} et ${playerTwo.name} s’affrontent en ${DUEL_MODE_LOG_NAMES[mode]}.`,
    "event",
  );
}

/**
 * Resolves what the table still owes before play goes on: first a duel if two
 * players are in Hell (only one may suffer there), then the queued tile wheels.
 */
export function settleBoard(state: GameState, resumeStage: TurnStage): GameState {
  if (
    state.phase !== "playing" ||
    state.pendingDuel ||
    state.pendingDiscard ||
    state.pendingCalmDown ||
    state.pendingChallenge ||
    state.pendingCupRepositionPlayerId
  ) {
    return state;
  }
  const stage = normalizeResumeStage(state, resumeStage);
  const hellPlayers = state.players.filter((player) => player.position === HELL_NODE_ID);
  if (hellPlayers.length >= 2) return startDuel(state, hellPlayers[0].id, hellPlayers[1].id, stage);

  const withWheels = validTileWheels(state);
  if (withWheels.pendingTileWheels.length > 0) {
    return { ...withWheels, turnStage: "tile-wheel", tileWheelResumeStage: stage };
  }
  return { ...withWheels, turnStage: stage };
}

export function sendPlayerToHell(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!player) return state;
  const nextState = updatePlayer(state, playerId, placeInHell);
  return addLog(nextState, `${player.name} est envoyé en Enfer.`, "bad");
}

export function randomNormalNode(excludeNodeId?: NodeId): NodeId {
  const nodes = NORMAL_NODE_IDS.filter((nodeId) => nodeId !== HELL_NODE_ID && nodeId !== excludeNodeId);
  return randomChoice(nodes) ?? START_NODE_ID;
}

function createCupNode(previousNodeId: NodeId): NodeId {
  const candidates = NORMAL_NODE_IDS.filter((nodeId) => nodeId !== START_NODE_ID && nodeId !== previousNodeId);
  return randomChoice(candidates) ?? 1;
}

function applyTrollEffects(state: GameState): GameState {
  let nextState = state;
  for (const troll of state.players.filter((player) => player.passiveId === "troll")) {
    const targets = shuffle(state.players.filter((player) => player.id !== troll.id)).slice(0, 2);
    for (const target of targets) {
      nextState = applyCurrencyChange(nextState, target.id, -100);
      nextState = applyCurrencyChange(nextState, troll.id, 100);
    }
  }
  return nextState;
}

/** Calme-toi: the holder may push back a collector who stands close to the new Cup. */
export function addCupCycleEffects(state: GameState, collectorId: PlayerId): GameState {
  const calmDownPlayer = state.players.find((player) => player.passiveId === "calm-down");
  const cupNodeId = state.redCupNodeId;
  const collector = findPlayer(state, collectorId);
  if (!calmDownPlayer || cupNodeId === null || !collector || collector.position === HELL_NODE_ID) return state;

  const distance = getShortestPath(cupNodeId, collector.position, true)?.length ?? Infinity;
  if (distance < 1 || distance >= 3) return state;

  const distanceToCup = (path: NodeId[]) => getShortestPath(cupNodeId, path[path.length - 1], true)?.length ?? 0;
  const retreatPath = getPathsOfLength(collector.position, 3, true).sort(
    (left, right) => distanceToCup(right) - distanceToCup(left),
  )[0];
  const retreatNode = retreatPath?.[retreatPath.length - 1];
  if (retreatNode === undefined) return state;

  const nextState: GameState = {
    ...state,
    turnStage: "passive-choice",
    pendingCalmDown: {
      passivePlayerId: calmDownPlayer.id,
      collectorId: collector.id,
      retreatNodeId: retreatNode,
      resumeStage: state.turnStage,
    },
  };
  return addLog(nextState, `${calmDownPlayer.name} peut utiliser Calme-toi contre ${collector.name}.`, "event");
}

export function finishCupCollection(state: GameState, playerId: PlayerId, cupNodeId: NodeId): GameState {
  const player = findPlayer(state, playerId);
  if (!player) return state;

  let nextState = updatePlayer(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    inventory: [...currentPlayer.inventory, { id: crypto.randomUUID(), kind: "red-cup" }],
  }));
  const totalCups = countRedCups(findPlayer(nextState, playerId) ?? player);
  nextState = addLog(nextState, `${player.name} récupère une Red Cup (${totalCups}/${RED_CUP_GOAL}).`, "good");

  if (totalCups >= RED_CUP_GOAL) {
    nextState = {
      ...nextState,
      phase: "finished",
      turnStage: "finished",
      redCupNodeId: null,
      winnerId: playerId,
      pendingCalmDown: null,
      pendingReaction: null,
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

export function collectCupOrRequestDiscard(state: GameState, playerId: PlayerId, nodeId: NodeId): GameState {
  const player = findPlayer(state, playerId);
  if (!player || state.redCupNodeId !== nodeId) return state;

  if (player.inventory.length >= getInventoryCapacity(player)) {
    return {
      ...state,
      turnStage: "discard",
      pendingDiscard: { playerId, reason: "red-cup", cupNodeId: nodeId, resumeStage: state.turnStage },
    };
  }

  return finishCupCollection(state, playerId, nodeId);
}

/** Je note: suffering an item's effect adds a copy of that item, sacrificing another one if needed. */
export function itemCopyForPassive(state: GameState, targetPlayerId: PlayerId, itemId: ItemId): GameState {
  const target = findPlayer(state, targetPlayerId);
  if (!target || target.passiveId !== "i-take-notes") return state;

  // Draven hits its own user too: copying it would hand Je note an endless supply.
  if (itemId === "draven") return state;

  // The no-stacking rule wins over Je note: never a third copy, never a second Gomme.
  const copies = countItemCopies(target, itemId);
  if (copies >= 2 || (itemId === "eraser" && copies >= 1)) {
    return addLog(state, `${target.name} a déjà assez de ${ITEM_CATALOG[itemId].name} : pas de copie.`);
  }

  if (canAddItem(target, itemId)) {
    const nextState = updatePlayer(state, targetPlayerId, (player) => appendItem(player, itemId));
    return addLog(nextState, `${target.name} récupère aussi ${ITEM_CATALOG[itemId].name}.`, "event");
  }

  const discardable = target.inventory.some((entry) => entry.kind === "item");
  if (!discardable) return state;

  return {
    ...state,
    turnStage: "discard",
    pendingDiscard: { playerId: targetPlayerId, reason: "forced-item", itemId, resumeStage: state.turnStage },
  };
}

export function addStartBonus(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!player || player.passiveId === "im-cups") return state;
  return applyCurrencyChange(addLog(state, `${player.name} passe par le départ.`, "good"), playerId, START_BONUS);
}

/** Red light, Green light: every green or red tile walked on changes the balance. */
export function addRedGreenBonuses(state: GameState, playerId: PlayerId, path: NodeId[]): GameState {
  const player = findPlayer(state, playerId);
  if (!player || player.passiveId !== "red-light-green-light") return state;

  let nextState = state;
  for (const nodeId of path) {
    const kind = getNodeKind(nodeId);
    if (kind === "green") nextState = applyCurrencyChange(nextState, playerId, 100);
    if (kind === "red") nextState = applyCurrencyChange(nextState, playerId, -100);
  }
  return nextState;
}

export function triggerMud(state: GameState, playerId: PlayerId, nodeId: NodeId): GameState {
  const trap = state.mudTraps.find((candidate) => candidate.nodeId === nodeId);
  const player = findPlayer(state, playerId);
  if (!trap || !player) return state;

  let nextState: GameState = { ...state, mudTraps: state.mudTraps.filter((candidate) => candidate.id !== trap.id) };
  nextState = addLog(nextState, `${player.name} tombe dans la Boue.`, "bad");
  nextState = applyCurrencyChange(nextState, playerId, -MUD_PENALTY);
  // A Red Cup on the same tile may already need the only discard slot, so Je note skips the copy there.
  if (nextState.redCupNodeId === nodeId) return nextState;
  return itemCopyForPassive(nextState, playerId, "mud");
}

function moveBulletBill(state: GameState, round: number): GameState {
  const bullet = state.bulletBill;
  if (!bullet) return state;

  if (bullet.status === "waiting") {
    if (bullet.spawnRound > round) return state;
    const spawned: GameState = {
      ...state,
      bulletBill: { status: "active", position: START_NODE_ID, spawnRound: round },
    };
    return addLog(spawned, "Bullet Bill apparaît au départ.", "event");
  }

  const target = state.players
    .filter((player) => player.position !== HELL_NODE_ID)
    .map((player) => ({ player, path: getShortestPath(bullet.position, player.position, true) }))
    .filter((entry): entry is { player: (typeof entry)["player"]; path: NodeId[] } => entry.path !== null)
    .sort((left, right) => left.path.length - right.path.length)[0];

  if (!target) return state;
  // A player standing on Bullet Bill's tile is hit straight away.
  const steps = target.path.length <= 2 ? 1 : 2;
  const position = target.path.length === 0 ? bullet.position : target.path[Math.min(steps, target.path.length) - 1];
  let nextState: GameState = { ...state, bulletBill: { ...bullet, position } };
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

const MAXIMUM_BOOT_PRICE = 500;
const BOOT_PRICE_STEP = 50;

/**
 * Bad luck on the Hell wheel must not bench a player for the whole game: after
 * HELL_TURN_LIMIT of their own turns there, they walk out to the start, get
 * the start bonus like any other way out of Hell, and pay a toll. The bonus is
 * paid first so it cushions the toll before the usual currency rules apply
 * (Casque, reset at −300).
 */
export function releaseFromHellWithToll(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!player || player.position !== HELL_NODE_ID) return state;
  let nextState = updatePlayer(state, playerId, (current) => ({ ...current, position: START_NODE_ID, hellTurns: 0 }));
  nextState = addLog(
    nextState,
    `${player.name} a purgé ${HELL_TURN_LIMIT} tours en Enfer : retour en case 0 contre ${HELL_EXIT_TOLL} pièces.`,
    "event",
  );
  nextState = addStartBonus(nextState, playerId);
  return applyCurrencyChange(nextState, playerId, -HELL_EXIT_TOLL);
}

/** Counts one more of the player's own turns in Hell, releasing them once the limit is served. */
function serveHellTurn(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!player || player.position !== HELL_NODE_ID) return state;
  return updatePlayer(state, playerId, (current) => ({ ...current, hellTurns: current.hellTurns + 1 }));
}

/**
 * Swaps (Monopoly Man) move players in and out of Hell without going through
 * placeInHell, so every countdown of a player standing outside is cleared at
 * each turn change: whoever gets into Hell later starts again from zero.
 */
function resetHellCountdowns(state: GameState): GameState {
  if (!state.players.some((player) => player.position !== HELL_NODE_ID && player.hellTurns !== 0)) return state;
  return {
    ...state,
    players: state.players.map((player) =>
      player.position !== HELL_NODE_ID && player.hellTurns !== 0 ? { ...player, hellTurns: 0 } : player,
    ),
  };
}

function hasServedHellSentence(state: GameState, playerId: PlayerId): boolean {
  const player = findPlayer(state, playerId);
  return player?.position === HELL_NODE_ID && player.hellTurns >= HELL_TURN_LIMIT;
}

/** Passes the turn, consuming skipped turns and running end-of-round effects. */
export function beginNextTurn(state: GameState): GameState {
  if (state.players.length === 0) return state;
  let nextState = state;
  // The outgoing player's last allowed turn in Hell is over: out they go.
  const outgoing = state.players[state.activePlayerIndex];
  if (outgoing && hasServedHellSentence(nextState, outgoing.id)) {
    nextState = releaseFromHellWithToll(nextState, outgoing.id);
  }
  nextState = resetHellCountdowns(nextState);

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
          bootPrice: Math.min(MAXIMUM_BOOT_PRICE, nextState.bootPrice + BOOT_PRICE_STEP),
          bootLastPriceRound: nextRound,
        };
      }
    }

    const nextPlayer = nextState.players[nextIndex];
    if (nextPlayer.skippedTurns <= 0) break;
    nextState = updatePlayer(nextState, nextPlayer.id, (player) => ({
      ...player,
      skippedTurns: player.skippedTurns - 1,
    }));
    nextState = addLog(nextState, `${nextPlayer.name} passe son tour.`, "bad");
    // A turn skipped in Hell still counts towards the sentence.
    nextState = serveHellTurn(nextState, nextPlayer.id);
    if (hasServedHellSentence(nextState, nextPlayer.id)) {
      nextState = releaseFromHellWithToll(nextState, nextPlayer.id);
    }
    attempts += 1;
  } while (attempts < state.players.length * 3);

  nextState = serveHellTurn(nextState, nextState.players[nextIndex].id);
  const activePlayer = nextState.players[nextIndex];
  nextState = {
    ...nextState,
    activePlayerIndex: nextIndex,
    round: nextRound,
    turnStage: activePlayer.position === HELL_NODE_ID ? "hell" : "move",
    turnActionTaken: false,
    moveDistance: 1,
    pendingWheel: null,
    pendingChallenge: null,
    pendingDiscard: null,
    pendingReaction: null,
    pendingTileWheels: [],
    pendingCupRepositionPlayerId: null,
    pendingCupRevealNodeId: null,
    pendingCupRepositionResumeStage: null,
    pendingCupCollectorId: null,
    pendingCalmDown: null,
  };
  return addLog(nextState, `Tour de ${activePlayer.name}.`, "event");
}
