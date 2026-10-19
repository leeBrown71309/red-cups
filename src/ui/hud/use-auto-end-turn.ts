import { useEffect } from "react";
import { useCountdownRunning } from "../../feedback/ui-store";
import { shouldEndTurnAutomatically } from "../../game/idle-turn";
import { useGameStore } from "../../game/store";
import type { GameState } from "../../game/types";

/** How long the table is left to read the last move before a turn with nothing left in it ends by itself. */
export const AUTO_END_TURN_DELAY_MS = 1_400;

/**
 * Ends the turn of a player who has nothing left to do (patch 0.3.0: no energy, no Cups Power, passif or free item
 * to use). Only the device that plays the seat sends it, once the board has settled, so online every device replays
 * the same action; any change of state in the meantime cancels it.
 */
export function useAutoEndTurn(game: GameState, settled: boolean, isOwnTurn: boolean): void {
  const countdownRunning = useCountdownRunning();
  const idle = settled && isOwnTurn && !countdownRunning && game.pause === null && shouldEndTurnAutomatically(game);
  useEffect(() => {
    if (!idle) return undefined;
    const timer = window.setTimeout(() => {
      const current = useGameStore.getState();
      if (shouldEndTurnAutomatically(current)) current.endTurn();
    }, AUTO_END_TURN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [idle, game.activePlayerIndex, game.round, game.turnStage]);
}
