import type { GameLogEntry, GameState, PassiveId, Player, PlayerId } from "../game/types";

/**
 * What one viewer may see of the others, online (patch 0.1.6). At a local
 * table one screen is shared and the viewer is null: nothing is hidden.
 */

export interface VisibleCards {
  /** Null while hidden from this viewer. */
  actif: PassiveId | null;
  passif: PassiveId | null;
}

/**
 * The actif of another player is a secret until its effect shows: only the
 * diable, announced to the whole table, is public. Passifs are public, and
 * once the game is over every card is shown.
 */
export function getVisibleCards(
  player: Pick<Player, "id" | "passiveId" | "passifId">,
  viewerId: PlayerId | null,
  phase: GameState["phase"],
): VisibleCards {
  const sharesScreen = viewerId === null || viewerId === player.id || phase === "finished";
  const actifIsPublic = sharesScreen || player.passiveId === "devil";
  return { actif: actifIsPublic ? player.passiveId : null, passif: player.passifId ?? null };
}

/** Whether this viewer may see what is in the bag of `ownerId`: always at a local table, only their own online. */
export function canSeeBagOf(viewerId: PlayerId | null, ownerId: PlayerId): boolean {
  return viewerId === null || viewerId === ownerId;
}

/**
 * What a journal line says to a viewer. Lines about a bag (a purchase, a
 * theft, a discard) hold a public version for the table online.
 */
export function readLogEntry(entry: GameLogEntry, viewerId: PlayerId | null): string {
  if (!entry.secret || canSeeBagOf(viewerId, entry.secret.ownerId)) return entry.text;
  return entry.secret.publicText;
}
