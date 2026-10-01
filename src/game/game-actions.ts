import { abandonPlayer } from "./abandon";
import { isTableBroke, spinBlessingWheel, startBlessingRound } from "./blessing";
import { earnsStartBonus, getBoard } from "./board";
import { createGhost, spareHellPlayers } from "./ghost";
import { pickBlizzardTile } from "./ice";
import { getBoardMap } from "./maps/map-registry";
import { FREE_ITEM_POOL, ITEM_CATALOG, PASSIVE_ORDER } from "./catalog";
import { castDuelVote, flipDuelCoin, pickDuelHand, resolveDuel, startBasketRound, submitBasketScore } from "./duel";
import { createEngineId, runWithSeededSource } from "./engine-random";
import {
  canAffordItem,
  canAffordMove,
  canEndTurn,
  getEnergyCapacity,
  getItemEnergyCost,
  spendAllEnergy,
  spendEnergy,
} from "./energy";
import {
  addCupCycleEffects,
  addRedGreenBonuses,
  addStartBonus,
  arriveOnTile,
  beginNextTurn,
  finishCupCollection,
  getWheelArrivalStage,
  itemCopyForPassive,
  normalizeResumeStage,
  queueTileWheel,
  sendPlayerToHell,
  settleBoard,
  startDuel,
  startWheel,
  validTileWheels,
} from "./game-effects";
import {
  canAddItem,
  canStartNewSlot,
  getItemPrice,
  getTileWheel,
  getUniqueLegalDestinations,
  isShopNode,
} from "./rules";
import {
  addLog,
  appendItem,
  applyCurrencyChange,
  findPlayer,
  getActivePlayer,
  getItemEntry,
  makeLog,
  placeInHell,
  randomChoice,
  removeInventoryEntry,
  spendItemEntry,
  shuffle,
  updatePlayer,
} from "./state-utils";
import {
  applyItemUse,
  applyMove,
  cancelDeclaredAction,
  carryOutDeclaredAction,
  isThrownItem,
  openReactionWindow,
  planItemUse,
  planMove,
} from "./turn-actions";
import type {
  GameState,
  ItemId,
  MapId,
  NodeId,
  Player,
  PlayerColor,
  PlayerId,
  RpsChoice,
  TurnStage,
  WheelId,
  WheelOutcomeId,
} from "./types";
import {
  EMPTY_GAME_STATE,
  FIRST_ROUND,
  FREE_TOMATOES,
  HELL_NODE_ID,
  PLAYER_COLORS,
  STARTING_CURRENCY,
  START_NODE_ID,
} from "./types";

/**
 * Every change to a game is one serialisable action run through `reduceGame`.
 * The local store applies it directly; an online game sends it to every
 * device, which all reduce it the same way.
 */
export type GameAction =
  | { type: "startGame"; playerNames: string[]; seed?: number; avatarColors?: PlayerColor[]; mapId?: MapId }
  | { type: "resetGame" }
  | { type: "movePlayer"; destination: NodeId; ignoreArrows: boolean }
  | { type: "prepareBoot"; entryId: string }
  | { type: "buyItem"; itemId: ItemId }
  /** `count`: Tomates thrown in one go from their stack; one for every other item. */
  | { type: "useItem"; entryId: string; targetPlayerId?: PlayerId; count?: number }
  | { type: "resolveReaction"; reactorId: PlayerId | null }
  | { type: "endTurn" }
  | { type: "spinHellWheel" }
  | { type: "spinTileWheel" }
  | { type: "spinBlessingWheel" }
  | { type: "abandonGame"; playerId: PlayerId }
  | { type: "spinWheel"; wheelId: WheelId; playerId: PlayerId; resumeStage: TurnStage; sourceItemId?: ItemId }
  | { type: "resolveWheel" }
  | { type: "cancelWheel" }
  | { type: "challengePlayer"; targetPlayerId: PlayerId }
  | { type: "flipDuelCoin" }
  | { type: "pickDuelHand"; playerId: PlayerId; choice: RpsChoice }
  | { type: "castDuelVote"; voterId: PlayerId; candidateId: PlayerId }
  | { type: "resolveDuel"; winnerId: PlayerId }
  | { type: "startBasketRound"; playerId: PlayerId }
  | { type: "submitBasketScore"; playerId: PlayerId; score: number }
  | { type: "discardInventoryEntry"; entryId: string }
  | { type: "repositionBeforeCup"; destination: NodeId }
  | { type: "advanceOneTile"; destination: NodeId }
  | { type: "resolveCalmDown"; useEffect: boolean };

