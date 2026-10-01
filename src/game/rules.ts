import { getBoardNode, getPathsOfLength, type Board } from "./board";
import { ITEM_CATALOG } from "./catalog";
import { getEntryUnits } from "./state-utils";
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

/**
 * At most two copies of an item and a single Gomme; a stackable item (the
 * Tomate) fills one slot only, up to its limit.
 */
export function canAddItem(player: Player, itemId: ItemId): boolean {
  const stackLimit = ITEM_CATALOG[itemId].stackLimit;
  if (stackLimit) {
    const units = countItemUnits(player, itemId);
    return units > 0 ? units < stackLimit : getOpenInventorySlots(player) > 0;
  }
  if (getOpenInventorySlots(player) === 0) return false;
  const itemCount = countItemCopies(player, itemId);
  if (itemId === "eraser" && itemCount >= 1) return false;
  return itemCount < 2;
}

/**
 * Whether an item handed to the player (Je note, the ghost's loot) can end up
 * in the bag, once an ordinary item is thrown away to make room. The copy
 * limits hold whatever is thrown away, and so does a stack of Tomates: a
 * discard frees a slot, not a place in the stack.
 */
export function canReceiveItem(player: Player, itemId: ItemId): boolean {
  if (canAddItem(player, itemId)) return true;
  const copies = countItemCopies(player, itemId);
  if (ITEM_CATALOG[itemId].stackLimit && copies > 0) return false;
  if (copies >= 2 || (itemId === "eraser" && copies >= 1)) return false;
  return player.inventory.some((entry) => entry.kind === "item");
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
 * New Me, a tile wheel owed by someone who was teleported or pushed there,
 * and the next spinner of a Tour de Bénédiction.
 */
export function getDecidingPlayer(state: GameState): Player | undefined {
  const deciderIds: Partial<Record<GameState["turnStage"], PlayerId | null | undefined>> = {
    reposition: state.pendingCupRepositionPlayerId,
    "tile-wheel": state.pendingTileWheels[0]?.playerId,
    blessing: state.blessingQueue[0],
  };
  const deciderId = deciderIds[state.turnStage];
  return state.players.find((player) => player.id === deciderId) ?? state.players[state.activePlayerIndex];
}
