import { passTurnFrom } from "./game-effects";
import { addLog } from "./state-utils";
import type { GameState, PlayerId, TurnStage } from "./types";

/**
 * A player may leave a game in progress; the others play on. Seats are only
 * emptied while the table is at rest, so no wheel, duel or decision is left
 * waiting for someone who is gone.
 */
const ABANDON_STAGES: TurnStage[] = ["move", "hell", "shop", "turn-end"];

export function canAbandon(state: GameState): boolean {
  return state.phase === "playing" && ABANDON_STAGES.includes(state.turnStage);
}

/**
 * Removes the player with their Red Cups and items. If it was their turn, it
 * passes to the next seat; with a single player left, that player wins.
 */
export function abandonPlayer(state: GameState, playerId: PlayerId): GameState {
  const index = state.players.findIndex((player) => player.id === playerId);
  if (!canAbandon(state) || index < 0) return state;

  const leaver = state.players[index];
  const players = state.players.filter((player) => player.id !== playerId);
  const wasActive = index === state.activePlayerIndex;
  let nextState: GameState = addLog(
    {
      ...state,
      players,
      abandonedPlayers: [...state.abandonedPlayers, leaver],
      // Keeps pointing at the same player once the seats before them shift.
      activePlayerIndex: index < state.activePlayerIndex ? state.activePlayerIndex - 1 : state.activePlayerIndex,
    },
    `${leaver.name} abandonne la partie.`,
    "bad",
  );

  if (players.length === 1) {
    const [winner] = players;
    nextState = {
      ...nextState,
      phase: "finished",
      turnStage: "finished",
      activePlayerIndex: 0,
      winnerId: winner.id,
      winReason: "forfeit",
    };
    return addLog(nextState, `${winner.name} remporte la partie par abandon !`, "good");
  }

  if (!wasActive) return nextState;
  return passTurnFrom({ ...nextState, turnStage: "turn-end" }, index - 1);
}