export type GameActionType = GameAction["type"];

const MAX_PLAYERS = 8;

/** Online players pick their avatar in the lobby; a local table takes the palette in seat order. */
function createPlayers(playerNames: string[], avatarColors: PlayerColor[] | undefined): Player[] {
  const names = playerNames.slice(0, MAX_PLAYERS).map((name, index) => name.trim() || `Joueur ${index + 1}`);
  const passives = shuffle(PASSIVE_ORDER).slice(0, names.length);
  return names.map((name, index) => ({
    id: getSeatPlayerId(index),
    name,
    color: avatarColors?.[index] ?? PLAYER_COLORS[index],
    position: START_NODE_ID,
    currency: STARTING_CURRENCY,
    inventory: [],
    passiveId: passives[index],
    skippedTurns: 0,
    hellTurns: 0,
    noThanksReadyRound: FIRST_ROUND,
    previousNodeId: null,
  }));
}

/**
 * Seat ids are the seat numbers (`p1`, `p2`…): an online room maps each seat
 * to its device without any lookup table.
 */
export function getSeatPlayerId(seatIndex: number): PlayerId {
  return `p${seatIndex + 1}`;
}

/** A random map is drawn by the lobby beforehand: the action always names the board. */
function startGame(
  state: GameState,
  playerNames: string[],
  seed: number | undefined,
  avatarColors: PlayerColor[] | undefined,
  mapId: MapId | undefined,
): GameState {
  if (playerNames.length < 2) return state;
  const map = getBoardMap(mapId ?? EMPTY_GAME_STATE.mapId);
  const build = (): GameState => {
    const players = createPlayers(playerNames, avatarColors);
    const opening: GameState = {
      ...EMPTY_GAME_STATE,
      phase: "playing",
      turnStage: "move",
      mapId: map.id,
      players,
      energyLeft: getEnergyCapacity(players[0]),
      redCupNodeId: map.initialCupNodeId,
      log: [
        makeLog(
          `La partie commence sur ${map.name}. La première Red Cup est en case ${map.initialCupNodeId}.`,
          "event",
        ),
      ],
    };
    // Banquise opens with its third ice tile already laid; blizzards move it later on.
    const withIce =
      map.blizzardEveryRounds === undefined ? opening : { ...opening, iceTileNodeId: pickBlizzardTile(opening) };
    // Luna Park's ghost waits a round or two before haunting the carousel.
    return { ...withIce, ghost: createGhost(withIce) };
  };
  if (seed === undefined) return build();
  const { result, seed: seededRandom } = runWithSeededSource({ rngState: seed >>> 0, nextId: 0 }, build);
  return { ...result, seededRandom };
}

/** Wheel results that hand over to another wheel instead of applying an effect. */
const CHAINED_WHEELS: Partial<Record<WheelOutcomeId, WheelId>> = {
  "spin-fortune": "fortune",
  "spin-misfortune": "misfortune",
};

/** Wheel of fortune: what a full bag gets instead of the free item. */
const FULL_BAG_FREE_ITEM_COINS = 200;

/**
 * Wheel of fortune: one item of the pool the bag can take, drawn at random.
 * A Tomate comes as a whole new stack, the stack being one item; with no slot
 * for it, the started stacks fill up instead.
 */
