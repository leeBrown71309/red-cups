import { canAbandon } from "../abandon";
import { getActivePlayer } from "../state-utils";
import { getIdleStrikes, IDLE_STRIKES_TO_FORFEIT, isActiveDecision } from "../turn-clock";
import type { GameState } from "../types";
import { newLogTexts, violation, type RuleViolation } from "./invariant-helpers";

/**
 * Checks for the online turn clock (patch 0.1.4). A clock running out plays
 * several default decisions in one action, so that action is judged by these
 * checks and by the state checks, not by the per-action rules.
 */

export function checkClockState(state: GameState, found: RuleViolation[]): void {
  const clock = state.turnClock;
  const active = getActivePlayer(state);
  if (!clock || state.phase !== "playing" || !active) return;
  if (clock.playerId !== active.id || clock.round !== state.round) {
    found.push(violation("clock-follows-turn", `the clock counts for ${clock.playerId}, not ${active.id}`));
  }
  if (canAbandon(state)) {
    const late = state.players.find((player) => getIdleStrikes(state, player.id) >= IDLE_STRIKES_TO_FORFEIT);
    if (late) found.push(violation("forfeit-due", `${late.name} lost three chances but still plays`));
  }
}

/** A clock run out: only the active player loses a chance, one at most, and only when they did nothing. */
export function checkClockExpiry(previous: GameState, next: GameState): RuleViolation[] {
  const found: RuleViolation[] = [];
  const active = getActivePlayer(previous);
  for (const player of previous.players) {
    const gained = getIdleStrikes(next, player.id) - getIdleStrikes(previous, player.id);
    const allowed = player.id === active?.id && isActiveDecision(previous) && !previous.turnActionTaken ? 1 : 0;
    if (gained > allowed || gained < 0) {
      found.push(
        violation("clock-strike", `${player.name} went from ${getIdleStrikes(previous, player.id)} chances lost`),
      );
    }
  }
  // A forfeit only comes with the third chance.
  const forfeits = newLogTexts(previous, next).filter((text) => text.includes("déclare forfait"));
  for (const text of forfeits) {
    const leaver = previous.players.find((player) => text.startsWith(player.name));
    if (leaver && getIdleStrikes(next, leaver.id) < IDLE_STRIKES_TO_FORFEIT) {
      found.push(violation("forfeit-early", `${leaver.name} forfeited before three chances`));
    }
  }
  return found;
}
