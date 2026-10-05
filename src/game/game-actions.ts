import { hasCard } from "./cards";
import { abandonPlayer, canAbandon } from "./abandon";
import { isTableBroke, spinBlessingWheel, startBlessingRound } from "./blessing";
import { earnsStartBonus, getBoard, isIce } from "./board";
import { createGhost, spareHellPlayers } from "./ghost";
import { carryOffIce, drawSlide, pickBlizzardTile, recordSlide, slideOffIce, slideOnArrival } from "./ice";
import { getBoardMap } from "./maps/map-registry";
import { FREE_ITEM_POOL, ITEM_CATALOG } from "./catalog";
import { chooseDuelMode } from "./duel-choice";
import { castDuelVote, flipDuelCoin, pickDuelHand, resolveDuel, startBasketRound, submitBasketScore } from "./duel";
import { createEngineId, drawEngineRandom, runWithSeededSource } from "./engine-random";
import { announceDevil, leaveHell, rewardDevilInHell } from "./devil";
import { submitArmTaps } from "./arm-wrestle";
import { blackjackHit, blackjackStand } from "./blackjack";
import {
  closeDraft,
  createDraft,
  DRAFT_TIME_MS,
  dealOffers,
  getDraftPool,
  HARMFUL_PASSIFS,
  pickPassive,
} from "./draft";
import { offerGamble, resolveGamble } from "./gamble";
import { rewardHellRegulars } from "./hell-regular";
import { kickPlayer } from "./kick";
import { joinLatePlayer } from "./late-join";
import { pauseGame, resumeGame } from "./pause";
import { buyItem, isOnShelf, sellItem } from "./shopping";
import { assignGuardian, rescueProtege } from "./guardian";
import { canBeChallenged, getStartingCurrency, getTheftPenalty, getTheftRisk, isDoomed } from "./passive-rules";
import { checkVictories } from "./victory";
import { getDefaultAction } from "./clock-defaults";
import {
  addIdleStrike,
  getClockDeadline,
  getIdleStrikes,
  IDLE_STRIKES_TO_FORFEIT,
  isActiveDecision,
  updateClocks,
} from "./turn-clock";
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
  dropTileWheels,
  finishCupCollection,
  getCalmDownTiles,
  getWheelArrivalStage,
  itemCopyForPassive,
  normalizeResumeStage,
  resumeAfterBulletReaction,
  sendPlayerToHell,
  settleBoard,
  stealFromKnockedOut,
  startDuel,
  startWheel,
  validTileWheels,
  skipBenchedTurns,
} from "./game-effects";
import { canAddItem, canStartNewSlot, canUseNoThanks, getForwardTiles, getPriceFor, getTileWheelFor } from "./rules";
import {
  addBagLog,
  addLog,
  appendItem,
  applyCurrencyChange,
  findPlayer,
  getActivePlayer,
  getEntryUnits,
  getItemEntry,
  makeLog,
  placeInHell,
  randomChoice,
  removeInventoryEntry,
  spendItemEntry,
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
  spendNoThanks,
} from "./turn-actions";
import type {
  DuelMode,
  GameState,
  ItemId,
  MapId,
  NodeId,
  PassiveId,
  PendingWheel,
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
  GAME_COUNTDOWN_MS,
  HELL_NODE_ID,
  PLAYER_COLORS,
  ROLLER_DIE_FACES,
  START_NODE_ID,
} from "./types";

/**
 * Every change to a game is one serialisable action run through `reduceGame`.
 * The local store applies it directly; an online game sends it to every
 * device, which all reduce it the same way.
 */
