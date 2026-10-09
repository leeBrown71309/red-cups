import { useMemo } from "react";
import { getBoardMap } from "../../game/maps/map-registry";
import { useGameStore } from "../../game/store";
import { getFloodedNodeIds, getNextFerryQuay, getRoundsUntilTideTurns, getTideLevel } from "../../game/tide";
import type { NodeId } from "../../game/types";
import { TIDE_ROUNDS } from "../../game/types";
import { UiIcon } from "../icons/ui-icon";

/** The island a quay belongs to, for the ferry's schedule. */
function islandNameOf(islands: NodeId[][], names: string[], nodeId: NodeId): string {
  const index = islands.findIndex((tiles) => tiles.includes(nodeId));
  return index >= 0 ? names[index] : "";
}

/**
 * Archipel des Marées: the tide and the ferry, always on show. The tide turns every two rounds and the panel says
 * when, so nobody is caught on a causeway by surprise; the ferry's timetable gives the quay it is moored at now, and
 * the one it goes to when the next round opens.
 */
export function TidePanel() {
  const mapId = useGameStore((state) => state.mapId);
  const round = useGameStore((state) => state.round);
  const ferryQuayId = useGameStore((state) => state.ferryQuayId);
  const map = getBoardMap(mapId);
  const tidal = map.tidal;
  const level = getTideLevel(round);
  const roundsLeft = getRoundsUntilTideTurns(round);
  const drowned = useMemo(() => getFloodedNodeIds(map, round), [map, round]);
  if (!tidal) return null;

  const nextQuay = ferryQuayId === null ? null : getNextFerryQuay(map, ferryQuayId);
  const turnsSoon = roundsLeft === 1;
  const nextLevel = level === "high" ? "basse" : "haute";
  return (
    <aside className={`tide-panel tide-panel--${level}${turnsSoon ? " is-turning" : ""}`} aria-label="Marée et bac">
      <div className="tide-panel__row" title={`Chaussées sous l’eau : ${drowned.join(", ") || "aucune"}`}>
        <UiIcon name="waves" size={20} />
        <span className="tide-panel__level">Marée {level === "high" ? "haute" : "basse"}</span>
        <span className="tide-panel__pips" role="img" aria-label={`Encore ${roundsLeft} tour de table`}>
          {Array.from({ length: TIDE_ROUNDS }, (_, index) => (
            <i key={index} className={index < TIDE_ROUNDS - roundsLeft ? "is-spent" : ""} />
          ))}
        </span>
        <span className="tide-panel__next">
          {turnsSoon ? `${nextLevel} au prochain tour` : `${nextLevel} dans ${roundsLeft} tours`}
        </span>
      </div>
      {ferryQuayId !== null && (
        <div className="tide-panel__row tide-panel__row--ferry">
          <UiIcon name="ferry" size={20} />
          <span>
            Bac · Quai {ferryQuayId} <small>{islandNameOf(tidal.islands, tidal.islandNames, ferryQuayId)}</small>
          </span>
          {nextQuay !== null && (
            <span className="tide-panel__next">
              → Quai {nextQuay} <small>{islandNameOf(tidal.islands, tidal.islandNames, nextQuay)}</small>
            </span>
          )}
        </div>
      )}
    </aside>
  );
}
