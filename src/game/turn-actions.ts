import { createEngineId, drawEngineRandom } from "./engine-random";
import { earnsStartBonus, getBoard, getShortestPath, isIce } from "./board";
import { drawSlide } from "./ice";
import { ITEM_CATALOG } from "./catalog";
import {
  addRedGreenBonuses,
  addStartBonus,
  collectCupOrRequestDiscard,
  itemCopyForPassive,
  queueTileWheel,
  queueWheelsForMovedPlayers,
  settleBoard,
  randomNormalNode,
  sendPlayerToHell,
  startWheel,
  triggerMud,
} from "./game-effects";
import { canUseDelinquent, findLegalPath, isShopNode } from "./rules";
import {
  addLog,
  applyCurrencyChange,
  findPlayer,
  getActivePlayer,
  getItemEntry,
  getEntryUnits,
  spendItemEntry,
  placeInHell,
  updatePlayer,
} from "./state-utils";
import type { DeclaredAction, GameState, ItemId, NodeId, PendingReaction, Player, PlayerId, TurnStage } from "./types";
import {
  CANCELLED_ITEM_IS_CONSUMED,
  DELINQUENT_COST,
  HELL_NODE_ID,
  NO_THANKS_COOLDOWN_ROUNDS,
  TOMATO_STUN_CHANCE,
} from "./types";

/**
 * The two actions a player can take on their turn — moving or using an item —
 * split into "plan" (validation, no change) and "apply" (effects), so the
 * Non merci reaction window can sit in between.
 */

export interface MovePlan {
  path: NodeId[];
  /** True when the move goes against an arrow thanks to Délinquant. */
  rebel: boolean;
}

export function planMove(state: GameState, destination: NodeId, ignoreArrows: boolean): MovePlan | null {
  const player = getActivePlayer(state);
  if (state.phase !== "playing" || state.turnStage !== "move" || !player) return null;

  const board = getBoard(state);
  const regularPath = findLegalPath(board, player, destination, state.moveDistance, false);
  if (regularPath) return { path: regularPath, rebel: false };

  // Délinquant only pays when the destination really requires going against an arrow.
  if (!ignoreArrows || !canUseDelinquent(player, state.round)) return null;
  const rebelPath = findLegalPath(board, player, destination, state.moveDistance, true);
  return rebelPath ? { path: rebelPath, rebel: true } : null;
}

function getArrivalStage(state: GameState, nodeId: NodeId): TurnStage {
  return isShopNode(getBoard(state), nodeId) ? "shop" : "turn-end";
}

/**
 * Plays a walk. At Banquise a walk that ends on ice slides on at random
 * (`drawSlide`): the player's final tile is where the slide stops, or, when
 * falling ice caught them, the ice tile they were leaving; they then wait
 * there, halfway down the road, until their next turn.
 */
export function applyMove(state: GameState, walkEnd: NodeId, plan: MovePlan): GameState {
  const player = getActivePlayer(state);
  if (!player) return state;

  let nextState = state;
  if (plan.rebel) {
    nextState = addLog(nextState, `${player.name} ignore les flèches grâce à Délinquant.`, "event");
    nextState = applyCurrencyChange(nextState, player.id, -DELINQUENT_COST);
  }

  const board = getBoard(state);
  const slide = isIce(board, walkEnd) ? drawSlide(state, player.position, plan.path) : null;
  const path = slide ? [...plan.path, ...slide.slide] : plan.path;
  const destination = path[path.length - 1];
  const interruptedTo = slide?.interruptedTo ?? null;

  nextState = updatePlayer(nextState, player.id, (currentPlayer) => ({ ...currentPlayer, position: destination }));
  nextState = addLog(nextState, `${player.name} se déplace en case ${walkEnd}.`);
  if (slide && slide.slide.length > 0) {
    nextState = addLog(nextState, `${player.name} glisse sur la glace jusqu’en case ${destination}.`, "event");
  }
  if (slide?.iceFall) {
    nextState = {
      ...nextState,
      lastIceFall: { seq: (state.lastIceFall?.seq ?? 0) + 1, playerId: player.id, ...slide.iceFall },
    };
    nextState = addLog(
      nextState,
      slide.iceFall.hit
        ? `La glace tombe sur ${player.name}, pris au piège sur la route de la case ${slide.iceFall.to}.`
        : `La glace tombe à côté de ${player.name}, qui file vers la case ${slide.iceFall.to}.`,
      slide.iceFall.hit ? "bad" : "event",
    );
  }
  nextState = addRedGreenBonuses(nextState, player.id, path);
  if (earnsStartBonus(board, player.position, path)) nextState = addStartBonus(nextState, player.id);

  nextState = {
    ...nextState,
    moveDistance: 1,
    turnActionTaken: true,
    turnStage: interruptedTo === null ? getArrivalStage(state, destination) : "turn-end",
    lastMovement: {
      seq: (state.lastMovement?.seq ?? 0) + 1,
      playerId: player.id,
      from: player.position,
      path,
      ...(slide && slide.slide.length + (interruptedTo === null ? 0 : 1) > 0 ? { slideStart: plan.path.length } : {}),
      ...(interruptedTo === null ? {} : { interruptedTo }),
    },
  };

  // Stuck in the ice: nothing is reached yet; the slide ends when the player's next turn comes.
  if (interruptedTo !== null) {
    return {
      ...nextState,
      frozenSlides: [
        ...nextState.frozenSlides.filter((entry) => entry.playerId !== player.id),
        { playerId: player.id, from: destination, to: interruptedTo },
      ],
    };
  }

  // Queued first, spun last: mud and the Red Cup resolve before the tile's wheel.
  nextState = queueTileWheel(nextState, player.id);
  nextState = triggerMud(nextState, player.id, destination);
  if (nextState.redCupNodeId === destination) {
    nextState = collectCupOrRequestDiscard(nextState, player.id, destination);
  }

  const waitsForDecision = ["discard", "reposition", "passive-choice"].includes(nextState.turnStage);
  if (nextState.phase !== "playing" || waitsForDecision) return nextState;
  return settleBoard(nextState, nextState.turnStage);
}

