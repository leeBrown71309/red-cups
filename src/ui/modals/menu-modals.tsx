import { useState } from "react";
import { canAbandon } from "../../game/abandon";
import { useGameStore } from "../../game/store";
import type { PlayerId } from "../../game/types";
import { useLocalPlayerId, useRoomStore } from "../../net/room-store";
import { AudioSliders } from "../components/audio-controls";
import { ModalShell } from "../components/modal-shell";
import { PlayerAvatar } from "../components/player-avatar";
import { useFullscreenToggle } from "../fullscreen";
import { usePauseControls } from "../hud/pause-controls";
import { UiIcon } from "../icons/ui-icon";
import { useLogReader } from "../log-text";
import { PlayerPickList } from "./decision-modals";

interface PauseMenuProps {
  onClose: () => void;
  onOpenHelp: () => void;
  onOpenJournal: () => void;
  onOpenAbandon: () => void;
}

export function PauseMenu({ onClose, onOpenHelp, onOpenJournal, onOpenAbandon }: PauseMenuProps) {
  const resetGame = useGameStore((state) => state.resetGame);
  const leaveRoom = useRoomStore((state) => state.leave);
  const isOnline = useLocalPlayerId() !== null;
  const [confirmQuit, setConfirmQuit] = useState(false);
  // Online, quitting leaves the room and abandons the game, so the others play on.
  const quit = () => (isOnline ? void leaveRoom() : resetGame());
  const fullscreen = useFullscreenToggle();
  const tablePause = usePauseControls();
  const paused = useGameStore((state) => state.pause !== null);

  return (
    <ModalShell title="Pause" eyebrow="Red Cups" size="small" onClose={onClose} className="pause-menu">
      <div className="pause-menu__list">
        <button type="button" className="btn btn--cup btn--block" onClick={onClose} data-autofocus>
          <UiIcon name="play" size={20} /> {paused ? "Retour" : "Reprendre"}
        </button>
        {/* Online, this menu does not stop the game: only the host's pause stops it for everyone. */}
        {tablePause.offered && !paused && (
          <button
            type="button"
            className="btn btn--sky btn--block"
            onClick={() => {
              tablePause.pause();
              onClose();
            }}
            disabled={!tablePause.available}
            title={tablePause.available ? undefined : "Pause possible à la fin du mini-jeu"}
          >
            <UiIcon name="pause" size={20} /> Pause pour toute la table
          </button>
        )}
        <button type="button" className="btn btn--cream btn--block" onClick={onOpenHelp}>
          <UiIcon name="help" size={20} /> Comment jouer
        </button>
        <button type="button" className="btn btn--cream btn--block" onClick={onOpenJournal}>
          <UiIcon name="journal" size={20} /> Journal de la partie
        </button>
        {fullscreen.available && (
          <button type="button" className="btn btn--cream btn--block" onClick={fullscreen.toggle}>
            <UiIcon name={fullscreen.active ? "shrink" : "expand"} size={20} />
            {fullscreen.active ? "Quitter le plein écran" : "Plein écran"}
          </button>
        )}
        <button type="button" className="btn btn--cream btn--block" onClick={onOpenAbandon}>
          <UiIcon name="flag" size={20} /> Abandonner…
        </button>
      </div>
      <AudioSliders />
      <button
        type="button"
        className={`btn btn--block ${confirmQuit ? "btn--grape" : "btn--ghost"}`}
        onClick={() => (confirmQuit ? quit() : setConfirmQuit(true))}
      >
        {confirmQuit
          ? isOnline
            ? "Vraiment quitter ? Tu abandonnes la partie"
            : "Vraiment quitter ? La partie sera perdue"
          : "Quitter la partie"}
      </button>
    </ModalShell>
  );
}

/**
 * One player leaves while the others play on. At a local table the host
 * picks who leaves; online you can only abandon for yourself. With two
 * players left, the other one wins.
 */
export function AbandonModal({ onClose }: { onClose: () => void }) {
  const players = useGameStore((state) => state.players);
  const allowed = useGameStore(canAbandon);
  const abandonGame = useGameStore((state) => state.abandonGame);
  const localPlayerId = useLocalPlayerId();
  const leaveRoom = useRoomStore((state) => state.leave);
  const [pickedId, setLeaverId] = useState<PlayerId | null>(null);
  const leaverId = localPlayerId ?? pickedId;
  const leaver = players.find((player) => player.id === leaverId);
  const survivor = players.length === 2 ? players.find((player) => player.id !== leaverId) : undefined;

  return (
    <ModalShell title="Abandonner" eyebrow="Quitter la table" onClose={onClose} className="abandon-modal">
      {!allowed ? (
        <p className="modal-lead">
          Une roue, un duel ou une décision est en cours : termine-le, puis reviens ici pour abandonner.
        </p>
      ) : leaver ? (
        <>
          <div className="abandon-modal__leaver">
            <PlayerAvatar color={leaver.color} size={64} expression="worried" />
            <p className="modal-lead">
              <strong>{leaver.name}</strong> quitte la partie : ses Red Cups et ses objets quittent le plateau aussi.{" "}
              {survivor
                ? `${survivor.name} sera la dernière personne en jeu et gagnera la partie.`
                : "Les autres joueurs continuent la partie."}
            </p>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn--cream"
              onClick={() => (localPlayerId ? onClose() : setLeaverId(null))}
            >
              Retour
            </button>
            <button
              type="button"
              className="btn btn--grape"
              onClick={() => {
                // Online there is no watching from the side: abandoning also leaves the room.
                if (localPlayerId) void leaveRoom();
                else abandonGame(leaver.id);
                onClose();
              }}
              data-autofocus
            >
              <UiIcon name="flag" size={20} /> Abandonner
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="modal-lead">Qui quitte la partie ? Les autres joueurs continuent.</p>
          <PlayerPickList players={players} onPick={setLeaverId} />
        </>
      )}
    </ModalShell>
  );
}

export function JournalModal({ onClose }: { onClose: () => void }) {
  const log = useGameStore((state) => state.log);
  const readEntry = useLogReader();

  return (
    <ModalShell title="Journal" eyebrow="La table se souvient" onClose={onClose} className="journal-modal">
      <ol className="journal">
        {log.map((entry) => (
          <li key={entry.id} className={`journal__entry journal__entry--${entry.tone}`}>
            <span className="journal__dot" aria-hidden="true" />
            {readEntry(entry)}
          </li>
        ))}
      </ol>
    </ModalShell>
  );
}
