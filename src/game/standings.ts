import { countRedCups } from "./rules";
import type { GameState, Player, PlayerId } from "./types";

/**
 * The final table, as the victory screen and the game history show it:
 * players still at the table by Red Cups, then coins; players who left the
 * game afterwards, most recent departure first.
 */
export interface Standings {
  ranked: Player[];
  leavers: Player[];
}

export function getStandings(state: Pick<GameState, "players" | "abandonedPlayers">): Standings {
  const ranked = [...state.players].sort(
    (left, right) => countRedCups(right) - countRedCups(left) || right.currency - left.currency,
  );
  return { ranked, leavers: [...state.abandonedPlayers].reverse() };
}

/** 1 for the first place; null for a player who left the game or never sat at it. */
export function getPlaceOf(state: Pick<GameState, "players" | "abandonedPlayers">, playerId: PlayerId): number | null {
  const index = getStandings(state).ranked.findIndex((player) => player.id === playerId);
  return index < 0 ? null : index + 1;
}
