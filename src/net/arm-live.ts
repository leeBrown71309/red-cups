import { create } from "zustand";
import type { PlayerId } from "../game/types";

/**
 * Arm wrestle taps are far too quick for the engine: only the final count is
 * an action. While a side taps, its running count is sent on the room's
 * channel, so the other device moves the bar live. A lost message only
 * costs the bar a jolt; the count that counts is the one each side submits.
 */

export interface ArmWire {
  /** The wrestle the taps belong to. */
  wrestleId: string;
  playerId: PlayerId;
  taps: number;
}

interface ArmLiveState {
  wrestleId: string | null;
  taps: Partial<Record<PlayerId, number>>;
}

export const useArmLiveStore = create<ArmLiveState>(() => ({ wrestleId: null, taps: {} }));

let send: ((wire: ArmWire) => void) | null = null;

/** Called once the room's channel is open; `null` when it closes. */
export function attachArmLive(sender: ((wire: ArmWire) => void) | null): void {
  send = sender;
  useArmLiveStore.setState({ wrestleId: null, taps: {} });
}

/** A side shares its running count; a local table has nobody to share it with. */
export function shareArmTaps(wrestleId: string, playerId: PlayerId, taps: number): void {
  send?.({ wrestleId, playerId, taps });
}

export function handleArmWire(wire: ArmWire): void {
  if (typeof wire?.wrestleId !== "string" || typeof wire.taps !== "number") return;
  useArmLiveStore.setState((state) =>
    state.wrestleId === wire.wrestleId
      ? { taps: { ...state.taps, [wire.playerId]: wire.taps } }
      : { wrestleId: wire.wrestleId, taps: { [wire.playerId]: wire.taps } },
  );
}
