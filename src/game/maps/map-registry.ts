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

/**
 * The two large maps are not playable yet (patch 0.3.0: badly balanced, a system not worth playing). Until they are
 * reworked they only exist in development; the pre-prod and the production builds show them greyed out, « en
 * préparation », and never pick them, in a draw or otherwise.
 */
export const UNFINISHED_MAP_IDS: MapId[] = ["archipel", "desert"];

/** Whether this build lets the unfinished maps be played: a development build only (`vite`, and the tests). */
const unfinishedMapsPlayable = !import.meta.env?.PROD;

export function isMapAvailable(mapId: MapId): boolean {
  return unfinishedMapsPlayable || !UNFINISHED_MAP_IDS.includes(mapId);
}

export function isChoiceAvailable(choice: MapChoice): boolean {
  return choice === "random" || isMapAvailable(choice);
}

/** The choices a player may actually pick in this build; the others are listed greyed out. */
export const SELECTABLE_MAP_CHOICES: MapChoice[] = MAP_CHOICES.filter(isChoiceAvailable);

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

/** The table a large map is made for (it says so to the players, but any table may play it), or null. */
export function getRecommendedPlayers(mapId: MapId): number | null {
  return getBoardMap(mapId).recommendedPlayers ?? null;
}

/** Maps a random pick may draw for `playerCount` players: a large map only comes up for the table it is made for. */
export function getDrawableMapIds(playerCount: number): MapId[] {
  return MAP_ORDER.filter(
    (mapId) => isMapAvailable(mapId) && playerCount >= (getBoardMap(mapId).recommendedPlayers ?? 2),
  );
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
  // A choice remembered from a build that had more maps falls back to the classic board.
  if (choice !== "random") return isMapAvailable(choice) ? choice : DEFAULT_MAP_ID;
  const playable = getDrawableMapIds(playerCount);
  const pool = playable.length > 0 ? playable : MAP_ORDER.filter(isMapAvailable);
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index];
}
