import { getBoardMap, type MapChoice } from "../../game/maps/map-registry";
import { MapCarousel } from "../components/map-carousel";
import { useMapChoiceStore } from "./map-choice-store";

/**
 * Board choice, the lobby step after the players: the map carousel bound to
 * the remembered choice. Picking a map also shows it in 3D behind the lobby.
 */
export function MapPicker() {
  const choice = useMapChoiceStore((state) => state.choice);
  const setChoice = useMapChoiceStore((state) => state.setChoice);
  return <MapCarousel value={choice} onChange={setChoice} />;
}

/** Line under the start button: where the first Cup waits, or that the board will be drawn. */
export function describeMapChoice(choice: MapChoice): string {
  if (choice === "random") return "La carte sera tirée au sort au lancement.";
  const map = getBoardMap(choice);
  return `${map.name} : la première Red Cup attend en case ${map.initialCupNodeId}.`;
}
