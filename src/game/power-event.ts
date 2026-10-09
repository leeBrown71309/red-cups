import type { GameState, PowerEvent } from "./types";

type DistributiveOmit<Type, Key extends PropertyKey> = Type extends unknown ? Omit<Type, Key> : never;

/** Records the last deed of a Cups Power of patch 0.2.3; `seq` counts up from the one before. */
export function withPowerEvent(state: GameState, event: DistributiveOmit<PowerEvent, "seq">): GameState {
  return { ...state, lastPowerEvent: { seq: (state.lastPowerEvent?.seq ?? 0) + 1, ...event } as PowerEvent };
}
