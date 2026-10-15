import type { MapId, WorldStyle } from "../types";

/**
 * How a map sits in its world, picked with the map when a game is set up (and fixed for that game):
 * - "boxed": the board stands in its tray, the original look;
 * - "open": no tray, the ground goes on and the tiles stand further apart, off the grid. Same tiles, same roads, same
 *   rules: only the plan and the scenery change, for variety.
 * Only some maps have an open version so far; the large ones are always open.
 */
export type { WorldStyle };

export const DEFAULT_WORLD_STYLE: WorldStyle = "open";

/** The maps that come in both versions, and so offer the choice. */
export const OPEN_VERSION_MAP_IDS: MapId[] = ["classic", "luna-park", "banquise"];

export function isWorldStyle(value: unknown): value is WorldStyle {
  return value === "boxed" || value === "open";
}

export function hasOpenVersion(mapId: MapId): boolean {
  return OPEN_VERSION_MAP_IDS.includes(mapId);
}

/** The style a game really gets: the one asked for if the map has an open version, otherwise the original look. */
export function resolveWorldStyle(mapId: MapId, wanted: WorldStyle | undefined): WorldStyle {
  return wanted === "open" && hasOpenVersion(mapId) ? "open" : "boxed";
}
