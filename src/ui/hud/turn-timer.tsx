import { useEffect, useState } from "react";
import { useGameStore } from "../../game/store";
import { getClockDeadline, isActiveDecision } from "../../game/turn-clock";
import { getServerNow } from "../../net/room-store";
import { UiIcon } from "../icons/ui-icon";

/** Seconds from which the countdown turns red. */
const HURRY_SECONDS = 10;
const TICK_MS = 250;

/**
 * Online only: the seconds left to whoever must decide, the active player's
 * turn or somebody else's choice. Nothing in a local game, which has no clock.
 */
export function TurnTimer() {
  const deadline = useGameStore(getClockDeadline);
  const ownTurn = useGameStore(isActiveDecision);
  const [now, setNow] = useState(() => getServerNow());

  useEffect(() => {
    if (deadline === null) return undefined;
    const timer = window.setInterval(() => setNow(getServerNow()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [deadline]);

  if (deadline === null) return null;
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1_000));
  const hurry = seconds <= HURRY_SECONDS;
  return (
    <span
      className={`turn-timer ${hurry ? "is-hurry" : ""}`}
      title={ownTurn ? "Temps restant pour ce tour" : "Temps restant pour décider"}
      aria-label={`${seconds} secondes restantes`}
    >
      <UiIcon name="clock" size={14} /> {seconds} s
    </span>
  );
}
