import { getDuelVoterIds } from "./duel";
import type { GameAction } from "./game-actions";
import { getDecidingPlayer } from "./rules";
import { getActivePlayer } from "./state-utils";
import type { GameState, PlayerId } from "./types";

/**
 * Who may send an action in an online game. Every device runs the same check
 * on every action it receives, so an action from the wrong seat is refused
 * everywhere at once and the game never forks.
 *
 * A local game skips this: one device plays every seat.
 */
export function getActionActorIds(state: GameState, action: GameAction): PlayerId[] {
  if (state.phase !== "playing") return [];
  const active = getActivePlayer(state)?.id;
  const deciding = getDecidingPlayer(state)?.id;
  const only = (playerId: PlayerId | null | undefined): PlayerId[] => (playerId ? [playerId] : []);
  const duel = state.pendingDuel;

  switch (action.type) {
    // Set up by the room itself, never by a player mid-game.
    case "startGame":
    case "resetGame":
    case "spinWheel":
      return [];

    case "movePlayer":
    case "prepareBoot":
    case "buyItem":
    case "useItem":
    case "endTurn":
    case "spinHellWheel":
      return only(active);

    case "spinTileWheel":
    case "spinBlessingWheel":
    case "repositionBeforeCup":
      return only(deciding);

    case "resolveReaction":
      if (!state.pendingReaction) return [];
      if (action.reactorId === null) return state.pendingReaction.reactorIds;
      return state.pendingReaction.reactorIds.includes(action.reactorId) ? [action.reactorId] : [];

    // The Gomme belongs to whoever the wheel was spun for.
    case "resolveWheel":
    case "cancelWheel":
      return only(state.pendingWheel?.playerId);

    case "challengePlayer":
      return only(state.pendingChallenge?.playerId);

    case "flipDuelCoin":
    case "resolveDuel":
      return duel ? [duel.playerOneId, duel.playerTwoId] : [];

    case "pickDuelHand":
      return duel ? only(action.playerId) : [];

    case "castDuelVote":
      return duel && getDuelVoterIds(state, duel).includes(action.voterId) ? [action.voterId] : [];

    case "discardInventoryEntry":
      return only(state.pendingDiscard?.playerId);

    case "resolveCalmDown":
      return only(state.pendingCalmDown?.passivePlayerId);

    case "abandonGame":
      return only(action.playerId);
  }
}

/**
 * An online duel is only settled once the engine decided it, so nobody can
 * declare themselves the winner of a rock-paper-scissors or a vote.
 */
function isSettledDuel(state: GameState, action: GameAction): boolean {
  if (action.type !== "resolveDuel") return true;
  return state.pendingDuel?.winnerId === action.winnerId;
}

export function canPlayerSendAction(state: GameState, action: GameAction, playerId: PlayerId): boolean {
  return getActionActorIds(state, action).includes(playerId) && isSettledDuel(state, action);
}