export interface ItemPlan {
  itemId: ItemId;
  target?: Player;
  /** Tomates thrown in one go; one for every other item. */
  count: number;
}

/** Items that are not "used" as an action: they react or trigger on their own. */
const NON_ACTION_ITEMS: ItemId[] = ["eraser", "helmet", "bullet-bill", "boot"];

/**
 * Laid before the turn's action, like the Botte is prepared: the player may
 * still move or use another item afterwards, but lays one mud per turn.
 */
const PREPARATION_ITEMS: ItemId[] = ["mud"];

/** Pulled by the Corde or swapped by the Monopoly Man: moved, but nobody spins a wheel for it. */
const MOVES_WITHOUT_ARRIVAL: ItemId[] = ["rope", "monopoly-man"];

/**
 * Thrown before the turn's action and as often as the stack allows, without
 * using the action up or going through Non merci: the Tomate is only for fun.
 */
const THROWN_ITEMS: ItemId[] = ["tomato"];

function isPreparationItem(itemId: ItemId): boolean {
  return PREPARATION_ITEMS.includes(itemId);
}

export function isThrownItem(itemId: ItemId): boolean {
  return THROWN_ITEMS.includes(itemId);
}

export function planItemUse(
  state: GameState,
  entryId: string,
  targetPlayerId?: PlayerId,
  requestedCount = 1,
): ItemPlan | null {
  const player = getActivePlayer(state);
  if (!player || state.phase !== "playing") return null;

  const inHell = player.position === HELL_NODE_ID;
  if (state.turnStage !== (inHell ? "hell" : "move")) return null;

  const itemId = getItemEntry(player, entryId);
  if (!itemId || NON_ACTION_ITEMS.includes(itemId)) return null;
  if (itemId === "water-bottle" && !inHell) return null;
  // Nobody walks into Hell, so mud placed there could never be stepped on.
  if (itemId === "mud" && (inHell || state.mudPlacedThisTurn)) return null;

  // Only a stack can be thrown several at a time, and never more than it holds.
  const entry = player.inventory.find((candidate) => candidate.id === entryId);
  const count = isThrownItem(itemId) && entry ? requestedCount : 1;
  if (!Number.isInteger(count) || count < 1 || (entry && count > getEntryUnits(entry))) return null;

  const definition = ITEM_CATALOG[itemId];
  if (definition.target !== "player") return { itemId, count };

  const target = findPlayer(state, targetPlayerId);
  if (!target) return null;
  if (target.id === player.id && !definition.canTargetSelf) return null;
  return { itemId, target, count };
}

