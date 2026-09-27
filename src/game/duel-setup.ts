import { createEngineId, drawEngineRandom } from "./engine-random";
import { randomChoice } from "./state-utils";
import type { BasketShot, DuelMode, PendingDuel, PlayerId, TurnStage } from "./types";
import { BASKET_DURATION_MS } from "./types";

/**
 * How a duel is set up, shared by the duels in Hell and the Luna Park ghost:
 * the game is drawn among every mini-game, and what can be drawn in advance
 * (the coin, the ghost's shots) is drawn at once, so every device plays the
 * same duel.
 */

/** Every mini-game a duel may draw; the vote needs somebody left to vote. */
export function getDuelModes(hasVoters: boolean): DuelMode[] {
  const modes: DuelMode[] = ["coin-flip", "rock-paper-scissors", "basket"];
  if (hasVoters) modes.push("player-vote");
  return modes;
}

export function createDuel(
  playerOneId: PlayerId,
  playerTwoId: PlayerId,
  mode: DuelMode,
  resumeStage: TurnStage,
): PendingDuel {
  return {
    playerOneId,
    playerTwoId,
    mode,
    coinWinnerId: mode === "coin-flip" ? randomChoice([playerOneId, playerTwoId]) : undefined,
    resumeStage,
    rpsChoices: {},
    rpsTiedRound: null,
    rpsTies: 0,
    votes: {},
    voteTieBroken: false,
    winnerId: null,
    basket:
      mode === "basket"
        ? { id: createEngineId(), shooterId: null, scores: {}, ghostShots: [], tieBroken: false }
        : null,
    ghost: null,
  };
}

/** The ghost's form of the day: its base chance to score, from a poor day to a good one. */
const GHOST_FORM_MIN = 0.4;
const GHOST_FORM_RANGE = 0.3;
/** A basket makes the next shot likelier, a miss less likely: streaks, hot and cold. */
const GHOST_STREAK_BONUS = 0.08;
const GHOST_STREAK_MALUS = 0.08;
/** Pull back towards its form, so no streak lasts for ever. */
const GHOST_FORM_PULL = 0.25;
/** Even at its hottest it misses one shot in four, at its coldest it still scores now and then. */
const GHOST_CHANCE_MAX = 0.75;
const GHOST_CHANCE_MIN = 0.15;
/** After this many baskets in a row it gets cocky, and its next shot is much less sure. */
const GHOST_COCKY_STREAK = 4;
const GHOST_COCKY_FACTOR = 0.55;
const GHOST_FIRST_SHOT_MS = 500;
const GHOST_SHOT_GAP_MS = 750;
const GHOST_SHOT_GAP_RANGE_MS = 650;
/** Now and then it hesitates, like a player who fumbles the ball. */
const GHOST_HESITATION_CHANCE = 0.12;
const GHOST_HESITATION_MS = 900;
const GHOST_HESITATION_RANGE_MS = 1_100;
/** A shot released this late would land after the buzzer. */
const GHOST_LAST_SHOT_MARGIN_MS = 400;

/**
 * The ghost's whole basket round, drawn in advance so every device shows the
 * same shots. It is no perfect machine: its form changes from one duel to
 * the next, it goes through hot and cold streaks, gets cocky after a run of
 * baskets and loses time now and then.
 * It averages about six baskets, anywhere from two or three to ten.
 */
export function drawGhostShots(): BasketShot[] {
  const form = GHOST_FORM_MIN + drawEngineRandom() * GHOST_FORM_RANGE;
  const shots: BasketShot[] = [];
  let chance = form;
  let streak = 0;
  let atMs = GHOST_FIRST_SHOT_MS + drawEngineRandom() * GHOST_SHOT_GAP_RANGE_MS;

  while (atMs < BASKET_DURATION_MS - GHOST_LAST_SHOT_MARGIN_MS) {
    const cocky = streak >= GHOST_COCKY_STREAK ? GHOST_COCKY_FACTOR : 1;
    const made = drawEngineRandom() < chance * cocky;
    shots.push({ atMs: Math.round(atMs), made });
    streak = made ? streak + 1 : 0;
    chance += made ? GHOST_STREAK_BONUS : -GHOST_STREAK_MALUS;
    chance += (form - chance) * GHOST_FORM_PULL;
    chance = Math.min(GHOST_CHANCE_MAX, Math.max(GHOST_CHANCE_MIN, chance));
    const hesitation =
      drawEngineRandom() < GHOST_HESITATION_CHANCE
        ? GHOST_HESITATION_MS + drawEngineRandom() * GHOST_HESITATION_RANGE_MS
        : 0;
    atMs += GHOST_SHOT_GAP_MS + drawEngineRandom() * GHOST_SHOT_GAP_RANGE_MS + hesitation;
  }
  return shots;
}

export function countBaskets(shots: BasketShot[]): number {
  return shots.filter((shot) => shot.made).length;
}