function giveFreeItem(state: GameState, player: Player): GameState {
  const freeItem = randomChoice(FREE_ITEM_POOL.filter((itemId) => canAddItem(player, itemId)));
  if (!freeItem) return applyCurrencyChange(state, player.id, FULL_BAG_FREE_ITEM_COINS);

  if (freeItem === "tomato" && canStartNewSlot(player, freeItem)) {
    const stack = { id: createEngineId(), kind: "item" as const, itemId: freeItem, count: FREE_TOMATOES };
    const nextState = updatePlayer(state, player.id, (current) => ({
      ...current,
      inventory: [...current.inventory, stack],
    }));
    return addLog(nextState, `${player.name} reçoit ${FREE_TOMATOES} Tomates gratuitement.`, "good");
  }

  const wanted = freeItem === "tomato" ? FREE_TOMATOES : 1;
  let nextState = state;
  let given = 0;
  while (given < wanted && canAddItem(findPlayer(nextState, player.id) ?? player, freeItem)) {
    nextState = updatePlayer(nextState, player.id, (current) => appendItem(current, freeItem));
    given += 1;
  }
  const gift = freeItem === "tomato" && given > 1 ? `${given} Tomates` : ITEM_CATALOG[freeItem].name;
  return addLog(nextState, `${player.name} reçoit ${gift} gratuitement.`, "good");
}

/** Tiles a player may step forward onto: one step along the roads, arrows obeyed; none from Hell. */
export function getForwardTiles(state: GameState, player: Player): NodeId[] {
  if (player.position === HELL_NODE_ID) return [];
  return getUniqueLegalDestinations(getBoard(state), player, 1, false);
}

/** Applies one wheel outcome to its player; chained and interactive outcomes are handled by the caller. */
function applyWheelOutcome(
  state: GameState,
  player: Player,
  wheelId: WheelId,
  outcomeId: WheelOutcomeId,
  amount: number,
): GameState {
  switch (outcomeId) {
    case "lose-100":
    case "lose-200":
    case "lose-300":
    case "lose-400":
      return applyCurrencyChange(state, player.id, -amount);
    case "gain-100":
    case "gain-200":
    case "gain-300":
    case "gain-400":
      return applyCurrencyChange(state, player.id, amount);
    case "lose-item": {
      const entry = randomChoice(player.inventory.filter((candidate) => candidate.kind === "item"));
      // Never a Red Cup; an empty bag pays the wheel's amount in coins instead.
      if (!entry) return applyCurrencyChange(state, player.id, -amount);
      const nextState = updatePlayer(state, player.id, (current) => spendItemEntry(current, entry.id));
      return addLog(nextState, `${player.name} perd un objet.`, "bad");
    }
    case "skip-turn":
    case "hell-skip": {
      const nextState = updatePlayer(state, player.id, (current) => ({
        ...current,
        skippedTurns: current.skippedTurns + 1,
      }));
      return addLog(nextState, `${player.name} devra passer son prochain tour.`, "bad");
    }
    case "go-to-hell":
      return sendPlayerToHell(state, player.id);
    case "escape": {
      if (wheelId !== "hell" || player.position !== HELL_NODE_ID)
        return addLog(state, "La roue ne produit aucun effet.");
      const freed = updatePlayer(state, player.id, (current) => ({ ...current, position: START_NODE_ID }));
      return addStartBonus(addLog(freed, `${player.name} sort de l’Enfer et revient en case 0.`, "good"), player.id);
    }
    case "go-to-start": {
      const fromHell = player.position === HELL_NODE_ID;
      let nextState = updatePlayer(state, player.id, (current) => ({ ...current, position: START_NODE_ID }));
      nextState = addLog(
        nextState,
        fromHell ? `${player.name} sort de l’Enfer et file au Départ.` : `${player.name} file au Départ.`,
        "good",
      );
      nextState = addStartBonus(nextState, player.id);
      return arriveOnTile(nextState, player.id);
    }
    case "go-back": {
      const back = player.previousNodeId;
      // Hell is never somewhere to go back to, and a bad wheel does not let a player out of it.
      if (player.position === HELL_NODE_ID || back === null || back === HELL_NODE_ID || back === player.position) {
        return addLog(state, `${player.name} n’a nulle part où retourner.`);
      }
      let nextState = updatePlayer(state, player.id, (current) => ({ ...current, position: back }));
      nextState = addLog(nextState, `${player.name} retourne en case ${back}.`, "bad");
      nextState = { ...nextState, turnStage: getWheelArrivalStage(nextState, player.id, state.turnStage) };
      return arriveOnTile(nextState, player.id);
    }
    case "advance-one":
      if (getForwardTiles(state, player).length === 0)
        return addLog(state, `${player.name} n’a aucune case où avancer.`);
      return { ...state, turnStage: "advance", pendingAdvance: { playerId: player.id, resumeStage: state.turnStage } };
    case "free-item":
      return giveFreeItem(state, player);
    default:
      return addLog(state, "La roue ne produit aucun effet.");
  }
}

