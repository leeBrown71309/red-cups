import { MAP_ORDER, getBoardMap, type MapChoice } from "../../game/maps/map-registry";
import { BoardMap } from "../components/board-map";
import { UiIcon } from "../icons/ui-icon";
import { useMapChoiceStore } from "./map-choice-store";

/**
 * Board choice, the lobby step after the players: a random option that lets
 * the game draw the board at kickoff, then one option per map with its flat
 * plan and what makes it special. Picking a map also shows it in 3D
 * behind the lobby.
 */
export function MapPicker() {
  const choice = useMapChoiceStore((state) => state.choice);
  const setChoice = useMapChoiceStore((state) => state.setChoice);

  return (
    <div className="map-picker" role="radiogroup" aria-label="Carte de la partie">
      {/* Random always comes first, however many maps are added below it. */}
      <button
        type="button"
        role="radio"
        aria-checked={choice === "random"}
        className={`map-option ${choice === "random" ? "is-selected" : ""}`}
        onClick={() => setChoice("random")}
      >
        <span className="map-option__preview map-option__preview--random" aria-hidden="true">
          <UiIcon name="dice" size={34} />
        </span>
        <span className="map-option__text">
          <strong>Aléatoire</strong>
          <small>Le jeu tire la carte au sort au lancement de la partie, parmi {MAP_ORDER.length} plateaux.</small>
        </span>
      </button>
      {MAP_ORDER.map((mapId) => {
        const map = getBoardMap(mapId);
        const selected = choice === mapId;
        return (
          <button
            key={mapId}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`map-option ${selected ? "is-selected" : ""}`}
            onClick={() => setChoice(mapId)}
          >
            <span className="map-option__preview">
              <BoardMap mapId={mapId} />
            </span>
            <span className="map-option__text">
              <strong>{map.name}</strong>
              <small>{map.tagline}</small>
              <span className="map-option__highlights">
                {map.highlights.map((highlight) => (
                  <span key={highlight}>{highlight}</span>
                ))}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Line under the start button: where the first Cup waits, or that the board will be drawn. */
export function describeMapChoice(choice: MapChoice): string {
  if (choice === "random") return "La carte sera tirée au sort au lancement.";
  const map = getBoardMap(choice);
  return `${map.name} : la première Red Cup attend en case ${map.initialCupNodeId}.`;
}
