import { BOARD_NODES, BOARD_EDGES, getNeighbors, getPathsOfLength } from "./board";
import { ITEM_CATALOG, PASSIVE_CATALOG } from "./catalog";
import type { InventoryEntry, ItemId, NodeId, Player, PlayerId } from "./types";
import { BASE_INVENTORY_CAPACITY, HELL_NODE_ID, START_NODE_ID } from "./types";

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

export function canAddItem(player: Player, itemId: ItemId): boolean {
  if (getOpenInventorySlots(player) === 0) return false;

  const itemCount = player.inventory.filter((entry) => entry.kind === "item" && entry.itemId === itemId).length;

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

export function getPlayerById(players: Player[], playerId: PlayerId): Player | undefined {
  return players.find((player) => player.id === playerId);
}

export function isShopNode(nodeId: NodeId): boolean {
  return BOARD_NODES.find((node) => node.id === nodeId)?.kind === "shop";
}

export function getItemPrice(itemId: ItemId, bootPrice: number): number {
  return itemId === "boot" ? bootPrice : ITEM_CATALOG[itemId].price;
}

export function getRandomItemCandidate(player: Player, maximumPrice = Number.POSITIVE_INFINITY): ItemId | null {
  const candidates = Object.values(ITEM_CATALOG)
    .filter((item) => item.id !== "bullet-bill")
    .filter((item) => item.price <= maximumPrice)
    .filter((item) => canAddItem(player, item.id));

  return candidates[0]?.id ?? null;
}

export function getNearestPlayer(sourceNodeId: NodeId, players: Player[]): Player | undefined {
  const source = BOARD_NODES.find((node) => node.id === sourceNodeId);
  if (!source) return undefined;

  return players
    .filter((player) => player.position !== HELL_NODE_ID)
    .sort((left, right) => {
      const leftNode = BOARD_NODES.find((node) => node.id === left.position);
      const rightNode = BOARD_NODES.find((node) => node.id === right.position);
      if (!leftNode || !rightNode) return 0;

      const leftDistance = Math.hypot(leftNode.x - source.x, leftNode.z - source.z);
      const rightDistance = Math.hypot(rightNode.x - source.x, rightNode.z - source.z);
      return leftDistance - rightDistance;
    })[0];
}

export function getPathDistance(fromNodeId: NodeId, toNodeId: NodeId): number {
  if (fromNodeId === toNodeId) return 0;

  const queue: { nodeId: NodeId; distance: number }[] = [{ nodeId: fromNodeId, distance: 0 }];
  const visited = new Set<NodeId>([fromNodeId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    for (const neighbor of getNeighbors(current.nodeId, true)) {
      if (visited.has(neighbor)) continue;
      if (neighbor === toNodeId) return current.distance + 1;

      visited.add(neighbor);
      queue.push({ nodeId: neighbor, distance: current.distance + 1 });
    }
  }

  return Number.POSITIVE_INFINITY;
}

export function chooseRandom<T>(items: T[], randomValue: number): T | undefined {
  if (items.length === 0) return undefined;
  const normalizedValue = Math.min(Math.max(randomValue, 0), 0.999_999_999);
  return items[Math.floor(normalizedValue * items.length)];
}

export function createInventoryEntry(kind: InventoryEntry["kind"], itemId?: ItemId): InventoryEntry {
  const id = crypto.randomUUID();
  if (kind === "red-cup") return { id, kind };
  if (!itemId) throw new Error("An item id is required for an item entry.");
  return { id, kind, itemId };
}

export function getPlayerTileEffects(player: Player): number {
  const node = BOARD_NODES.find((boardNode) => boardNode.id === player.position);
  if (!node || player.passiveId !== "red-light-green-light") return 0;
  if (node.kind === "green") return 100;
  if (node.kind === "red") return -100;
  return 0;
}

export function getCanUseBoot(player: Player): boolean {
  return player.inventory.some((entry) => entry.kind === "item" && entry.itemId === "boot");
}

export function getItems(player: Player): ItemId[] {
  return player.inventory.flatMap((entry) => (entry.kind === "item" ? [entry.itemId] : []));
}

export function getRandomOpponentIds(players: Player[], excludedPlayerIds: PlayerId[]): PlayerId[] {
  return players.filter((player) => !excludedPlayerIds.includes(player.id)).map((player) => player.id);
}

export function getPassiveDescription(player: Player): string {
  return PASSIVE_CATALOG[player.passiveId].description;
}

export function getStartingNode(): NodeId {
  return START_NODE_ID;
}

export function isHellNode(nodeId: NodeId): boolean {
  return nodeId === HELL_NODE_ID;
}

export function isDirectedEdge(fromNodeId: NodeId, toNodeId: NodeId): boolean {
  return BOARD_EDGES.some((edge) => edge.oneWay && edge.from === fromNodeId && edge.to === toNodeId);
}