export type GameAction =
  /** `draft`: the players pick their passive first (patch 0.1.4); otherwise passives are drawn. */
  | {
      type: "startGame";
      playerNames: string[];
      seed?: number;
      avatarColors?: PlayerColor[];
      mapId?: MapId;
      draft?: boolean;
    }
  /** The passive draft: a player's pick, which may change until the draft closes. */
  | { type: "pickPassive"; playerId: PlayerId; passiveId: PassiveId }
  | { type: "resetGame" }
  | { type: "movePlayer"; destination: NodeId; ignoreArrows: boolean }
  | { type: "prepareBoot"; entryId: string }
  /** Roller: throws the die that sets the length of the move. */
  | { type: "rollDice" }
  /** Le diable walks out of Hell, whenever they please. */
  | { type: "leaveHell" }
  /** L'Ange-Gardien gives up two turns to pull their protégé out of Hell. */
  | { type: "rescueProtege" }
  /** `count`: copies bought in one go, one by default. */
  | { type: "buyItem"; itemId: ItemId; count?: number }
  /** Brocanteur: sells one item of the bag back to the shop. */
  | { type: "sellItem"; entryId: string }
  /** Voleur: one attempt per visit to the shop. */
  | { type: "stealItem"; itemId: ItemId }
  /** `count`: Tomates thrown in one go from their stack; one for every other item. */
  | { type: "useItem"; entryId: string; targetPlayerId?: PlayerId; count?: number }
  | { type: "resolveReaction"; reactorId: PlayerId | null }
  | { type: "endTurn" }
  | { type: "spinHellWheel" }
  | { type: "spinTileWheel" }
  | { type: "spinBlessingWheel" }
  | { type: "abandonGame"; playerId: PlayerId }
  /** Online: somebody sat down after the kickoff, while the first round is not over. */
  | { type: "joinLatePlayer"; playerId: PlayerId; name: string; color: PlayerColor }
  /** Online: the host sends a player away, at the lobby's table or in the game. */
  | { type: "kickPlayer"; hostId: PlayerId; playerId: PlayerId }
  | { type: "spinWheel"; wheelId: WheelId; playerId: PlayerId; resumeStage: TurnStage; sourceItemId?: ItemId }
  | { type: "resolveWheel" }
  /** With the Gomme, or with a ready Non merci when `withNoThanks` is set. */
  | { type: "cancelWheel"; withNoThanks?: boolean }
  | { type: "challengePlayer"; targetPlayerId: PlayerId }
  | { type: "flipDuelCoin" }
  /** Meneur de jeu: the mini-game picked among the two drawn. */
  | { type: "chooseDuelMode"; mode: DuelMode }
  | { type: "pickDuelHand"; playerId: PlayerId; choice: RpsChoice }
  | { type: "castDuelVote"; voterId: PlayerId; candidateId: PlayerId }
  | { type: "resolveDuel"; winnerId: PlayerId }
  | { type: "startBasketRound"; playerId: PlayerId }
  | { type: "submitBasketScore"; playerId: PlayerId; score: number }
  | { type: "discardInventoryEntry"; entryId: string }
  /** New Cup, New Me: off to the start for the start bonus, or stay. */
  | { type: "resolveNewCup"; goToStart: boolean }
  | { type: "advanceOneTile"; destination: NodeId }
  /** Calme-toi: the tile the player is set down on, or null to let them be. */
  | { type: "resolveCalmDown"; destination: NodeId | null }
  /** Double or nothing: stake the gain or loss on offer, or keep it. */
  | { type: "resolveGamble"; accept: boolean }
  /** Online: the clock that counts ran out; any seated device may close it. */
  | { type: "expireClock" }
  /** Blackjack duel: the duellist whose turn it is draws a card, or keeps their hand. */
  | { type: "blackjackHit"; playerId: PlayerId }
  | { type: "blackjackStand"; playerId: PlayerId }
  /** Arm wrestle: one side's taps once their ten seconds are over. */
  | { type: "submitArmTaps"; playerId: PlayerId; taps: number }
  /** Online: the host stops every clock and every action, then lets the table play on. */
  | { type: "pauseGame"; playerId: PlayerId }
  | { type: "resumeGame"; playerId: PlayerId };

/** What an action is played with besides the board: online, the server time it was sent at. */
export interface ReduceContext {
  now?: number;
}

export type GameActionType = GameAction["type"];

const MAX_PLAYERS = 8;

