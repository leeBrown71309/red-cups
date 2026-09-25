import { useState } from "react";
import { useGameStore } from "../../game/store";
import { AudioSliders } from "../components/audio-controls";
import { ModalShell } from "../components/modal-shell";
import { enterGameFullscreen, exitGameFullscreen, isFullscreenSupported, useFullscreenState } from "../fullscreen";
import { UiIcon } from "../icons/ui-icon";

interface PauseMenuProps {
  onClose: () => void;
  onOpenHelp: () => void;
  onOpenJournal: () => void;
}

export function PauseMenu({ onClose, onOpenHelp, onOpenJournal }: PauseMenuProps) {
  const resetGame = useGameStore((state) => state.resetGame);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const fullscreenActive = useFullscreenState();
  const toggleFullscreen = () => (fullscreenActive ? exitGameFullscreen() : void enterGameFullscreen());

  return (
    <ModalShell title="Pause" eyebrow="Red Cups" size="small" onClose={onClose} className="pause-menu">
      <div className="pause-menu__list">
        <button type="button" className="btn btn--cup btn--block" onClick={onClose} data-autofocus>
          <UiIcon name="play" size={20} /> Reprendre
        </button>
        <button type="button" className="btn btn--cream btn--block" onClick={onOpenHelp}>
          <UiIcon name="help" size={20} /> Comment jouer
        </button>
        <button type="button" className="btn btn--cream btn--block" onClick={onOpenJournal}>
          <UiIcon name="journal" size={20} /> Journal de la partie
        </button>
        {isFullscreenSupported() && (
          <button type="button" className="btn btn--cream btn--block" onClick={toggleFullscreen}>
            <UiIcon name={fullscreenActive ? "shrink" : "expand"} size={20} />
            {fullscreenActive ? "Quitter le plein écran" : "Plein écran"}
          </button>
        )}
      </div>
      <AudioSliders />
      <button
        type="button"
        className={`btn btn--block ${confirmQuit ? "btn--grape" : "btn--ghost"}`}
        onClick={() => (confirmQuit ? resetGame() : setConfirmQuit(true))}
      >
        {confirmQuit ? "Vraiment quitter ? La partie sera perdue" : "Quitter la partie"}
      </button>
    </ModalShell>
  );
}

export function JournalModal({ onClose }: { onClose: () => void }) {
  const log = useGameStore((state) => state.log);

  return (
    <ModalShell title="Journal" eyebrow="La table se souvient" onClose={onClose} className="journal-modal">
      <ol className="journal">
        {log.map((entry) => (
          <li key={entry.id} className={`journal__entry journal__entry--${entry.tone}`}>
            <span className="journal__dot" aria-hidden="true" />
            {entry.text}
          </li>
        ))}
      </ol>
    </ModalShell>
  );
}
