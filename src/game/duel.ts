import { countBaskets } from "./duel-setup";
import { addStartBonus, settleBoard } from "./game-effects";
import { resolveGhostDuel } from "./ghost";
import { carryOffIce } from "./ice";
import { addLog, findPlayer, randomChoice, updatePlayer } from "./state-utils";
import type { GameState, PendingDuel, PlayerId, RpsChoice } from "./types";
import { BASKET_MAX_SCORE, GHOST_ID, START_NODE_ID } from "./types";

/**
 * Duels are decided inside the engine: the coin, each secret hand and each
 * vote is an action. In an online game every device then reaches the same
 * winner, and nobody can simply declare themselves the winner.
 */

const BEATS: Record<RpsChoice, RpsChoice> = { rock: "scissors", paper: "rock", scissors: "paper" };

export function isDuellist(duel: PendingDuel, playerId: PlayerId): boolean {
  return duel.playerOneId === playerId || duel.playerTwoId === playerId;
}

const RPS_CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];

/** The duellists who play for themselves: the ghost's hand and shots are drawn by the engine. */
export function getHumanDuellistIds(duel: PendingDuel): PlayerId[] {
  return [duel.playerOneId, duel.playerTwoId].filter((id) => id !== GHOST_ID);
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
  // The ghost plays blind, like anybody would: its hand is drawn once the player's is in.
  if (duel.playerTwoId === GHOST_ID && !rpsChoices[GHOST_ID]) {
    rpsChoices[GHOST_ID] = randomChoice(RPS_CHOICES) ?? "rock";
  }
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

/** Basket: the next duellist to shoot, in seat order of the duel; the ghost never waits for a turn. */
export function getNextBasketShooterId(duel: PendingDuel): PlayerId | null {
  if (!duel.basket) return null;
  return getHumanDuellistIds(duel).find((id) => duel.basket?.scores[id] === undefined) ?? null;
}

/** Basket: the duellist presses start; their 15 seconds run from there (the ghost's alongside). */
export function startBasketRound(state: GameState, playerId: PlayerId): GameState {
  const duel = state.pendingDuel;
  if (!duel?.basket || duel.winnerId || duel.basket.shooterId !== null) return state;
  if (getNextBasketShooterId(duel) !== playerId) return state;
  return withDuel(state, { ...duel, basket: { ...duel.basket, shooterId: playerId } });
}

/**
 * Basket: the shooter's device reports their baskets once the time is up.
 * Against the ghost the duel is decided at once; between two players, once
 * both have shot. Equal scores are settled by a coin.
 */
export function submitBasketScore(state: GameState, playerId: PlayerId, score: number): GameState {
  const duel = state.pendingDuel;
  const basket = duel?.basket;
  if (!duel || !basket || duel.winnerId || basket.shooterId !== playerId || !Number.isFinite(score)) return state;

  const scores = { ...basket.scores, [playerId]: Math.max(0, Math.min(BASKET_MAX_SCORE, Math.floor(score))) };
  if (duel.playerTwoId === GHOST_ID) scores[GHOST_ID] = countBaskets(basket.ghostShots);
  const nextBasket = { ...basket, shooterId: null, scores };
  const first = scores[duel.playerOneId];
  const second = scores[duel.playerTwoId];
  if (first === undefined || second === undefined) return withDuel(state, { ...duel, basket: nextBasket });

  if (first !== second) {
    const winnerId = first > second ? duel.playerOneId : duel.playerTwoId;
    return withDuel(state, { ...duel, basket: nextBasket, winnerId });
  }
  const winnerId = randomChoice([duel.playerOneId, duel.playerTwoId]) ?? duel.playerOneId;
  const tied = withDuel(state, { ...duel, basket: { ...nextBasket, tieBroken: true }, winnerId });
  return addLog(tied, `Égalité au Basket (${first} partout) : la pièce départage.`, "event");
}

/**
 * Applies the duel: the winner goes back to the start with the start bonus,
 * like every other way out of Hell, and the loser stays there.
 * Once the engine has decided the duel, only that winner is accepted.
 */
export function resolveDuel(state: GameState, winnerId: PlayerId): GameState {
  const duel = state.pendingDuel;
  if (!duel || !isDuellist(duel, winnerId)) return state;
  if (duel.winnerId && duel.winnerId !== winnerId) return state;
  if (duel.mode === "coin-flip" && duel.coinWinnerId !== winnerId) return state;
  if (duel.ghost) return resolveGhostDuel(state, winnerId);
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
  nextState = addStartBonus(nextState, winnerId);
  // A start frozen by the blizzard carries the winner on.
  nextState = carryOffIce(nextState, winnerId, winner.position);
  return settleBoard(nextState, duel.resumeStage);
}