/** Online players pick their avatar in the lobby; a local table takes the palette in seat order. */
function createPlayers(playerNames: string[], avatarColors: PlayerColor[] | undefined): Player[] {
  const names = playerNames.slice(0, MAX_PLAYERS).map((name, index) => name.trim() || `Joueur ${index + 1}`);
  // One actif and one passif each, drawn at random; L'Ange-Gardien only joins a table of four or more.
  const ids = names.map((_, index) => getSeatPlayerId(index));
  const actifs = dealOffers(ids, getDraftPool("actif", names.length), 1);
  const passifs = dealOffers(ids, getDraftPool("passif", names.length), 1, (playerId) =>
    actifs[playerId][0] === "guardian-angel" ? HARMFUL_PASSIFS : [],
  );
  return names.map((name, index) => ({
    id: ids[index],
    name,
    color: avatarColors?.[index] ?? PLAYER_COLORS[index],
    position: START_NODE_ID,
    currency: getStartingCurrency(actifs[ids[index]][0], passifs[ids[index]][0]),
    inventory: [],
    passiveId: actifs[ids[index]][0],
    passifId: passifs[ids[index]][0],
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
  draft: { now: number | undefined } | null,
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
      startingPlayerCount: players.length,
      energyLeft: getEnergyCapacity(players[0]),
      redCupNodeId: map.initialCupNodeId,
      log: [
        makeLog(
          `La partie commence sur ${map.name}. La première Red Cup est en case ${map.initialCupNodeId}.`,
          "event",
        ),
      ],
    };
    // A draft deals the passive cards first; without one, both roles are public at once: le diable
    // is announced, L'Ange-Gardien's protégé drawn and named.
    const withRoles = draft
      ? {
          ...opening,
          phase: "draft" as const,
          draft: createDraft(players, draft.now === undefined ? null : draft.now + DRAFT_TIME_MS),
        }
      : announceDevil(assignGuardian(opening));
    // Banquise opens with its third ice tile already laid; blizzards move it later on.
    const withIce =
      map.blizzardEveryRounds === undefined
        ? withRoles
        : // The whole table stands on the start at first: the first ice falls elsewhere.
          { ...withRoles, iceTileNodeId: pickBlizzardTile(withRoles, [START_NODE_ID]) };
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
    return addBagLog(
      nextState,
      player.id,
      `${player.name} reçoit ${FREE_TOMATOES} Tomates gratuitement.`,
      `${player.name} reçoit un objet gratuitement.`,
      "good",
    );
  }

  const wanted = freeItem === "tomato" ? FREE_TOMATOES : 1;
  let nextState = state;
  let given = 0;
  while (given < wanted && canAddItem(findPlayer(nextState, player.id) ?? player, freeItem)) {
    nextState = updatePlayer(nextState, player.id, (current) => appendItem(current, freeItem));
    given += 1;
  }
  const gift = freeItem === "tomato" && given > 1 ? `${given} Tomates` : ITEM_CATALOG[freeItem].name;
  return addBagLog(
    nextState,
    player.id,
    `${player.name} reçoit ${gift} gratuitement.`,
    `${player.name} reçoit un objet gratuitement.`,
    "good",
  );
}

export { getForwardTiles };

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
      // A stack of Tomates goes as a whole: it is one item.
      const nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, entry.id));
      const units = getEntryUnits(entry);
      const lost = units > 1 ? `sa pile de ${units} ${ITEM_CATALOG[entry.itemId].name}s` : "un objet";
      return addLog(nextState, `${player.name} perd ${lost}.`, "bad");
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
      const paid = addStartBonus(
        addLog(freed, `${player.name} sort de l’Enfer et revient en case 0.`, "good"),
        player.id,
      );
      // A start frozen by the blizzard carries them on.
      return carryOffIce(paid, player.id, HELL_NODE_ID);
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
      return arriveAfterSlide(nextState, player.id, player.position);
    }
    case "go-back": {
      const back = player.previousNodeId;
      // Hell is never somewhere to go back to, and a bad wheel does not let a player out of it.
      if (player.position === HELL_NODE_ID || back === null || back === HELL_NODE_ID || back === player.position) {
        return addLog(state, `${player.name} n’a nulle part où retourner.`);
      }
      let nextState = updatePlayer(state, player.id, (current) => ({ ...current, position: back }));
      nextState = addLog(nextState, `${player.name} retourne en case ${back}.`, "bad");
      return arriveAfterSlide(nextState, player.id, player.position, state.turnStage);
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
 * « Va au Départ », « Retourne d’où tu viens »: the wheel set the player down
 * on a tile, coming from `cameFrom`. At Banquise, ice there slides them on
 * first, and they arrive where the slide stops. The active player whose turn
 * was over then shops on a blue tile, when `resumeStage` asks for the stage
 * to follow.
 */
function arriveAfterSlide(state: GameState, playerId: PlayerId, cameFrom: NodeId, resumeStage?: TurnStage): GameState {
  const slid = slideOnArrival(state, playerId, cameFrom);
  const staged = resumeStage ? { ...slid, turnStage: getWheelArrivalStage(slid, playerId, resumeStage) } : slid;
  return arriveOnTile(staged, playerId);
}

/**
 * Wheel of fortune, « Avance d’une case »: a one-tile walk, arrows obeyed.
 * The tile walked onto counts for Red light, Green light and the start bonus,
 * and is reached like the end of any walk: its wheel, its shop, its mud and
 * its Red Cup. At Banquise a step onto ice slides on, like any walk (see
 * `drawSlide`): the tile the slide stops on is the one reached.
 */
function advanceOneTile(state: GameState, destination: NodeId): GameState {
  const pending = state.pendingAdvance;
  const player = findPlayer(state, pending?.playerId);
  if (!pending || !player || state.turnStage !== "advance") return state;
  if (!getForwardTiles(state, player).includes(destination)) return state;

  const board = getBoard(state);
  const slide = isIce(board, destination) ? drawSlide(state, player.position, [destination]) : null;
  const path = slide ? [destination, ...slide.slide] : [destination];
  const end = path[path.length - 1];
  // Caught by falling ice halfway: nothing is reached, the shop included, until the player's next turn.
  const heldTo = slide?.interruptedTo ?? null;

  let nextState = updatePlayer(state, player.id, (current) => ({ ...current, position: end }));
  // Like a walk, the ice ends the turn of the active player it caught.
  const heldStage =
    getActivePlayer(state)?.id === player.id && pending.resumeStage === "move" ? "turn-end" : pending.resumeStage;
  const resumeStage = heldTo === null ? getWheelArrivalStage(nextState, player.id, pending.resumeStage) : heldStage;
  nextState = { ...nextState, pendingAdvance: null, turnStage: resumeStage };
  const slid = slide !== null && (slide.slide.length > 0 || heldTo !== null);
  nextState = {
    ...nextState,
    lastMovement: {
      seq: (state.lastMovement?.seq ?? 0) + 1,
      playerId: player.id,
      from: player.position,
      path,
      ...(slid ? { slideStart: 1 } : {}),
      ...(heldTo === null ? {} : { interruptedTo: heldTo }),
    },
  };
  nextState = addLog(nextState, `${player.name} avance en case ${destination}.`, "good");
  if (slide) nextState = recordSlide(nextState, player.id, slide, end);
  nextState = addRedGreenBonuses(nextState, player.id, path);
  if (earnsStartBonus(board, player.position, path) && !isDoomed(state, player)) {
    nextState = addStartBonus(nextState, player.id);
  }
  if (heldTo !== null) return settleBoard(nextState, resumeStage);
  nextState = stealFromKnockedOut(nextState, player.id);
  nextState = arriveOnTile(nextState, player.id, path[path.length - 2] ?? player.position);

  const waitsForDecision = ["discard", "reposition", "passive-choice"].includes(nextState.turnStage);
  if (nextState.phase !== "playing" || waitsForDecision) return nextState;
  return settleBoard(nextState, resumeStage);
}

/** Non merci no longer cancels a move (patch 0.1.4): the walk applies at once. */
function movePlayer(state: GameState, destination: NodeId, ignoreArrows: boolean): GameState {
  const plan = planMove(state, destination, ignoreArrows);
  return plan ? applyMove(state, destination, plan) : state;
}

/** One Botte per turn: it costs a point and keeps another for the two-tile move. The Roller has its die. */
function prepareBoot(state: GameState, entryId: string): GameState {
  const player = getActivePlayer(state);
  if (!player || state.turnStage !== "move" || state.moveDistance !== 1 || hasCard(player, "roller")) {
    return state;
  }
  if (getItemEntry(player, entryId) !== "boot" || !canAffordItem(state, "boot")) return state;

  let nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, entryId));
  nextState = { ...spendEnergy(nextState, getItemEnergyCost("boot")), moveDistance: 2 };
  return addLog(nextState, `${player.name} prépare la Botte pour un déplacement de deux cases.`, "event");
}