/**
 * Wheel of fortune, « Avance d’une case »: a one-tile walk, arrows obeyed.
 * The tile walked onto counts for Red light, Green light and the start bonus,
 * and is reached like the end of any walk: its wheel, its shop, its mud and
 * its Red Cup.
 */
function advanceOneTile(state: GameState, destination: NodeId): GameState {
  const pending = state.pendingAdvance;
  const player = findPlayer(state, pending?.playerId);
  if (!pending || !player || state.turnStage !== "advance") return state;
  if (!getForwardTiles(state, player).includes(destination)) return state;

  let nextState = updatePlayer(state, player.id, (current) => ({ ...current, position: destination }));
  const resumeStage = getWheelArrivalStage(nextState, player.id, pending.resumeStage);
  nextState = { ...nextState, pendingAdvance: null, turnStage: resumeStage };
  nextState = {
    ...nextState,
    lastMovement: {
      seq: (state.lastMovement?.seq ?? 0) + 1,
      playerId: player.id,
      from: player.position,
      path: [destination],
    },
  };
  nextState = addLog(nextState, `${player.name} avance en case ${destination}.`, "good");
  nextState = addRedGreenBonuses(nextState, player.id, [destination]);
  if (earnsStartBonus(getBoard(state), player.position, [destination])) {
    nextState = addStartBonus(nextState, player.id);
  }
  nextState = arriveOnTile(nextState, player.id);

  const waitsForDecision = ["discard", "reposition", "passive-choice"].includes(nextState.turnStage);
  if (nextState.phase !== "playing" || waitsForDecision) return nextState;
  return settleBoard(nextState, resumeStage);
}

function movePlayer(state: GameState, destination: NodeId, ignoreArrows: boolean): GameState {
  const plan = planMove(state, destination, ignoreArrows);
  if (!plan) return state;
  const waiting = openReactionWindow(state, { type: "move", destination, ignoreArrows });
  return waiting ?? applyMove(state, destination, plan);
}

/** One Botte per turn: it costs a point and keeps another for the two-tile move. */
function prepareBoot(state: GameState, entryId: string): GameState {
  const player = getActivePlayer(state);
  if (!player || state.turnStage !== "move" || state.moveDistance !== 1) return state;
  if (getItemEntry(player, entryId) !== "boot" || !canAffordItem(state, "boot")) return state;

  let nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, entryId));
  nextState = { ...spendEnergy(nextState, getItemEnergyCost("boot")), moveDistance: 2 };
  return addLog(nextState, `${player.name} prépare la Botte pour un déplacement de deux cases.`, "event");
}

function buyItem(state: GameState, itemId: ItemId): GameState {
  const player = getActivePlayer(state);
  if (!player || state.turnStage !== "shop" || !isShopNode(getBoard(state), player.position)) return state;

  // Shopping costs no energy: what is bought is used from the next turn on, Bullet Bill included.
  const price = getItemPrice(itemId, state.bootPrice);
  if (player.currency < price || !canAddItem(player, itemId)) return state;

  let nextState = applyCurrencyChange(state, player.id, -price);
  nextState = updatePlayer(nextState, player.id, (current) => appendItem(current, itemId));
  if (itemId === "boot" && !state.bootFirstPurchased) {
    nextState = { ...nextState, bootFirstPurchased: true, bootLastPriceRound: state.round };
  }
  return addLog(nextState, `${player.name} achète ${ITEM_CATALOG[itemId].name} pour ${price} pièces.`, "good");
}

