import type { GameLogEntry } from "../game/types";
import { getLocalPlayerId, useLocalPlayerId } from "../net/room-store";
import { readLogEntry } from "./visibility";

/** For the components: the journal line as this device may read it. */
export function useLogReader(): (entry: GameLogEntry) => string {
  const viewerId = useLocalPlayerId();
  return (entry) => readLogEntry(entry, viewerId);
}

/** For the callbacks outside React. */
export function readLogEntryNow(entry: GameLogEntry): string {
  return readLogEntry(entry, getLocalPlayerId());
}
