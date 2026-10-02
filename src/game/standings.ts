import { countRedCups } from "./rules";
import type { GameState, Player, PlayerId } from "./types";

/**
 * The final table, as the victory screen and the game history show it: the
 * winner first (Cupide may win without a Red Cup), then the players still at
 * the table by Red Cups, then coins; players who left the game afterwards,
 * most recent departure first.
 */
export interface Standings {
  ranked: Player[];
  leavers: Player[];
}

type StandingsSource = Pick<GameState, "players" | "abandonedPlayers"> & Partial<Pick<GameState, "winnerId">>;

export function getStandings(state: StandingsSource): Standings {
  const isWinner = (player: Player) => (player.id === state.winnerId ? 1 : 0);
  const ranked = [...state.players].sort(
    (left, right) =>
      isWinner(right) - isWinner(left) || countRedCups(right) - countRedCups(left) || right.currency - left.currency,
  );
  return { ranked, leavers: [...state.abandonedPlayers].reverse() };
}

/** 1 for the first place; null for a player who left the game or never sat at it. */
export function getPlaceOf(state: StandingsSource, playerId: PlayerId): number | null {
  const index = getStandings(state).ranked.findIndex((player) => player.id === playerId);
  return index < 0 ? null : index + 1;
}
