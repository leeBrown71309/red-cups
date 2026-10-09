import { ARCHIPEL_MAP } from "../game/maps/archipel-map";
import { DESERT_MAP } from "../game/maps/desert-map";
import type { MapId, NodeId } from "../game/types";

export interface StallPlacement {
  /** Offset from the shop tile, in world units. */
  x: number;
  z: number;
  rotation: number;
}

/**
 * Where the scene puts what the rules do not know about: the tray size,
 * the booths beside the shops, the start flag and the pond. Booths and props
 * are pushed into free corners so they never cover a road.
 */
export interface MapLayoutConfig {
  /** Inner playing area of the tray, in world units. */
  groundWidth: number;
  groundDepth: number;
  shopStalls: Record<NodeId, StallPlacement>;
  startFlagOffset: { x: number; z: number };
  pond: { x: number; z: number; radius: number } | null;
  /** Radius kept free of decorations around Hell. */
  hellClearance: number;
  /** Height pawns stand at in Hell. */
  hellFloorY: number;
  /** How far beside its tile a ghost-train portal stands, away from the board centre. */
  portalReach: number;
  /** Areas decorations keep off, e.g. the frozen lake, as centre and half sizes. */
  clearZones: { x: number; z: number; halfWidth: number; halfDepth: number }[];
  /** Height the stepping stones of the roads lie at; the Archipel lifts them above its sea and its sand. */
  roadY?: number;
  /**
   * A large map has no tray: no rim, no box round the board, the world simply goes on (the tray size only frames the
   * camera and the decoration).
   */
  openWorld?: boolean;
  /** How much further than the usual view the camera may zoom out; the large maps are wider than the screen is. */
  zoomOutFactor?: number;
}

const CLASSIC_LAYOUT: MapLayoutConfig = {
  groundWidth: 23.4,
  groundDepth: 15.6,
  shopStalls: {
    9: { x: -1.2, z: -1.75, rotation: 0.35 },
    8: { x: -1.75, z: -1.55, rotation: -0.2 },
    3: { x: 1.9, z: 1.65, rotation: Math.PI - 0.25 },
  },
  startFlagOffset: { x: -1.05, z: -1.05 },
  pond: { x: 4.3, z: -4.6, radius: 1.6 },
  hellClearance: 2.4,
  hellFloorY: 0.14,
  portalReach: 0,
  clearZones: [],
};

const LUNA_PARK_LAYOUT: MapLayoutConfig = {
  groundWidth: 24.4,
  groundDepth: 17.4,
  shopStalls: {
    5: { x: 1.9, z: -1.35, rotation: 0.2 },
    8: { x: -1.75, z: 1.35, rotation: -0.55 },
    // The ghost-train portal takes the outer corner of tile 12.
    12: { x: -1.75, z: -1.45, rotation: 0.5 },
  },
  startFlagOffset: { x: -1.05, z: -1.05 },
  pond: null,
  hellClearance: 1.9,
  hellFloorY: 0.36,
  portalReach: 2.1,
  clearZones: [],
};

/** The frozen lake spans the ice row, bank to bank; the crevasse of Hell bites into its back edge. */
export const BANQUISE_LAKE = { x: 0, z: 0.6, halfWidth: 7.7, halfDepth: 2.3 };

const BANQUISE_LAYOUT: MapLayoutConfig = {
  groundWidth: 24.4,
  groundDepth: 17.4,
  shopStalls: {
    5: { x: -1.75, z: 1.35, rotation: -0.55 },
    8: { x: 0, z: -1.8, rotation: 0 },
    12: { x: 1.75, z: 1.35, rotation: 0.55 },
  },
  startFlagOffset: { x: -1.05, z: 1 },
  pond: null,
  hellClearance: 1.9,
  hellFloorY: 0.12,
  portalReach: 0,
  clearZones: [BANQUISE_LAKE],
};

/**
 * The Archipel's booths stand on the outer side of each shop tile, away from the middle of its island, facing it.
 * Computed from the map so that moving a tile moves its booth.
 */
function placeArchipelStalls(): Record<NodeId, StallPlacement> {
  const stalls: Record<NodeId, StallPlacement> = {};
  const tidal = ARCHIPEL_MAP.tidal;
  if (!tidal) return stalls;
  for (const tiles of tidal.islands) {
    const points = tiles.flatMap((id) => ARCHIPEL_MAP.nodes.filter((node) => node.id === id));
    const centre = {
      x: points.reduce((sum, node) => sum + node.x, 0) / points.length,
      z: points.reduce((sum, node) => sum + node.z, 0) / points.length,
    };
    for (const node of points.filter((candidate) => candidate.kind === "shop")) {
      const away = Math.atan2(node.z - centre.z, node.x - centre.x);
      stalls[node.id] = {
        x: Math.cos(away) * 2.4,
        z: Math.sin(away) * 2.4,
        // The booth looks back at the island: its front is its local +z.
        rotation: Math.atan2(-Math.cos(away), -Math.sin(away)),
      };
    }
  }
  return stalls;
}

/**
 * The Archipel: a big tray (44 × 33) for 41 tiles. Hell, the Maelström, takes the middle of the ring; the start flag
 * stands on the Port.
 */
const ARCHIPEL_LAYOUT: MapLayoutConfig = {
  groundWidth: 68,
  groundDepth: 52,
  shopStalls: placeArchipelStalls(),
  startFlagOffset: { x: -1.05, z: 1 },
  pond: null,
  hellClearance: 3.4,
  hellFloorY: 0.16,
  portalReach: 0,
  clearZones: [],
  roadY: 0.19,
  openWorld: true,
  zoomOutFactor: 1.8,
};

/**
 * The oases are the shops: a stall (an awning on poles) stands on the outer side of each, away from the dunes.
 */
function placeDesertStalls(): Record<NodeId, StallPlacement> {
  const stalls: Record<NodeId, StallPlacement> = {};
  for (const oasisId of DESERT_MAP.desert?.oases ?? []) {
    const node = DESERT_MAP.nodes.find((candidate) => candidate.id === oasisId);
    if (!node) continue;
    const away = Math.atan2(node.z, node.x);
    stalls[oasisId] = {
      x: Math.cos(away) * 2.6,
      z: Math.sin(away) * 2.6,
      rotation: Math.atan2(-Math.cos(away), -Math.sin(away)),
    };
  }
  return stalls;
}

/** The Désert: an open world of dunes, as wide as the sandy loops it holds. */
const DESERT_LAYOUT: MapLayoutConfig = {
  groundWidth: 84,
  groundDepth: 62,
  shopStalls: placeDesertStalls(),
  startFlagOffset: { x: -1.05, z: 1 },
  pond: null,
  hellClearance: 4.6,
  hellFloorY: 0.16,
  portalReach: 0,
  clearZones: [],
  roadY: 0.07,
  openWorld: true,
  zoomOutFactor: 1.7,
};

const LAYOUTS: Record<MapId, MapLayoutConfig> = {
  classic: CLASSIC_LAYOUT,
  "luna-park": LUNA_PARK_LAYOUT,
  banquise: BANQUISE_LAYOUT,
  archipel: ARCHIPEL_LAYOUT,
  desert: DESERT_LAYOUT,
};

export function getMapLayoutConfig(mapId: MapId): MapLayoutConfig {
  return LAYOUTS[mapId] ?? CLASSIC_LAYOUT;
}
