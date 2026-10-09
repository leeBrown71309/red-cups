import { useGameStore } from "../../game/store";
import { useLocalPlayerId, useRoomStore } from "../../net/room-store";
import { UiIcon } from "../icons/ui-icon";

/** Online, whoever abandoned keeps their seat in the room: they watch on, and may join the rematch. */
export function LeftTableBanner() {
  const localPlayerId = useLocalPlayerId();
  const playing = useGameStore((state) => state.phase === "playing");
  const hasLeft = useGameStore((state) => state.abandonedPlayers.some((player) => player.id === localPlayerId));
  const leaveRoom = useRoomStore((state) => state.leave);
  if (!localPlayerId || !playing || !hasLeft) return null;

  return (
    <div className="hud-ribbon" role="status">
      <span>
        <UiIcon name="info" size={18} /> Tu as quitté la partie : tu restes au salon pour la revanche.
      </span>
      <button type="button" className="btn btn--cream" onClick={() => void leaveRoom()}>
        Quitter le salon
      </button>
    </div>
  );
}