function useItem(
  state: GameState,
  entryId: string,
  targetPlayerId: PlayerId | undefined,
  count: number | undefined,
): GameState {
  const plan = planItemUse(state, entryId, targetPlayerId, count);
  if (!plan) return state;
  if (isThrownItem(plan.itemId)) return applyItemUse(state, entryId, plan);
  const waiting = openReactionWindow(state, {
    type: "item",
    entryId,
    itemId: plan.itemId,
    targetPlayerId: plan.target?.id,
  });
  return waiting ?? applyItemUse(state, entryId, plan);
}

function resolveReaction(state: GameState, reactorId: PlayerId | null): GameState {
  const pending = state.pendingReaction;
  if (!pending || state.turnStage !== "reaction") return state;
  if (reactorId === null) return carryOutDeclaredAction(state, pending);
  if (!pending.reactorIds.includes(reactorId)) return state;
  return cancelDeclaredAction(state, pending, reactorId);
}

function endTurn(state: GameState): GameState {
  if (!canEndTurn(state)) return state;
  const ended: GameState = { ...state, turnStage: "turn-end" };
  return isTableBroke(ended) ? startBlessingRound(ended) : beginNextTurn(ended);
}

/** In Hell the wheel stands for the move: it takes the energy left and ends the turn. */
function spinHellWheel(state: GameState): GameState {
  const player = getActivePlayer(state);
  if (!player || state.turnStage !== "hell" || player.position !== HELL_NODE_ID || !canAffordMove(state)) {
    return state;
  }
  return startWheel(spendAllEnergy(state), "hell", player.id, "turn-end", { origin: "hell" });
}

function spinTileWheel(current: GameState): GameState {
  if (current.turnStage !== "tile-wheel") return current;
  const state = validTileWheels(current);
  const [next, ...rest] = state.pendingTileWheels;
  const wheelId = next ? getTileWheel(getBoard(state), next.nodeId) : null;
  if (!next || !wheelId) return { ...state, turnStage: state.tileWheelResumeStage };
  const queueRest = { ...state, pendingTileWheels: rest };
  return startWheel(queueRest, wheelId, next.playerId, state.tileWheelResumeStage, { origin: "tile" });
}

function resolveWheel(state: GameState): GameState {
  const pending = state.pendingWheel;
  const player = findPlayer(state, pending?.playerId);
  if (!pending || !player) return state;

  const chainedWheel = CHAINED_WHEELS[pending.result.id];
  if (chainedWheel) {
    return startWheel(state, chainedWheel, pending.playerId, pending.resumeStage, {
      sourceItemId: pending.sourceItemId,
      origin: "chain",
    });
  }

  if (pending.result.id === "challenge") {
    const nextState: GameState = {
      ...state,
      pendingWheel: null,
      pendingChallenge: { playerId: pending.playerId, resumeStage: pending.resumeStage },
      turnStage: "target",
    };
    return pending.sourceItemId
      ? itemCopyForPassive(nextState, pending.playerId, pending.sourceItemId, getActivePlayer(state)?.id)
      : nextState;
  }

  let nextState: GameState = { ...state, pendingWheel: null, turnStage: pending.resumeStage };
  nextState = applyWheelOutcome(nextState, player, pending.wheelId, pending.result.id, pending.result.amount ?? 0);
  // The item's user is still the active player: its wheel always resolves within their turn.
  if (pending.sourceItemId) {
    nextState = itemCopyForPassive(nextState, pending.playerId, pending.sourceItemId, getActivePlayer(state)?.id);
  }
  if (nextState.pendingDiscard) return nextState;
  // A wheel that moved its player onto a blue tile has opened its shop in place of the stage it came from.
  return settleBoard(nextState, nextState.turnStage);
}

function cancelWheel(state: GameState): GameState {
  const pending = state.pendingWheel;
  const player = findPlayer(state, pending?.playerId);
  const eraser = player?.inventory.find((entry) => entry.kind === "item" && entry.itemId === "eraser");
  if (!pending || !player || !eraser) return state;

  let nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, eraser.id));
  nextState = { ...nextState, pendingWheel: null, turnStage: pending.resumeStage };
  nextState = addLog(nextState, `${player.name} utilise la Gomme et annule l’effet.`, "good");
  return settleBoard(nextState, pending.resumeStage);
}

