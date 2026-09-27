import { useGameStore } from "../../game/store";
import { useLocalPlayerId, useRoomStore } from "../../net/room-store";
import { PlayerAvatar } from "../components/player-avatar";
import { StandingsList } from "../components/standings-list";
import { UiIcon } from "../icons/ui-icon";
import { drawChosenMap } from "../lobby/map-choice-store";

const CONFETTI_PIECES = 36;

export function VictoryModal() {
  const players = useGameStore((state) => state.players);
  const abandonedPlayers = useGameStore((state) => state.abandonedPlayers);
  const winnerId = useGameStore((state) => state.winnerId);
  const winReason = useGameStore((state) => state.winReason);
  const startGame = useGameStore((state) => state.startGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const leaveRoom = useRoomStore((state) => state.leave);
  const isOnline = useLocalPlayerId() !== null;
  const winner = players.find((player) => player.id === winnerId);
  if (!winner) return null;

  // A rematch replays the same local table; online, everybody goes back to the menu.
  const canRematch = !isOnline && players.length >= 2;

  return (
    <div className="modal-layer victory" role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <div className="modal-backdrop" />
      <div className="victory__confetti" aria-hidden="true">
        {Array.from({ length: CONFETTI_PIECES }, (_, index) => (
          <i key={index} style={{ left: `${(index * 97) % 100}%`, animationDelay: `${(index % 12) * 0.12}s` }} />
        ))}
      </div>
      <section className="modal-card modal-card--gold modal-card--medium victory__card">
        <div className="victory__hero">
          <UiIcon name="crown" size={42} className="victory__crown" />
          <PlayerAvatar color={winner.color} size={120} />
        </div>
        <span className="modal-card__eyebrow">
          {winReason === "forfeit" ? "Dernière personne à table" : "Trois Red Cups. Une légende."}
        </span>
        <h2 id="victory-title" className="victory__title">
          {winner.name} gagne la partie !
        </h2>
        <StandingsList state={{ players, abandonedPlayers, winnerId }} />
        <div className="modal-actions">
          <button
            type="button"
            className={`btn ${canRematch ? "btn--cream" : "btn--cup"}`}
            onClick={() => (isOnline ? void leaveRoom() : resetGame())}
          >
            {isOnline ? "Quitter le salon" : "Menu principal"}
          </button>
          {canRematch && (
            <button
              type="button"
              className="btn btn--cup"
              onClick={() =>
                startGame(
                  players.map((player) => player.name),
                  undefined,
                  drawChosenMap(),
                )
              }
              data-autofocus
            >
              <UiIcon name="refresh" size={20} /> Revanche !
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