/** Le diable out of Hell: the ghost may be waiting on the start. A refused exit changes nothing. */
function leaveHellAndSettle(state: GameState): GameState {
  const left = leaveHell(state);
  return left === state ? state : settleBoard(left, "move");
}

/**
 * Roller: the die is thrown before the move, which then covers exactly that
 * many tiles (or as many as the roads allow). No item after it.
 */
function rollDice(state: GameState): GameState {
  const player = getActivePlayer(state);
  if (!player || !hasCard(player, "roller") || state.turnStage !== "move" || state.diceRoll !== null) return state;
  if (!canAffordMove(state)) return state;
  const diceRoll = 1 + Math.floor(drawEngineRandom() * ROLLER_DIE_FACES);
  return addLog({ ...state, diceRoll }, `${player.name} lance le dé : ${diceRoll}.`, "event");
}

/**
 * Voleur: one attempt per visit to the shop, with 1 % of risk for every 10
 * coins of the price. Away with it, the item is free; caught, the thief goes
 * to Hell, which ends the turn, and pays 1.5 times the price.
 */
function stealItem(state: GameState, itemId: ItemId): GameState {
  const player = getActivePlayer(state);
  if (!player || !hasCard(player, "thief") || state.theftAttempted || !isOnShelf(state, player, itemId)) {
    return state;
  }

  const price = getPriceFor(state, itemId, player);
  const itemName = ITEM_CATALOG[itemId].name;
  let nextState: GameState = { ...state, theftAttempted: true };
  if (drawEngineRandom() >= getTheftRisk(price)) {
    nextState = updatePlayer(nextState, player.id, (current) => appendItem(current, itemId));
    return addBagLog(
      nextState,
      player.id,
      `${player.name} vole ${itemName} sans se faire prendre !`,
      `${player.name} vole un objet sans se faire prendre !`,
      "good",
    );
  }

  nextState = addBagLog(
    nextState,
    player.id,
    `${player.name} se fait prendre en volant ${itemName} !`,
    `${player.name} se fait prendre en volant un objet !`,
    "bad",
  );
  nextState = payTheftPenalty(nextState, player.id, getTheftPenalty(price));
  nextState = sendPlayerToHell(nextState, player.id);
  return settleBoard({ ...nextState, turnStage: "turn-end" }, "turn-end");
}

/**
 * Voleur caught: their items go first, the dearest first, until their worth
 * covers the penalty (nothing is given back for an item worth more); coins
 * pay whatever is left.
 */
