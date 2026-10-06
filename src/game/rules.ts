import { hasCard } from "./cards";
import { getBoard, getBoardNode, getNeighbors, getPathsOfLength, getSimplePaths, type Board } from "./board";
import { ITEM_CATALOG } from "./catalog";
import {
  getBagSlots,
  getCopyLimit,
  getMudPrice,
  isDoomed,
  isLastInClass,
  LAST_IN_CLASS_DISCOUNT,
  shopsAnywhere,
} from "./passive-rules";
import { findStackWithRoom, getEntryUnits } from "./state-utils";
import type { BoardNode, GameState, ItemId, NodeId, Player, PlayerId, WheelId } from "./types";
import { CORRUPTER_COST, FIRST_ROUND, HELL_NODE_ID, MADE_IN_HEAVEN_CUP_NODE_ID, START_NODE_ID } from "./types";

/** Pure rule queries: no state changes here, only answers about a player or a tile. */

/** Tiles a player may step forward onto: one step along the roads, arrows obeyed; none from Hell. */
export function getForwardTiles(state: GameState, player: Player): NodeId[] {
  if (player.position === HELL_NODE_ID) return [];
  return getUniqueLegalDestinations(getBoard(state), player, 1, false);
}

/** Every bag holds four entries, Red Cups included; L'Ange-Gardien's two. */
export function getInventoryCapacity(player: Player): number {
  return getBagSlots(player);
}

export function getOpenInventorySlots(player: Player): number {
  return Math.max(0, getInventoryCapacity(player) - player.inventory.length);
}

export function countRedCups(player: Player): number {
  return player.inventory.filter((entry) => entry.kind === "red-cup").length;
}

export function countItemCopies(player: Player, itemId: ItemId): number {
  return player.inventory.filter((entry) => entry.kind === "item" && entry.itemId === itemId).length;
}

/** Items of one kind in the bag, a stack counting each of its units. */
export function countItemUnits(player: Player, itemId: ItemId): number {
  return player.inventory
    .filter((entry) => entry.kind === "item" && entry.itemId === itemId)
    .reduce((total, entry) => total + getEntryUnits(entry), 0);
}

/** Everything in a bag, every Tomate of a stack and every Red Cup counted. */
export function countBagUnits(player: Player): number {
  return player.inventory.reduce((total, entry) => total + getEntryUnits(entry), 0);
}

/** At most two copies of an item, a single Gomme: whether one more slot of it may be filled. */
function isWithinCopyLimit(player: Player, itemId: ItemId): boolean {
  return countItemCopies(player, itemId) < getCopyLimit(player, itemId, getInventoryCapacity(player));
}

/** Whether the item may take a slot of its own: room in the bag, within the copy limits. */
export function canStartNewSlot(player: Player, itemId: ItemId): boolean {
  return getOpenInventorySlots(player) > 0 && isWithinCopyLimit(player, itemId);
}

/**
 * At most two copies of an item and a single Gomme. A stackable item (the
 * Tomate) piles up to its limit in a slot, and each stack counts as one copy:
 * two stacks at most (patch 0.1.4), one per slot for Tomato Enjoyer.
 */
export function canAddItem(player: Player, itemId: ItemId): boolean {
  return findStackWithRoom(player, itemId) !== undefined || canStartNewSlot(player, itemId);
}

/**
 * Whether an item handed to the player (Je note, the ghost's loot) can end up
 * in the bag, once an ordinary item is thrown away to make room. The copy
 * limits hold whatever is thrown away.
 */
export function canReceiveItem(player: Player, itemId: ItemId): boolean {
  if (canAddItem(player, itemId)) return true;
  return isWithinCopyLimit(player, itemId) && player.inventory.some((entry) => entry.kind === "item");
}

export function getLegalMoveOptions(board: Board, player: Player, distance = 1, ignoreArrows = false): NodeId[][] {
  if (player.position === HELL_NODE_ID || distance < 1) return [];

  // A walk onto ice ends there; where it slides on is drawn when the move is played.
  return getPathsOfLength(board, player.position, distance, ignoreArrows).filter(
    (path) => path.length === distance && !path.includes(HELL_NODE_ID),
  );
}

export function getUniqueLegalDestinations(board: Board, player: Player, distance = 1, ignoreArrows = false): NodeId[] {
  return [...new Set(getLegalMoveOptions(board, player, distance, ignoreArrows).map((path) => path[path.length - 1]))];
}

export function findLegalPath(
  board: Board,
  player: Player,
  destination: NodeId,
  distance = 1,
  ignoreArrows = false,
): NodeId[] | null {
  return (
    getLegalMoveOptions(board, player, distance, ignoreArrows).find((path) => path[path.length - 1] === destination) ??
    null
  );
}

export type CorrupterBlocker = "not-corrupter" | "too-poor" | "first-round-start";

/**
 * Corrupteur pays for every move that needs it, so the passive is unusable
 * without the funds. On the first round it may not leave the start against
 * its arrows: on the classic board 0 → 8 would grab the first Red Cup before
 * anybody else could move.
 */
