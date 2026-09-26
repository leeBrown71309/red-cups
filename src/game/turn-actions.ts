import { earnsStartBonus, getShortestPath } from "./board";
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
  removeInventoryEntry,
  placeInHell,
  updatePlayer,
} from "./state-utils";
import type { DeclaredAction, GameState, ItemId, NodeId, PendingReaction, Player, PlayerId, TurnStage } from "./types";
import { CANCELLED_ITEM_IS_CONSUMED, DELINQUENT_COST, HELL_NODE_ID, NO_THANKS_COOLDOWN_ROUNDS } from "./types";

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

  const regularPath = findLegalPath(player, destination, state.moveDistance, false);
  if (regularPath) return { path: regularPath, rebel: false };

  // Délinquant only pays when the destination really requires going against an arrow.
  if (!ignoreArrows || !canUseDelinquent(player, state.round)) return null;
  const rebelPath = findLegalPath(player, destination, state.moveDistance, true);
  return rebelPath ? { path: rebelPath, rebel: true } : null;
}

function getArrivalStage(nodeId: NodeId): TurnStage {
  return isShopNode(nodeId) ? "shop" : "turn-end";
}

export function applyMove(state: GameState, destination: NodeId, plan: MovePlan): GameState {
  const player = getActivePlayer(state);
  if (!player) return state;

  let nextState = state;
  if (plan.rebel) {
    nextState = addLog(nextState, `${player.name} ignore les flèches grâce à Délinquant.`, "event");
    nextState = applyCurrencyChange(nextState, player.id, -DELINQUENT_COST);
  }

  nextState = updatePlayer(nextState, player.id, (currentPlayer) => ({ ...currentPlayer, position: destination }));
  nextState = addLog(nextState, `${player.name} se déplace en case ${destination}.`);
  nextState = addRedGreenBonuses(nextState, player.id, plan.path);
  if (earnsStartBonus(player.position, plan.path)) nextState = addStartBonus(nextState, player.id);

  nextState = {
    ...nextState,
    moveDistance: 1,
    turnActionTaken: true,
    turnStage: getArrivalStage(destination),
    lastMovement: {
      seq: (state.lastMovement?.seq ?? 0) + 1,
      playerId: player.id,
      from: player.position,
      path: plan.path,
    },
  };

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

function isPreparationItem(itemId: ItemId): boolean {
  return PREPARATION_ITEMS.includes(itemId);
}

export function planItemUse(state: GameState, entryId: string, targetPlayerId?: PlayerId): ItemPlan | null {
  const player = getActivePlayer(state);
  if (!player || state.phase !== "playing") return null;

  const inHell = player.position === HELL_NODE_ID;
  if (state.turnStage !== (inHell ? "hell" : "move")) return null;

  const itemId = getItemEntry(player, entryId);
  if (!itemId || NON_ACTION_ITEMS.includes(itemId)) return null;
  if (itemId === "water-bottle" && !inHell) return null;
  // Nobody walks into Hell, so mud placed there could never be stepped on.
  if (itemId === "mud" && (inHell || state.mudPlacedThisTurn)) return null;

  const definition = ITEM_CATALOG[itemId];
  if (definition.target !== "player") return { itemId };

  const target = findPlayer(state, targetPlayerId);
  if (!target) return null;
  if (target.id === player.id && !definition.canTargetSelf) return null;
  return { itemId, target };
}

export function applyItemUse(state: GameState, entryId: string, plan: ItemPlan): GameState {
  const player = getActivePlayer(state);
  if (!player) return state;
  const { itemId, target } = plan;

  let nextState = updatePlayer(state, player.id, (currentPlayer) => removeInventoryEntry(currentPlayer, entryId));
  nextState = isPreparationItem(itemId)
    ? { ...nextState, mudPlacedThisTurn: true }
    : { ...nextState, turnActionTaken: true, turnStage: "turn-end" };

  switch (itemId) {
    case "ndoye":
      if (!target) return state;
      nextState = addLog(nextState, `${player.name} active Ndoye sur ${target.name}.`, "event");
      // Je note copies Ndoye when the wheel resolves, through the wheel's source item.
      return startWheel(nextState, "misfortune", target.id, "turn-end", { sourceItemId: "ndoye", origin: "item" });

    case "hollow-purple":
      if (!target) return state;
      nextState = sendPlayerToHell(nextState, target.id);
      nextState = itemCopyForPassive(nextState, target.id, itemId);
      break;

    case "rope":
      if (!target) return state;
      nextState = pullWithRope(nextState, player, target);
      nextState = itemCopyForPassive(nextState, target.id, itemId);
      break;

    case "mud":
      nextState = {
        ...nextState,
        mudTraps: [...nextState.mudTraps, { id: crypto.randomUUID(), nodeId: player.position, ownerId: player.id }],
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
      nextState = itemCopyForPassive(nextState, target.id, itemId);
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
      nextState = itemCopyForPassive(nextState, target.id, itemId);
      break;

    case "water-bottle": {
      const destination = randomNormalNode();
      nextState = updatePlayer(nextState, player.id, (currentPlayer) => ({ ...currentPlayer, position: destination }));
      nextState = addLog(nextState, `${player.name} sort de l’Enfer et atterrit en case ${destination}.`, "good");
      if (nextState.redCupNodeId === destination) {
        nextState = collectCupOrRequestDiscard(nextState, player.id, destination);
      }
      break;
    }

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

/** Corde pulls the target onto the user's tile; Baraqué only moves half the way. */
function pullWithRope(state: GameState, user: Player, target: Player): GameState {
  if (target.passiveId !== "built-like-a-tank") {
    const nextState = updatePlayer(state, target.id, (currentPlayer) => ({
      ...currentPlayer,
      position: user.position,
    }));
    return addLog(nextState, `${target.name} est tiré sur la case de ${user.name}.`, "event");
  }

  const path = getShortestPath(target.position, user.position, true) ?? [];
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
    nextState = updatePlayer(nextState, actor.id, (player) => removeInventoryEntry(player, action.entryId));
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
