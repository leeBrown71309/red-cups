import { useGameStore } from "../game/store";
import type { Player, PlayerId } from "../game/types";
import { useLocalPlayerId } from "../net/room-store";
import { canSeeBagOf, getVisibleCards, type VisibleCards } from "./visibility";

/** The cards of `player` that this device may show. */
export function useVisibleCards(player: Pick<Player, "id" | "passiveId" | "passifId"> | undefined): VisibleCards {
  const viewerId = useLocalPlayerId();
  const phase = useGameStore((state) => state.phase);
  return player ? getVisibleCards(player, viewerId, phase) : { actif: null, passif: null };
}

export function useCanSeeBagOf(ownerId: PlayerId): boolean {
  return canSeeBagOf(useLocalPlayerId(), ownerId);
}
