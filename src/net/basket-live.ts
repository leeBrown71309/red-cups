import { create } from "zustand";
import type { BasketShot, PlayerId } from "../game/types";

/**
 * Basket shots are too quick to go through the game engine one by one: only
 * the final score is an action. While the shooter plays, each shot is sent
 * on the room's channel so the rest of an online table can watch the round
 * live. A lost shot only costs the watchers one animation; the score that
 * counts is the one the shooter's device submits.
 */

export interface BasketWire {
  /** Basket duel id and shooter: the round the shot belongs to. */
  roundKey: string;
  shooterId: PlayerId;
  shot: BasketShot;
}

interface BasketLiveState {
  roundKey: string | null;
  shots: BasketShot[];
}

export const useBasketLiveStore = create<BasketLiveState>(() => ({ roundKey: null, shots: [] }));

let send: ((wire: BasketWire) => void) | null = null;

export function getBasketRoundKey(basketId: string, shooterId: PlayerId): string {
  return `${basketId}:${shooterId}`;
}

/** Called once the room's channel is open; `null` when it closes. */
export function attachBasketLive(sender: ((wire: BasketWire) => void) | null): void {
  send = sender;
  useBasketLiveStore.setState({ roundKey: null, shots: [] });
}

/** The shooter's device shares a shot; a local table has nobody to share it with. */
export function shareBasketShot(roundKey: string, shooterId: PlayerId, shot: BasketShot): void {
  send?.({ roundKey, shooterId, shot });
}

/** A watcher receives a shot; a shot from another round starts that round's list afresh. */
export function handleBasketWire(wire: BasketWire): void {
  if (typeof wire?.roundKey !== "string" || typeof wire.shot?.atMs !== "number") return;
  useBasketLiveStore.setState((state) =>
    state.roundKey === wire.roundKey
      ? { shots: [...state.shots, wire.shot] }
      : { roundKey: wire.roundKey, shots: [wire.shot] },
  );
}
