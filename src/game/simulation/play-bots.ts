import { createSeededRandom } from "../../utils/seeded-random";
import { canAbandon } from "../abandon";
import { pickGameState } from "../game-save";
import { useGameStore } from "../store";
import type { GameState, PlayerId } from "../types";
import { chooseBotAction } from "./bot-player";

/**
 * Bots playing on from a given board, e.g. the board of an online kickoff,
 * to produce the realistic end states the game history is tested and
 * previewed with.
 */
export interface BotPlayOptions {
  seed: number;
  /** Stops early, leaving the game unfinished. */
  maxSteps?: number;
  /** This player leaves the table as soon as it may, once `afterStep` actions were played. */
  abandon?: { playerId: PlayerId; afterStep: number };
}

const DEFAULT_MAX_STEPS = 4_000;

export function playBotsFrom(start: GameState, options: BotPlayOptions): GameState {
  const store = useGameStore;
  const random = createSeededRandom(options.seed * 7_919 + 17);
  let abandoned = false;
  try {
    store.getState().adoptGame(start);
    for (let step = 0; step < (options.maxSteps ?? DEFAULT_MAX_STEPS); step += 1) {
      const state = store.getState();
      // An online kickoff opens on the passive draft: the bots pick first.
      if (state.phase !== "playing" && state.phase !== "draft") break;
      const { abandon } = options;
      if (abandon && !abandoned && step >= abandon.afterStep && canAbandon(state)) {
        state.abandonGame(abandon.playerId);
        abandoned = true;
        continue;
      }
      const action = chooseBotAction(state, random);
      if (!action) break;
      action.perform(state);
    }
    return pickGameState(store.getState());
  } finally {
    store.getState().resetGame();
  }
}