function payTheftPenalty(state: GameState, playerId: PlayerId, penalty: number): GameState {
  const player = findPlayer(state, playerId);
  if (!player) return state;

  const worthOf = (entry: Player["inventory"][number]) =>
    entry.kind === "item" ? getPriceFor(state, entry.itemId, player) * (entry.count ?? 1) : 0;
  const items = player.inventory
    .filter((entry) => entry.kind === "item")
    .sort((left, right) => worthOf(right) - worthOf(left));

  let nextState = state;
  let owed = penalty;
  for (const entry of items) {
    if (owed <= 0 || entry.kind !== "item") break;
    owed -= worthOf(entry);
    nextState = updatePlayer(nextState, playerId, (current) => removeInventoryEntry(current, entry.id));
    nextState = addBagLog(
      nextState,
      playerId,
      `${player.name} rend ${ITEM_CATALOG[entry.itemId].name}.`,
      `${player.name} rend un objet.`,
      "bad",
    );
  }
  return owed > 0 ? applyCurrencyChange(nextState, playerId, -owed, { gamble: false }) : nextState;
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
  if (reactorId !== null && !pending.reactorIds.includes(reactorId)) return state;
  if (pending.action.type === "bullet-bill") return resolveBulletReaction(state, pending.action.victimId, reactorId);
  if (reactorId === null) return carryOutDeclaredAction(state, pending);
  return cancelDeclaredAction(state, pending, reactorId);
}

/**
 * Bullet Bill's victim answered as a new round was starting: with Non merci,
 * or their angel's Bouclier, it fizzles out; otherwise it hits. Either way the
 * turn change then goes on.
 */
function resolveBulletReaction(state: GameState, victimId: PlayerId, reactorId: PlayerId | null): GameState {
  if (reactorId === null) return resumeAfterBulletReaction(state, false);
  const reactor = findPlayer(state, reactorId);
  const victim = findPlayer(state, victimId);
  if (reactorId !== victimId) {
    // L'Ange-Gardien raises their Bouclier, which is then spent.
    const shield = reactor?.inventory.find((entry) => entry.kind === "item" && entry.itemId === "shield");
    let shielded = updatePlayer(state, reactorId, (player) => spendItemEntry(player, shield?.id ?? ""));
    shielded = addLog(
      shielded,
      `${reactor?.name ?? "L’Ange-Gardien"} lève son Bouclier : Bullet Bill épargne ${victim?.name ?? "son protégé"}.`,
      "event",
    );
    return resumeAfterBulletReaction(shielded, true);
  }
  // Spent in the round that is starting.
  let nextState = spendNoThanks(state, victimId, state.round + 1);
  nextState = addLog(nextState, `${victim?.name ?? "Un joueur"} utilise Non merci contre Bullet Bill.`, "event");
  return resumeAfterBulletReaction(nextState, true);
}

function endTurn(state: GameState): GameState {
  if (!canEndTurn(state)) return state;
  const player = getActivePlayer(state);
  return endTurnNow(player ? addLog(state, `${player.name} termine son tour.`, "event") : state);
}

/** The turn is over, whatever is left of it; a broke table first goes through its Tour de Bénédiction. */
function endTurnNow(state: GameState): GameState {
  const ended: GameState = { ...state, turnStage: "turn-end" };
  return isTableBroke(ended) ? startBlessingRound(ended) : beginNextTurn(ended);
}

/** Defaults played in a row when a clock runs out, at most: a turn never has this many decisions left. */
const MAX_DEFAULT_STEPS = 24;

/**
 * Online: the clock that counts ran out. The active player's turn ends, their
 * own decisions still open taking their default; a turn run out without
 * anything done costs them a chance. Somebody else's decision takes its
 * default, every vote or hand still missing included.
 */
function expireClock(state: GameState, now: number | undefined): GameState {
  const deadline = getClockDeadline(state);
  if (now === undefined || deadline === null || now < deadline) return state;
  // The draft's minute is over: whoever has not picked gets a card at random.
  if (state.phase === "draft") return closeDraft(state, now);
  if (isActiveDecision(state)) return expireTurn(state);

  const stage = state.turnStage;
  let nextState = addLog(state, "Temps écoulé : le choix par défaut s’applique.", "event");
  for (let step = 0; step < MAX_DEFAULT_STEPS; step += 1) {
    const action = getDefaultAction(nextState);
    const after = action ? dispatchGameAction(nextState, action) : nextState;
    if (after === nextState) break;
    nextState = after;
    if (nextState.turnStage !== stage || isActiveDecision(nextState)) break;
  }
  return nextState;
}

function expireTurn(state: GameState): GameState {
  const player = getActivePlayer(state);
  if (!player) return state;
  let nextState = addLog(state, `Temps écoulé pour ${player.name}.`, "bad");
  if (!state.turnActionTaken) {
    nextState = addIdleStrike(nextState, player.id);
    const strikes = getIdleStrikes(nextState, player.id);
    nextState = addLog(nextState, `${player.name} perd une chance (${strikes}/${IDLE_STRIKES_TO_FORFEIT}).`, "bad");
  }
  for (let step = 0; step < MAX_DEFAULT_STEPS; step += 1) {
    const stillTheirs =
      nextState.phase === "playing" && getActivePlayer(nextState)?.id === player.id && isActiveDecision(nextState);
    if (!stillTheirs) break;
    if (["move", "hell", "shop", "turn-end"].includes(nextState.turnStage)) return endTurnNow(nextState);
    const action = getDefaultAction(nextState);
    const after = action ? dispatchGameAction(nextState, action) : nextState;
    if (after === nextState) break;
    nextState = after;
  }
  return nextState;
}

