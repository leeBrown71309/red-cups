import type { MapId } from "../types";
import { ARCHIPEL_MAP } from "./archipel-map";
import { BANQUISE_MAP } from "./banquise-map";
import { DESERT_MAP } from "./desert-map";
import { CLASSIC_MAP } from "./classic-map";
import { LUNA_PARK_MAP } from "./luna-park-map";
import type { BoardMap } from "./map-types";

export const DEFAULT_MAP_ID: MapId = "classic";

/** Maps in the order the picker shows them. */
export const MAP_ORDER: MapId[] = ["classic", "luna-park", "banquise", "archipel", "desert"];

const MAPS: Record<MapId, BoardMap> = {
  classic: CLASSIC_MAP,
  "luna-park": LUNA_PARK_MAP,
  banquise: BANQUISE_MAP,
  archipel: ARCHIPEL_MAP,
  desert: DESERT_MAP,
};

/** What the lobby lets the host pick: one map, or a draw at kickoff. */
export type MapChoice = MapId | "random";

/** Every choice in the order the picker offers them: the draw always comes first. */
export const MAP_CHOICES: MapChoice[] = ["random", ...MAP_ORDER];

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

/** Whether a table of `playerCount` may play on this map: the large ones need a full table. */
export function canPlayMap(mapId: MapId, playerCount: number): boolean {
  return playerCount >= (getBoardMap(mapId).minPlayers ?? 2);
}

/** Whether the lobby's pick can start with `playerCount` players: a draw always can, it only picks fitting maps. */
export function isChoicePlayable(choice: MapChoice, playerCount: number): boolean {
  return choice === "random" || canPlayMap(choice, playerCount);
}

/** Maps a table of `playerCount` may play, in the picker's order. */
export function getPlayableMapIds(playerCount: number): MapId[] {
  return MAP_ORDER.filter((mapId) => canPlayMap(mapId, playerCount));
}

/**
 * Turns the lobby choice into a map before the game starts, so the start
 * action carries a fixed map and every device builds the same game. The draw
 * only picks among the maps the table is big enough for.
 */
export function resolveMapChoice(
  choice: MapChoice,
  random: () => number = Math.random,
  playerCount = Number.POSITIVE_INFINITY,
): MapId {
  if (choice !== "random") return choice;
  const playable = getPlayableMapIds(playerCount);
  const pool = playable.length > 0 ? playable : MAP_ORDER;
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index];
}
