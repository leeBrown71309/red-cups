import { addLog, findPlayer } from "./state-utils";
import type { GameState, PlayerId } from "./types";

/**
 * Online pause (patch 0.1.4): the host stops the game for the whole table.
 * Nothing can be played until it resumes, except leaving the table, and every
 * clock stands still: on resume, the deadlines move back by the time spent
 * paused, so nobody loses a second of their turn.
 */

/** A host gone quiet must not hold the table forever: past this long, any player may resume. */
export const PAUSE_TAKEOVER_MS = 120_000;

/** The host while they sit at the table; once they left, the first seated player takes over. */
export function getHostPlayerId(state: GameState): PlayerId | null {
  if (findPlayer(state, state.hostPlayerId)) return state.hostPlayerId;
  return state.players[0]?.id ?? null;
}

/**
 * Basket rounds and the arm wrestle are timed on the players' devices: a
 * pause in the middle would throw their count away, so it waits for the end.
 */
function isLiveMiniGame(state: GameState): boolean {
  return state.turnStage === "arm-wrestle" || Boolean(state.pendingDuel?.basket?.shooterId);
}

export function canPauseGame(state: GameState): boolean {
  return state.phase === "playing" && state.pause === null && !isLiveMiniGame(state);
}

export function canResumeGame(state: GameState, playerId: PlayerId, now: number | undefined): boolean {
  if (!state.pause) return false;
  if (playerId === getHostPlayerId(state)) return true;
  return now !== undefined && now - state.pause.since >= PAUSE_TAKEOVER_MS;
}

export function pauseGame(state: GameState, playerId: PlayerId, now: number | undefined): GameState {
  const host = findPlayer(state, playerId);
  if (!host || playerId !== getHostPlayerId(state) || !canPauseGame(state)) return state;
  const paused = { ...state, pause: { byPlayerId: playerId, since: now ?? 0 } };
  return addLog(paused, `${host.name} met la partie en pause.`, "event");
}

export function resumeGame(state: GameState, playerId: PlayerId, now: number | undefined): GameState {
  const player = findPlayer(state, playerId);
  if (!player || !state.pause || !canResumeGame(state, playerId, now)) return state;
  const pausedFor = now === undefined ? 0 : Math.max(0, now - state.pause.since);
  const { turnClock, decisionClock } = state;
  const resumed: GameState = {
    ...state,
    pause: null,
    turnClock:
      turnClock && turnClock.runningSince !== null
        ? { ...turnClock, runningSince: turnClock.runningSince + pausedFor }
        : turnClock,
    decisionClock: decisionClock ? { deadline: decisionClock.deadline + pausedFor } : null,
  };
  return addLog(resumed, `${player.name} relance la partie.`, "event");
}
