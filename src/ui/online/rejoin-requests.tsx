import { PLAYER_COLORS } from "../../game/types";
import { useRoomStore } from "../../net/room-store";
import { PlayerAvatar } from "../components/player-avatar";
import { UiIcon } from "../icons/ui-icon";

/**
 * Host only: a player the host sent away asks to come back. A card in the corner,
 * out of the way of the game, until the host accepts or refuses.
 */
export function RejoinRequests() {
  const requests = useRoomStore((state) => state.rejoinRequests);
  const busy = useRoomStore((state) => state.busy);
  const answer = useRoomStore((state) => state.answerRejoin);
  if (requests.length === 0) return null;

  return (
    <ul className="rejoin-requests" aria-live="polite">
      {requests.map((request) => (
        <li key={request.userId} className="rejoin-requests__item">
          <PlayerAvatar color={PLAYER_COLORS[request.avatar] ?? PLAYER_COLORS[0]} size={40} />
          <p>
            <strong>{request.name}</strong> demande à revenir à la table.
          </p>
          <div className="rejoin-requests__actions">
            <button
              type="button"
              className="btn btn--cup btn--small"
              disabled={busy}
              onClick={() => void answer(request.userId, true)}
            >
              <UiIcon name="check" size={16} /> Accepter
            </button>
            <button
              type="button"
              className="btn btn--cream btn--small"
              disabled={busy}
              onClick={() => void answer(request.userId, false)}
            >
              Refuser
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
