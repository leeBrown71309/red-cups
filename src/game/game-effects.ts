import { hasCard } from "./cards";
import { createEngineId, drawEngineRandom } from "./engine-random";
import { getBoard, getOpenBoard, getShortestPath, hasCarousel, isBlockedRoad, isIce, type Board } from "./board";
import { blowBlizzard, carryOffIce, drawSlide, isBlizzardRound, recordSlide } from "./ice";
import { advanceBulletBill, findBulletReactors } from "./bullet-bill";
import { createDuel, DUEL_MODE_LOG_NAMES, getDuelModes } from "./duel-setup";
import { getEnergyCapacity } from "./energy";
import { advanceGhost, findGhostOpponent, startGhostDuel } from "./ghost";
import { thawSnowFrozen, throwSnowball } from "./snowballs";
import { findGameMaster, openDuelChoice } from "./duel-choice";
import { ITEM_CATALOG, chooseWheelResult, getWheelResultValue } from "./catalog";
import { applyHellTouch, countDevilHellTurn, expireDevilSpells, triggerPortal } from "./devil";
import {
  avoidsHell,
  canCollectRedCup,
  drawsTwiceKeepingBest,
  getHellTurnLimit,
  getMudOwnerReward,
  isImmuneToItems,
  spinsTwice,
} from "./passive-rules";
import { endGame } from "./victory";
import {
  canAddItem,
  canReceiveItem,
  countRedCups,
  getInventoryCapacity,
  getNodeKind,
  getTileWheelFor,
  isKnockedOut,
  opensShop,
} from "./rules";
import {
  addBagLog,
  addLog,
  appendItem,
  applyCurrencyChange,
  findPlayer,
  getActivePlayer,
  randomChoice,
  sendPlayerToHell,
  updatePlayer,
  loseTurns,
} from "./state-utils";
import type {
  GameState,
  ItemId,
  NodeId,
  Barrier,
  Player,
  PlayerId,
  TurnStage,
  WheelId,
  WheelOrigin,
  WheelResult,
  QueuedWheel,
} from "./types";
import {
  BOOT_PRICE_STEP,
  CALM_DOWN_DISTANCE,
  GOBLIN_THEFT,
  GREEDY_CUP_REWARD,
  RED_GREEN_GAIN,
  RED_GREEN_PENALTY,
  GREEDY_STUN_THEFT,
  HELL_EXIT_TOLL,
  HELL_NODE_ID,
  JE_NOTE_COPY_CHANCE,
  MAXIMUM_BOOT_PRICE,
  MUD_PENALTY,
  RED_CUP_GOAL,
  RED_GREEN_TRIGGERS_PER_CUP,
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

/** Draws the wheel result now; the UI only animates towards it. */
export function startWheel(
  state: GameState,
  wheelId: WheelId,
  playerId: PlayerId,
  resumeStage: TurnStage,
  options: { sourceItemId?: ItemId; origin?: WheelOrigin; repeats?: QueuedWheel[]; preset?: WheelResult } = {},
): GameState {
  const spinner = findPlayer(state, playerId);
  // L'Ange-Gardien's wheel of misfortune is not everybody's.
  let result = options.preset ?? chooseWheelResult(wheelId, drawEngineRandom(), spinner);
  // Main verte, Main rouge: a second wheel beside the first, the player keeps one of the two. The better one
  // stands in for the choice of a player who never makes it.
  let choices: [WheelResult, WheelResult] | undefined;
  if (!options.preset && drawsTwiceKeepingBest(spinner, wheelId)) {
    const other = chooseWheelResult(wheelId, drawEngineRandom(), spinner);
    choices = [result, other];
    if (getWheelResultValue(other) > getWheelResultValue(result)) result = other;
  }
  // « Va au Départ » (patch 0.2.0): the player of the wheel of fortune may refuse the start and pick
  // nothing instead; time running out falls on one or the other at 50/50.
  let randomFallback = false;
  if (!choices && wheelId === "fortune" && result.id === "go-to-start") {
    choices = [result, { id: "nothing", label: "Rien ne se passe" }];
    randomFallback = true;
  }
  // A second wheel of the same kind for Touché angélique and Touché funeste, spun along with this one and
  // applied once this one is settled.
  const repeats: QueuedWheel[] = [
    ...(options.repeats ?? []),
    ...(!options.preset && options.origin !== "double" && spinsTwice(spinner, wheelId)
      ? [{ wheelId, result: chooseWheelResult(wheelId, drawEngineRandom(), spinner) }]
      : []),
  ];
  const { repeats: _inherited, preset, ...rest } = options;
  const nextState: GameState = {
    ...state,
    pendingWheel: {
      id: createEngineId(),
      wheelId,
      playerId,
      result,
      resumeStage,
      ...rest,
      ...(preset ? { preSpun: true } : {}),
      ...(choices ? { choices } : {}),
      ...(randomFallback ? { randomFallback: true } : {}),
      ...(repeats.length > 0 ? { repeats } : {}),
    },
    turnStage: "wheel-result",
  };
  const whose = spinner ? ` de ${spinner.name}` : "";
  const text = randomFallback
    ? `La roue ${WHEEL_LOG_NAMES[wheelId]}${whose} indique : ${result.label} — ou rien, au choix du joueur.`
    : choices
      ? `Les deux roues ${WHEEL_LOG_NAMES[wheelId]}${whose} indiquent : ${choices[0].label} et ${choices[1].label}.`
      : `La roue ${WHEEL_LOG_NAMES[wheelId]}${whose} indique : ${result.label}.`;
  return addLog(nextState, text, "event");
}

/**
 * A stage decided before a side effect may no longer apply afterwards, e.g.
 * the shop after Calme-toi pushed the player off the blue tile.
 */
export function normalizeResumeStage(state: GameState, stage: TurnStage): TurnStage {
  const active = getActivePlayer(state);
  if (!active || state.phase !== "playing") return stage;
  if (stage === "shop" && !opensShop(state, active)) return "turn-end";
  if (stage === "tile-wheel") return state.tileWheelResumeStage;
  // A turn that opens with side effects (Banquise's thaw) must still start where the player now is.
  if (stage === "move" && active.position === HELL_NODE_ID) return "hell";
  if (stage === "hell" && active.position !== HELL_NODE_ID) return "move";
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
  if (getTileWheelFor(state, player, player.position) === null) {
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

/**
 * Set down without arriving (New Cup, New Me, Calme-toi): a wheel still owed
 * on the tile left is dropped at once, so coming back there later never
 * revives it.
 */
export function dropTileWheels(state: GameState, playerId: PlayerId): GameState {
  const kept = state.pendingTileWheels.filter((entry) => entry.playerId !== playerId);
  return kept.length === state.pendingTileWheels.length ? state : { ...state, pendingTileWheels: kept };
}

/** Drops queued wheels whose player has left the tile since, e.g. after a duel or Calme-toi. */
export function validTileWheels(state: GameState): GameState {
  const valid = state.pendingTileWheels.filter((entry) => {
    const player = findPlayer(state, entry.playerId);
    return player?.position === entry.nodeId && getTileWheelFor(state, player, entry.nodeId) !== null;
  });
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
  const gameMaster = findGameMaster(state, [playerOneId, playerTwoId]);
  if (gameMaster) {
    const announced = addLog(state, `${playerOne.name} et ${playerTwo.name} s’affrontent en duel.`, "event");
    return openDuelChoice(announced, [playerOneId, playerTwoId], gameMaster, resumeStage, otherPlayers.length > 0);
  }
  const mode = randomChoice(getDuelModes(otherPlayers.length > 0)) ?? "coin-flip";

  const nextState: GameState = {
    ...state,
    pendingDuel: createDuel(playerOneId, playerTwoId, mode, resumeStage),
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
 * Banquise: breaking free of the ice at the start of a turn can end in Hell
 * (a wheel, Calme-toi). The turn then played in Hell is the first one of the
 * sentence, as if the player had started it there.
 */
function countHellTurnStartedThere(state: GameState, resumeStage: TurnStage): GameState {
  const active = getActivePlayer(state);
  if (resumeStage !== "move" || !active || active.position !== HELL_NODE_ID || active.hellTurns > 0) return state;
  const started = updatePlayer(state, active.id, (player) => ({ ...player, hellTurns: 1 }));
  return countDevilHellTurn(started, active.id);
}

/**
 * Resolves what the table still owes before play goes on: first a duel if two
 * players are in Hell (only one may suffer there), then the Luna Park ghost
 * meeting a player on its tile, then the queued tile wheels.
 */
export function settleBoard(current: GameState, resumeStage: TurnStage): GameState {
  const state = countHellTurnStartedThere(current, resumeStage);
  if (
    state.phase !== "playing" ||
    state.pendingDuel ||
    state.pendingDuelChoice ||
    state.pendingDiscard ||
    state.pendingCalmDown ||
    state.pendingChallenge ||
    state.pendingCupRepositionPlayerId ||
    state.pendingAdvance
  ) {
    return state;
  }
  const stage = normalizeResumeStage(state, resumeStage);
  // Le diable's Toucher d'Enfer, then the Black Cup waiting in Hell for whoever arrives there.
  const touched = applyHellTouch(state);
  if (touched !== state) return settleBoard(touched, stage);
  const collected = collectBlackCup(state, stage);
  if (collected) return collected;
  const hellPlayers = state.players.filter((player) => player.position === HELL_NODE_ID);
  if (hellPlayers.length >= 2) return startDuel(state, hellPlayers[0].id, hellPlayers[1].id, stage);
  const ghostOpponent = findGhostOpponent(state);
  if (ghostOpponent) return startGhostDuel(state, ghostOpponent.id, stage);

  const withWheels = validTileWheels(state);
  if (withWheels.pendingTileWheels.length > 0) {
    return { ...withWheels, turnStage: "tile-wheel", tileWheelResumeStage: stage };
  }
  if (stage === "blessing") return continueBlessing(withWheels);
  return { ...withWheels, turnStage: stage };
}

/**
 * Tour de Bénédiction: the next player spins, or, once the whole table has
 * spun, the turn that was ending passes as usual.
 */
function continueBlessing(state: GameState): GameState {
  if (state.blessingQueue.length > 0) return { ...state, turnStage: "blessing" };
  const ended = addLog({ ...state, turnStage: "turn-end" }, "Fin du Tour de Bénédiction : la partie reprend.", "event");
  return beginNextTurn(ended);
}

export { sendPlayerToHell };

/**
 * Le diable's Black Cup is picked up by the first player who arrives in Hell
 * after it was cast, le diable aside; whoever already stood there does not.
 * Null when nobody picks it up now.
 */
function collectBlackCup(state: GameState, stage: TurnStage): GameState | null {
  const blackCup = state.blackCup;
  if (!blackCup || state.redCupNodeId !== HELL_NODE_ID) return null;
  const inHell = state.players.filter((player) => player.position === HELL_NODE_ID);
  const bystanderIds = blackCup.bystanderIds.filter((id) => inHell.some((player) => player.id === id));
  const collector = inHell.find((player) => !bystanderIds.includes(player.id) && canCollectRedCup(player));
  if (!collector) {
    return bystanderIds.length === blackCup.bystanderIds.length
      ? null
      : settleBoard({ ...state, blackCup: { ...blackCup, bystanderIds } }, stage);
  }

  // The Black Cup ends once the next Cup appears, after a discard for room if need be.
  const found = addLog({ ...state, turnStage: stage }, `${collector.name} trouve la Black Cup en Enfer !`, "good");
  const nextState = collectCupOrRequestDiscard(found, collector.id, HELL_NODE_ID);
  const waitsForDecision = ["discard", "reposition", "passive-choice"].includes(nextState.turnStage);
  if (nextState.phase !== "playing" || waitsForDecision) return nextState;
  return settleBoard(nextState, nextState.turnStage);
}

/** Any tile but Hell (and `excludeNodeId`); with `standOnly`, never on ice, where nobody stays. */
export function randomNormalNode(board: Board, excludeNodeId?: NodeId, standOnly = false): NodeId {
  const nodes = board.normalNodeIds.filter(
    (nodeId) => nodeId !== excludeNodeId && !(standOnly && isIce(board, nodeId)),
  );
  return randomChoice(nodes) ?? START_NODE_ID;
}

/** Never on the start, the previous Cup's tile or ice: a Cup there could not be stood on. */
function createCupNode(board: Board, previousNodeId: NodeId): NodeId {
  const candidates = board.normalNodeIds.filter(
    (nodeId) => nodeId !== START_NODE_ID && nodeId !== previousNodeId && !isIce(board, nodeId),
  );
  return randomChoice(candidates) ?? START_NODE_ID;
}

/** Luna Park: every new Red Cup turns the carousel the other way. */
function flipCarousel(state: GameState): GameState {
  if (!hasCarousel(getBoard(state))) return state;
  const flipped: GameState = { ...state, carouselReversed: !state.carouselReversed };
  return addLog(flipped, "Le carrousel change de sens !", "event");
}

function applyGoblinEffects(state: GameState): GameState {
  let nextState = state;
  for (const goblin of state.players.filter((player) => hasCard(player, "goblin"))) {
    // Every other player, 150 coins each (patch 0.1.6).
    for (const target of state.players.filter((player) => player.id !== goblin.id)) {
      nextState = applyCurrencyChange(nextState, target.id, -GOBLIN_THEFT);
      nextState = applyCurrencyChange(nextState, goblin.id, GOBLIN_THEFT);
    }
  }
  return nextState;
}

/** Steps between the Red Cup and a tile, arrows aside; Hell is out of reach. */
function getDistanceToCup(board: Board, cupNodeId: NodeId, nodeId: NodeId): number {
  return getShortestPath(board, cupNodeId, nodeId, true)?.length ?? Infinity;
}

/**
 * Calme-toi: the tiles exactly three steps from the Red Cup, where the holder
 * may set a player down; never on ice, where nobody stays.
 */
export function getCalmDownTiles(state: GameState): NodeId[] {
  const cupNodeId = state.redCupNodeId;
  if (cupNodeId === null) return [];
  const board = getOpenBoard(state);
  return board.normalNodeIds.filter(
    (nodeId) => !isIce(board, nodeId) && getDistanceToCup(board, cupNodeId, nodeId) === CALM_DOWN_DISTANCE,
  );
}

/**
 * Calme-toi: once the new Red Cup is placed, every other player one or two
 * steps from it, and closer to it than the holder, may be set down by the
 * holder three steps from it. The holder decides for each of them in turn.
 */
export function addCupCycleEffects(state: GameState): GameState {
  const holder = state.players.find((player) => hasCard(player, "calm-down"));
  const cupNodeId = state.redCupNodeId;
  if (!holder || cupNodeId === null || getCalmDownTiles(state).length === 0) return state;

  const board = getOpenBoard(state);
  const holderDistance = getDistanceToCup(board, cupNodeId, holder.position);
  const targets = state.players.filter((player) => {
    const distance = getDistanceToCup(board, cupNodeId, player.position);
    return player.id !== holder.id && distance >= 1 && distance <= 2 && distance < holderDistance;
  });
  if (targets.length === 0) return state;

  const nextState: GameState = {
    ...state,
    turnStage: "passive-choice",
    pendingCalmDown: {
      passivePlayerId: holder.id,
      targetIds: targets.map((player) => player.id),
      resumeStage: state.turnStage,
    },
  };
  const names = targets.map((player) => player.name).join(", ");
  return addLog(nextState, `${holder.name} peut utiliser Calme-toi sur ${names}.`, "event");
}

export function finishCupCollection(state: GameState, playerId: PlayerId, cupNodeId: NodeId): GameState {
  const player = findPlayer(state, playerId);
  if (!player) return state;

  let nextState = updatePlayer(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    inventory: [...currentPlayer.inventory, { id: createEngineId(), kind: "red-cup" }],
  }));
  const totalCups = countRedCups(findPlayer(nextState, playerId) ?? player);
  nextState = addLog(nextState, `${player.name} récupère une Red Cup (${totalCups}/${RED_CUP_GOAL}).`, "good");

  if (totalCups >= RED_CUP_GOAL) {
    nextState = { ...endGame(nextState, playerId, "red-cups"), redCupNodeId: null };
    return addLog(nextState, `${player.name} remporte la partie !`, "good");
  }
  return placeNextCup(nextState, cupNodeId, state.turnStage);
}

/** Cupide: a Red Cup pays coins instead of taking a bag slot, and the next one appears as usual. */
function cashInCup(state: GameState, playerId: PlayerId, cupNodeId: NodeId): GameState {
  const player = findPlayer(state, playerId);
  if (!player) return state;
  let nextState = addLog(state, `${player.name} encaisse la Red Cup : +${GREEDY_CUP_REWARD} pièces.`, "good");
  nextState = applyCurrencyChange(nextState, playerId, GREEDY_CUP_REWARD);
  return placeNextCup(nextState, cupNodeId, state.turnStage);
}

/**
 * The Red Cup on `cupNodeId` was taken: the next one is drawn elsewhere, and
 * the passives of a new Cup wake up. `stageBefore` is where play stood.
 */
function placeNextCup(state: GameState, cupNodeId: NodeId, stageBefore: TurnStage): GameState {
  let nextState = state;
  const nextCupNodeId = createCupNode(getBoard(state), cupNodeId);
  const repositioner = nextState.players.find((candidate) => hasCard(candidate, "new-cup-new-me"));
  const resumeStage = stageBefore === "discard" ? "turn-end" : stageBefore;

  nextState = {
    ...nextState,
    previousRedCupNodeId: cupNodeId,
    redCupCycle: nextState.redCupCycle + 1,
    blackCup: null,
    redCupNodeId: repositioner ? null : nextCupNodeId,
    pendingCupRepositionPlayerId: repositioner?.id ?? null,
    pendingCupRevealNodeId: repositioner ? nextCupNodeId : null,
    pendingCupRepositionResumeStage: repositioner ? resumeStage : null,
    turnStage: repositioner ? "reposition" : resumeStage,
    redGreenTriggers: { green: 0, red: 0 },
  };

  nextState = applyGoblinEffects(nextState);
  nextState = addLog(nextState, "Une nouvelle Red Cup apparaît sur le plateau.", "event");
  nextState = flipCarousel(nextState);
  // New Cup, New Me decides before the Cup is shown; Calme-toi then looks around it.
  if (!repositioner) nextState = addCupCycleEffects(nextState);
  return nextState;
}

export function collectCupOrRequestDiscard(state: GameState, playerId: PlayerId, nodeId: NodeId): GameState {
  const player = findPlayer(state, playerId);
  // Le diable and L'Ange-Gardien walk past it.
  if (!player || state.redCupNodeId !== nodeId || !canCollectRedCup(player)) return state;
  if (hasCard(player, "greedy")) return cashInCup(state, playerId, nodeId);

  if (player.inventory.length >= getInventoryCapacity(player)) {
    return {
      ...state,
      turnStage: "discard",
      pendingDiscard: { playerId, reason: "red-cup", cupNodeId: nodeId, resumeStage: state.turnStage },
    };
  }

  return finishCupCollection(state, playerId, nodeId);
}

/**
 * Je note: a single-target item used against its holder has one chance in
 * three of leaving them a copy, sacrificing another item if needed. `userId`
 * is whoever used the item.
 */
export function itemCopyForPassive(
  state: GameState,
  targetPlayerId: PlayerId,
  itemId: ItemId,
  userId: PlayerId | undefined,
): GameState {
  const target = findPlayer(state, targetPlayerId);
  if (!target || !hasCard(target, "i-take-notes") || ITEM_CATALOG[itemId].target !== "player") return state;

  // An item used on oneself would come straight back: Ndoye on yourself every turn, for free.
  if (userId === targetPlayerId) {
    return addLog(state, `${target.name} s’est visé lui-même : Je note ne copie pas ${ITEM_CATALOG[itemId].name}.`);
  }
  if (drawEngineRandom() >= JE_NOTE_COPY_CHANCE) {
    return addLog(state, `${target.name} ne note rien cette fois.`);
  }

  if (canAddItem(target, itemId)) {
    const nextState = updatePlayer(state, targetPlayerId, (player) => appendItem(player, itemId));
    return addBagLog(
      nextState,
      target.id,
      `${target.name} récupère aussi ${ITEM_CATALOG[itemId].name}.`,
      `${target.name} récupère une copie.`,
      "event",
    );
  }

  // The no-stacking rule wins over Je note: never a third copy, a second Gomme or a sixth Tomate.
  if (!canReceiveItem(target, itemId)) {
    const onlyCups = !target.inventory.some((entry) => entry.kind === "item");
    if (onlyCups) return state;
    return addBagLog(
      state,
      target.id,
      `${target.name} a déjà assez de ${ITEM_CATALOG[itemId].name} : pas de copie.`,
      `${target.name} ne garde pas de copie.`,
    );
  }

  return {
    ...state,
    turnStage: "discard",
    pendingDiscard: { playerId: targetPlayerId, reason: "forced-item", itemId, resumeStage: state.turnStage },
  };
}

export function addStartBonus(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!player) return state;
  return applyCurrencyChange(addLog(state, `${player.name} passe par le départ.`, "good"), playerId, START_BONUS);
}

/**
 * Red light, Green light: per Red Cup, the first two green tiles walked on pay
 * 100 coins and the first two red ones cost 50 (patch 0.1.5).
 */
export function addRedGreenBonuses(state: GameState, playerId: PlayerId, path: NodeId[]): GameState {
  const player = findPlayer(state, playerId);
  if (!player || !hasCard(player, "red-light-green-light")) return state;

  const board = getBoard(state);
  let nextState = state;
  for (const nodeId of path) {
    const kind = getNodeKind(board, nodeId);
    if (kind !== "green" && kind !== "red") continue;
    if (nextState.redGreenTriggers[kind] >= RED_GREEN_TRIGGERS_PER_CUP) continue;
    nextState = {
      ...nextState,
      redGreenTriggers: { ...nextState.redGreenTriggers, [kind]: nextState.redGreenTriggers[kind] + 1 },
    };
    nextState = applyCurrencyChange(nextState, playerId, kind === "green" ? RED_GREEN_GAIN : -RED_GREEN_PENALTY);
  }
  return nextState;
}

/**
 * Reaching a tile because a wheel said so (« Avance d’une case », « Retourne
 * d’où tu viens », « Va au Départ ») is an arrival, like the end of a walk:
 * the tile's wheel is queued, its mud and Red Cup apply, and the ghost meets
 * the player when the board settles. The shop opens through the stage given
 * by `getWheelArrivalStage`. `cameFrom` is the tile stepped in from, when the
 * player stepped rather than being set down.
 */
export function arriveOnTile(state: GameState, playerId: PlayerId, cameFrom: NodeId | null = null): GameState {
  const player = findPlayer(state, playerId);
  if (!player) return state;
  // Queued first, spun last: mud and the Red Cup resolve before the tile's wheel.
  let nextState = queueTileWheel(state, playerId);
  nextState = triggerMud(nextState, playerId, player.position, cameFrom);
  nextState = triggerPortal(nextState, playerId);
  // Chance aveugle may have stepped back out of the mud, and a Portail drops into Hell.
  if (findPlayer(nextState, playerId)?.position !== player.position) return nextState;
  if (nextState.redCupNodeId !== player.position) return nextState;
  return collectCupOrRequestDiscard(nextState, playerId, player.position);
}

/**
 * Where play goes on once a wheel moved `playerId` onto their tile: the active
 * player whose turn was over shops on a blue tile; anything else carries on.
 */
export function getWheelArrivalStage(state: GameState, playerId: PlayerId, resumeStage: TurnStage): TurnStage {
  const player = findPlayer(state, playerId);
  const isActive = getActivePlayer(state)?.id === playerId;
  const onShop = player !== undefined && opensShop(state, player);
  return isActive && onShop && resumeStage === "turn-end" ? "shop" : resumeStage;
}

/** Cupide walks onto a tile: every knocked-out player standing there pays them a little. */
export function stealFromKnockedOut(state: GameState, playerId: PlayerId): GameState {
  const thief = findPlayer(state, playerId);
  if (!thief || !hasCard(thief, "greedy")) return state;
  let nextState = state;
  const victims = state.players.filter(
    (player) => player.id !== thief.id && player.position === thief.position && isKnockedOut(player),
  );
  for (const victim of victims) {
    nextState = applyCurrencyChange(nextState, victim.id, -GREEDY_STUN_THEFT);
    nextState = applyCurrencyChange(nextState, thief.id, GREEDY_STUN_THEFT);
    nextState = addLog(
      nextState,
      `${thief.name} détrousse ${victim.name}, assommé : ${GREEDY_STUN_THEFT} pièces.`,
      "event",
    );
  }
  return nextState;
}

/**
 * Stopping in mud costs the player and pays its owner, then the mud is gone.
 * Chance aveugle loses nothing (and pays nobody): they step back to
 * `cameFrom`, the tile they stepped in from, or stay when they were set down.
 */
export function triggerMud(state: GameState, playerId: PlayerId, nodeId: NodeId, cameFrom: NodeId | null): GameState {
  const trap = state.mudTraps.find((candidate) => candidate.nodeId === nodeId);
  const player = findPlayer(state, playerId);
  if (!trap || !player) return state;

  let nextState: GameState = { ...state, mudTraps: state.mudTraps.filter((candidate) => candidate.id !== trap.id) };
  if (isImmuneToItems(player)) return stepBackFromMud(nextState, player, cameFrom);
  nextState = addLog(nextState, `${player.name} tombe dans la Boue.`, "bad");
  // L'Ange-Gardien loses their next turn rather than coins; the mud's owner is paid all the same.
  if (avoidsHell(player)) {
    nextState = updatePlayer(nextState, playerId, (current) => loseTurns(current));
    nextState = addLog(nextState, `${player.name} perd son prochain tour dans la Boue.`, "bad");
  } else {
    nextState = applyCurrencyChange(nextState, playerId, -MUD_PENALTY);
  }
  // Stepping in your own mud pays nobody.
  const owner = findPlayer(nextState, trap.ownerId);
  if (owner && owner.id !== playerId) {
    const reward = getMudOwnerReward(owner);
    nextState = addLog(nextState, `${owner.name} touche ${reward} pièces grâce à sa Boue.`, "good");
    nextState = linkLastGamble(nextState, playerId, { playerId: owner.id, amount: reward });
    nextState = applyCurrencyChange(nextState, owner.id, reward);
  }
  return nextState;
}

/** The gamble just queued for `playerId` also settles what the loss paid somebody else. */
function linkLastGamble(
  state: GameState,
  playerId: PlayerId,
  linked: { playerId: PlayerId; amount: number },
): GameState {
  const index = state.pendingGambles.map((gamble) => gamble.playerId).lastIndexOf(playerId);
  if (index < 0 || state.pendingGambles[index].amount >= 0) return state;
  return {
    ...state,
    pendingGambles: state.pendingGambles.map((gamble, at) => (at === index ? { ...gamble, linked } : gamble)),
  };
}

/** Chance aveugle slips in the mud: one tile back, without an arrival there, and not a coin lost. */
function stepBackFromMud(state: GameState, player: Player, cameFrom: NodeId | null): GameState {
  if (cameFrom === null || cameFrom === HELL_NODE_ID || cameFrom === player.position) {
    return addLog(state, `${player.name} glisse dans la Boue, sans rien perdre.`, "event");
  }
  const nextState = updatePlayer(state, player.id, (current) => ({ ...current, position: cameFrom }));
  const logged = addLog(
    nextState,
    `${player.name} glisse dans la Boue et recule en case ${cameFrom}, sans rien perdre.`,
    "event",
  );
  // Back onto ice, the ice carries them on.
  return carryOffIce(logged, player.id, player.position);
}

/**
 * Bad luck on the Hell wheel must not bench a player for the whole game: after
 * their limit (five, three for the Habitué de l'Enfer) of their own turns there, they walk out to the start, get
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
    `${player.name} a purgé ${getHellTurnLimit(player)} tours en Enfer : retour en case 0 contre ${HELL_EXIT_TOLL} pièces.`,
    "event",
  );
  nextState = addStartBonus(nextState, playerId);
  // A start frozen by the blizzard carries them on.
  return carryOffIce(applyCurrencyChange(nextState, playerId, -HELL_EXIT_TOLL), playerId, HELL_NODE_ID);
}

/** Counts one more of the player's own turns in Hell, releasing them once the limit is served. */
function serveHellTurn(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!player || player.position !== HELL_NODE_ID) return state;
  const served = updatePlayer(state, playerId, (current) => ({ ...current, hellTurns: current.hellTurns + 1 }));
  return countDevilHellTurn(served, playerId);
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
  return player?.position === HELL_NODE_ID && player.hellTurns >= getHellTurnLimit(player);
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
  return passTurnFrom(nextState, state.activePlayerIndex);
}

/**
 * A player who is put to sleep as their turn opens (a thaw wheel, a reset at
 * −300…) must not play it: the turn they were to lose is this one, used up
 * on the spot (patch 0.1.5). One who falls asleep after acting keeps the turn
 * they are in and loses the next, as the wheels say.
 */
export function skipBenchedTurns(state: GameState): GameState {
  let nextState = state;
  for (let guard = 0; guard < state.players.length * 3; guard += 1) {
    const active = getActivePlayer(nextState);
    const waitsToMove = nextState.turnStage === "move" || nextState.turnStage === "hell";
    if (nextState.phase !== "playing" || !active || !waitsToMove) return nextState;
    if (active.skippedTurns <= 0 || nextState.turnActionTaken) return nextState;
    nextState = updatePlayer(nextState, active.id, (player) => ({ ...player, skippedTurns: player.skippedTurns - 1 }));
    nextState = addLog(nextState, `${active.name} passe son tour.`, "bad");
    nextState = thawSnowFrozen(nextState, active.id);
    nextState = beginNextTurn(nextState);
  }
  return nextState;
}

/**
 * Hands the turn to the first player seated after `fromIndex` who may play.
 * `fromIndex` is −1 when the seat before the first one was just emptied, so
 * the round goes on from the first seat without starting a new one.
 */
export function passTurnFrom(state: GameState, fromIndex: number): GameState {
  if (state.players.length === 0) return state;
  // Banquise: the turn that ends draws a snowball, before the next player is found (a freeze skips them).
  return seatNextPlayer(throwSnowball(resetHellCountdowns(state)), fromIndex, null);
}

/**
 * Non merci: Bullet Bill was about to hit its holder as a new round started,
 * and the turn change waited for their answer. It goes on from that round
 * start, with Bullet Bill hitting or fizzling out.
 */
export function resumeAfterBulletReaction(state: GameState, dodged: boolean): GameState {
  const paused: GameState = { ...state, pendingReaction: null };
  return seatNextPlayer(paused, state.players.length - 1, dodged ? "dodged" : "hit");
}

/**
 * The search for the next player of `passTurnFrom`. `bulletAnswer` carries the
 * Non merci holder's answer to the first round start, once they gave it.
 */
function seatNextPlayer(state: GameState, fromIndex: number, bulletAnswer: "hit" | "dodged" | null): GameState {
  let nextState = state;
  const seatCount = nextState.players.length;
  let nextIndex = fromIndex;
  let nextRound = state.round;
  let attempts = 0;
  let answer = bulletAnswer;

  do {
    nextIndex += 1;
    if (nextIndex >= seatCount) {
      nextIndex = 0;
      nextRound += 1;
      // Before anything of the new round, Bullet Bill's victim may answer with Non merci, or their angel
      // with a Bouclier.
      const reaction = answer === null ? findBulletReactors(nextState, nextRound) : null;
      if (reaction) return askToDodgeBulletBill(nextState, reaction.victimId, reaction.reactorIds);
      nextState = advanceBulletBill(nextState, nextRound, answer === "dodged");
      answer = null;
      if (isBlizzardRound(nextState, nextRound)) nextState = blowBlizzard(nextState);
      if (nextState.bootFirstPurchased && nextRound > state.bootLastPriceRound) {
        nextState = {
          ...nextState,
          bootPrice: Math.min(MAXIMUM_BOOT_PRICE, nextState.bootPrice + BOOT_PRICE_STEP),
          bootLastPriceRound: nextRound,
        };
      }
    }

    // Le diable's Toucher d'Enfer strikes before a knocked-out player's skipped turn is used up.
    nextState = applyHellTouch(nextState);
    const nextPlayer = nextState.players[nextIndex];
    if (nextPlayer.skippedTurns <= 0) break;
    nextState = updatePlayer(nextState, nextPlayer.id, (player) => ({
      ...player,
      skippedTurns: player.skippedTurns - 1,
    }));
    nextState = addLog(nextState, `${nextPlayer.name} passe son tour.`, "bad");
    nextState = thawSnowFrozen(nextState, nextPlayer.id);
    // A turn skipped in Hell still counts towards the sentence.
    nextState = serveHellTurn(nextState, nextPlayer.id);
    if (hasServedHellSentence(nextState, nextPlayer.id)) {
      nextState = releaseFromHellWithToll(nextState, nextPlayer.id);
    }
    attempts += 1;
  } while (attempts < seatCount * 3);

  // The seated player can play again: the knocked-out status ends there, once their skipped turns are used up.
  if (nextState.players[nextIndex].knockedOut) {
    nextState = updatePlayer(nextState, nextState.players[nextIndex].id, (player) => ({
      ...player,
      knockedOut: false,
    }));
  }
  nextState = serveHellTurn(nextState, nextState.players[nextIndex].id);
  const activePlayer = nextState.players[nextIndex];
  nextState = {
    ...nextState,
    activePlayerIndex: nextIndex,
    round: nextRound,
    turnStage: activePlayer.position === HELL_NODE_ID ? "hell" : "move",
    energyLeft: getEnergyCapacity(activePlayer, nextState),
    turnActionTaken: false,
    moveDistance: 1,
    mudPlacedThisTurn: false,
    thrownStackId: null,
    diceRoll: null,
    theftAttempted: false,
    blessingQueue: [],
    pendingWheel: null,
    pendingChallenge: null,
    pendingDiscard: null,
    pendingReaction: null,
    pendingTileWheels: [],
    pendingCupRepositionPlayerId: null,
    pendingCupRevealNodeId: null,
    pendingCupRepositionResumeStage: null,
    pendingCalmDown: null,
    pendingAdvance: null,
  };
  // Le diable's Portails, Black Cup and Doomsday last whole rounds, from turn to turn.
  nextState = expireDevilSpells(nextState);
  nextState = expireBarrier(nextState, activePlayer.id);
  nextState = thawFrozenSlide(addLog(nextState, `Tour de ${activePlayer.name}.`, "event"));
  return rideGhost(nextState);
}

/**
 * Each turn of a Barrière's owner wears it down; it falls when none is left, or when its owner has left the
 * table.
 */
function expireBarrier(state: GameState, seatedId: PlayerId): GameState {
  if (!state.barriers.some((barrier) => barrier.ownerId === seatedId || !findPlayer(state, barrier.ownerId))) {
    return state;
  }
  const standing: Barrier[] = [];
  for (const barrier of state.barriers) {
    const wornDown = barrier.ownerId === seatedId ? { ...barrier, turnsLeft: barrier.turnsLeft - 1 } : barrier;
    if (wornDown.turnsLeft > 0 && findPlayer(state, barrier.ownerId)) standing.push(wornDown);
  }
  const nextState = { ...state, barriers: standing };
  if (standing.length === state.barriers.length) return nextState;
  const text = state.barriers.length - standing.length > 1 ? "Des Barrières tombent" : "Une Barrière tombe";
  return addLog(nextState, `${text} : la route est rouverte.`, "event");
}

/** The turn change holds while Bullet Bill's victim (Non merci) or their angel (Bouclier) decides. */
function askToDodgeBulletBill(state: GameState, victimId: PlayerId, reactorIds: PlayerId[]): GameState {
  const victim = findPlayer(state, victimId);
  const nextState: GameState = {
    ...state,
    turnStage: "reaction",
    pendingReaction: {
      actorId: null,
      action: { type: "bullet-bill", victimId },
      reactorIds,
      resumeStage: "turn-end",
    },
  };
  return addLog(nextState, `Bullet Bill fonce sur ${victim?.name ?? "un joueur"}…`, "event");
}

/**
 * Every turn change ends on a settled board, whatever the map: a player
 * knocked out on le diable's tile by a snowball or Bullet Bill meets their
 * Toucher d'Enfer at once. At Luna Park, the ghost rides on first, and may
 * land on somebody right away.
 */
function rideGhost(state: GameState): GameState {
  if (state.phase !== "playing" || !["move", "hell"].includes(state.turnStage)) return state;
  return settleBoard(state.ghost ? advanceGhost(state) : state, state.turnStage);
}

/**
 * Banquise: a player caught by falling ice breaks free when their turn comes,
 * finishes the slide to the tile it was heading for, then plays as usual.
 * Arriving there counts like the end of a walk (mud, Red Cup, wheel) but for
 * the shop, which only opens at the end of the turn's own move.
 */
function thawFrozenSlide(state: GameState): GameState {
  const active = getActivePlayer(state);
  const frozen = active ? state.frozenSlides.find((entry) => entry.playerId === active.id) : undefined;
  if (!active || !frozen) return state;

  let nextState: GameState = {
    ...state,
    frozenSlides: state.frozenSlides.filter((entry) => entry.playerId !== active.id),
  };
  // Pulled, swapped or sent to Hell meanwhile: the slide it was finishing no longer exists.
  if (active.position !== frozen.from) return nextState;

  const board = getBoard(state);
  // A Barrière set on the road meanwhile stops the slide: it bounces back on the tile and slides on another way.
  const barred = isBlockedRoad(board, frozen.from, frozen.to);
  // The blizzard may have frozen the tile meanwhile: the slide then goes on from there.
  const onward = barred
    ? drawSlide(state, frozen.to, [frozen.from], false)
    : isIce(board, frozen.to)
      ? drawSlide(state, frozen.from, [frozen.to], false)
      : null;
  const path = barred ? (onward?.slide ?? []) : [frozen.to, ...(onward?.slide ?? [])];
  if (barred && path.length === 0) {
    // No other road to slide on: nobody stays on ice, the safety net after the action carries them off.
    nextState = addLog(nextState, `${active.name} brise la glace, mais une Barrière lui ferme la route.`, "event");
    return settleBoard(nextState, nextState.turnStage);
  }
  const end = path[path.length - 1];
  nextState = updatePlayer(nextState, active.id, (player) => ({ ...player, position: end }));
  nextState = {
    ...nextState,
    lastMovement: {
      seq: (state.lastMovement?.seq ?? 0) + 1,
      playerId: active.id,
      from: frozen.from,
      path,
      thawed: true,
    },
  };
  nextState = addLog(
    nextState,
    barred
      ? `${active.name} brise la glace, se heurte à une Barrière, rebondit et glisse jusqu’en case ${end}.`
      : `${active.name} brise la glace et arrive en case ${frozen.to}.`,
    "event",
  );
  if (onward) nextState = recordSlide(nextState, active.id, onward, end);
  nextState = addRedGreenBonuses(nextState, active.id, path);
  nextState = queueTileWheel(nextState, active.id);
  nextState = triggerMud(nextState, active.id, end, path[path.length - 2] ?? frozen.from);
  nextState = triggerPortal(nextState, active.id);
  const landed = findPlayer(nextState, active.id)?.position === end;
  if (landed && nextState.redCupNodeId === end) {
    nextState = collectCupOrRequestDiscard(nextState, active.id, end);
  }

  const waitsForDecision = ["discard", "reposition", "passive-choice"].includes(nextState.turnStage);
  if (nextState.phase !== "playing" || waitsForDecision) return nextState;
  return settleBoard(nextState, nextState.turnStage);
}
