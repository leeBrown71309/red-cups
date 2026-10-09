import { ABANDON_STAGES } from "./abandon";
import { joinLatePlayer, MAX_TABLE_SIZE } from "./late-join";
import { addLog } from "./state-utils";
import type { GameState, PlayerId } from "./types";

/**
 * A player the host sent away comes back once the host accepted their request.
 * During the draft they sit down again like a newcomer, with fresh offers;
 * during the game they take their old place back with what they held, last in
 * the turn order, but only while the table is at rest. L'Ange-Gardien comes
 * back as Lambda: the roles were handed out at the start.
 */

export function canReinstatePlayer(state: GameState, playerId: PlayerId): boolean {
  if (!state.abandonedPlayers.some((player) => player.id === playerId)) return false;
  if (state.players.length >= MAX_TABLE_SIZE || state.players.some((player) => player.id === playerId)) return false;
  if (state.phase === "draft") return true;
  return state.phase === "playing" && ABANDON_STAGES.includes(state.turnStage);
}

export function reinstatePlayer(state: GameState, playerId: PlayerId): GameState {
  if (!canReinstatePlayer(state, playerId)) return state;
  const returning = state.abandonedPlayers.find((player) => player.id === playerId);
  if (!returning) return state;
  const abandonedPlayers = state.abandonedPlayers.filter((player) => player.id !== playerId);

  if (state.phase === "draft") {
    return joinLatePlayer({ ...state, abandonedPlayers }, playerId, returning.name, returning.color);
  }

  const back = {
    ...returning,
    skippedTurns: 0,
    knockedOut: false,
    passiveId: returning.passiveId === "guardian-angel" ? ("lambda" as const) : returning.passiveId,
  };
  return addLog(
    { ...state, abandonedPlayers, players: [...state.players, back] },
    `${back.name} revient à la table.`,
    "good",
  );
}