function challengePlayer(state: GameState, targetPlayerId: PlayerId): GameState {
  const pending = state.pendingChallenge;
  const target = findPlayer(state, targetPlayerId);
  if (!pending || !target || pending.playerId === targetPlayerId) return state;

  let nextState = updatePlayer(state, targetPlayerId, placeInHell);
  nextState = { ...nextState, pendingChallenge: null };
  nextState = addLog(nextState, `${target.name} est appelé en Enfer pour un duel.`, "event");
  return startDuel(nextState, pending.playerId, targetPlayerId, pending.resumeStage);
}

function discardInventoryEntry(state: GameState, entryId: string): GameState {
  const pending = state.pendingDiscard;
  const player = findPlayer(state, pending?.playerId);
  const entry = player?.inventory.find((candidate) => candidate.id === entryId);
  if (!pending || !player || !entry || entry.kind === "red-cup") return state;

  let nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, entryId));
  nextState = { ...nextState, pendingDiscard: null, turnStage: pending.resumeStage };
  nextState = addLog(nextState, `${player.name} abandonne ${ITEM_CATALOG[entry.itemId].name}.`, "bad");

  if (pending.reason === "red-cup" && pending.cupNodeId !== undefined) {
    nextState = finishCupCollection(nextState, player.id, pending.cupNodeId);
  } else if (pending.reason === "forced-item" && pending.itemId) {
    const copiedItem = pending.itemId;
    nextState = updatePlayer(nextState, player.id, (current) => appendItem(current, copiedItem));
    nextState = addLog(nextState, `${player.name} reçoit ${ITEM_CATALOG[copiedItem].name} grâce à Je note.`, "event");
  } else if (pending.reason === "loot" && pending.itemId) {
    const lootItem = pending.itemId;
    nextState = updatePlayer(nextState, player.id, (current) => appendItem(current, lootItem));
    nextState = addLog(
      nextState,
      `${player.name} reprend ${ITEM_CATALOG[lootItem].name} dans le butin du fantôme.`,
      "good",
    );
  }

  const waitsForDecision = ["reposition", "passive-choice"].includes(nextState.turnStage);
  if (nextState.phase !== "playing" || waitsForDecision) return nextState;
  return settleBoard(nextState, nextState.turnStage);
}

function repositionBeforeCup(state: GameState, destination: NodeId): GameState {
  const playerId = state.pendingCupRepositionPlayerId;
  const player = findPlayer(state, playerId);
  if (
    !playerId ||
    !player ||
    state.pendingCupRevealNodeId === null ||
    !getBoard(state).normalNodeIds.includes(destination)
  ) {
    return state;
  }

  // Repositioning is not an arrival: it earns neither the wheel nor the shop of the new tile.
  // A wheel already owed on the tile left behind is dropped when the board settles.
  const moved = destination !== player.position;
  const resumeStage = state.pendingCupRepositionResumeStage ?? "turn-end";
  const shopLeftBehind = moved && getActivePlayer(state)?.id === playerId && resumeStage === "shop";
  let nextState = updatePlayer(state, playerId, (current) => ({ ...current, position: destination }));
  nextState = {
    ...nextState,
    redCupNodeId: state.pendingCupRevealNodeId,
    pendingCupRepositionPlayerId: null,
    pendingCupRevealNodeId: null,
    pendingCupRepositionResumeStage: null,
    pendingCupCollectorId: null,
  };
  nextState = {
    ...nextState,
    turnStage: normalizeResumeStage(nextState, shopLeftBehind ? "turn-end" : resumeStage),
  };
  nextState = addLog(nextState, `${player.name} se repositionne avant l’apparition de la Cup.`, "event");
  if (state.pendingCupCollectorId) nextState = addCupCycleEffects(nextState, state.pendingCupCollectorId);
  if (nextState.turnStage === "passive-choice") return nextState;
  return settleBoard(nextState, nextState.turnStage);
}

