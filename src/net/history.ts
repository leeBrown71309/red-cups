import { getSeatPlayerId } from "../game/game-actions";
import { getPlaceOf } from "../game/standings";
import type { GameState, PlayerId } from "../game/types";
import { getSupabase } from "./supabase-client";

/**
 * The online games of a Google account, as `get_my_games` returns them.
 * The database only keeps the last board: winner, places and rounds are
 * read from it here, with the same rules as the victory screen.
 */

export type HistoryStatus = "playing" | "finished" | "unfinished";

export interface HistorySeat {
  seat: number;
  name: string;
  /** Index into PLAYER_COLORS. */
  avatar: number;
}

export interface HistoryGame {
  id: string;
  status: HistoryStatus;
  startedAt: Date;
  endedAt: Date | null;
  /** The last board; null only for a game still being played. */
  final: GameState | null;
  mySeat: number;
  seats: HistorySeat[];
}

export type HistoryOutcome =
  | { kind: "won" }
  | { kind: "placed"; place: number; of: number }
  | { kind: "abandoned" }
  | { kind: "unfinished" }
  | { kind: "playing" };

interface RawHistoryGame {
  id: string;
  status: HistoryStatus;
  started_at: string;
  ended_at: string | null;
  final: GameState | null;
  my_seat: number;
  seats: HistorySeat[] | null;
}

export const HISTORY_LIMIT = 20;

export function parseHistoryGame(raw: RawHistoryGame): HistoryGame {
  return {
    id: raw.id,
    status: raw.status,
    startedAt: new Date(raw.started_at),
    endedAt: raw.ended_at ? new Date(raw.ended_at) : null,
    final: raw.final,
    mySeat: raw.my_seat,
    seats: raw.seats ?? [],
  };
}

export async function fetchMyGames(limit = HISTORY_LIMIT): Promise<HistoryGame[]> {
  const { data, error } = await getSupabase().rpc("get_my_games", { p_limit: limit });
  if (error) throw new Error(`Historique illisible : ${error.message}`);
  return ((data as RawHistoryGame[] | null) ?? []).map(parseHistoryGame);
}

export function getMyPlayerId(game: HistoryGame): PlayerId {
  return getSeatPlayerId(game.mySeat);
}

/** How the game went for the account reading its history. */
export function getOutcome(game: HistoryGame): HistoryOutcome {
  if (game.status === "playing" || !game.final) return { kind: "playing" };
  if (game.status === "unfinished") return { kind: "unfinished" };
  const me = getMyPlayerId(game);
  if (game.final.winnerId === me) return { kind: "won" };
  const place = getPlaceOf(game.final, me);
  if (place === null) return { kind: "abandoned" };
  return { kind: "placed", place, of: game.final.players.length + game.final.abandonedPlayers.length };
}

/** Name of the winner as they sat at the table, or null for a game without one. */
export function getWinnerName(game: HistoryGame): string | null {
  const winnerId = game.final?.winnerId;
  if (!winnerId) return null;
  return game.final?.players.find((player) => player.id === winnerId)?.name ?? null;
}

/** Whole minutes between the kickoff and the end; null while the game is on. */
export function getDurationMinutes(game: HistoryGame): number | null {
  if (!game.endedAt) return null;
  return Math.max(0, Math.round((game.endedAt.getTime() - game.startedAt.getTime()) / 60_000));
}
