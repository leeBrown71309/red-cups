import { canPlayerSendAction } from "../game/action-permissions";
import { getSeatPlayerId, reduceGame, type GameAction } from "../game/game-actions";
import type { GameState, MapId, PlayerColor, PlayerId } from "../game/types";
import { EMPTY_GAME_STATE, PLAYER_COLORS, RULES_VERSION } from "../game/types";
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
  /** `issuedAt`: the server time the sender played it at, so every device runs the same turn clock. */
  | { kind: "action"; action: GameAction; fromVersion: number; senderId: string; issuedAt?: number }
  /** The lobby roster changed: somebody sat down, left or picked another avatar. */
  | { kind: "roster" }
  /** The host kicked off: everybody loads the first snapshot. */
  | { kind: "start" }
  /** The host sent a player away: that player's device leaves the room. */
  | { kind: "kicked"; userId: string };

/**
 * Whether a presence "leave" means the device really left the room. Any change
 * of a device's presence (the mic turned on, off or muted) is sent as its old
 * entry leaving and its new one joining: the device still has an entry then,
 * and must not be announced as disconnected.
 */
export function hasLeftRoom(currentPresences: readonly unknown[] | undefined): boolean {
  return !currentPresences || currentPresences.length === 0;
}

/** The engine player a user plays, from their position in the frozen seat order. */
export function getPlayerIdOfUser(seatOrder: string[], userId: string): PlayerId | null {
  const seat = seatOrder.indexOf(userId);
  return seat < 0 ? null : getSeatPlayerId(seat);
}

/** The user playing an engine player, the other way round. */
export function getUserIdOfPlayer(seatOrder: string[], playerId: PlayerId): string | null {
  return seatOrder.find((_, seat) => getSeatPlayerId(seat) === playerId) ?? null;
}

/**
 * The state this device's action leads to, or null when it may not play it
 * (not its turn, or refused by the rules). Nothing is sent in that case.
 */
export function prepareLocalAction(
  state: GameState,
  action: GameAction,
  playerId: PlayerId | null,
  now?: number,
): GameState | null {
  if (!playerId || !canPlayerSendAction(state, action, playerId)) return null;
  const nextState = reduceGame(state, action, { now });
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
  const nextState = prepareLocalAction(state, wire.action, getPlayerIdOfUser(seatOrder, wire.senderId), wire.issuedAt);
  // The sender's write was accepted, so a refusal here means this board drifted.
  if (!nextState) return { kind: "resync" };
  return { kind: "applied", state: nextState, version: version + 1 };
}

/**
 * Whether a stored game runs on this device's rules: a device on other rules
 * would not land on the same board, so it may not play it.
 */
export function isSameRules(state: GameState | null): boolean {
  return state === null || state.rulesVersion === RULES_VERSION;
}

/**
 * The first board of an online game: turn order is the order players sat
 * down, each with the avatar they picked, the map the host picked (already
 * drawn if random) and the host's seed so every device draws the same luck
 * from there on. The host is remembered as a player: they may pause the game.
 */
export function buildOnlineGame(
  players: RoomPlayer[],
  seed: number,
  mapId: MapId,
  now?: number,
  hostUserId?: string | null,
): { state: GameState; seatOrder: string[] } {
  const avatarColors: PlayerColor[] = players.map((player) => PLAYER_COLORS[player.avatar] ?? PLAYER_COLORS[0]);
  const action: GameAction = {
    type: "startGame",
    playerNames: players.map((player) => player.name),
    seed,
    avatarColors,
    mapId,
    // Online games open on the passive draft, under the table's minute.
    draft: true,
  };
  // The draft's clock starts with the game.
  const started = reduceGame(EMPTY_GAME_STATE, action, { now });
  const seatOrder = players.map((player) => player.userId);
  // The host pauses the game for the whole table.
  const hostPlayerId = hostUserId ? getPlayerIdOfUser(seatOrder, hostUserId) : null;
  return { state: { ...started, hostPlayerId }, seatOrder };
}
