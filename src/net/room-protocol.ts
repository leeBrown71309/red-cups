import { canPlayerSendAction } from "../game/action-permissions";
import { getSeatPlayerId, reduceGame, type GameAction } from "../game/game-actions";
import type { GameState, PlayerColor, PlayerId } from "../game/types";
import { EMPTY_GAME_STATE, PLAYER_COLORS } from "../game/types";
import type { RoomPlayer } from "./room-api";

/**
 * The rules an online game follows, kept pure so they can be tested.
 *
 * The database is the referee of order. A device first computes the result
 * of its own action and writes it with a compare-and-set on the version; only
 * once that write is accepted does it apply the action and broadcast it. Two
 * simultaneous moves therefore never fork the game: one write wins, the
 * other device reloads and tries again. Every other device replays the
 * broadcast action on its own board and must land on the same state.
 */

export type RoomWire =
  | { kind: "action"; action: GameAction; fromVersion: number; senderId: string }
  /** The lobby roster changed: somebody sat down, left or picked another avatar. */
  | { kind: "roster" }
  /** The host kicked off: everybody loads the first snapshot. */
  | { kind: "start" };

/** The engine player a user plays, from their position in the frozen seat order. */
export function getPlayerIdOfUser(seatOrder: string[], userId: string): PlayerId | null {
  const seat = seatOrder.indexOf(userId);
  return seat < 0 ? null : getSeatPlayerId(seat);
}

/**
 * The state this device's action leads to, or null when it may not play it
 * (not its turn, or refused by the rules). Nothing is sent in that case.
 */
export function prepareLocalAction(state: GameState, action: GameAction, playerId: PlayerId | null): GameState | null {
  if (!playerId || !canPlayerSendAction(state, action, playerId)) return null;
  const nextState = reduceGame(state, action);
  return nextState === state ? null : nextState;
}

export type RemoteActionOutcome =
  | { kind: "applied"; state: GameState; version: number }
  /** Already part of this board (e.g. loaded with a snapshot): nothing to do. */
  | { kind: "stale" }
  /** This device missed something or disagrees with the stored game: reload the snapshot. */
  | { kind: "resync" };

export function applyRemoteAction(
  state: GameState,
  version: number,
  seatOrder: string[],
  wire: Extract<RoomWire, { kind: "action" }>,
): RemoteActionOutcome {
  if (wire.fromVersion < version) return { kind: "stale" };
  if (wire.fromVersion > version) return { kind: "resync" };
  const nextState = prepareLocalAction(state, wire.action, getPlayerIdOfUser(seatOrder, wire.senderId));
  // The sender's write was accepted, so a refusal here means this board drifted.
  if (!nextState) return { kind: "resync" };
  return { kind: "applied", state: nextState, version: version + 1 };
}

/**
 * The first board of an online game: turn order is the order players sat
 * down, each with the avatar they picked, and the host's seed so every device
 * draws the same luck from there on.
 */
export function buildOnlineGame(players: RoomPlayer[], seed: number): { state: GameState; seatOrder: string[] } {
  const avatarColors: PlayerColor[] = players.map((player) => PLAYER_COLORS[player.avatar] ?? PLAYER_COLORS[0]);
  const state = reduceGame(EMPTY_GAME_STATE, {
    type: "startGame",
    playerNames: players.map((player) => player.name),
    seed,
    avatarColors,
  });
  return { state, seatOrder: players.map((player) => player.userId) };
}