/** Online: three turns run out without doing anything are a forfeit, as soon as the table is at rest. */
function applyForfeits(state: GameState): GameState {
  let nextState = state;
  for (const player of state.players) {
    if (getIdleStrikes(nextState, player.id) < IDLE_STRIKES_TO_FORFEIT || !canAbandon(nextState)) continue;
    nextState = abandonPlayer(nextState, player.id, "forfeit");
  }
  return nextState;
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
  const spinner = findPlayer(state, next?.playerId);
  const wheelId = next && spinner ? getTileWheelFor(state, spinner, next.nodeId) : null;
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
      repeats: pending.repeats,
    });
  }

  // L'Ange-Gardien and Chance aveugle cannot be dragged into Hell: with nobody else to call, the duel is off.
  const opponents = state.players.filter((candidate) => canBeChallenged(pending.playerId, candidate));
  if (pending.result.id === "challenge" && opponents.length === 0) {
    const nextState = addLog({ ...state, pendingWheel: null, turnStage: pending.resumeStage }, "Personne à défier.");
    return settleBoard(nextState, pending.resumeStage);
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
  const userId = getActivePlayer(state)?.id;
  if (pending.sourceItemId === "ndoye") nextState = refundGreedyNdoye(nextState, player, userId);
  if (pending.sourceItemId) {
    nextState = itemCopyForPassive(nextState, pending.playerId, pending.sourceItemId, userId);
  }
  if (nextState.pendingDiscard) return nextState;
  // A wheel that moved its player onto a blue tile has opened its shop in place of the stage it came from.
  return settleThenSpinAgain(nextState, pending);
}

/**
 * Settles the board, then spins again for Touché angélique and Main du
 * diable if the result left the table where it was. A result that opens
 * another decision (a step forward, a duel, a shop) loses the second spin.
 */
function settleThenSpinAgain(state: GameState, pending: PendingWheel): GameState {
  const settled = settleBoard(state, state.turnStage);
  const undecided =
    settled.pendingAdvance ||
    settled.pendingDiscard ||
    settled.pendingDuel ||
    settled.pendingChallenge ||
    settled.pendingCalmDown ||
    settled.pendingReaction ||
    settled.pendingArmWrestle ||
    settled.pendingCupRepositionPlayerId ||
    settled.pendingTileWheels.length > 0 ||
    settled.pendingGambles.length > 0;
  if (settled.turnStage !== state.turnStage || undecided) return settled;
  return spinAgain(settled, pending) ?? settled;
}

/** The wheel still owed after a result was applied or rubbed out, if the player can still spin it. */
function spinAgain(state: GameState, pending: PendingWheel): GameState | null {
  const [wheelId, ...repeats] = pending.repeats ?? [];
  if (!wheelId || state.phase !== "playing" || !findPlayer(state, pending.playerId)) return null;
  return startWheel(state, wheelId, pending.playerId, pending.resumeStage, {
    sourceItemId: pending.sourceItemId,
    origin: "double",
    repeats,
  });
}

/** Cupide: whatever their Ndoye's wheel makes its target lose comes back to them. */
function refundGreedyNdoye(state: GameState, target: Player, userId: PlayerId | undefined): GameState {
  const user = findPlayer(state, userId);
  const lost = target.currency - (findPlayer(state, target.id)?.currency ?? target.currency);
  if (!user || !hasCard(user, "greedy") || user.id === target.id || lost <= 0) return state;
  const nextState = applyCurrencyChange(state, user.id, lost);
  return addLog(nextState, `${user.name} récupère les ${lost} pièces perdues par ${target.name}.`, "good");
}

/**
 * Rubs out the result of a wheel for its player: with the Gomme, or with a
 * ready Non merci, which then recharges (patch 0.1.4).
 */
function cancelWheel(state: GameState, withNoThanks: boolean): GameState {
  const pending = state.pendingWheel;
  const player = findPlayer(state, pending?.playerId);
  if (!pending || !player) return state;

  let nextState: GameState;
  if (withNoThanks) {
    if (!canUseNoThanks(player, state.round)) return state;
    nextState = spendNoThanks(state, player.id, state.round);
    nextState = addLog(nextState, `${player.name} utilise Non merci et annule l’effet de la roue.`, "good");
  } else {
    const eraser = player.inventory.find((entry) => entry.kind === "item" && entry.itemId === "eraser");
    if (!eraser) return state;
    nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, eraser.id));
    nextState = addLog(nextState, `${player.name} utilise la Gomme et annule l’effet.`, "good");
  }
  nextState = { ...nextState, pendingWheel: null, turnStage: pending.resumeStage };
  // Only this result is rubbed out: a second spin of Touché angélique or Main du diable still comes.
  return settleThenSpinAgain(nextState, pending);
}

