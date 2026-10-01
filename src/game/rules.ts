import { getBoardNode, getPathsOfLength, type Board } from "./board";
import { ITEM_CATALOG } from "./catalog";
import { findStackWithRoom, getEntryUnits } from "./state-utils";
import type { BoardNode, GameState, ItemId, NodeId, Player, PlayerId, WheelId } from "./types";
import { BASE_INVENTORY_CAPACITY, DELINQUENT_COST, FIRST_ROUND, HELL_NODE_ID, START_NODE_ID } from "./types";

/** Pure rule queries: no state changes here, only answers about a player or a tile. */

export function getInventoryCapacity(player: Player): number {
  const passiveBonus = player.passiveId === "penta" ? 1 : 0;
  return BASE_INVENTORY_CAPACITY + passiveBonus;
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

/** At most two copies of an item, a single Gomme: whether one more slot of it may be filled. */
function isWithinCopyLimit(player: Player, itemId: ItemId): boolean {
  const copies = countItemCopies(player, itemId);
  return itemId === "eraser" ? copies < 1 : copies < 2;
}

/** Whether the item may take a slot of its own: room in the bag, within the copy limits. */
export function canStartNewSlot(player: Player, itemId: ItemId): boolean {
  return getOpenInventorySlots(player) > 0 && isWithinCopyLimit(player, itemId);
}

/**
 * At most two copies of an item and a single Gomme. A stackable item (the
 * Tomate) piles up to its limit in a slot, and each stack counts as one copy:
 * two stacks at most (patch 0.1.4).
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

export type DelinquentBlocker = "not-delinquent" | "too-poor" | "first-round-start";

/**
 * Délinquant pays for every move that needs it, so the passive is unusable
 * without the funds. On the first round it may not leave the start against
 * its arrows: on the classic board 0 → 8 would grab the first Red Cup before
 * anybody else could move.
 */
export function getDelinquentBlocker(player: Player, round: number): DelinquentBlocker | null {
  if (player.passiveId !== "delinquent") return "not-delinquent";
  if (player.currency < DELINQUENT_COST) return "too-poor";
  if (round <= FIRST_ROUND && player.position === START_NODE_ID) return "first-round-start";
  return null;
}

export function canUseDelinquent(player: Player, round: number): boolean {
  return getDelinquentBlocker(player, round) === null;
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

export function getItemPrice(itemId: ItemId, bootPrice: number): number {
  return itemId === "boot" ? bootPrice : ITEM_CATALOG[itemId].price;
}

/**
 * Player who must act right now: usually the active one, except for New Cup,
 * New Me, a step forward won on a wheel, a tile wheel owed by someone who was
 * teleported or pushed there, and the next spinner of a Tour de Bénédiction.
 */
export function getDecidingPlayer(state: GameState): Player | undefined {
  const deciderIds: Partial<Record<GameState["turnStage"], PlayerId | null | undefined>> = {
    reposition: state.pendingCupRepositionPlayerId,
    advance: state.pendingAdvance?.playerId,
    "tile-wheel": state.pendingTileWheels[0]?.playerId,
    blessing: state.blessingQueue[0],
  };
  const deciderId = deciderIds[state.turnStage];
  return state.players.find((player) => player.id === deciderId) ?? state.players[state.activePlayerIndex];
}
