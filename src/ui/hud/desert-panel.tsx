import { useMemo } from "react";
import { getKnownRealCup } from "../../game/desert";
import { getBoardMap } from "../../game/maps/map-registry";
import { useGameStore } from "../../game/store";
import { getClosedPasses, getRoundsUntilStorm } from "../../game/tide";
import { STORM_ROUNDS } from "../../game/types";
import { useLocalPlayerId } from "../../net/room-store";
import { UiIcon } from "../icons/ui-icon";

/**
 * Désert des Mirages: the sandstorm and the caravan, always on show. The storm shifts every four rounds and the panel
 * says when, so nobody is caught on a pass by surprise. A player who drank at a well also reads here which Cup is the
 * real one: the panel of the others says nothing, and nothing in the journal ever does.
 */
export function DesertPanel() {
  const mapId = useGameStore((state) => state.mapId);
  const round = useGameStore((state) => state.round);
  const caravanNodeId = useGameStore((state) => state.caravanNodeId);
  const cupPairId = useGameStore((state) => state.cupPairId);
  const wellKnowledge = useGameStore((state) => state.wellKnowledge);
  const viewerId = useLocalPlayerId();
  const activeId = useGameStore((state) => state.players[state.activePlayerIndex]?.id ?? null);
  const map = getBoardMap(mapId);
  const closed = useMemo(() => getClosedPasses(map, round), [map, round]);
  if (!map.desert) return null;

  const roundsLeft = getRoundsUntilStorm(round);
  const turnsSoon = roundsLeft === 1;
  // Online, each screen reads its own player's knowledge; on a single screen (tests, dev) the player to act reads theirs.
  const knownRealNodeId = getKnownRealCup({ wellKnowledge, cupPairId }, viewerId ?? activeId);
  return (
    <aside className={`desert-panel${turnsSoon ? " is-turning" : ""}`} aria-label="Tempête et caravane">
      <div className="desert-panel__row">
        <UiIcon name="waves" size={20} />
        <span className="desert-panel__title">Passes {closed.join(" · ")} fermées</span>
        <span className="desert-panel__pips" role="img" aria-label={`Encore ${roundsLeft} tour de table`}>
          {Array.from({ length: STORM_ROUNDS }, (_, index) => (
            <i key={index} className={index < STORM_ROUNDS - roundsLeft ? "is-spent" : ""} />
          ))}
        </span>
        <span className="desert-panel__next">
          {turnsSoon ? "tempête au prochain tour" : `tempête dans ${roundsLeft} tours`}
        </span>
      </div>
      {caravanNodeId !== null && (
        <div className="desert-panel__row desert-panel__row--caravan">
          <UiIcon name="ferry" size={20} />
          <span>
            Caravane · case {caravanNodeId} <small>(avance de 2 cases par tour)</small>
          </span>
        </div>
      )}
      {knownRealNodeId !== null && (
        <div className="desert-panel__row desert-panel__row--secret">
          <UiIcon name="eye" size={20} />
          <span>La vraie Red Cup est en case {knownRealNodeId} : secret du puits</span>
        </div>
      )}
    </aside>
  );
}
