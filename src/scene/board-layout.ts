import * as THREE from "three";
import { BOARD_EDGES, BOARD_NODES, getBoardNode } from "../game/board";
import type { BoardEdge, NodeId } from "../game/types";
import { HELL_NODE_ID, START_NODE_ID } from "../game/types";

/** Inner grass area of the toy-box tray, in world units. */
export const GRASS_WIDTH = 23.4;
export const GRASS_DEPTH = 15.6;
export const RIM_THICKNESS = 1.1;
export const RIM_HEIGHT = 0.8;

const HALF_WIDTH = GRASS_WIDTH / 2;

/** Booths are pushed into free corners so they never cover a road. */
export const SHOP_STALL_PLACEMENTS: Record<number, { x: number; z: number; rotation: number }> = {
  9: { x: -1.2, z: -1.75, rotation: 0.35 },
  8: { x: -1.75, z: -1.55, rotation: -0.2 },
  3: { x: 1.9, z: 1.65, rotation: Math.PI - 0.25 },
};

export const START_FLAG_OFFSET = { x: -1.05, z: -1.05 };
export const POND_CENTER = { x: 4.3, z: -4.6, radius: 1.6 };

export interface TunnelLayout {
  entrance: THREE.Vector3;
  exit: THREE.Vector3;
}

export function getTunnelLayout(edge: BoardEdge): TunnelLayout {
  const from = getBoardNode(edge.from);
  const to = getBoardNode(edge.to);
  const entranceSide = from && from.x < 0 ? -1 : 1;
  return {
    entrance: new THREE.Vector3(entranceSide * (HALF_WIDTH - 0.05), 0, from?.z ?? 0),
    exit: new THREE.Vector3(-entranceSide * (HALF_WIDTH - 0.05), 0, to?.z ?? 0),
  };
}

export function getNodePosition(nodeId: NodeId): THREE.Vector3 {
  const node = getBoardNode(nodeId);
  return new THREE.Vector3(node?.x ?? 0, 0, node?.z ?? 0);
}

export interface RoadSegment {
  edge: BoardEdge;
  start: THREE.Vector3;
  end: THREE.Vector3;
  /** Direction of travel for one-way roads, from start to end. */
  directed: boolean;
  tunnel: boolean;
}

/**
 * Visual segments for every board edge. A tunnel becomes two segments: from
 * its first tile to the rim, and from the opposite rim to its second tile.
 */
let cachedSegments: RoadSegment[] | null = null;

export function getRoadSegments(): RoadSegment[] {
  cachedSegments ??= buildRoadSegments();
  return cachedSegments;
}

function buildRoadSegments(): RoadSegment[] {
  return BOARD_EDGES.flatMap((edge): RoadSegment[] => {
    const start = getNodePosition(edge.from);
    const end = getNodePosition(edge.to);
    const directed = edge.arrow === true || edge.kind === "tunnel";

    if (edge.kind === "tunnel") {
      const tunnel = getTunnelLayout(edge);
      return [
        { edge, start, end: tunnel.entrance, directed, tunnel: true },
        { edge, start: tunnel.exit, end, directed, tunnel: true },
      ];
    }

    return [{ edge, start, end, directed, tunnel: false }];
  });
}

/** Exclusion zones used to keep decorations away from gameplay elements. */
export function isAreaFree(x: number, z: number, margin: number): boolean {
  if (Math.abs(x) > HALF_WIDTH - 0.6 - margin || Math.abs(z) > GRASS_DEPTH / 2 - 0.6 - margin) return false;

  for (const node of BOARD_NODES) {
    const clearance = node.id === HELL_NODE_ID ? 2.4 : node.id === START_NODE_ID ? 2.2 : 1.8;
    if (Math.hypot(node.x - x, node.z - z) < clearance + margin) return false;
  }

  for (const [nodeId, placement] of Object.entries(SHOP_STALL_PLACEMENTS)) {
    const node = getBoardNode(Number(nodeId));
    if (!node) continue;
    if (Math.hypot(node.x + placement.x - x, node.z + placement.z - z) < 1.3 + margin) return false;
  }

  if (Math.hypot(POND_CENTER.x - x, POND_CENTER.z - z) < POND_CENTER.radius + 0.3 + margin) return false;

  const point = new THREE.Vector3(x, 0, z);
  const closest = new THREE.Vector3();
  for (const segment of getRoadSegments()) {
    new THREE.Line3(segment.start, segment.end).closestPointToPoint(point, true, closest);
    if (closest.distanceTo(point) < 0.85 + margin) return false;
  }

  return true;
}
