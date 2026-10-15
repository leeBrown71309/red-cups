import { useMemo, useState, type CSSProperties } from "react";
import { resolveMapChoice, type MapChoice } from "../../game/maps/map-registry";
import { getChosenWorldStyle } from "../lobby/map-choice-store";
import { useGameStore } from "../../game/store";
import { FOOL_GOAL, GREEDY_GOAL } from "../../game/types";
import { useLocalPlayerId, useRoomStore } from "../../net/room-store";
import { MapCarousel } from "../components/map-carousel";
import { PlayerAvatar } from "../components/player-avatar";
import { StandingsList } from "../components/standings-list";
import { UiIcon } from "../icons/ui-icon";
import { formatCurrency } from "../display/game-display";
import { describeMapChoice } from "../lobby/map-picker";

const CONFETTI_PIECES = 64;

/**
 * One piece of confetti: scattered anywhere across the screen, with its own fall time, sway, spin and size. The
 * delay is negative so the screen is already full of confetti when the modal opens, instead of falling in rows.
 */
function createConfettiStyle(): CSSProperties {
  const duration = 2.8 + Math.random() * 2.6;
  return {
    left: `${Math.random() * 100}%`,
    width: `${8 + Math.random() * 8}px`,
    height: `${12 + Math.random() * 10}px`,
    animationDuration: `${duration}s`,
    animationDelay: `${-Math.random() * duration}s`,
    "--confetti-sway": `${(Math.random() - 0.5) * 160}px`,
    "--confetti-spin": `${(Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 720)}deg`,
  } as CSSProperties;
}

export function VictoryModal() {
  const players = useGameStore((state) => state.players);
  const abandonedPlayers = useGameStore((state) => state.abandonedPlayers);
  const winnerId = useGameStore((state) => state.winnerId);
  const winReason = useGameStore((state) => state.winReason);
  const coWinnerId = useGameStore((state) => state.coWinnerId);
  const devilHellTurns = useGameStore((state) => state.devilHellTurns);
  const mapId = useGameStore((state) => state.mapId);
  const startGame = useGameStore((state) => state.startGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const leaveRoom = useRoomStore((state) => state.leave);
  const rematchRoom = useRoomStore((state) => state.rematch);
  const isHost = useRoomStore((state) => state.myUserId !== null && state.myUserId === state.hostId);
  const seatedCount = useRoomStore((state) => state.players.filter((player) => !player.absent).length);
  const roomBusy = useRoomStore((state) => state.busy);
  const isOnline = useLocalPlayerId() !== null;
  const [pickingMap, setPickingMap] = useState(false);
  // The rematch offers the board just played first; any other map, or a draw, is one arrow away.
  const [rematchChoice, setRematchChoice] = useState<MapChoice>(mapId);
  // The winner may have left since (a forfeit, the host's kick): the final table still shows, never a blank page.
  const winner = players.find((player) => player.id === winnerId) ?? abandonedPlayers.find((p) => p.id === winnerId);
  const angel = players.find((player) => player.id === coWinnerId);
  const confettiStyles = useMemo(() => Array.from({ length: CONFETTI_PIECES }, createConfettiStyle), []);

  // A rematch replays the same table. Online, the host starts it for whoever is still in the room.
  const canRematch = (isOnline ? isHost && seatedCount >= 2 : players.length >= 2) && winner !== undefined;
  // The same table replays: a large map needs as many players as it asks for.
  const rematchPlayers = isOnline ? seatedCount : players.length;
  const startRematch = () => {
    const nextMapId = resolveMapChoice(rematchChoice, Math.random, rematchPlayers);
    const worldStyle = getChosenWorldStyle(nextMapId);
    if (isOnline) void rematchRoom(nextMapId, worldStyle);
    else
      startGame(
        players.map((player) => player.name),
        undefined,
        nextMapId,
        true,
        worldStyle,
      );
  };

  return (
    <div className="modal-layer victory" role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <div className="modal-backdrop" />
      <div className="victory__confetti" aria-hidden="true">
        {confettiStyles.map((style, index) => (
          <i key={index} style={style} />
        ))}
      </div>
      {canRematch && pickingMap ? (
        <section className="modal-card modal-card--gold modal-card--medium victory__card">
          <span className="modal-card__eyebrow">Revanche · même table</span>
          <h2 id="victory-title" className="victory__title">
            Sur quelle carte ?
          </h2>
          <MapCarousel value={rematchChoice} onChange={setRematchChoice} compact playerCount={rematchPlayers} />
          <p className="victory__map-note">
            {isOnline
              ? `${describeMapChoice(rematchChoice)} Tous ceux encore dans le salon rejouent.`
              : describeMapChoice(rematchChoice)}
          </p>
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
            {winner && <PlayerAvatar color={winner.color} size={120} />}
          </div>
          <span className="modal-card__eyebrow">
            {winReason === "forfeit"
              ? "Dernière personne à table"
              : winReason === "greedy"
                ? `${formatCurrency(GREEDY_GOAL)} pièces. Cupide rafle la mise.`
                : winReason === "fool"
                  ? `${formatCurrency(FOOL_GOAL)} pièces. Le Fou a tout perdu et tout gagné.`
                  : winReason === "devil"
                    ? `${devilHellTurns} tours passés en Enfer. Le diable l’emporte.`
                    : "Trois Red Cups. Une légende."}
          </span>
          <h2 id="victory-title" className="victory__title">
            {winner ? `${winner.name} gagne la partie !` : "Partie terminée"}
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