export function applyItemUse(state: GameState, entryId: string, plan: ItemPlan): GameState {
  const player = getActivePlayer(state);
  if (!player) return state;
  const { itemId, target, count } = plan;

  let nextState = state;
  for (let spent = 0; spent < count; spent += 1) {
    nextState = updatePlayer(nextState, player.id, (currentPlayer) => spendItemEntry(currentPlayer, entryId));
  }
  if (isPreparationItem(itemId)) nextState = { ...nextState, mudPlacedThisTurn: true };
  else if (!isThrownItem(itemId)) nextState = { ...nextState, turnActionTaken: true, turnStage: "turn-end" };

  switch (itemId) {
    case "ndoye":
      if (!target) return state;
      nextState = addLog(nextState, `${player.name} active Ndoye sur ${target.name}.`, "event");
      // Je note copies Ndoye when the wheel resolves, through the wheel's source item.
      return startWheel(nextState, "misfortune", target.id, "turn-end", { sourceItemId: "ndoye", origin: "item" });

    case "hollow-purple":
      if (!target) return state;
      nextState = sendPlayerToHell(nextState, target.id);
      nextState = itemCopyForPassive(nextState, target.id, itemId, player.id);
      break;

    case "rope":
      if (!target) return state;
      nextState = pullWithRope(nextState, player, target);
      nextState = itemCopyForPassive(nextState, target.id, itemId, player.id);
      break;

    case "mud":
      nextState = {
        ...nextState,
        mudTraps: [...nextState.mudTraps, { id: createEngineId(), nodeId: player.position, ownerId: player.id }],
      };
      nextState = addLog(nextState, `${player.name} pose de la Boue en case ${player.position}.`, "event");
      break;

    case "middle-finger":
      if (!target) return state;
      nextState = updatePlayer(nextState, target.id, (currentPlayer) => ({
        ...currentPlayer,
        skippedTurns: currentPlayer.skippedTurns + 1,
      }));
      nextState = addLog(nextState, `${target.name} devra passer son prochain tour.`, "bad");
      nextState = itemCopyForPassive(nextState, target.id, itemId, player.id);
      break;

    case "monopoly-man":
      if (!target) return state;
      if (target.passiveId === "built-like-a-tank") {
        nextState = addLog(nextState, `Baraqué annule l’effet du Monopoly Man sur ${target.name}.`, "event");
        break;
      }
      nextState = {
        ...nextState,
        players: nextState.players.map((candidate) => {
          if (candidate.id === player.id) return { ...candidate, position: target.position };
          if (candidate.id === target.id) return { ...candidate, position: player.position };
          return candidate;
        }),
      };
      nextState = addLog(nextState, `${player.name} échange sa place avec ${target.name}.`, "event");
      nextState = itemCopyForPassive(nextState, target.id, itemId, player.id);
      break;

    case "water-bottle": {
      const destination = randomNormalNode(getBoard(state));
      nextState = updatePlayer(nextState, player.id, (currentPlayer) => ({ ...currentPlayer, position: destination }));
      nextState = addLog(nextState, `${player.name} sort de l’Enfer et atterrit en case ${destination}.`, "good");
      if (nextState.redCupNodeId === destination) {
        nextState = collectCupOrRequestDiscard(nextState, player.id, destination);
      }
      break;
    }

    case "tomato":
      if (!target) return state;
      nextState = throwTomatoes(nextState, player, target, count);
      // Je note keeps one per Tomate received, until its stack is full or it has to make room first.
      for (let copied = 0; copied < count && !nextState.pendingDiscard; copied += 1) {
        nextState = itemCopyForPassive(nextState, target.id, itemId, player.id);
      }
      break;

    case "draven": {
      nextState = {
        ...nextState,
        players: nextState.players.map(placeInHell),
      };
      nextState = addLog(nextState, "Draven envoie toute la table en Enfer.", "bad");
      break;
    }

    default:
      return state;
  }

  if (nextState.phase !== "playing") return nextState;
  // Teleported onto a green or red tile, the wheel spins all the same; a pull or a swap never earns one.
  if (!MOVES_WITHOUT_ARRIVAL.includes(itemId)) nextState = queueWheelsForMovedPlayers(state, nextState);
  return settleBoard(nextState, nextState.turnStage);
}

/**
 * A volley of Tomates in the face, for fun. Each one has its own small chance
 * to knock the target out; knocked out once or several times, it is a single
 * skipped turn.
 */
