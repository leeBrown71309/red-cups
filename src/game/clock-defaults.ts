import { getHumanDuellistIds, getNextBasketShooterId } from "./duel";
import type { GameAction } from "./game-actions";
import { avoidsHell } from "./passive-rules";
import { getForwardTiles } from "./rules";
import { findPlayer, randomChoice } from "./state-utils";
import type { GameState, PendingDuel, RpsChoice } from "./types";

/**
 * What happens when a decision's time runs out online: the cautious choice
 * where there is one (let it pass, stay, keep the coins), a random one drawn
 * by the engine otherwise (the tile to step onto, the item to throw away, a
 * hand, a vote). Null when the stage waits on nobody.
 */

const RPS_CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];

export function getDefaultAction(state: GameState): GameAction | null {
  switch (state.turnStage) {
    case "move":
    case "hell":
    case "shop":
    case "turn-end":
      return { type: "endTurn" };
    case "tile-wheel":
      return { type: "spinTileWheel" };
    case "wheel-result":
      return { type: "resolveWheel" };
    case "blessing":
      return { type: "spinBlessingWheel" };
    case "reaction":
      return { type: "resolveReaction", reactorId: null };
    case "reposition":
      return { type: "resolveNewCup", goToStart: false };
    case "passive-choice":
      return { type: "resolveCalmDown", destination: null };
    case "gamble":
      return { type: "resolveGamble", accept: false };
    case "advance": {
      const walker = findPlayer(state, state.pendingAdvance?.playerId);
      const destination = walker ? randomChoice(getForwardTiles(state, walker)) : undefined;
      return destination === undefined ? null : { type: "advanceOneTile", destination };
    }
    case "discard": {
      const owner = findPlayer(state, state.pendingDiscard?.playerId);
      const entry = randomChoice(owner?.inventory.filter((candidate) => candidate.kind === "item") ?? []);
      return entry ? { type: "discardInventoryEntry", entryId: entry.id } : null;
    }
    case "target": {
      const challengerId = state.pendingChallenge?.playerId;
      const opponent = randomChoice(
        state.players.filter((player) => player.id !== challengerId && !avoidsHell(player)),
      );
      return opponent ? { type: "challengePlayer", targetPlayerId: opponent.id } : null;
    }
    case "duel":
      return state.pendingDuel ? getDuelDefault(state, state.pendingDuel) : null;
    case "arm-wrestle": {
      // A side whose count never came pulled with no strength at all.
      const wrestle = state.pendingArmWrestle;
      const missing = wrestle && [wrestle.attackerId, wrestle.defenderId].find((id) => wrestle.taps[id] === undefined);
      return missing ? { type: "submitArmTaps", playerId: missing, taps: 0 } : null;
    }
    default:
      return null;
  }
}

/** A duel left waiting: the coin flips, a missing hand or vote is drawn, an absent shooter scores nothing. */
function getDuelDefault(state: GameState, duel: PendingDuel): GameAction | null {
  if (duel.winnerId) return { type: "resolveDuel", winnerId: duel.winnerId };
  switch (duel.mode) {
    case "coin-flip":
      return { type: "flipDuelCoin" };
    case "rock-paper-scissors": {
      const chooserId = getHumanDuellistIds(duel).find((id) => !duel.rpsChoices[id]);
      const choice = randomChoice(RPS_CHOICES);
      return chooserId && choice ? { type: "pickDuelHand", playerId: chooserId, choice } : null;
    }
    case "player-vote": {
      const voter = state.players.find(
        (player) => player.id !== duel.playerOneId && player.id !== duel.playerTwoId && !duel.votes[player.id],
      );
      const candidateId = randomChoice([duel.playerOneId, duel.playerTwoId]);
      return voter && candidateId ? { type: "castDuelVote", voterId: voter.id, candidateId } : null;
    }
    case "basket": {
      const shooterId = duel.basket?.shooterId ?? getNextBasketShooterId(duel);
      if (!shooterId) return null;
      if (duel.basket?.shooterId !== shooterId) return { type: "startBasketRound", playerId: shooterId };
      return { type: "submitBasketScore", playerId: shooterId, score: 0 };
    }
    case "blackjack": {
      // An absent duellist keeps their hand.
      const turnId = duel.blackjack?.turnId;
      return turnId ? { type: "blackjackStand", playerId: turnId } : null;
    }
  }
}
