import { stepSeededRandom } from "../utils/seeded-random";
import type { SeededRandomState } from "./types";

/**
 * Where the engine draws its luck and its ids.
 *
 * A local game keeps `Math.random` and `crypto.randomUUID`, so tests can force
 * an outcome by mocking `Math.random`. An online game carries a seeded state:
 * every device replays the same actions from the same seed and must reach the
 * exact same result, ids included.
 */

interface EngineSource {
  random: () => number;
  createId: () => string;
}

let activeSource: EngineSource | null = null;

export function drawEngineRandom(): number {
  return activeSource ? activeSource.random() : Math.random();
}

export function createEngineId(): string {
  return activeSource ? activeSource.createId() : crypto.randomUUID();
}

/**
 * Runs `apply` with the engine drawing from `seed`, and returns the seed as it
 * stands afterwards. Sources nest safely, so a reducer may call another one.
 */
export function runWithSeededSource<T>(
  seed: SeededRandomState,
  apply: () => T,
): { result: T; seed: SeededRandomState } {
  let { rngState, nextId } = seed;
  const source: EngineSource = {
    random: () => {
      const step = stepSeededRandom(rngState);
      rngState = step.nextState;
      return step.value;
    },
    createId: () => `e${(nextId++).toString(36)}`,
  };

  const previous = activeSource;
  activeSource = source;
  try {
    const result = apply();
    return { result, seed: { rngState, nextId } };
  } finally {
    activeSource = previous;
  }
}