function throwTomatoes(state: GameState, thrower: Player, target: Player, count: number): GameState {
  let stunned = false;
  for (let thrown = 0; thrown < count; thrown += 1) {
    if (drawEngineRandom() < TOMATO_STUN_CHANCE) stunned = true;
  }
  const volley = count === 1 ? "une Tomate" : `${count} Tomates`;
  let nextState: GameState = {
    ...state,
    lastTomatoThrow: {
      seq: (state.lastTomatoThrow?.seq ?? 0) + 1,
      throwerId: thrower.id,
      targetId: target.id,
      count,
      stunned,
    },
  };
  if (!stunned) return addLog(nextState, `${thrower.name} lance ${volley} sur ${target.name}. Splat !`, "event");
  nextState = updatePlayer(nextState, target.id, (current) => ({ ...current, skippedTurns: current.skippedTurns + 1 }));
  return addLog(
    nextState,
    `${thrower.name} lance ${volley} sur ${target.name}, qui est assommé : il passera son prochain tour !`,
    "bad",
  );
}

/** Corde pulls the target onto the user's tile; Baraqué only moves half the way. */
function pullWithRope(state: GameState, user: Player, target: Player): GameState {
  if (target.passiveId !== "built-like-a-tank") {
    const nextState = updatePlayer(state, target.id, (currentPlayer) => ({
      ...currentPlayer,
      position: user.position,
    }));
    return addLog(nextState, `${target.name} est tiré sur la case de ${user.name}.`, "event");
  }

  const path = getShortestPath(getBoard(state), target.position, user.position, true) ?? [];
  const steps = Math.ceil(path.length / 2);
  const nextState = updatePlayer(state, target.id, (currentPlayer) => ({
    ...currentPlayer,
    position: steps > 0 ? path[steps - 1] : currentPlayer.position,
  }));
  return addLog(nextState, `${target.name} résiste à la Corde grâce à Baraqué.`, "event");
}

/** Players who could cancel the actor's action right now with Non merci. */
export function getNoThanksReactors(state: GameState, actorId: PlayerId): PlayerId[] {
  return state.players
    .filter(
      (player) => player.passiveId === "no-thanks" && player.id !== actorId && player.noThanksReadyRound <= state.round,
    )
    .map((player) => player.id);
}

/** Holds a declared action until the Non merci holders decide; null when nobody can react. */
export function openReactionWindow(state: GameState, action: DeclaredAction): GameState | null {
  const actor = getActivePlayer(state);
  if (!actor) return null;
  const reactorIds = getNoThanksReactors(state, actor.id);
  if (reactorIds.length === 0) return null;

  const pendingReaction: PendingReaction = { actorId: actor.id, action, reactorIds, resumeStage: state.turnStage };
  return addLog({ ...state, turnStage: "reaction", pendingReaction }, `${actor.name} annonce son action…`, "event");
}

export function cancelDeclaredAction(state: GameState, pending: PendingReaction, reactorId: PlayerId): GameState {
  const reactor = findPlayer(state, reactorId);
  const actor = findPlayer(state, pending.actorId);
  if (!reactor || !actor) return state;

  let nextState = updatePlayer(state, reactor.id, (player) => ({
    ...player,
    noThanksReadyRound: state.round + NO_THANKS_COOLDOWN_ROUNDS,
  }));
  const { action } = pending;
  if (action.type === "item" && CANCELLED_ITEM_IS_CONSUMED) {
    nextState = updatePlayer(nextState, actor.id, (player) => spendItemEntry(player, action.entryId));
  }

  // A cancelled mud is lost, but it was never the turn's action: the actor still gets to play.
  if (action.type === "item" && isPreparationItem(action.itemId)) {
    nextState = { ...nextState, pendingReaction: null, turnStage: pending.resumeStage, mudPlacedThisTurn: true };
    return addLog(nextState, `${reactor.name} utilise Non merci : la Boue de ${actor.name} est perdue.`, "event");
  }

  nextState = {
    ...nextState,
    pendingReaction: null,
    turnStage: "turn-end",
    moveDistance: 1,
    turnActionTaken: true,
  };
  return addLog(nextState, `${reactor.name} utilise Non merci : l’action de ${actor.name} est annulée.`, "event");
}

/** Re-plays the declared action once nobody reacted, from the stage it was declared in. */
export function carryOutDeclaredAction(state: GameState, pending: PendingReaction): GameState {
  const base: GameState = { ...state, pendingReaction: null, turnStage: pending.resumeStage };
  const { action } = pending;

  if (action.type === "move") {
    const plan = planMove(base, action.destination, action.ignoreArrows);
    return plan ? applyMove(base, action.destination, plan) : base;
  }

  const plan = planItemUse(base, action.entryId, action.targetPlayerId);
  return plan ? applyItemUse(base, action.entryId, plan) : base;
}
