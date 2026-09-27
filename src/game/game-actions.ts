import { abandonPlayer } from "./abandon";
import { isTableBroke, spinBlessingWheel, startBlessingRound } from "./blessing";
import { NORMAL_NODE_IDS } from "./board";
import { launchBulletBill } from "./bullet-bill";
import { ITEM_CATALOG, ITEM_ORDER, PASSIVE_ORDER } from "./catalog";
import { castDuelVote, flipDuelCoin, pickDuelHand, resolveDuel } from "./duel";
import { runWithSeededSource } from "./engine-random";
import {
  addCupCycleEffects,
  addStartBonus,
  beginNextTurn,
  finishCupCollection,
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
  canUseDelinquent,
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
  shuffle,
  updatePlayer,
} from "./state-utils";
import {
  applyItemUse,
  applyMove,
  cancelDeclaredAction,
  carryOutDeclaredAction,
  openReactionWindow,
  planItemUse,
  planMove,
} from "./turn-actions";
import type {
  GameState,
  ItemId,
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
  HELL_NODE_ID,
  INITIAL_RED_CUP_NODE_ID,
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
  | { type: "startGame"; playerNames: string[]; seed?: number; avatarColors?: PlayerColor[] }
  | { type: "resetGame" }
  | { type: "movePlayer"; destination: NodeId; ignoreArrows: boolean }
  | { type: "prepareBoot"; entryId: string }
  | { type: "buyItem"; itemId: ItemId }
  | { type: "useItem"; entryId: string; targetPlayerId?: PlayerId }
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
  | { type: "discardInventoryEntry"; entryId: string }
  | { type: "repositionBeforeCup"; destination: NodeId }
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
  }));
}

/**
 * Seat ids are the seat numbers (`p1`, `p2`…): an online room maps each seat
 * to its device without any lookup table.
 */
export function getSeatPlayerId(seatIndex: number): PlayerId {
  return `p${seatIndex + 1}`;
}

function startGame(
  state: GameState,
  playerNames: string[],
  seed: number | undefined,
  avatarColors: PlayerColor[] | undefined,
): GameState {
  if (playerNames.length < 2) return state;
  const build = (): GameState => ({
    ...EMPTY_GAME_STATE,
    phase: "playing",
    turnStage: "move",
    players: createPlayers(playerNames, avatarColors),
    redCupNodeId: INITIAL_RED_CUP_NODE_ID,
    log: [makeLog("La partie commence. La première Red Cup est en case 8.", "event")],
  });
  if (seed === undefined) return build();
  const { result, seed: seededRandom } = runWithSeededSource({ rngState: seed >>> 0, nextId: 0 }, build);
  return { ...result, seededRandom };
}

/** Wheel results that hand over to another wheel instead of applying an effect. */
const CHAINED_WHEELS: Partial<Record<WheelOutcomeId, WheelId>> = {
  "spin-fortune": "fortune",
  "spin-misfortune": "misfortune",
};

/** Applies one wheel outcome to its player; chained and interactive outcomes are handled by the caller. */
function applyWheelOutcome(
  state: GameState,
  player: Player,
  wheelId: WheelId,
  outcomeId: string,
  amount: number,
): GameState {
  switch (outcomeId) {
    case "lose-100":
    case "lose-200":
    case "lose-400":
      return applyCurrencyChange(state, player.id, -amount);
    case "gain-100":
    case "gain-200":
    case "gain-300":
    case "gain-400":
    case "gain-500":
      return applyCurrencyChange(state, player.id, amount);
    case "lose-item": {
      const entry = randomChoice(player.inventory.filter((candidate) => candidate.kind === "item"));
      if (!entry) return applyCurrencyChange(state, player.id, -100);
      const nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, entry.id));
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
      if (wheelId === "fortune" && player.position !== HELL_NODE_ID)
        return applyCurrencyChange(state, player.id, amount);
      const freed = updatePlayer(state, player.id, (current) => ({ ...current, position: START_NODE_ID }));
      return addStartBonus(addLog(freed, `${player.name} sort de l’Enfer et revient en case 0.`, "good"), player.id);
    }
    case "free-item": {
      const options = ITEM_ORDER.filter(
        (itemId) => itemId !== "bullet-bill" && ITEM_CATALOG[itemId].price <= 300 && canAddItem(player, itemId),
      );
      const freeItem = randomChoice(options);
      if (!freeItem) return applyCurrencyChange(state, player.id, 200);
      const nextState = updatePlayer(state, player.id, (current) => appendItem(current, freeItem));
      return addLog(nextState, `${player.name} reçoit ${ITEM_CATALOG[freeItem].name} gratuitement.`, "good");
    }
    default:
      return addLog(state, "La roue ne produit aucun effet.");
  }
}

