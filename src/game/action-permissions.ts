import { getDuelVoterIds, getHumanDuellistIds } from "./duel";
import type { GameAction } from "./game-actions";
import { canJoinLate } from "./late-join";
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
  // A newcomer sits at the next seat of the room, which the engine does not know yet.
  if (action.type === "joinLatePlayer") return canJoinLate(state) ? [action.playerId] : [];
  // The draft: each player picks for themselves; anybody may close it once its minute is over.
  if (state.phase === "draft") {
    if (action.type === "pickPassive") return state.draft?.offers[action.playerId] ? [action.playerId] : [];
    if (action.type === "expireClock") return state.players.map((player) => player.id);
    return [];
  }
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
    case "rollDice":
    case "leaveHell":
    case "rescueProtege":
    case "buyItem":
    case "stealItem":
    case "useItem":
    case "endTurn":
    case "spinHellWheel":
      return only(active);

    case "spinTileWheel":
    case "spinBlessingWheel":
    case "resolveNewCup":
    case "advanceOneTile":
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
      return duel ? getHumanDuellistIds(duel) : [];

    // Only the shooter's device knows their baskets.
    case "startBasketRound":
    case "submitBasketScore":
      return duel && getHumanDuellistIds(duel).includes(action.playerId) ? [action.playerId] : [];

    // Only the duellist whose hand it is draws or stands.
    case "blackjackHit":
    case "blackjackStand":
      return duel?.blackjack?.turnId === action.playerId ? [action.playerId] : [];

    // Each side of the arm wrestle sends their own taps.
    case "submitArmTaps": {
      const wrestle = state.pendingArmWrestle;
      return wrestle && [wrestle.attackerId, wrestle.defenderId].includes(action.playerId) ? [action.playerId] : [];
    }

    case "pickDuelHand":
      return duel && getHumanDuellistIds(duel).includes(action.playerId) ? [action.playerId] : [];

    case "castDuelVote":
      return duel && getDuelVoterIds(state, duel).includes(action.voterId) ? [action.voterId] : [];

    case "discardInventoryEntry":
      return only(state.pendingDiscard?.playerId);

    case "resolveCalmDown":
      return only(state.pendingCalmDown?.passivePlayerId);

    case "resolveGamble":
      return state.turnStage === "gamble" ? only(state.pendingGambles[0]?.playerId) : [];

    case "abandonGame":
      return only(action.playerId);

    // The engine then checks that the sender is the host, or that the host has been gone too long.
    case "pauseGame":
    case "resumeGame":
      return only(action.playerId);

    case "pickPassive":
      return [];

    // Whoever sees a clock run out may close it: a device gone quiet must not hold the table.
    case "expireClock":
      return state.players.map((player) => player.id);
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
