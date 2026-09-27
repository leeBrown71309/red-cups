import type { MapId } from "../types";
import { CLASSIC_MAP } from "./classic-map";
import { LUNA_PARK_MAP } from "./luna-park-map";
import type { BoardMap } from "./map-types";

export const DEFAULT_MAP_ID: MapId = "classic";

/** Maps in the order the picker shows them. */
export const MAP_ORDER: MapId[] = ["classic", "luna-park"];

const MAPS: Record<MapId, BoardMap> = {
  classic: CLASSIC_MAP,
  "luna-park": LUNA_PARK_MAP,
};

/** What the lobby lets the host pick: one map, or a draw at kickoff. */
export type MapChoice = MapId | "random";

export function isMapId(value: unknown): value is MapId {
  return typeof value === "string" && MAP_ORDER.includes(value as MapId);
}

export function isMapChoice(value: unknown): value is MapChoice {
  return value === "random" || isMapId(value);
}

/** Unknown ids (an old save, a newer client) fall back to the classic board. */
export function getBoardMap(mapId: MapId): BoardMap {
  return MAPS[mapId] ?? MAPS[DEFAULT_MAP_ID];
}

/**
 * Turns the lobby choice into a map before the game starts, so the start
 * action carries a fixed map and every device builds the same game.
 */
export function resolveMapChoice(choice: MapChoice, random: () => number = Math.random): MapId {
  if (choice !== "random") return choice;
  const index = Math.min(MAP_ORDER.length - 1, Math.floor(random() * MAP_ORDER.length));
  return MAP_ORDER[index];
}
