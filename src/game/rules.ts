import { getBoardNode, getPathsOfLength } from "./board";
import { ITEM_CATALOG } from "./catalog";
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

/** No stacking: at most two copies of an item, and a single Gomme. */
export function canAddItem(player: Player, itemId: ItemId): boolean {
  if (getOpenInventorySlots(player) === 0) return false;
  const itemCount = countItemCopies(player, itemId);
  if (itemId === "eraser" && itemCount >= 1) return false;
  return itemCount < 2;
}

export function getLegalMoveOptions(player: Player, distance = 1, ignoreArrows = false): NodeId[][] {
  if (player.position === HELL_NODE_ID || distance < 1) return [];

  return getPathsOfLength(player.position, distance, ignoreArrows).filter(
    (path) => path.length === distance && !path.includes(HELL_NODE_ID),
  );
}

export function getUniqueLegalDestinations(player: Player, distance = 1, ignoreArrows = false): NodeId[] {
  return [...new Set(getLegalMoveOptions(player, distance, ignoreArrows).map((path) => path[path.length - 1]))];
}

export function findLegalPath(
  player: Player,
  destination: NodeId,
  distance = 1,
  ignoreArrows = false,
): NodeId[] | null {
  return (
    getLegalMoveOptions(player, distance, ignoreArrows).find((path) => path[path.length - 1] === destination) ?? null
  );
}

export type DelinquentBlocker = "not-delinquent" | "too-poor" | "first-round-start";

/**
 * Délinquant pays per ignored arrow, so the passive is unusable without the
 * funds. On the first round it may not leave the start against its arrows:
 * 0 → 8 would grab the first Red Cup before anybody else could move.
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

export function getNodeKind(nodeId: NodeId): BoardNode["kind"] | undefined {
  return getBoardNode(nodeId)?.kind;
}

export function isShopNode(nodeId: NodeId): boolean {
  return getNodeKind(nodeId) === "shop";
}

/** Stopping on a green tile spins the wheel of fortune, a red tile the wheel of misfortune. */
export function getTileWheel(nodeId: NodeId): WheelId | null {
  const kind = getNodeKind(nodeId);
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
