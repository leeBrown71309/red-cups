import { getBoardMap } from "./maps/map-registry";
import type { BoardMap } from "./maps/map-types";
import type { BoardEdge, BoardNode, GameState, MapId, NodeId } from "./types";
import { HELL_NODE_ID, START_NODE_ID } from "./types";

/**
 * The graph a game is played on right now: the map's tiles and roads, with
 * the carousel (if any) already turned the way it currently goes and the
 * blizzard's temporary ice laid on its tile. Every movement rule reads this,
 * never the raw map, so neither needs a special case anywhere else.
 */
export interface Board {
  map: BoardMap;
  nodes: BoardNode[];
  edges: BoardEdge[];
  /** Every tile a player can stand on or be sent to, i.e. all but Hell. */
  normalNodeIds: NodeId[];
  carouselReversed: boolean;
  /** Banquise: the blizzard's temporary ice tile, on top of the map's own ice. */
  iceTileNodeId: NodeId | null;
}

const boardCache = new Map<string, Board>();

export function resolveBoard(mapId: MapId, carouselReversed = false, iceTileNodeId: NodeId | null = null): Board {
  const key = `${mapId}:${carouselReversed}:${iceTileNodeId}`;
  const cached = boardCache.get(key);
  if (cached) return cached;

  const map = getBoardMap(mapId);
  const edges = map.edges.map((edge) =>
    carouselReversed && edge.kind === "carousel" ? { ...edge, from: edge.to, to: edge.from } : edge,
  );
  const nodes = map.nodes.map((node) => (node.id === iceTileNodeId ? { ...node, ice: true } : node));
  const board: Board = {
    map,
    nodes,
    edges,
    normalNodeIds: nodes.filter((node) => node.id !== HELL_NODE_ID).map((node) => node.id),
    carouselReversed,
    iceTileNodeId,
  };
  boardCache.set(key, board);
  return board;
}

export function getBoard(state: Pick<GameState, "mapId" | "carouselReversed" | "iceTileNodeId">): Board {
  return resolveBoard(state.mapId, state.carouselReversed, state.iceTileNodeId);
}

export function hasIce(board: Board): boolean {
  return board.nodes.some((node) => node.ice);
}

export function isIce(board: Board, nodeId: NodeId): boolean {
  return getBoardNode(board, nodeId)?.ice === true;
}

/**
 * Banquise: where a slide may carry on from an ice tile, read from the
 * board's real roads (arrows and one-way roads included), never back the way
 * the player came. One road left means a forced slide; several, a random one.
 */
export function getSlideExits(board: Board, previousNodeId: NodeId, iceNodeId: NodeId): NodeId[] {
  if (!isIce(board, iceNodeId)) return [];
  return getNeighbors(board, iceNodeId).filter((nodeId) => nodeId !== previousNodeId);
}

/**
 * Tiles a blizzard may freeze: any walkable tile that is not ice already,
 * not excluded (the Red Cup's tile, the ice it replaces) and has at least two
 * roads, so a player sliding onto it always has somewhere to go on to.
 */
export function getBlizzardCandidates(board: Board, excluded: (NodeId | null)[]): NodeId[] {
  const permanentIce = new Set(board.map.nodes.filter((node) => node.ice).map((node) => node.id));
  return board.normalNodeIds.filter(
    (nodeId) =>
      !permanentIce.has(nodeId) && !excluded.includes(nodeId) && getNeighbors(board, nodeId, true).length >= 2,
  );
}

export function hasCarousel(board: Board): boolean {
  return board.edges.some((edge) => edge.kind === "carousel");
}

export function getBoardNode(board: Board, nodeId: NodeId): BoardNode | undefined {
  return board.nodes.find((node) => node.id === nodeId);
}

export function findEdge(board: Board, fromNodeId: NodeId, toNodeId: NodeId): BoardEdge | undefined {
  return board.edges.find(
    (edge) => (edge.from === fromNodeId && edge.to === toNodeId) || (edge.from === toNodeId && edge.to === fromNodeId),
  );
}

/** Tunnels and carousel roads only go from `from` to `to`. */
export function isOneWay(edge: BoardEdge): boolean {
  return edge.kind === "tunnel" || edge.kind === "carousel";
}

/**
 * Tiles reachable in one step. Arrows constrain the tile they are drawn on
 * (forced exit), tunnels and the carousel are one-way; `ignoreArrows`
 * (Corrupteur) lifts all of them, so any connected road can be taken either way.
 */
export function getNeighbors(board: Board, nodeId: NodeId, ignoreArrows = false): NodeId[] {
  const neighbors = new Set<NodeId>();
  const forcedExits = board.edges.filter((edge) => edge.arrow && edge.from === nodeId);

  if (forcedExits.length > 0 && !ignoreArrows) {
    for (const edge of forcedExits) neighbors.add(edge.to);
  } else {
    for (const edge of board.edges) {
      if (edge.from === nodeId) neighbors.add(edge.to);
      if (edge.to === nodeId && (!isOneWay(edge) || ignoreArrows)) neighbors.add(edge.from);
    }
  }

  return [...neighbors].filter((neighbor) => neighbor !== HELL_NODE_ID);
}

/** Tiles whose arrow points at the start: entering the start from them completes the loop. */
export function getStartBonusNodeIds(board: Board): NodeId[] {
  return board.edges.filter((edge) => edge.arrow && edge.to === START_NODE_ID).map((edge) => edge.from);
}

/**
 * The 200 coins of the start reward completing the loop, so they are only paid
 * when a step enters the start along an arrow pointing at it (8 → 0 on the
 * classic board and at Luna Park, 4 → 0 at Banquise). Stepping back into it against its own
 * arrows (4 → 0 on the classic board) would otherwise let a player farm the
 * bonus by bouncing 4 ↔ 0.
 */
export function earnsStartBonus(board: Board, fromNodeId: NodeId, path: NodeId[]): boolean {
  // Banquise: a start frozen by the blizzard pays nothing, the player just slides across it.
  if (isIce(board, START_NODE_ID)) return false;
  let previous = fromNodeId;
  for (const nodeId of path) {
    const edge = findEdge(board, previous, nodeId);
    if (nodeId === START_NODE_ID && edge?.arrow && edge.to === START_NODE_ID) return true;
    previous = nodeId;
  }
  return false;
}

export function getPathsOfLength(
  board: Board,
  startNodeId: NodeId,
  distance: number,
  ignoreArrows = false,
): NodeId[][] {
  let paths: NodeId[][] = [[startNodeId]];

  for (let step = 0; step < distance; step += 1) {
    paths = paths.flatMap((path) =>
      getNeighbors(board, path[path.length - 1], ignoreArrows).map((neighbor) => [...path, neighbor]),
    );
  }

  return paths.map((path) => path.slice(1));
}

export function getShortestPath(
  board: Board,
  fromNodeId: NodeId,
  toNodeId: NodeId,
  ignoreArrows = true,
): NodeId[] | null {
  if (fromNodeId === toNodeId) return [];

  const queue: { nodeId: NodeId; path: NodeId[] }[] = [{ nodeId: fromNodeId, path: [] }];
  const visited = new Set<NodeId>([fromNodeId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    for (const neighbor of getNeighbors(board, current.nodeId, ignoreArrows)) {
      if (visited.has(neighbor)) continue;

      const nextPath = [...current.path, neighbor];
      if (neighbor === toNodeId) return nextPath;

      visited.add(neighbor);
      queue.push({ nodeId: neighbor, path: nextPath });
    }
  }

  return null;
}
