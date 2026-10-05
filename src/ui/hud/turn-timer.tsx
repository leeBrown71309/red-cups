import { useEffect, useState } from "react";
import { useGameStore } from "../../game/store";
import {
  getClockDeadline,
  getClockMsLeft,
  HELD_CLOCK_SHOWN_MS,
  isActiveDecision,
  isClockHeld,
} from "../../game/turn-clock";
import { getServerNow } from "../../net/room-store";
import { UiIcon } from "../icons/ui-icon";

/** Seconds from which the countdown turns red. */
const HURRY_SECONDS = 10;
const TICK_MS = 250;

/**
 * Online only: the seconds left to whoever must decide, the active player's
 * turn or somebody else's choice, and the pause while the host holds the
 * game. Nothing in a local game, which has no clock.
 */
export function TurnTimer({ className = "" }: { className?: string }) {
  const deadline = useGameStore(getClockDeadline);
  const ownTurn = useGameStore(isActiveDecision);
  const paused = useGameStore((state) => state.pause !== null);
  const held = useGameStore(isClockHeld);
  const duel = useGameStore((state) => state.turnStage === "duel" || state.turnStage === "duel-choice");
  const game = useGameStore();
  const [now, setNow] = useState(() => getServerNow());

  useEffect(() => {
    if (deadline === null) return undefined;
    const timer = window.setInterval(() => setNow(getServerNow()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [deadline]);

  if (paused) {
    return (
      <span className={`turn-timer is-paused ${className}`} title="Partie en pause : le chrono est arrêté">
        <UiIcon name="pause" strokeWidth={3} /> Pause
      </span>
    );
  }
  const msLeft = getClockMsLeft(game, now);
  if (deadline === null || msLeft === null) return null;
  // The turn waits for the duel or the wheel; its safety clock only shows when somebody is about to be played for.
  if (held && msLeft > HELD_CLOCK_SHOWN_MS) {
    const what = duel ? "Duel" : "Roue";
    return (
      <span className={`turn-timer is-paused ${className}`} title={`${what} en cours : le chrono du tour est arrêté`}>
        <UiIcon name="pause" strokeWidth={3} /> {what}
      </span>
    );
  }
  const seconds = Math.max(0, Math.ceil(msLeft / 1_000));
  const hurry = seconds <= HURRY_SECONDS;
  return (
    <span
      className={`turn-timer ${hurry ? "is-hurry" : ""} ${className}`}
      title={ownTurn ? "Temps restant pour ce tour" : "Temps restant pour décider"}
      aria-label={`${seconds} secondes restantes`}
      role="timer"
    >
      <UiIcon name="clock" strokeWidth={2.8} /> {seconds} s
    </span>
  );
}
