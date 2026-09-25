import type { BoardEdge, BoardNode, NodeId } from "./types";
import { HELL_NODE_ID, START_NODE_ID } from "./types";

/**
 * Board layout transcribed from slide 1 of the original presentation.
 * Coordinates follow the slide grid: five columns (x) and three rows (z),
 * with the camera looking from the bottom edge of the slide.
 */
export const BOARD_NODES: BoardNode[] = [
  { id: 0, x: 0, z: 0, kind: "start", label: "Départ" },
  { id: 1, x: 8, z: 4.5, kind: "green", label: "Verte" },
  { id: 2, x: 0, z: -4.5, kind: "neutral", label: "Neutre" },
  { id: 3, x: 0, z: 4.5, kind: "shop", label: "Boutique" },
  { id: 4, x: -8, z: 0, kind: "red", label: "Rouge" },
  { id: 5, x: -4, z: -4.5, kind: "green", label: "Verte" },
  { id: 6, x: 4, z: 4.5, kind: "red", label: "Rouge" },
  { id: 7, x: -8, z: 4.5, kind: "green", label: "Verte" },
  { id: 8, x: 8, z: -4.5, kind: "shop", label: "Boutique" },
  { id: 9, x: -8, z: -4.5, kind: "shop", label: "Boutique" },
  { id: 10, x: 8, z: 0, kind: "red", label: "Rouge" },
  { id: 11, x: 4, z: 0.3, kind: "hell", label: "Enfer" },
];

/**
 * On the original board, arrows are drawn on tiles 0, 1, 2, 3, 8 and 9 and
 * point along one of their roads. Standing on such a tile, a player must leave
 * through its arrow; every other road stays usable in both directions, so a
 * player may walk into an arrow tile against its arrow (6 → 3) but then has to
 * follow the arrow out (3 → 6). Rule confirmed by the game's author.
 * The grey road leaving tile 7 through the left border and entering tile 1
 * from the right border is a one-way wrap-around tunnel.
 */
export const BOARD_EDGES: BoardEdge[] = [
  { from: 9, to: 5 },
  { from: 2, to: 5, arrow: true },
  { from: 0, to: 2, arrow: true },
  { from: 8, to: 0, arrow: true },
  { from: 9, to: 4, arrow: true },
  { from: 0, to: 4, arrow: true },
  { from: 4, to: 7 },
  { from: 4, to: 3 },
  { from: 7, to: 3 },
  { from: 3, to: 6, arrow: true },
  { from: 6, to: 1 },
  { from: 1, to: 10, arrow: true },
  { from: 10, to: 8 },
  { from: 7, to: 1, kind: "tunnel" },
];

export const NORMAL_NODE_IDS = BOARD_NODES.filter((node) => node.id !== HELL_NODE_ID).map((node) => node.id);

export function getBoardNode(nodeId: NodeId): BoardNode | undefined {
  return BOARD_NODES.find((node) => node.id === nodeId);
}

export function findEdge(fromNodeId: NodeId, toNodeId: NodeId): BoardEdge | undefined {
  return BOARD_EDGES.find(
    (edge) => (edge.from === fromNodeId && edge.to === toNodeId) || (edge.from === toNodeId && edge.to === fromNodeId),
  );
}

function isTunnel(edge: BoardEdge): boolean {
  return edge.kind === "tunnel";
}

/**
 * Tiles reachable in one step. Arrows constrain the tile they are drawn on
 * (forced exit), tunnels are one-way passages; `ignoreArrows` (Délinquant)
 * lifts both, so any connected road can be taken either way.
 */
export function getNeighbors(nodeId: NodeId, ignoreArrows = false, edges: BoardEdge[] = BOARD_EDGES): NodeId[] {
  const neighbors = new Set<NodeId>();
  const forcedExits = edges.filter((edge) => edge.arrow && edge.from === nodeId);

  if (forcedExits.length > 0 && !ignoreArrows) {
    for (const edge of forcedExits) neighbors.add(edge.to);
  } else {
    for (const edge of edges) {
      if (edge.from === nodeId) neighbors.add(edge.to);
      if (edge.to === nodeId && (!isTunnel(edge) || ignoreArrows)) neighbors.add(edge.from);
    }
  }

  return [...neighbors].filter((neighbor) => neighbor !== HELL_NODE_ID);
}

/**
 * The 200 coins of the start reward completing the loop, so they are only paid
 * when a step enters the start along an arrow pointing at it (8 → 0). Stepping
 * back into it against its own arrows (4 → 0, or 2 → 0 with Délinquant) would
 * otherwise let a player farm the bonus by bouncing 4 ↔ 0.
 */
export function earnsStartBonus(fromNodeId: NodeId, path: NodeId[]): boolean {
  let previous = fromNodeId;
  for (const nodeId of path) {
    const edge = findEdge(previous, nodeId);
    if (nodeId === START_NODE_ID && edge?.arrow && edge.to === START_NODE_ID) return true;
    previous = nodeId;
  }
  return false;
}

export function getPathsOfLength(startNodeId: NodeId, distance: number, ignoreArrows = false): NodeId[][] {
  let paths: NodeId[][] = [[startNodeId]];

  for (let step = 0; step < distance; step += 1) {
    paths = paths.flatMap((path) =>
      getNeighbors(path[path.length - 1], ignoreArrows).map((neighbor) => [...path, neighbor]),
    );
  }

  return paths.map((path) => path.slice(1));
}

export function getShortestPath(fromNodeId: NodeId, toNodeId: NodeId, ignoreArrows = true): NodeId[] | null {
  if (fromNodeId === toNodeId) return [];

  const queue: { nodeId: NodeId; path: NodeId[] }[] = [{ nodeId: fromNodeId, path: [] }];
  const visited = new Set<NodeId>([fromNodeId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    for (const neighbor of getNeighbors(current.nodeId, ignoreArrows)) {
      if (visited.has(neighbor)) continue;

      const nextPath = [...current.path, neighbor];
      if (neighbor === toNodeId) return nextPath;

      visited.add(neighbor);
      queue.push({ nodeId: neighbor, path: nextPath });
    }
  }

  return null;
}
