import { ITEM_ORDER, PASSIVE_ORDER, WHEEL_RESULTS } from "../catalog";
import { getBoardMap } from "../maps/map-registry";
import type { DuelMode, ItemId, MapId, TurnStage } from "../types";
import { mergeCounts, type BotGameReport } from "./run-bot-game";

/**
 * What a campaign on one map must have played for its "no violation" to mean
 * something: every item, wheel outcome, duel mode, stage and passive, the
 * table's special moves, and each of the map's own mechanics. Returns what was
 * never seen, as readable labels.
 */

const DUEL_MODES: DuelMode[] = ["coin-flip", "rock-paper-scissors", "player-vote", "basket", "blackjack"];

const STAGES: TurnStage[] = [
  "move",
  "reaction",
  "shop",
  "tile-wheel",
  "turn-end",
  "hell",
  "wheel-result",
  "duel",
  "duel-choice",
  "discard",
  "target",
  "reposition",
  "advance",
  "passive-choice",
  "gamble",
  "arm-wrestle",
  "blessing",
];

/** Moves and decisions beyond items and wheels: Corrupteur, the Botte, le diable, the angel, the Voleur… */
const SPECIAL_ACTIONS = [
  "move-rebel",
  "prepare-boot",
  "roll-dice",
  "leave-hell",
  "rescue-protege",
  "abandon",
  "cancel-wheel",
  "no-thanks:wheel",
  "reaction:cancel-item",
  "draft:pick",
  "expire-clock",
];

/** Each map's mechanics, read from the map itself so a new map gets its checks for free. */
function getMapEvents(mapId: MapId): string[] {
  const map = getBoardMap(mapId);
  const events = ["start-bonus", "bullet-bill"];
  if (map.edges.some((edge) => edge.kind === "tunnel")) events.push("tunnel");
  if (map.edges.some((edge) => edge.kind === "carousel")) events.push("carousel-flip");
  if (map.haunted) events.push("ghost:appear", "ghost:move", "ghost:teleport", "ghost:duel", "ghost:fling");
  if (map.nodes.some((node) => node.ice)) {
    // A walk ending on ice, and a step forward won on a wheel, both slide on.
    events.push("slide:move", "slide:advance", "ice-fall:hit", "ice-fall:miss", "thaw");
  }
  // The blizzard freezing a tile somebody stands on carries them away.
  if (map.blizzardEveryRounds !== undefined) events.push("blizzard", "ice-carry:blizzard");
  if (map.snowballs) events.push("snowball:hit", "snowball:freeze");
  return events;
}

export function findCoverageGaps(reports: BotGameReport[], mapId: MapId): string[] {
  const actions = mergeCounts(reports, "actionCounts");
  const stages = mergeCounts(reports, "stageCounts");
  const events = mergeCounts(reports, "eventCounts");
  const passives = new Set(reports.flatMap((report) => report.passives));
  const outcomes = new Set(Object.values(WHEEL_RESULTS).flatMap((results) => results.map((result) => result.id)));
  const hasPrefix = (prefix: string) => Object.keys(actions).some((label) => label.startsWith(prefix));
  // Some items are never "used": the Botte is put on, the Gomme cancels a wheel, others work on their own.
  const wasUsed = (itemId: ItemId) => {
    if (itemId === "helmet") return true;
    if (itemId === "boot") return Boolean(actions["prepare-boot"]);
    if (itemId === "eraser") return Boolean(actions["cancel-wheel"]);
    return Boolean(actions[`use:${itemId}`] || events[`item:${itemId}`]);
  };

  return [
    ...ITEM_ORDER.filter((itemId) => !wasUsed(itemId)).map((id) => `item ${id}`),
    ...ITEM_ORDER.filter((itemId) => !actions[`buy:${itemId}`] && !hasPrefix(`steal:${itemId}`)).map(
      (id) => `purchase ${id}`,
    ),
    ...[...outcomes].filter((outcome) => !actions[`wheel:${outcome}`]).map((outcome) => `wheel ${outcome}`),
    ...DUEL_MODES.filter((mode) => !actions[`duel:${mode}`]).map((mode) => `duel ${mode}`),
    ...STAGES.filter((stage) => !stages[stage]).map((stage) => `stage ${stage}`),
    ...PASSIVE_ORDER.filter((passiveId) => !passives.has(passiveId)).map((passiveId) => `passive ${passiveId}`),
    ...SPECIAL_ACTIONS.filter((label) => !actions[label]).map((label) => `action ${label}`),
    ...(hasPrefix("steal:") ? [] : ["action steal"]),
    ...getMapEvents(mapId)
      .filter((event) => !events[event])
      .map((event) => `${mapId} ${event}`),
  ];
}
