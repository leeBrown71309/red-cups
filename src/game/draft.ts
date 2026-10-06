import { CARD_KINDS, type CardKind } from "./cards";
import { PASSIVE_ORDER } from "./catalog";
import { announceDevil } from "./devil";
import { getEnergyCapacity } from "./energy";
import { assignGuardian } from "./guardian";
import { getStartingCurrency } from "./passive-rules";
import { addLog, randomChoice, shuffle } from "./state-utils";
import type { GameState, PassiveDraft, PassiveId, Player, PlayerId } from "./types";
import { GUARDIAN_MIN_PLAYERS } from "./types";

/**
 * The draft (patch 0.1.4, two stages since patch 0.1.6): before the game,
 * every player picks an actif among the cards dealt to them, then a passif
 * among others. Online the table has a minute per stage; a local table has
 * no clock (Q15).
 */

/** One minute for the whole table, online, at each stage. */
export const DRAFT_TIME_MS = 60_000;
/** Cards offered to each player at each stage. */
const OFFER_SIZE = 2;
/** Roles that exist once per table: they are never dealt a second time. */
const UNIQUE_CARDS: PassiveId[] = ["devil", "guardian-angel"];
/** Passifs that take from other players: L'Ange-Gardien never gets them. */
export const HARMFUL_PASSIFS: PassiveId[] = ["thief", "goblin", "corrupter", "trapper"];

/** Passifs a given actif may never be dealt: L'Ange-Gardien harms nobody, Cupide and Nepo Baby never go together. */
export function getRefusedPassifs(actifId: PassiveId | null | undefined): PassiveId[] {
  if (actifId === "guardian-angel") return HARMFUL_PASSIFS;
  if (actifId === "greedy") return ["nepo-baby"];
  return [];
}

export function getDraftOfferSize(_playerCount?: number): number {
  return OFFER_SIZE;
}

/**
 * Cards of one kind that may be dealt at a table this size. Lambda only fills
 * an empty slot; L'Ange-Gardien only joins a table of four or more.
 */
export function getDraftPool(kind: CardKind, playerCount: number): PassiveId[] {
  return PASSIVE_ORDER.filter(
    (cardId) =>
      CARD_KINDS[cardId] === kind &&
      cardId !== "lambda" &&
      (cardId !== "guardian-angel" || playerCount >= GUARDIAN_MIN_PLAYERS),
  );
}

/**
 * Deals each player `size` cards from the pool. No card is dealt twice at the
 * table while the pool lasts; once it runs out the cards come round again,
 * except the roles, and no offer ever holds a card twice.
 */
export function dealOffers(
  playerIds: PlayerId[],
  pool: PassiveId[],
  size = OFFER_SIZE,
  excluded: (playerId: PlayerId) => PassiveId[] = () => [],
): Record<PlayerId, PassiveId[]> {
  let deck = shuffle(pool);
  const refill = () => shuffle(pool.filter((cardId) => !UNIQUE_CARDS.includes(cardId)));
  const offers: Record<PlayerId, PassiveId[]> = {};
  for (const playerId of playerIds) {
    const offer: PassiveId[] = [];
    const refused = excluded(playerId);
    const fits = (cardId: PassiveId) => !offer.includes(cardId) && !refused.includes(cardId);
    while (offer.length < size) {
      let index = deck.findIndex(fits);
      if (index === -1) {
        deck = [...deck, ...refill()];
        index = deck.findIndex(fits);
        if (index === -1) break;
      }
      offer.push(deck.splice(index, 1)[0]);
    }
    offers[playerId] = offer;
  }
  return offers;
}

/** Deals the actifs to open the draft. */
export function createDraft(players: Player[], deadline: number | null): PassiveDraft {
  return {
    stage: "actif",
    offers: dealOffers(
      players.map((player) => player.id),
      getDraftPool("actif", players.length),
    ),
    picks: {},
    actifs: {},
    deadline,
  };
}

/** A pick may change until the stage closes; the last one missing closes it. */
export function pickPassive(state: GameState, playerId: PlayerId, passiveId: PassiveId, now?: number): GameState {
  const draft = state.draft;
  if (state.phase !== "draft" || !draft || !draft.offers[playerId]?.includes(passiveId)) return state;
  if (draft.picks[playerId] === passiveId) return state;
  const nextState: GameState = { ...state, draft: { ...draft, picks: { ...draft.picks, [playerId]: passiveId } } };
  return hasEveryonePicked(nextState) ? closeDraft(nextState, now) : nextState;
}

export function hasEveryonePicked(state: GameState): boolean {
  return state.players.every((player) => state.draft?.picks[player.id] !== undefined);
}

/**
 * Closes the stage: whoever has not picked gets one of their cards at random.
 * The actif stage hands over to the passif stage; the passif stage starts the
 * game, with what follows from the cards at any start (coins, the first
 * gauge, L'Ange-Gardien's protégé, le diable's announcement).
 */
export function closeDraft(state: GameState, now?: number): GameState {
  const draft = state.draft;
  if (state.phase !== "draft" || !draft) return state;
  const picks: Record<PlayerId, PassiveId> = {};
  for (const player of state.players) {
    const pick = draft.picks[player.id] ?? randomChoice(draft.offers[player.id] ?? []);
    if (pick) picks[player.id] = pick;
  }

  if (draft.stage === "actif") {
    // L'Ange-Gardien may harm nobody: no passif of theft, of mud or of any other harm for them.
    const offers = dealOffers(
      state.players.map((player) => player.id),
      getDraftPool("passif", state.players.length),
      OFFER_SIZE,
      (playerId) => getRefusedPassifs(picks[playerId]),
    );
    const deadline = draft.deadline === null ? null : (now ?? draft.deadline) + DRAFT_TIME_MS;
    return addLog(
      { ...state, draft: { stage: "passif", offers, picks: {}, actifs: picks, deadline } },
      "Les actifs sont choisis : place aux passifs.",
      "event",
    );
  }

  const players = state.players.map((player) => {
    const actif = draft.actifs[player.id] ?? player.passiveId;
    const passif = picks[player.id] ?? null;
    return { ...player, passiveId: actif, passifId: passif, currency: getStartingCurrency(actif, passif) };
  });
  const active = players[state.activePlayerIndex];
  let nextState: GameState = {
    ...state,
    phase: "playing",
    turnStage: "move",
    draft: null,
    players,
    energyLeft: active ? getEnergyCapacity(active) : state.energyLeft,
  };
  nextState = addLog(nextState, "Les cartes sont choisies : la partie commence !", "event");
  return announceDevil(assignGuardian(nextState));
}

/** Players still to pick at this stage, in seat order: the local table hands the screen to them one after the other. */
export function getPlayersToPick(state: GameState): Player[] {
  return state.players.filter((player) => state.draft?.picks[player.id] === undefined);
}
