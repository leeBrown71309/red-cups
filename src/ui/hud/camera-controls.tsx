import { useUiStore } from "../../feedback/ui-store";
import { boardCamera } from "../../scene/board-stage";
import { UiIcon } from "../icons/ui-icon";

/** Zoom and recentre buttons; pinch, wheel and drag also work on the board. */
export function CameraControls() {
  const follow = useUiStore((state) => state.followActivePlayer);
  const toggleFollow = useUiStore((state) => state.toggleFollowActivePlayer);

  return (
    <div className="camera-controls" aria-label="Caméra">
      <button type="button" className="icon-button" onClick={() => boardCamera.zoomIn()} aria-label="Zoomer">
        <UiIcon name="plus" />
      </button>
      <button type="button" className="icon-button" onClick={() => boardCamera.zoomOut()} aria-label="Dézoomer">
        <UiIcon name="minus" />
      </button>
      <button type="button" className="icon-button" onClick={() => boardCamera.recenter()} aria-label="Vue d’ensemble">
        <UiIcon name="recenter" />
      </button>
      <button
        type="button"
        className={`icon-button ${follow ? "is-on" : ""}`}
        onClick={toggleFollow}
        aria-pressed={follow}
        aria-label="Suivre le joueur actif"
        title="Suivre le joueur actif"
      >
        <UiIcon name="follow" />
      </button>
    </div>
  );
}