function movePlayer(state: GameState, destination: NodeId, ignoreArrows: boolean): GameState {
  const plan = planMove(state, destination, ignoreArrows);
  if (!plan) return state;
  const waiting = openReactionWindow(state, { type: "move", destination, ignoreArrows });
  return waiting ?? applyMove(state, destination, plan);
}

function prepareBoot(state: GameState, entryId: string): GameState {
  const player = getActivePlayer(state);
  if (!player || state.turnStage !== "move" || state.moveDistance !== 1) return state;
  if (getItemEntry(player, entryId) !== "boot") return state;

  let nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, entryId));
  nextState = { ...nextState, moveDistance: 2 };
  return addLog(nextState, `${player.name} prépare la Botte pour un déplacement de deux cases.`, "event");
}

function buyItem(state: GameState, itemId: ItemId): GameState {
  const player = getActivePlayer(state);
  if (!player || state.turnStage !== "shop" || !isShopNode(player.position)) return state;

  const price = getItemPrice(itemId, state.bootPrice);
  if (player.currency < price) return state;

  if (itemId === "bullet-bill") {
    if (state.bulletBill) return state;
    const nextState = launchBulletBill(applyCurrencyChange(state, player.id, -price));
    return addLog(
      nextState,
      `${player.name} achète Bullet Bill pour ${price} pièces : il attend au départ et fonce au prochain tour.`,
      "event",
    );
  }

  if (!canAddItem(player, itemId)) return state;
  let nextState = applyCurrencyChange(state, player.id, -price);
  nextState = updatePlayer(nextState, player.id, (current) => appendItem(current, itemId));
  if (itemId === "boot" && !state.bootFirstPurchased) {
    nextState = { ...nextState, bootFirstPurchased: true, bootLastPriceRound: state.round };
  }
  return addLog(nextState, `${player.name} achète ${ITEM_CATALOG[itemId].name} pour ${price} pièces.`, "good");
}

function useItem(state: GameState, entryId: string, targetPlayerId: PlayerId | undefined): GameState {
  const plan = planItemUse(state, entryId, targetPlayerId);
  if (!plan) return state;
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
  if (state.phase !== "playing") return state;
  const activePlayer = getActivePlayer(state);
  const noLegalMove =
    state.turnStage === "move" &&
    activePlayer !== undefined &&
    getUniqueLegalDestinations(activePlayer, state.moveDistance, canUseDelinquent(activePlayer, state.round)).length ===
      0;
  if (!["shop", "turn-end"].includes(state.turnStage) && !noLegalMove) return state;
  const ended: GameState = { ...state, turnStage: "turn-end" };
  return isTableBroke(ended) ? startBlessingRound(ended) : beginNextTurn(ended);
}

function spinHellWheel(state: GameState): GameState {
  const player = getActivePlayer(state);
  if (!player || state.turnStage !== "hell" || player.position !== HELL_NODE_ID) return state;
  return startWheel(state, "hell", player.id, "turn-end", { origin: "hell" });
}

function spinTileWheel(current: GameState): GameState {
  if (current.turnStage !== "tile-wheel") return current;
  const state = validTileWheels(current);
  const [next, ...rest] = state.pendingTileWheels;
  const wheelId = next ? getTileWheel(next.nodeId) : null;
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
    return pending.sourceItemId ? itemCopyForPassive(nextState, pending.playerId, pending.sourceItemId) : nextState;
  }

  let nextState: GameState = { ...state, pendingWheel: null, turnStage: pending.resumeStage };
  nextState = applyWheelOutcome(nextState, player, pending.wheelId, pending.result.id, pending.result.amount ?? 0);
  if (pending.sourceItemId) nextState = itemCopyForPassive(nextState, pending.playerId, pending.sourceItemId);
  if (nextState.pendingDiscard) return nextState;
  return settleBoard(nextState, pending.resumeStage);
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
  }

  const waitsForDecision = ["reposition", "passive-choice"].includes(nextState.turnStage);
  if (nextState.phase !== "playing" || waitsForDecision) return nextState;
  return settleBoard(nextState, nextState.turnStage);
}

function repositionBeforeCup(state: GameState, destination: NodeId): GameState {
  const playerId = state.pendingCupRepositionPlayerId;
  const player = findPlayer(state, playerId);
  if (!playerId || !player || state.pendingCupRevealNodeId === null || !NORMAL_NODE_IDS.includes(destination)) {
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

function applyGameAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "startGame":
      return startGame(state, action.playerNames, action.seed, action.avatarColors);
    case "resetGame":
      return EMPTY_GAME_STATE;
    case "movePlayer":
      return movePlayer(state, action.destination, action.ignoreArrows);
    case "prepareBoot":
      return prepareBoot(state, action.entryId);
    case "buyItem":
      return buyItem(state, action.itemId);
    case "useItem":
      return useItem(state, action.entryId, action.targetPlayerId);
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
    case "discardInventoryEntry":
      return discardInventoryEntry(state, action.entryId);
    case "repositionBeforeCup":
      return repositionBeforeCup(state, action.destination);
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
