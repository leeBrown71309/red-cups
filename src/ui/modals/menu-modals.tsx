import { useEffect, useState } from "react";
import { useGameStore } from "../../game/store";
import { AudioSliders } from "../components/audio-controls";
import { ModalShell } from "../components/modal-shell";
import { UiIcon } from "../icons/ui-icon";

type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void };

function useFullscreen(): { active: boolean; supported: boolean; toggle: () => void } {
  const [active, setActive] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const update = () =>
      setActive(Boolean(document.fullscreenElement ?? (document as FullscreenDocument).webkitFullscreenElement));
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
    };
  }, []);

  const root = document.documentElement as FullscreenElement;
  const supported = Boolean(root.requestFullscreen ?? root.webkitRequestFullscreen);
  const toggle = () => {
    const doc = document as FullscreenDocument;
    try {
      if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
        void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else if (root.requestFullscreen) {
        void root.requestFullscreen().catch((error: unknown) => console.warn("Fullscreen was refused.", error));
      } else {
        root.webkitRequestFullscreen?.();
      }
    } catch (error) {
      console.warn("Fullscreen is unavailable.", error);
    }
  };

  return { active, supported, toggle };
}

interface PauseMenuProps {
  onClose: () => void;
  onOpenHelp: () => void;
  onOpenJournal: () => void;
}

export function PauseMenu({ onClose, onOpenHelp, onOpenJournal }: PauseMenuProps) {
  const resetGame = useGameStore((state) => state.resetGame);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const fullscreen = useFullscreen();

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
        {fullscreen.supported && (
          <button type="button" className="btn btn--cream btn--block" onClick={fullscreen.toggle}>
            <UiIcon name={fullscreen.active ? "shrink" : "expand"} size={20} />
            {fullscreen.active ? "Quitter le plein écran" : "Plein écran"}
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
