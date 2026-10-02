import { addLog, randomChoice, shuffle } from "./state-utils";
import type { BlackjackDuel, GameState, PendingDuel, PlayerId, PlayingCard } from "./types";
import { GHOST_ID } from "./types";

/**
 * Blackjack duel (patch 0.1.4): two cards each, then each duellist in turn
 * draws or stands; the hand closest to 21 without going over wins, a coin
 * settles equal hands. The ghost plays as a dealer: it draws below 17.
 */

export const BLACKJACK_TARGET = 21;
/** The ghost, as a dealer, stops drawing from this total on. */
const DEALER_STANDS_AT = 17;

/** Every card of one deck, in order; the duel shuffles it. */
function createDeck(): PlayingCard[] {
  return [0, 1, 2, 3].flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ rank: index + 1, suit })));
}

/** Aces count 11 when that does not go over 21, 1 otherwise; faces count 10. */
export function getHandValue(cards: PlayingCard[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 1) aces += 1;
    total += Math.min(card.rank, 10);
  }
  while (aces > 0 && total + 10 <= BLACKJACK_TARGET) {
    total += 10;
    aces -= 1;
  }
  return total;
}

export function createBlackjack(firstId: PlayerId, secondId: PlayerId): BlackjackDuel {
  const deck = shuffle(createDeck());
  const hands = { [firstId]: [deck[0], deck[2]], [secondId]: [deck[1], deck[3]] };
  return { deck: deck.slice(4), hands, turnId: firstId, tieBroken: false };
}

function isDone(cards: PlayingCard[]): boolean {
  return getHandValue(cards) >= BLACKJACK_TARGET;
}

/**
 * Hands the turn on: to the second duellist once the first stood, went over
 * or reached 21; the ghost draws as a dealer at once; with both done, the
 * duel is decided.
 */
function passTurn(state: GameState, duel: PendingDuel, blackjack: BlackjackDuel): GameState {
  let next = blackjack;
  const second = duel.playerTwoId;
  if (next.turnId === duel.playerOneId && !isDone(next.hands[second] ?? [])) next = { ...next, turnId: second };
  else next = { ...next, turnId: null };

  if (next.turnId === GHOST_ID) next = playDealer(next);
  if (next.turnId !== null) return { ...state, pendingDuel: { ...duel, blackjack: next } };
  return decide(state, duel, next);
}

/** The ghost draws until 17 or more, then stands. */
function playDealer(blackjack: BlackjackDuel): BlackjackDuel {
  let deck = blackjack.deck;
  let hand = blackjack.hands[GHOST_ID] ?? [];
  while (getHandValue(hand) < DEALER_STANDS_AT && deck.length > 0) {
    hand = [...hand, deck[0]];
    deck = deck.slice(1);
  }
  return { ...blackjack, deck, hands: { ...blackjack.hands, [GHOST_ID]: hand }, turnId: null };
}

function decide(state: GameState, duel: PendingDuel, blackjack: BlackjackDuel): GameState {
  const score = (playerId: PlayerId) => {
    const value = getHandValue(blackjack.hands[playerId] ?? []);
    return value > BLACKJACK_TARGET ? -1 : value;
  };
  const first = score(duel.playerOneId);
  const second = score(duel.playerTwoId);
  if (first !== second) {
    const winnerId = first > second ? duel.playerOneId : duel.playerTwoId;
    return { ...state, pendingDuel: { ...duel, blackjack, winnerId } };
  }
  const winnerId = randomChoice([duel.playerOneId, duel.playerTwoId]) ?? duel.playerOneId;
  const tied: GameState = {
    ...state,
    pendingDuel: { ...duel, blackjack: { ...blackjack, tieBroken: true }, winnerId },
  };
  return addLog(tied, "Égalité au Blackjack : la pièce départage.", "event");
}

/** The duellist whose turn it is draws a card; at 21 or over, their hand is done. */
export function blackjackHit(state: GameState, playerId: PlayerId): GameState {
  const duel = state.pendingDuel;
  const blackjack = duel?.blackjack;
  if (!duel || !blackjack || duel.winnerId || blackjack.turnId !== playerId || blackjack.deck.length === 0) {
    return state;
  }
  const hand = [...(blackjack.hands[playerId] ?? []), blackjack.deck[0]];
  const next: BlackjackDuel = {
    ...blackjack,
    deck: blackjack.deck.slice(1),
    hands: { ...blackjack.hands, [playerId]: hand },
  };
  return isDone(hand) ? passTurn(state, duel, next) : { ...state, pendingDuel: { ...duel, blackjack: next } };
}

/** The duellist whose turn it is keeps their hand. */
export function blackjackStand(state: GameState, playerId: PlayerId): GameState {
  const duel = state.pendingDuel;
  const blackjack = duel?.blackjack;
  if (!duel || !blackjack || duel.winnerId || blackjack.turnId !== playerId) return state;
  return passTurn(state, duel, blackjack);
}
