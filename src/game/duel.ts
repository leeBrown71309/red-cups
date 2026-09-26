import { settleBoard } from "./game-effects";
import { addLog, findPlayer, randomChoice, updatePlayer } from "./state-utils";
import type { GameState, PendingDuel, PlayerId, RpsChoice } from "./types";
import { START_NODE_ID } from "./types";

/**
 * Duels are decided inside the engine: the coin, each secret hand and each
 * vote is an action. In an online game every device then reaches the same
 * winner, and nobody can simply declare themselves the winner.
 */

const BEATS: Record<RpsChoice, RpsChoice> = { rock: "scissors", paper: "rock", scissors: "paper" };

export function isDuellist(duel: PendingDuel, playerId: PlayerId): boolean {
  return duel.playerOneId === playerId || duel.playerTwoId === playerId;
}

/** Everybody seated but the two duellists votes in a player-vote duel. */
export function getDuelVoterIds(state: GameState, duel: PendingDuel): PlayerId[] {
  return state.players.filter((player) => !isDuellist(duel, player.id)).map((player) => player.id);
}

function withDuel(state: GameState, duel: PendingDuel): GameState {
  return { ...state, pendingDuel: duel };
}

/** Reveals the coin the engine flipped when the duel started. */
export function flipDuelCoin(state: GameState): GameState {
  const duel = state.pendingDuel;
  if (!duel || duel.mode !== "coin-flip" || duel.winnerId || !duel.coinWinnerId) return state;
  return withDuel(state, { ...duel, winnerId: duel.coinWinnerId });
}

export function pickDuelHand(state: GameState, playerId: PlayerId, choice: RpsChoice): GameState {
  const duel = state.pendingDuel;
  if (!duel || duel.mode !== "rock-paper-scissors" || duel.winnerId) return state;
  if (!isDuellist(duel, playerId) || duel.rpsChoices[playerId]) return state;

  const rpsChoices = { ...duel.rpsChoices, [playerId]: choice };
  const firstChoice = rpsChoices[duel.playerOneId];
  const secondChoice = rpsChoices[duel.playerTwoId];
  if (!firstChoice || !secondChoice) return withDuel(state, { ...duel, rpsChoices, rpsTiedRound: null });

  if (firstChoice === secondChoice) {
    const tied: PendingDuel = { ...duel, rpsChoices: {}, rpsTiedRound: rpsChoices, rpsTies: duel.rpsTies + 1 };
    return addLog(withDuel(state, tied), "Égalité au pierre-feuille-ciseaux : on rejoue.", "event");
  }
  const winnerId = BEATS[firstChoice] === secondChoice ? duel.playerOneId : duel.playerTwoId;
  return withDuel(state, { ...duel, rpsChoices, winnerId });
}

export function castDuelVote(state: GameState, voterId: PlayerId, candidateId: PlayerId): GameState {
  const duel = state.pendingDuel;
  if (!duel || duel.mode !== "player-vote" || duel.winnerId) return state;
  const voterIds = getDuelVoterIds(state, duel);
  if (!voterIds.includes(voterId) || duel.votes[voterId] || !isDuellist(duel, candidateId)) return state;

  const votes = { ...duel.votes, [voterId]: candidateId };
  if (voterIds.some((id) => !votes[id])) return withDuel(state, { ...duel, votes });

  const ballots = voterIds.map((id) => votes[id]);
  const firstVotes = ballots.filter((vote) => vote === duel.playerOneId).length;
  const secondVotes = ballots.length - firstVotes;
  if (firstVotes !== secondVotes) {
    const winnerId = firstVotes > secondVotes ? duel.playerOneId : duel.playerTwoId;
    return withDuel(state, { ...duel, votes, winnerId });
  }
  const winnerId = randomChoice([duel.playerOneId, duel.playerTwoId]) ?? duel.playerOneId;
  return withDuel(state, { ...duel, votes, winnerId, voteTieBroken: true });
}

/**
 * Applies the duel: the winner goes back to the start, the loser stays in Hell.
 * Once the engine has decided the duel, only that winner is accepted.
 */
export function resolveDuel(state: GameState, winnerId: PlayerId): GameState {
  const duel = state.pendingDuel;
  if (!duel || !isDuellist(duel, winnerId)) return state;
  if (duel.winnerId && duel.winnerId !== winnerId) return state;
  if (duel.mode === "coin-flip" && duel.coinWinnerId !== winnerId) return state;
  const loserId = winnerId === duel.playerOneId ? duel.playerTwoId : duel.playerOneId;
  const winner = findPlayer(state, winnerId);
  const loser = findPlayer(state, loserId);
  if (!winner || !loser) return state;

  let nextState = updatePlayer(state, winnerId, (player) => ({ ...player, position: START_NODE_ID }));
  nextState = { ...nextState, pendingDuel: null };
  nextState = addLog(
    nextState,
    `${winner.name} gagne le duel et retourne en case 0. ${loser.name} reste en Enfer.`,
    "good",
  );
  return settleBoard(nextState, duel.resumeStage);
}
