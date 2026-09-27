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
};

const LUNA_PARK_LAYOUT: MapLayoutConfig = {
  groundWidth: 24.4,
  groundDepth: 17.4,
  shopStalls: {
    5: { x: -1.75, z: 1.35, rotation: -0.55 },
    8: { x: 1.9, z: -1.35, rotation: 0.2 },
    // The ghost-train portal takes the outer corner of tile 12.
    12: { x: -1.75, z: -1.45, rotation: 0.5 },
  },
  startFlagOffset: { x: -1.05, z: -1.05 },
  pond: null,
  hellClearance: 1.9,
  hellFloorY: 0.36,
  portalReach: 2.1,
};

const LAYOUTS: Record<MapId, MapLayoutConfig> = {
  classic: CLASSIC_LAYOUT,
  "luna-park": LUNA_PARK_LAYOUT,
};

export function getMapLayoutConfig(mapId: MapId): MapLayoutConfig {
  return LAYOUTS[mapId] ?? CLASSIC_LAYOUT;
}
