const MULBERRY_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 4_294_967_296;

/**
 * One step of mulberry32. Exposing the state lets a game store it and resume
 * the exact same sequence on another device.
 */
export function stepSeededRandom(state: number): { value: number; nextState: number } {
  const nextState = (state + MULBERRY_INCREMENT) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { value: ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE, nextState };
}

/**
 * Deterministic PRNG (mulberry32). The same seed always yields the same
 * sequence, which makes scenery layouts and bot games reproducible.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    const step = stepSeededRandom(state);
    state = step.nextState;
    return step.value;
  };
}

/** A fresh 32-bit seed, for games whose sequence must be shared. */
export function createRandomSeed(): number {
  return Math.floor(Math.random() * UINT32_RANGE) >>> 0;
}
