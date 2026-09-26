import type { GameState } from "../game/types";
import { getSupabase } from "./supabase-client";

/**
 * Thin wrappers over the room functions of `supabase/schema.sql`. Every call
 * checks the error it gets back: a refusal must never look like a success.
 */

export type RoomStatus = "lobby" | "playing" | "over";

export interface RoomPlayer {
  userId: string;
  /** Engine seat once the game has started; null in the lobby. */
  seat: number | null;
  name: string;
  /** Index into PLAYER_COLORS. */
  avatar: number;
  /** Quiet for more than 75 seconds. */
  absent: boolean;
}

export interface RoomSnapshot {
  code: string;
  status: RoomStatus;
  hostId: string;
  /** False for somebody who has not sat down: they only see the lobby roster, never the board. */
  isPlayer: boolean;
  state: GameState | null;
  version: number;
  seatOrder: string[];
  players: RoomPlayer[];
}

/** No 0/O or 1/I: a code read aloud or copied by hand should not be ambiguous. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(random: () => number = Math.random): string {
  return Array.from(
    { length: ROOM_CODE_LENGTH },
    () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)],
  ).join("");
}

/** Accepts what people type or paste: lower case, spaces, a dash, or a whole invitation link. */
export function normalizeRoomCode(input: string): string | null {
  const fromLink = /[?&]room=([A-Za-z0-9-]+)/.exec(input)?.[1] ?? input;
  const code = fromLink.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length === ROOM_CODE_LENGTH ? code : null;
}

export function buildInviteLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}?room=${code}`;
}

interface RawPlayer {
  user_id: string;
  seat: number | null;
  name: string;
  avatar: number;
  absent: boolean;
}

interface RawRoom {
  code: string;
  status: RoomStatus;
  host_id: string;
  is_player: boolean;
  state: GameState | null;
  version: number | null;
  seat_order: string[] | null;
  players: RawPlayer[] | null;
}

export function parseRoom(raw: RawRoom): RoomSnapshot {
  return {
    code: raw.code,
    status: raw.status,
    hostId: raw.host_id,
    isPlayer: raw.is_player,
    state: raw.state,
    version: raw.version ?? 0,
    seatOrder: raw.seat_order ?? [],
    players: (raw.players ?? []).map((player) => ({
      userId: player.user_id,
      seat: player.seat,
      name: player.name,
      avatar: player.avatar,
      absent: player.absent,
    })),
  };
}

async function callRoomFunction<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function fetchRoom(code: string): Promise<RoomSnapshot | null> {
  const raw = await callRoomFunction<RawRoom | null>("get_room", { p_code: code });
  return raw ? parseRoom(raw) : null;
}

const MAX_CODE_ATTEMPTS = 5;

/** Creates a room under a fresh code, drawing again on the rare collision. */
export async function createRoom(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode();
    const { error } = await getSupabase().rpc("create_room", { p_code: code });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Impossible de créer un salon, réessaie.");
}

export function claimSeat(code: string, name: string, avatar: number): Promise<void> {
  return callRoomFunction("claim_seat", { p_code: code, p_name: name, p_avatar: avatar });
}

/** Returns the room's current version, or null once the room is gone. */
export function touchSeat(code: string): Promise<number | null> {
  return callRoomFunction<number | null>("touch_seat", { p_code: code });
}

export function leaveRoom(code: string): Promise<void> {
  return callRoomFunction("leave_room", { p_code: code });
}

export function openRoom(code: string, state: GameState, seatOrder: string[]): Promise<void> {
  return callRoomFunction("open_room", { p_code: code, p_state: state, p_seat_order: seatOrder });
}

/** Compare-and-set: false means another device moved first and this one must resync. */
export function advanceRoom(code: string, state: GameState, fromVersion: number): Promise<boolean> {
  return callRoomFunction<boolean>("advance_room", { p_code: code, p_state: state, p_from: fromVersion });
}
