import { useGameStore } from "../game/store";
import type { GameState, PassiveId, Player, PlayerId } from "../game/types";
import { useLocalPlayerId } from "../net/room-store";

/**
 * Online, the actif of another player is a secret until its effect shows:
 * only the diable, announced to the whole table, is public. Passifs are
 * public. At a local table (viewer null) one screen is shared and nothing is
 * hidden; once the game is over every card is shown.
 */
export interface VisibleCards {
  /** Null while hidden from this viewer. */
  actif: PassiveId | null;
  passif: PassiveId | null;
}

export function getVisibleCards(
  player: Pick<Player, "id" | "passiveId" | "passifId">,
  viewerId: PlayerId | null,
  phase: GameState["phase"],
): VisibleCards {
  const sharesScreen = viewerId === null || viewerId === player.id || phase === "finished";
  const actifIsPublic = sharesScreen || player.passiveId === "devil";
  return { actif: actifIsPublic ? player.passiveId : null, passif: player.passifId ?? null };
}

/** The cards of `player` that this device may show. */
export function useVisibleCards(player: Pick<Player, "id" | "passiveId" | "passifId"> | undefined): VisibleCards {
  const viewerId = useLocalPlayerId();
  const phase = useGameStore((state) => state.phase);
  return player ? getVisibleCards(player, viewerId, phase) : { actif: null, passif: null };
}