export function getCorrupterBlocker(player: Player, round: number): CorrupterBlocker | null {
  if (!hasCard(player, "corrupter")) return "not-corrupter";
  if (player.currency < CORRUPTER_COST) return "too-poor";
  if (round <= FIRST_ROUND && player.position === START_NODE_ID) return "first-round-start";
  return null;
}

export function canUseCorrupter(player: Player, round: number): boolean {
  return getCorrupterBlocker(player, round) === null;
}

/** Non merci is ready once its cooldown is over. */
export function canUseNoThanks(player: Player, round: number): boolean {
  return hasCard(player, "no-thanks") && player.noThanksReadyRound <= round;
}

export function getNodeKind(board: Board, nodeId: NodeId): BoardNode["kind"] | undefined {
  return getBoardNode(board, nodeId)?.kind;
}

export function isShopNode(board: Board, nodeId: NodeId): boolean {
  return getNodeKind(board, nodeId) === "shop";
}

/** Stopping on a green tile spins the wheel of fortune, a red tile the wheel of misfortune. */
export function getTileWheel(board: Board, nodeId: NodeId): WheelId | null {
  const kind = getNodeKind(board, nodeId);
  if (kind === "green") return "fortune";
  if (kind === "red") return "misfortune";
  return null;
}

/** What `buyer` pays: the Botte's price climbs over the game, and Cupide gets the mud cheaper. */
export function getItemPrice(itemId: ItemId, bootPrice: number, buyer?: Player): number {
  if (itemId === "boot") return bootPrice;
  if (itemId === "mud") return getMudPrice(buyer);
  return ITEM_CATALOG[itemId].price;
}

/**
 * What `buyer` pays in this game: the usual price, less a tenth (rounded up to
 * ten coins) for a Dernier de la classe who is last. Every price the rules or
 * the shop show goes through here.
 */
export function getPriceFor(state: Pick<GameState, "bootPrice" | "players">, itemId: ItemId, buyer?: Player): number {
  const price = getItemPrice(itemId, state.bootPrice, buyer);
  if (!buyer || !isLastInClass(state, buyer)) return price;
  return Math.ceil((price * (1 - LAST_IN_CLASS_DISCOUNT)) / 10) * 10;
}

/** The wheel `player` spins on `nodeId`: during Doomsday, the wheel of misfortune on every tile. */
export function getTileWheelFor(state: GameState, player: Player, nodeId: NodeId): WheelId | null {
  if (nodeId !== HELL_NODE_ID && isDoomed(state, player)) return "misfortune";
  return getTileWheel(getBoard(state), nodeId);
}

/** Made In Heaven is only sold while the Red Cup stands away from the tile it would set it down on. */
export function isOnSale(state: Pick<GameState, "redCupNodeId">, itemId: ItemId): boolean {
  return itemId !== "made-in-heaven" || state.redCupNodeId !== MADE_IN_HEAVEN_CUP_NODE_ID;
}

/** A blue tile opens the shop, for eShop any tile does; never in Hell, nor during Doomsday. */
export function opensShop(state: GameState, player: Player, nodeId: NodeId = player.position): boolean {
  if (nodeId === HELL_NODE_ID || isDoomed(state, player)) return false;
  return isShopNode(getBoard(state), nodeId) || shopsAnywhere(player);
}

/**
 * The walks open to `player` this turn: for the Roller, those its die allows
 * once thrown; for everyone else one step, or two with the Botte.
 */
export function getTurnMoveOptions(state: GameState, player: Player, ignoreArrows = false): NodeId[][] {
  const board = getBoard(state);
  if (!hasCard(player, "roller")) return getLegalMoveOptions(board, player, state.moveDistance, ignoreArrows);
  if (state.diceRoll === null || player.position === HELL_NODE_ID) return [];
  return getSimplePaths(board, player.position, state.diceRoll);
}

/** Whether a move is still possible this turn; a Roller who has not thrown yet only needs a road. */
export function hasTurnMove(state: GameState, player: Player, ignoreArrows = false): boolean {
  if (hasCard(player, "roller") && state.diceRoll === null) {
    return player.position !== HELL_NODE_ID && getNeighbors(getBoard(state), player.position).length > 0;
  }
  return getTurnMoveOptions(state, player, ignoreArrows).length > 0;
}

/**
 * Player who must act right now: usually the active one, except for New Cup,
 * New Me, Calme-toi, Double or nothing, a step forward won on a wheel, a tile
 * wheel owed by someone who was teleported or pushed there, and the next
 * spinner of a Tour de Bénédiction.
 */
export function getDecidingPlayer(state: GameState): Player | undefined {
  const deciderIds: Partial<Record<GameState["turnStage"], PlayerId | null | undefined>> = {
    reposition: state.pendingCupRepositionPlayerId,
    "passive-choice": state.pendingCalmDown?.passivePlayerId,
    gamble: state.pendingGambles[0]?.playerId,
    advance: state.pendingAdvance?.playerId,
    "tile-wheel": state.pendingTileWheels[0]?.playerId,
    blessing: state.blessingQueue[0],
  };
  const deciderId = deciderIds[state.turnStage];
  return state.players.find((player) => player.id === deciderId) ?? state.players[state.activePlayerIndex];
}
