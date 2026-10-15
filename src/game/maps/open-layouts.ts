import type { MapId, NodeId, WorldStyle } from "../types";
import { hasOpenVersion } from "./world-style";

/**
 * Where the tiles of a map stand in its open version: the same tiles and the same roads, further apart and off the
 * grid. Every map has its own plan, so the open versions do not look alike.
 */
export const OPEN_NODE_POSITIONS: Partial<Record<MapId, Record<NodeId, { x: number; z: number }>>> = {
  // Classic: a loose loop with arcs and zigzags (9-4-7 bows round the left, 9-5-2 zigzags along the back, 8-10-1 bulges
  // on the right).
  classic: {
    0: { x: 0.4, z: 0.6 },
    1: { x: 10.8, z: 7.8 },
    2: { x: 1.2, z: -5.8 },
    3: { x: -2.4, z: 6.4 },
    4: { x: -12.4, z: 1.2 },
    5: { x: -4.8, z: -8.2 },
    6: { x: 4.6, z: 4.8 },
    7: { x: -9.2, z: 7.0 },
    8: { x: 10.2, z: -6.6 },
    9: { x: -9.6, z: -4.4 },
    10: { x: 13.4, z: 0.4 },
    11: { x: 7, z: 1.6 },
  },
  // Luna Park: a fairground midway, a ring road round the carousel hub: the carousel is a squashed, turned diamond and
  // the outer ring a wobbling circle of unequal stretches, with a long straight to the start.
  "luna-park": {
    0: { x: -1.6, z: 10.6 },
    1: { x: -0.7, z: 3.9 },
    2: { x: 4.9, z: 0.9 },
    3: { x: 0.3, z: -3.6 },
    4: { x: -4.6, z: -0.4 },
    5: { x: 0.4, z: -11 },
    6: { x: -13.5, z: 0.5 },
    7: { x: -9.6, z: -8 },
    8: { x: -9.6, z: 8 },
    9: { x: 10.6, z: -8.3 },
    10: { x: 12.5, z: 1.1 },
    11: { x: 0, z: 0 },
    12: { x: 10, z: 8.4 },
  },
  // Banquise: a river bend. The three rows of the lake shear into curves, the frozen lake runs between the two banks
  // and the crevasse of Hell sits at its back, between the two roads that leave the shop 8 for the ice.
  banquise: {
    0: { x: 0.8, z: 9.8 },
    1: { x: -7.2, z: 8.4 },
    2: { x: 8.6, z: 8.2 },
    3: { x: -7.6, z: 0.4 },
    4: { x: 0.2, z: 1.4 },
    5: { x: -14, z: 4.6 },
    6: { x: -14.8, z: -2.6 },
    7: { x: 8, z: -0.8 },
    8: { x: 0.6, z: -8.4 },
    9: { x: 11.2, z: -9.6 },
    10: { x: 15.4, z: -3.8 },
    11: { x: 0.4, z: -4.2 },
    12: { x: 15, z: 4 },
    13: { x: -10.8, z: -9.4 },
  },
};

/** The tiles of `mapId` where the style puts them: moved in the open version, as written otherwise. */
export function moveNodes<T extends { id: NodeId; x: number; z: number }>(
  mapId: MapId,
  nodes: T[],
  style: WorldStyle,
): T[] {
  const open = style === "open" && hasOpenVersion(mapId) ? OPEN_NODE_POSITIONS[mapId] : undefined;
  return open ? nodes.map((node) => ({ ...node, ...open[node.id] })) : nodes;
}
