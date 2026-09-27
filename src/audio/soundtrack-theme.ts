import { create } from "zustand";
import { DEFAULT_MAP_ID, getBoardMap, type MapChoice } from "../game/maps/map-registry";
import type { MapThemeId } from "../game/maps/map-types";
import type { MapId } from "../game/types";

/** The game's own music, heard in the menus and when the map is left to chance. */
export const BASE_SOUNDTRACK: MapThemeId = getBoardMap(DEFAULT_MAP_ID).themeId;

interface MapAuditionState {
  /** The option a map picker on screen is showing, or null when no picker is open. */
  choice: MapChoice | null;
}

/** Lets the map picker play the soundtrack of the map on show, before it is chosen. */
export const useMapAuditionStore = create<MapAuditionState>(() => ({ choice: null }));

/**
 * Which soundtrack plays. A map picker on screen wins: each map plays its own
 * music, the random option the game's. Otherwise a game plays its map's music
 * and every menu the game's.
 */
export function pickSoundtrackTheme(auditionChoice: MapChoice | null, gameMapId: MapId | null): MapThemeId {
  if (auditionChoice !== null) {
    return auditionChoice === "random" ? BASE_SOUNDTRACK : getBoardMap(auditionChoice).themeId;
  }
  return gameMapId === null ? BASE_SOUNDTRACK : getBoardMap(gameMapId).themeId;
}
