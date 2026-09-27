import type { Player, PlayerColor, PlayerId } from "../../game/types";
import { GHOST_ID } from "../../game/types";
import { GhostAvatar, type GhostMood } from "../components/ghost-avatar";
import { PlayerAvatar } from "../components/player-avatar";

/** Either side of a duel: a seated player, or the Luna Park ghost. */
export interface Duellist {
  id: PlayerId;
  name: string;
  /** Unset for the ghost. */
  color?: PlayerColor;
}

const GHOST_NAME = "Le fantôme";

export function isGhost(duellist: Duellist): boolean {
  return duellist.id === GHOST_ID;
}

export function findDuellist(players: Player[], id: PlayerId): Duellist | undefined {
  if (id === GHOST_ID) return { id, name: GHOST_NAME };
  const player = players.find((candidate) => candidate.id === id);
  return player && { id: player.id, name: player.name, color: player.color };
}

interface DuellistAvatarProps {
  duellist: Duellist;
  size: number;
  state?: "idle" | "won" | "lost";
}

export function DuellistAvatar({ duellist, size, state = "idle" }: DuellistAvatarProps) {
  if (!duellist.color) {
    const mood: GhostMood = state === "won" ? "laughing" : state === "lost" ? "defeated" : "menacing";
    return <GhostAvatar size={size} mood={mood} />;
  }
  return <PlayerAvatar color={duellist.color} size={size} expression={state === "lost" ? "worried" : "happy"} />;
}
