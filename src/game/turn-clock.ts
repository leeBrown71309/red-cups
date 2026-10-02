import { getDuelVoterIds, getHumanDuellistIds } from "./duel";
import { getDecidingPlayer } from "./rules";
import { getActivePlayer } from "./state-utils";
import type { GameState, PlayerId } from "./types";
import { GHOST_ID } from "./types";

/**
 * Online turn clock (patch 0.1.4): 45 seconds of the active player's own
 * decisions per turn, paused while somebody else decides, who then has a
 * deadline of their own. The time comes with each action (`issuedAt`, the
 * server's clock as the sender saw it), so every device keeps the very same
 * clock. A local game has no clock.
 */

export const TURN_TIME_MS = 45_000;
/** Whoever else decides (a reaction, a vote, Calme-toi, a gamble…) gets this long before the default applies. */
export const DECISION_TIME_MS = 20_000;
/** Basket needs its two 15-second rounds and a little more. */
export const BASKET_DECISION_TIME_MS = 45_000;
/** Animations play after every action: the clock waits this long before it runs again. */
export const CLOCK_GRACE_MS = 3_000;
/** Devices other than the decider's wait this long past a deadline before closing it themselves. */
export const EXPIRY_MARGIN_MS = 2_000;
/** Turns run out without doing anything before a player forfeits. */
export const IDLE_STRIKES_TO_FORFEIT = 3;
/** From this many lost chances on, the player is warned as their turn starts. */
export const IDLE_STRIKES_WARNING = 2;

/**
 * Players deciding right now. Several for a duel (both duellists, or the
 * voters) and a reaction (every holder who may answer).
 */
export function getClockDeciderIds(state: GameState): PlayerId[] {
  const only = (playerId: PlayerId | null | undefined) => (playerId ? [playerId] : []);
  if (state.phase === "draft") {
    return state.players.filter((player) => state.draft?.picks[player.id] === undefined).map((player) => player.id);
  }
  switch (state.turnStage) {
    case "wheel-result":
      return only(state.pendingWheel?.playerId);
    case "discard":
      return only(state.pendingDiscard?.playerId);
    case "target":
      return only(state.pendingChallenge?.playerId);
    case "reaction":
      return state.pendingReaction?.reactorIds ?? [];
    case "duel": {
      const duel = state.pendingDuel;
      if (!duel) return [];
      if (duel.mode === "blackjack") return only(duel.blackjack?.turnId === GHOST_ID ? null : duel.blackjack?.turnId);
      return duel.mode === "player-vote" ? getDuelVoterIds(state, duel) : getHumanDuellistIds(duel);
    }
    case "arm-wrestle": {
      const wrestle = state.pendingArmWrestle;
      return wrestle ? [wrestle.attackerId, wrestle.defenderId].filter((id) => wrestle.taps[id] === undefined) : [];
    }
    default:
      return only(getDecidingPlayer(state)?.id);
  }
}

/** Whether the decision on hand belongs to the active player alone: their turn's 45 seconds run. */
export function isActiveDecision(state: GameState): boolean {
  const shared = ["duel", "reaction", "arm-wrestle"].includes(state.turnStage);
  if (state.phase !== "playing" || shared) return false;
  const deciders = getClockDeciderIds(state);
  return deciders.length === 1 && deciders[0] === getActivePlayer(state)?.id;
}

function getDecisionTime(state: GameState): number {
  const basket = state.turnStage === "duel" && state.pendingDuel?.mode === "basket";
  return basket || state.turnStage === "arm-wrestle" ? BASKET_DECISION_TIME_MS : DECISION_TIME_MS;
}

/**
 * Brings the clocks up to `now` once an action is played: a new turn gets its
 * full 45 seconds, the time thought since the last action is spent, and the
 * clock runs again after the animations, or pauses for somebody else's decision.
 */
export function updateClocks(state: GameState, now: number): GameState {
  const active = getActivePlayer(state);
  if (state.phase !== "playing" || !active) {
    return state.turnClock || state.decisionClock ? { ...state, turnClock: null, decisionClock: null } : state;
  }

  const previous = state.turnClock;
  const sameTurn = previous !== null && previous.playerId === active.id && previous.round === state.round;
  const spent = sameTurn && previous.runningSince !== null ? Math.max(0, now - previous.runningSince) : 0;
  const remainingMs = sameTurn ? previous.remainingMs - spent : TURN_TIME_MS;
  const running = isActiveDecision(state);
  return {
    ...state,
    turnClock: {
      playerId: active.id,
      round: state.round,
      remainingMs,
      runningSince: running ? now + CLOCK_GRACE_MS : null,
    },
    decisionClock: running ? null : { deadline: now + CLOCK_GRACE_MS + getDecisionTime(state) },
  };
}

/** When the clock that counts right now runs out; null in a local game or once it is over. */
export function getClockDeadline(state: GameState): number | null {
  if (state.phase === "draft") return state.draft?.deadline ?? null;
  if (state.phase !== "playing" || !state.turnClock) return null;
  const { remainingMs, runningSince } = state.turnClock;
  if (isActiveDecision(state)) return runningSince === null ? null : runningSince + remainingMs;
  return state.decisionClock?.deadline ?? null;
}

/** A turn that ran out without anything done costs the player a chance. */
export function addIdleStrike(state: GameState, playerId: PlayerId): GameState {
  return { ...state, idleStrikes: { ...state.idleStrikes, [playerId]: (state.idleStrikes[playerId] ?? 0) + 1 } };
}

export function getIdleStrikes(state: Pick<GameState, "idleStrikes">, playerId: PlayerId): number {
  return state.idleStrikes[playerId] ?? 0;
}