function challengePlayer(state: GameState, targetPlayerId: PlayerId): GameState {
  const pending = state.pendingChallenge;
  const target = findPlayer(state, targetPlayerId);
  // L'Ange-Gardien never goes to Hell and nothing may harm Chance aveugle: neither is dragged into a duel there.
  if (!pending || !target || !canBeChallenged(pending.playerId, target)) return state;

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
  nextState = addBagLog(
    nextState,
    player.id,
    `${player.name} abandonne ${ITEM_CATALOG[entry.itemId].name}.`,
    `${player.name} abandonne un objet.`,
    "bad",
  );

  if (pending.reason === "red-cup" && pending.cupNodeId !== undefined) {
    nextState = finishCupCollection(nextState, player.id, pending.cupNodeId);
  } else if (pending.reason === "forced-item" && pending.itemId) {
    const copiedItem = pending.itemId;
    nextState = updatePlayer(nextState, player.id, (current) => appendItem(current, copiedItem));
    nextState = addBagLog(
      nextState,
      player.id,
      `${player.name} reçoit ${ITEM_CATALOG[copiedItem].name} grâce à Je note.`,
      `${player.name} reçoit un objet grâce à Je note.`,
      "event",
    );
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

/**
 * New Cup, New Me (patch 0.1.4): before the new Red Cup appears, its holder
 * goes to the start for the start bonus, out of Hell too, or stays. Going
 * there is no arrival: neither wheel nor shop, and a wheel still owed on the
 * tile left behind is dropped when the board settles.
 */
function resolveNewCup(state: GameState, goToStart: boolean): GameState {
  const playerId = state.pendingCupRepositionPlayerId;
  const player = findPlayer(state, playerId);
  if (state.turnStage !== "reposition" || !playerId || !player || state.pendingCupRevealNodeId === null) {
    return state;
  }

  const resumeStage = state.pendingCupRepositionResumeStage ?? "turn-end";
  const shopLeftBehind =
    goToStart && player.position !== START_NODE_ID && getActivePlayer(state)?.id === playerId && resumeStage === "shop";
  let nextState: GameState = state;
  if (goToStart && player.position !== START_NODE_ID) nextState = dropTileWheels(nextState, playerId);
  if (goToStart) {
    nextState = updatePlayer(nextState, playerId, (current) => ({ ...current, position: START_NODE_ID }));
    nextState = addLog(nextState, `${player.name} file au Départ avant l’apparition de la Cup.`, "event");
    nextState = addStartBonus(nextState, playerId);
    // A start frozen by the blizzard carries them on, before Calme-toi looks around the new Cup.
    nextState = carryOffIce(nextState, playerId, player.position);
  } else {
    nextState = addLog(nextState, `${player.name} reste où il est avant l’apparition de la Cup.`);
  }
  nextState = {
    ...nextState,
    redCupNodeId: state.pendingCupRevealNodeId,
    pendingCupRepositionPlayerId: null,
    pendingCupRevealNodeId: null,
    pendingCupRepositionResumeStage: null,
  };
  nextState = {
    ...nextState,
    turnStage: normalizeResumeStage(nextState, shopLeftBehind ? "turn-end" : resumeStage),
  };
  nextState = addCupCycleEffects(nextState);
  if (nextState.turnStage === "passive-choice") return nextState;
  return settleBoard(nextState, nextState.turnStage);
}

/**
 * Calme-toi: the holder sets the first player of the queue down on a tile
 * three steps from the Red Cup, or lets them be. The tile does nothing for
 * them: no wheel, no shop, no mud. The next player of the queue follows.
 */
function resolveCalmDown(state: GameState, destination: NodeId | null): GameState {
  const pending = state.pendingCalmDown;
  const holder = findPlayer(state, pending?.passivePlayerId);
  const target = findPlayer(state, pending?.targetIds[0]);
  if (!pending || !holder || !target) return state;
  if (destination !== null && !getCalmDownTiles(state).includes(destination)) return state;

  let nextState: GameState = state;
  if (destination === null) {
    nextState = addLog(nextState, `${holder.name} laisse ${target.name} où il est.`);
  } else {
    nextState = destination === target.position ? nextState : dropTileWheels(nextState, target.id);
    nextState = updatePlayer(nextState, target.id, (player) => ({ ...player, position: destination }));
    nextState = addLog(
      nextState,
      `${holder.name} active Calme-toi : ${target.name} est replacé en case ${destination}.`,
      "event",
    );
  }

  const [, ...waiting] = pending.targetIds;
  if (waiting.length > 0) return { ...nextState, pendingCalmDown: { ...pending, targetIds: waiting } };
  return settleBoard({ ...nextState, pendingCalmDown: null }, pending.resumeStage);
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

/**
 * Runs one action; the Luna Park ghost first spares whoever stands in Hell
 * before it. Then Cupide may have won, and Double or nothing may stake what
 * the action earned or cost.
 */
function applyGameAction(state: GameState, action: GameAction, now: number | undefined): GameState {
  // The pause only touches the clocks: nothing on the board follows from it.
  if (action.type === "pauseGame" || action.type === "resumeGame") return dispatchGameAction(state, action, now);
  // Nothing is played while the game is paused, but a player may still leave the table.
  if (state.pause && action.type !== "abandonGame" && action.type !== "joinLatePlayer") {
    return state;
  }
  const prepared = spareHellPlayers(state);
  const dispatched = dispatchGameAction(prepared, action, now);
  // A refused action must hand back the very same object, even if the ghost's memory was touched.
  if (dispatched === prepared) return state;
  // Banquise: nobody stays on ice, whatever set them down there.
  const result = slideOffIce(prepared, dispatched);
  // Le diable's own trips to Hell pay them; the turns the others spend there are counted as they begin.
  const counted = rewardHellRegulars(prepared, rewardDevilInHell(prepared, recordPreviousTiles(prepared, result)));
  const forfeited = applyForfeits(counted);
  const settled = offerGamble(checkVictories(skipBenchedTurns(forfeited)));
  // Online, the clocks follow every action, at the time it was sent; the first turn's waits for the
  // countdown that follows the draft.
  if (now === undefined || settled.seededRandom === null) return settled;
  const countdown = prepared.phase === "draft" && settled.phase === "playing" ? GAME_COUNTDOWN_MS : 0;
  // A player leaving during the pause leaves at the time the clocks stopped, so the resume restores them whole.
  return updateClocks(settled, (state.pause ? state.pause.since : now) + countdown);
}

function dispatchGameAction(state: GameState, action: GameAction, now?: number): GameState {
  switch (action.type) {
    case "startGame":
      return startGame(
        state,
        action.playerNames,
        action.seed,
        action.avatarColors,
        action.mapId,
        action.draft ? { now } : null,
      );
    case "pickPassive":
      return pickPassive(state, action.playerId, action.passiveId, now);
    case "resetGame":
      return EMPTY_GAME_STATE;
    case "movePlayer":
      return movePlayer(state, action.destination, action.ignoreArrows);
    case "prepareBoot":
      return prepareBoot(state, action.entryId);
    case "rollDice":
      return rollDice(state);
    case "leaveHell":
      return leaveHellAndSettle(state);
    case "rescueProtege":
      return rescueProtege(state);
    case "buyItem":
      return buyItem(state, action.itemId, action.count);
    case "sellItem":
      return sellItem(state, action.entryId);
    case "stealItem":
      return stealItem(state, action.itemId);
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
    case "kickPlayer":
      return kickPlayer(state, action.hostId, action.playerId);
    case "joinLatePlayer":
      return joinLatePlayer(state, action.playerId, action.name, action.color);
    case "abandonGame":
      return abandonPlayer(state, action.playerId);
    case "spinWheel":
      return startWheel(state, action.wheelId, action.playerId, action.resumeStage, {
        sourceItemId: action.sourceItemId,
      });
    case "resolveWheel":
      return resolveWheel(state);
    case "cancelWheel":
      return cancelWheel(state, action.withNoThanks === true);
    case "challengePlayer":
      return challengePlayer(state, action.targetPlayerId);
    case "chooseDuelMode":
      return chooseDuelMode(state, action.mode);
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
    case "resolveNewCup":
      return resolveNewCup(state, action.goToStart);
    case "advanceOneTile":
      return advanceOneTile(state, action.destination);
    case "resolveCalmDown":
      return resolveCalmDown(state, action.destination);
    case "resolveGamble":
      return resolveGamble(state, action.accept);
    case "expireClock":
      return expireClock(state, now);
    case "blackjackHit":
      return blackjackHit(state, action.playerId);
    case "blackjackStand":
      return blackjackStand(state, action.playerId);
    case "submitArmTaps":
      return submitArmTaps(state, action.playerId, action.taps);
    case "pauseGame":
      return pauseGame(state, action.playerId, now);
    case "resumeGame":
      return resumeGame(state, action.playerId, now);
  }
}

/**
 * Applies one action. A refused action returns the very same state object,
 * which callers use to tell "nothing happened" apart from a change.
 * An online game draws from its stored seed, so the result is identical on
 * every device.
 */
export function reduceGame(state: GameState, action: GameAction, context: ReduceContext = {}): GameState {
  const { seededRandom } = state;
  const { now } = context;
  if (!seededRandom || action.type === "startGame" || action.type === "resetGame") {
    return applyGameAction(state, action, now);
  }
  const { result, seed } = runWithSeededSource(seededRandom, () => applyGameAction(state, action, now));
  return result === state ? state : { ...result, seededRandom: seed };
}
