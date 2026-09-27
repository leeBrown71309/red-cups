import { getBoardMap } from "./maps/map-registry";
import type { BoardMap } from "./maps/map-types";
import type { BoardEdge, BoardNode, GameState, MapId, NodeId } from "./types";
import { HELL_NODE_ID, START_NODE_ID } from "./types";

/**
 * The graph a game is played on right now: the map's tiles and roads, with
 * the carousel (if any) already turned the way it currently goes. Every
 * movement rule reads this, never the raw map, so a flipped carousel needs no
 * special case anywhere else.
 */
export interface Board {
  map: BoardMap;
  nodes: BoardNode[];
  edges: BoardEdge[];
  /** Every tile a player can stand on or be sent to, i.e. all but Hell. */
  normalNodeIds: NodeId[];
  carouselReversed: boolean;
  /** Banquise: `"from>ice"` → the tile a walk slides on to after reaching `ice` from `from`. */
  slides: Map<string, NodeId>;
}

const boardCache = new Map<string, Board>();

export function resolveBoard(mapId: MapId, carouselReversed = false): Board {
  const key = `${mapId}:${carouselReversed}`;
  const cached = boardCache.get(key);
  if (cached) return cached;

  const map = getBoardMap(mapId);
  const edges = map.edges.map((edge) =>
    carouselReversed && edge.kind === "carousel" ? { ...edge, from: edge.to, to: edge.from } : edge,
  );
  const board: Board = {
    map,
    nodes: map.nodes,
    edges,
    normalNodeIds: map.nodes.filter((node) => node.id !== HELL_NODE_ID).map((node) => node.id),
    carouselReversed,
    slides: new Map(),
  };
  board.slides = computeSlides(board);
  boardCache.set(key, board);
  return board;
}

/** A slide only carries on along a road that goes on (almost) straight ahead. */
const SLIDE_MAX_ANGLE = (25 * Math.PI) / 180;

function angleBetween(ax: number, az: number, bx: number, bz: number): number {
  const lengths = Math.hypot(ax, az) * Math.hypot(bx, bz) || 1;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / lengths)));
}

/**
 * Where each arrival on ice slides on to, read from the map's geometry:
 * the road leaving the ice tile in the direction the player came in. No such
 * road (arriving from the side of a lake, for instance) means no slide.
 */
function computeSlides(board: Board): Map<string, NodeId> {
  const slides = new Map<string, NodeId>();
  for (const ice of board.nodes.filter((node) => node.ice)) {
    const exits = getNeighbors(board, ice.id, true)
      .map((nodeId) => getBoardNode(board, nodeId))
      .filter((node): node is BoardNode => node !== undefined);
    for (const origin of board.nodes) {
      if (!getNeighbors(board, origin.id, true).includes(ice.id)) continue;
      const straight = exits.find(
        (exit) =>
          exit.id !== origin.id &&
          angleBetween(ice.x - origin.x, ice.z - origin.z, exit.x - ice.x, exit.z - ice.z) < SLIDE_MAX_ANGLE,
      );
      if (straight) slides.set(`${origin.id}>${ice.id}`, straight.id);
    }
  }
  return slides;
}

export function hasIce(board: Board): boolean {
  return board.nodes.some((node) => node.ice);
}

/**
 * Banquise: a walk that ends on ice keeps going straight ahead, tile after
 * tile, until it reaches a tile that is not ice or has nothing straight
 * ahead. Only the end of a walk slides: the Botte's middle tile does not.
 */
export function extendWithSlide(board: Board, fromNodeId: NodeId, path: NodeId[]): NodeId[] {
  if (path.length === 0 || board.slides.size === 0) return path;
  const extended = [...path];
  let previous = path.length >= 2 ? path[path.length - 2] : fromNodeId;
  let current = path[path.length - 1];
  for (;;) {
    const next = board.slides.get(`${previous}>${current}`);
    if (next === undefined || extended.includes(next)) break;
    extended.push(next);
    previous = current;
    current = next;
  }
  return extended;
}

/** True when `next` was reached by sliding off the ice tile `current`, entered from `previous`. */
export function isSlideStep(board: Board, previous: NodeId, current: NodeId, next: NodeId): boolean {
  return board.slides.get(`${previous}>${current}`) === next;
}

export function getBoard(state: Pick<GameState, "mapId" | "carouselReversed">): Board {
  return resolveBoard(state.mapId, state.carouselReversed);
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
 * (Délinquant) lifts all of them, so any connected road can be taken either way.
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
 * classic board, 5 → 0 at Luna Park). Stepping back into it against its own
 * arrows (4 → 0 on the classic board) would otherwise let a player farm the
 * bonus by bouncing 4 ↔ 0.
 */
export function earnsStartBonus(board: Board, fromNodeId: NodeId, path: NodeId[]): boolean {
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
