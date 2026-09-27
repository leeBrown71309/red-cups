import { useState } from "react";
import { resolveMapChoice, type MapChoice } from "../../game/maps/map-registry";
import { useGameStore } from "../../game/store";
import { useLocalPlayerId, useRoomStore } from "../../net/room-store";
import { MapCarousel } from "../components/map-carousel";
import { PlayerAvatar } from "../components/player-avatar";
import { StandingsList } from "../components/standings-list";
import { UiIcon } from "../icons/ui-icon";
import { describeMapChoice } from "../lobby/map-picker";

const CONFETTI_PIECES = 36;

export function VictoryModal() {
  const players = useGameStore((state) => state.players);
  const abandonedPlayers = useGameStore((state) => state.abandonedPlayers);
  const winnerId = useGameStore((state) => state.winnerId);
  const winReason = useGameStore((state) => state.winReason);
  const mapId = useGameStore((state) => state.mapId);
  const startGame = useGameStore((state) => state.startGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const leaveRoom = useRoomStore((state) => state.leave);
  const isOnline = useLocalPlayerId() !== null;
  const [pickingMap, setPickingMap] = useState(false);
  // The rematch offers the board just played first; any other map, or a draw, is one arrow away.
  const [rematchChoice, setRematchChoice] = useState<MapChoice>(mapId);
  const winner = players.find((player) => player.id === winnerId);
  if (!winner) return null;

  // A rematch replays the same local table; online, everybody goes back to the menu.
  const canRematch = !isOnline && players.length >= 2;
  const startRematch = () =>
    startGame(
      players.map((player) => player.name),
      undefined,
      resolveMapChoice(rematchChoice),
    );

  return (
    <div className="modal-layer victory" role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <div className="modal-backdrop" />
      <div className="victory__confetti" aria-hidden="true">
        {Array.from({ length: CONFETTI_PIECES }, (_, index) => (
          <i key={index} style={{ left: `${(index * 97) % 100}%`, animationDelay: `${(index % 12) * 0.12}s` }} />
        ))}
      </div>
      {canRematch && pickingMap ? (
        <section className="modal-card modal-card--gold modal-card--medium victory__card">
          <span className="modal-card__eyebrow">Revanche · même table</span>
          <h2 id="victory-title" className="victory__title">
            Sur quelle carte ?
          </h2>
          <MapCarousel value={rematchChoice} onChange={setRematchChoice} compact />
          <p className="victory__map-note">{describeMapChoice(rematchChoice)}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn--cream" onClick={() => setPickingMap(false)}>
              ← Retour
            </button>
            <button type="button" className="btn btn--cup" onClick={startRematch} data-autofocus>
              <UiIcon name="play" size={20} /> Rejouer
            </button>
          </div>
        </section>
      ) : (
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
              <button type="button" className="btn btn--cup" onClick={() => setPickingMap(true)} data-autofocus>
                <UiIcon name="refresh" size={20} /> Revanche !
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
