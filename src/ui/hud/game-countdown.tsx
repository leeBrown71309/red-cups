import { useEffect, useState } from "react";
import { useUiStore } from "../../feedback/ui-store";

const TICK_MS = 100;

/** Once the draft is over: « La partie commence dans 5… », then the first turn. */
export function GameCountdown() {
  const countdownUntil = useUiStore((state) => state.countdownUntil);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (countdownUntil <= performance.now()) return undefined;
    const timer = window.setInterval(() => setNow(performance.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [countdownUntil]);

  const seconds = Math.ceil((countdownUntil - now) / 1_000);
  if (seconds <= 0) return null;
  return (
    <div className="game-countdown" role="status" aria-live="assertive">
      <span className="game-countdown__label">La partie commence dans</span>
      <strong key={seconds} className="game-countdown__number">
        {seconds}
      </strong>
    </div>
  );
}
