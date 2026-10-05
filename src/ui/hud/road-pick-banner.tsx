import { useGameStore } from "../../game/store";
import { useUiStore } from "../../feedback/ui-store";
import { ITEM_CATALOG } from "../../game/catalog";
import { UiIcon } from "../icons/ui-icon";

/** While a Barrière is being set down: what to do, and a way out. The road itself is tapped on the board. */
export function RoadPickBanner() {
  const entryId = useUiStore((state) => state.roadPickEntryId);
  const setRoadPickEntryId = useUiStore((state) => state.setRoadPickEntryId);
  const activePlayer = useGameStore((state) => state.players[state.activePlayerIndex]);
  const entry = activePlayer?.inventory.find((candidate) => candidate.id === entryId);
  if (!entryId || entry?.kind !== "item") return null;

  return (
    <div className="road-pick-banner" role="status">
      <span>
        <UiIcon name="info" size={18} /> {ITEM_CATALOG[entry.itemId].name} : touche la route à fermer sur le plateau.
      </span>
      <button type="button" className="btn btn--cream" onClick={() => setRoadPickEntryId(null)}>
        Annuler
      </button>
    </div>
  );
}
