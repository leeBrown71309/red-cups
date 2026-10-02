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
  const coWinnerId = useGameStore((state) => state.coWinnerId);
  const devilHellEntries = useGameStore((state) => state.devilHellEntries);
  const mapId = useGameStore((state) => state.mapId);
  const startGame = useGameStore((state) => state.startGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const leaveRoom = useRoomStore((state) => state.leave);
  const rematchRoom = useRoomStore((state) => state.rematch);
  const isHost = useRoomStore((state) => state.myUserId !== null && state.myUserId === state.hostId);
  const seatedCount = useRoomStore((state) => state.players.filter((player) => !player.absent).length);
  const roomBusy = useRoomStore((state) => state.busy);
  const roomError = useRoomStore((state) => state.error);
  const isOnline = useLocalPlayerId() !== null;
  const [pickingMap, setPickingMap] = useState(false);
  // The rematch offers the board just played first; any other map, or a draw, is one arrow away.
  const [rematchChoice, setRematchChoice] = useState<MapChoice>(mapId);
  const winner = players.find((player) => player.id === winnerId);
  const angel = players.find((player) => player.id === coWinnerId);
  if (!winner) return null;

  // A rematch replays the same table. Online, the host starts it for whoever is still in the room.
  const canRematch = isOnline ? isHost && seatedCount >= 2 : players.length >= 2;
  const startRematch = () => {
    const nextMapId = resolveMapChoice(rematchChoice);
    if (isOnline) void rematchRoom(nextMapId);
    else
      startGame(
        players.map((player) => player.name),
        undefined,
        nextMapId,
        true,
      );
  };

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
          <p className="victory__map-note">
            {isOnline
              ? `${describeMapChoice(rematchChoice)} Tous ceux encore dans le salon rejouent.`
              : describeMapChoice(rematchChoice)}
          </p>
          {isOnline && roomError && <p className="victory__map-note victory__error">{roomError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn--cream" onClick={() => setPickingMap(false)}>
              ← Retour
            </button>
            <button type="button" className="btn btn--cup" onClick={startRematch} disabled={roomBusy} data-autofocus>
              <UiIcon name="play" size={20} /> {roomBusy ? "Lancement…" : "Rejouer"}
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
            {winReason === "forfeit"
              ? "Dernière personne à table"
              : winReason === "greedy"
                ? "5 000 pièces. Cupide rafle la mise."
                : winReason === "devil"
                  ? `${devilHellEntries} entrées en Enfer. Le diable l’emporte.`
                  : "Trois Red Cups. Une légende."}
          </span>
          <h2 id="victory-title" className="victory__title">
            {winner.name} gagne la partie !
          </h2>
          {angel && <p className="victory__map-note">Avec {angel.name}, son Ange-Gardien, qui gagne avec lui.</p>}
          <StandingsList state={{ players, abandonedPlayers, winnerId, coWinnerId }} />
          {isOnline && !isHost && (
            <p className="victory__map-note">Reste dans le salon : l’hôte peut lancer une revanche.</p>
          )}
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
