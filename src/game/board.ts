import type { BoardEdge, BoardNode, NodeId } from "./types";
import { HELL_NODE_ID, START_NODE_ID } from "./types";

export const BOARD_NODES: BoardNode[] = [
  { id: 0, x: 0, z: 0, kind: "start", label: "Départ" },
  { id: 1, x: 6, z: 4.1, kind: "green", label: "Verte" },
  { id: 2, x: 0, z: -4.1, kind: "neutral", label: "Neutre" },
  { id: 3, x: 0.1, z: 4.1, kind: "shop", label: "Boutique" },
  { id: 4, x: -6, z: 0, kind: "red", label: "Rouge" },
  { id: 5, x: -3, z: -4.1, kind: "green", label: "Verte" },
  { id: 6, x: 3, z: 4.1, kind: "red", label: "Rouge" },
  { id: 7, x: -6, z: 4.1, kind: "green", label: "Verte" },
  { id: 8, x: 6, z: -4.1, kind: "shop", label: "Boutique" },
  { id: 9, x: -6, z: -4.1, kind: "shop", label: "Boutique" },
  { id: 10, x: 6, z: 0, kind: "red", label: "Rouge" },
  { id: 11, x: 3, z: 0, kind: "hell", label: "Enfer" },
];

// The topology is transcribed from the board illustration. Arrow directions are
// kept as data so they can be corrected without changing the game engine.
export const BOARD_EDGES: BoardEdge[] = [
  { from: 9, to: 5 },
  { from: 5, to: 2, oneWay: true },
  { from: 9, to: 4, oneWay: true },
  { from: 4, to: 7 },
  { from: 7, to: 3 },
  { from: 4, to: 3 },
  { from: 3, to: 6, oneWay: true },
  { from: 6, to: 1 },
  { from: 1, to: 10, oneWay: true },
  { from: 10, to: 8 },
  { from: START_NODE_ID, to: 4, oneWay: true },
  { from: 5, to: START_NODE_ID },
  { from: 2, to: START_NODE_ID },
  { from: START_NODE_ID, to: 8 },
];

export const NORMAL_NODE_IDS = BOARD_NODES.filter(
  (node) => node.id !== HELL_NODE_ID,
).map((node) => node.id);

export function getNeighbors(
  nodeId: NodeId,
  ignoreArrows = false,
  edges: BoardEdge[] = BOARD_EDGES,
): NodeId[] {
  const neighbors = new Set<NodeId>();

  for (const edge of edges) {
    if (edge.from === nodeId) {
      neighbors.add(edge.to);
    }

    if (edge.to === nodeId && (!edge.oneWay || ignoreArrows)) {
      neighbors.add(edge.from);
    }
  }

  return [...neighbors].filter((neighbor) => neighbor !== HELL_NODE_ID);
}

export function getPathsOfLength(
  startNodeId: NodeId,
  distance: number,
  ignoreArrows = false,
): NodeId[][] {
  let paths: NodeId[][] = [[startNodeId]];

  for (let step = 0; step < distance; step += 1) {
    paths = paths.flatMap((path) =>
      getNeighbors(path[path.length - 1], ignoreArrows).map((neighbor) => [
        ...path,
        neighbor,
      ]),
    );
  }

  return paths.map((path) => path.slice(1));
}

export function getShortestPath(
  fromNodeId: NodeId,
  toNodeId: NodeId,
  ignoreArrows = true,
): NodeId[] | null {
  if (fromNodeId === toNodeId) return [];

  const queue: { nodeId: NodeId; path: NodeId[] }[] = [
    { nodeId: fromNodeId, path: [] },
  ];
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
