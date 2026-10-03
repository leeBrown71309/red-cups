import { useEffect, useRef } from "react";
import { soundEffects } from "../../audio/sound-effects";
import { useGameStore } from "../../game/store";
import { getClockDeadline, getClockMsLeft, getClockOwnerIds } from "../../game/turn-clock";
import { getServerNow, useLocalPlayerId } from "../../net/room-store";

/** The beeps start once this many seconds are left. */
const BEEP_FROM_SECONDS = 10;
const TICK_MS = 200;

/**
 * Online only: a beep for each of the last ten seconds of the clock, on the
 * device of whoever must decide, so they hear their time running out even
 * while looking at the board. Mounted once by the HUD.
 */
export function useClockBeeps(): void {
  const deadline = useGameStore(getClockDeadline);
  const localPlayerId = useLocalPlayerId();
  const isMine = useGameStore((state) => localPlayerId !== null && getClockOwnerIds(state).includes(localPlayerId));
  const lastBeep = useRef<string | null>(null);

  useEffect(() => {
    if (deadline === null || !isMine) return undefined;
    const check = () => {
      const msLeft = getClockMsLeft(useGameStore.getState(), getServerNow());
      if (msLeft === null) return;
      const seconds = Math.ceil(msLeft / 1_000);
      if (seconds < 1 || seconds > BEEP_FROM_SECONDS) return;
      // One beep per second of this deadline, however often the check runs.
      const key = `${deadline}:${seconds}`;
      if (lastBeep.current === key) return;
      lastBeep.current = key;
      soundEffects.clockBeep(seconds);
    };
    check();
    const timer = window.setInterval(check, TICK_MS);
    return () => window.clearInterval(timer);
  }, [deadline, isMine]);
}
