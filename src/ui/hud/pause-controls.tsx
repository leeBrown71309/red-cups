import { useEffect, useState } from "react";
import { canPauseGame, canResumeGame, getHostPlayerId, PAUSE_TAKEOVER_MS } from "../../game/pause";
import { useGameStore } from "../../game/store";
import { getServerNow, useLocalPlayerId } from "../../net/room-store";
import { ModalShell } from "../components/modal-shell";
import { UiIcon } from "../icons/ui-icon";

const TICK_MS = 1_000;

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The server's time, refreshed every second while `running`. */
function useServerClock(running: boolean): number {
  const [now, setNow] = useState(() => getServerNow());
  useEffect(() => {
    if (!running) return undefined;
    setNow(getServerNow());
    const timer = window.setInterval(() => setNow(getServerNow()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [running]);
  return now;
}

/**
 * Online only: what this device may do with the pause. Only the host pauses;
 * a local game has no clock to stop and never offers it.
 */
export function usePauseControls() {
  const localPlayerId = useLocalPlayerId();
  const isHost = useGameStore((state) => localPlayerId !== null && getHostPlayerId(state) === localPlayerId);
  const pausable = useGameStore(canPauseGame);
  const playing = useGameStore((state) => state.phase === "playing");
  const pauseGame = useGameStore((state) => state.pauseGame);
  return {
    /** The host sees the control, even when a mini-game holds it back for now. */
    offered: isHost && playing,
    available: isHost && pausable,
    pause: () => {
      if (localPlayerId) pauseGame(localPlayerId);
    },
  };
}

/** Top bar: the host stops the game for the whole table. */
export function PauseButton() {
  const paused = useGameStore((state) => state.pause !== null);
  const { offered, available, pause } = usePauseControls();
  if (!offered || paused) return null;
  const label = available ? "Mettre la partie en pause" : "Pause possible à la fin du mini-jeu";
  return (
    <button
      type="button"
      className="icon-button pause-button"
      onClick={pause}
      disabled={!available}
      aria-label={label}
      title={label}
    >
      <UiIcon name="pause" strokeWidth={3} />
    </button>
  );
}

/**
 * Covers the board while the host holds the game: nobody plays, no clock
 * runs. The host resumes; should they stay away too long, anybody may.
 */
export function PauseOverlay({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pause = useGameStore((state) => state.pause);
  const players = useGameStore((state) => state.players);
  const resumeGame = useGameStore((state) => state.resumeGame);
  const localPlayerId = useLocalPlayerId();
  const now = useServerClock(pause !== null);
  const game = useGameStore();
  if (!pause) return null;

  const pausedBy = players.find((player) => player.id === pause.byPlayerId);
  const hostId = getHostPlayerId(game);
  const host = players.find((player) => player.id === hostId);
  const elapsed = now - pause.since;
  const canResume = localPlayerId !== null && canResumeGame(game, localPlayerId, now);
  const isHost = localPlayerId !== null && localPlayerId === hostId;

  return (
    <ModalShell
      title="Partie en pause"
      eyebrow="Toute la table attend"
      tone="sky"
      size="small"
      className="pause-overlay"
    >
      <div className="pause-overlay__badge" aria-hidden="true">
        <UiIcon name="pause" size={34} strokeWidth={3.2} />
      </div>
      <p className="modal-lead">
        {pausedBy ? <strong>{pausedBy.name}</strong> : "L’hôte"} a mis la partie en pause : les chronos sont arrêtés et
        personne ne peut jouer.
      </p>
      <p className="pause-overlay__elapsed">
        <UiIcon name="clock" size={16} /> En pause depuis {formatDuration(elapsed)}
      </p>
      {!canResume && (
        <p className="pause-overlay__note">
          {host ? host.name : "L’hôte"} relancera la partie. Sans nouvelles de sa part, tout le monde pourra la relancer
          dans {formatDuration(PAUSE_TAKEOVER_MS - elapsed)}.
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn--cream" onClick={onOpenMenu}>
          <UiIcon name="menu" size={20} /> Menu
        </button>
        {canResume && localPlayerId && (
          <button type="button" className="btn btn--cup" onClick={() => resumeGame(localPlayerId)} data-autofocus>
            <UiIcon name="play" size={20} /> {isHost ? "Reprendre la partie" : "Relancer la partie"}
          </button>
        )}
      </div>
    </ModalShell>
  );
}