function resolveCalmDown(state: GameState, useEffect: boolean): GameState {
  const pending = state.pendingCalmDown;
  const holder = findPlayer(state, pending?.passivePlayerId);
  const collector = findPlayer(state, pending?.collectorId);
  if (!pending || !holder || !collector) return state;

  let nextState: GameState = { ...state, pendingCalmDown: null };
  if (useEffect) {
    nextState = updatePlayer(nextState, collector.id, (player) => ({ ...player, position: pending.retreatNodeId }));
    nextState = queueTileWheel(nextState, collector.id);
    nextState = addLog(
      nextState,
      `${holder.name} active Calme-toi : ${collector.name} recule de trois cases.`,
      "event",
    );
  } else {
    nextState = addLog(nextState, `${holder.name} laisse passer Calme-toi.`);
  }
  return settleBoard(nextState, pending.resumeStage);
}

/**
 * Remembers, for every player an action moved, the tile they stood on before:
 * after a walk, a pull, a swap or a teleport alike (« Retourne d’où tu viens »).
 */
function recordPreviousTiles(before: GameState, after: GameState): GameState {
  let moved = false;
  const players = after.players.map((player) => {
    const previous = findPlayer(before, player.id);
    if (!previous || previous.position === player.position) return player;
    moved = true;
    return { ...player, previousNodeId: previous.position };
  });
  return moved ? { ...after, players } : after;
}

/** Runs one action; the Luna Park ghost first spares whoever stands in Hell before it. */
function applyGameAction(state: GameState, action: GameAction): GameState {
  const prepared = spareHellPlayers(state);
  const result = dispatchGameAction(prepared, action);
  // A refused action must hand back the very same object, even if the ghost's memory was touched.
  return result === prepared ? state : recordPreviousTiles(prepared, result);
}

function dispatchGameAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "startGame":
      return startGame(state, action.playerNames, action.seed, action.avatarColors, action.mapId);
    case "resetGame":
      return EMPTY_GAME_STATE;
    case "movePlayer":
      return movePlayer(state, action.destination, action.ignoreArrows);
    case "prepareBoot":
      return prepareBoot(state, action.entryId);
    case "buyItem":
      return buyItem(state, action.itemId);
    case "useItem":
      return useItem(state, action.entryId, action.targetPlayerId, action.count);
    case "resolveReaction":
      return resolveReaction(state, action.reactorId);
    case "endTurn":
      return endTurn(state);
    case "spinHellWheel":
      return spinHellWheel(state);
    case "spinTileWheel":
      return spinTileWheel(state);
    case "spinBlessingWheel":
      return spinBlessingWheel(state);
    case "abandonGame":
      return abandonPlayer(state, action.playerId);
    case "spinWheel":
      return startWheel(state, action.wheelId, action.playerId, action.resumeStage, {
        sourceItemId: action.sourceItemId,
      });
    case "resolveWheel":
      return resolveWheel(state);
    case "cancelWheel":
      return cancelWheel(state);
    case "challengePlayer":
      return challengePlayer(state, action.targetPlayerId);
    case "flipDuelCoin":
      return flipDuelCoin(state);
    case "pickDuelHand":
      return pickDuelHand(state, action.playerId, action.choice);
    case "castDuelVote":
      return castDuelVote(state, action.voterId, action.candidateId);
    case "resolveDuel":
      return resolveDuel(state, action.winnerId);
    case "startBasketRound":
      return startBasketRound(state, action.playerId);
    case "submitBasketScore":
      return submitBasketScore(state, action.playerId, action.score);
    case "discardInventoryEntry":
      return discardInventoryEntry(state, action.entryId);
    case "repositionBeforeCup":
      return repositionBeforeCup(state, action.destination);
    case "advanceOneTile":
      return advanceOneTile(state, action.destination);
    case "resolveCalmDown":
      return resolveCalmDown(state, action.useEffect);
  }
}

/**
 * Applies one action. A refused action returns the very same state object,
 * which callers use to tell "nothing happened" apart from a change.
 * An online game draws from its stored seed, so the result is identical on
 * every device.
 */
export function reduceGame(state: GameState, action: GameAction): GameState {
  const { seededRandom } = state;
  if (!seededRandom || action.type === "startGame" || action.type === "resetGame") {
    return applyGameAction(state, action);
  }
  const { result, seed } = runWithSeededSource(seededRandom, () => applyGameAction(state, action));
  return result === state ? state : { ...result, seededRandom: seed };
}
