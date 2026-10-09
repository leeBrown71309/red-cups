import { useMemo } from "react";
import { getInvisiblePlayerIds } from "../game/mist";
import { getDecidingPlayer } from "../game/rules";
import { useGameStore } from "../game/store";
import type { GameLogEntry, GameState, PlayerId } from "../game/types";
import { getLocalPlayerId, useLocalPlayerId } from "../net/room-store";

/**
 * Mi-vu, Mi-vue (patch 0.2.3): what one viewer does not see while somebody is invisible. Every screen (the board,
 * the players panel, the journal, the toasts) asks this one place, so the fog is the same everywhere.
 *
 * Online, the viewer is the seat of this device. On a shared screen it is whoever decides right now, as for Chance
 * aveugle and the Red Cup.
 */
export interface Fog {
  viewerId: PlayerId | null;
  /** The viewer is invisible: they see no other player, no action, no trap, no Red Cup, no Bullet Bill. */
  viewerHidden: boolean;
  /** Players the viewer does not see: their pawn, their bag, their purse and their actions are all hidden. */
  hiddenIds: ReadonlySet<PlayerId>;
  /** The viewer's own pawn is drawn see-through, for them only. */
  ghostlyId: PlayerId | null;
}

const CLEAR_FOG: Fog = { viewerId: null, viewerHidden: false, hiddenIds: new Set(), ghostlyId: null };

export function getFog(state: GameState, localPlayerId: PlayerId | null): Fog {
  if (state.phase !== "playing") return CLEAR_FOG;
  const invisibleIds = getInvisiblePlayerIds(state);
  if (invisibleIds.length === 0) return CLEAR_FOG;
  const viewerId = localPlayerId ?? getDecidingPlayer(state)?.id ?? null;
  const viewerHidden = viewerId !== null && invisibleIds.includes(viewerId);
  const hiddenIds = new Set(
    viewerHidden
      ? state.players.filter((player) => player.id !== viewerId).map((player) => player.id)
      : invisibleIds.filter((id) => id !== viewerId),
  );
  return { viewerId, viewerHidden, hiddenIds, ghostlyId: viewerHidden ? viewerId : null };
}

export function useFog(): Fog {
  const game = useGameStore();
  const localPlayerId = useLocalPlayerId();
  return useMemo(() => getFog(game, localPlayerId), [game, localPlayerId]);
}

/** Whether the viewer sees what `playerId` owns or does: false for a player the fog hides from them. */
export function canSeePlayer(fog: Fog, playerId: PlayerId): boolean {
  return !fog.hiddenIds.has(playerId);
}

/**
 * Whether a journal line reaches the viewer. An invisible viewer reads their own turn only, and the others do not read
 * the turn of an invisible player; the lines that tell whose turn it is, who turns invisible or who leaves are open.
 */
export function isLogEntryVisible(entry: GameLogEntry, fog: Fog): boolean {
  if (entry.open || entry.by === undefined) return true;
  return fog.viewerHidden ? entry.by === fog.viewerId : !fog.hiddenIds.has(entry.by);
}

/** The fog as this device sees it right now, for the code that runs outside React. */
export function getFogNow(): Fog {
  return getFog(useGameStore.getState(), getLocalPlayerId());
}

/** The journal as the viewer may read it: the lines the fog hides are left out. */
export function useVisibleLog(): GameLogEntry[] {
  const log = useGameStore((state) => state.log);
  const fog = useFog();
  return useMemo(() => log.filter((entry) => isLogEntryVisible(entry, fog)), [log, fog]);
}
