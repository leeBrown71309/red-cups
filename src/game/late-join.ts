import { getCards } from "./cards";
import { dealOffers, dealUniquePassifs, getDraftPool, getStageOfferSize } from "./draft";
import { getStartingCurrency } from "./passive-rules";
import { addLog, randomChoice } from "./state-utils";
import type { GameState, PassiveDraft, PassiveId, Player, PlayerColor, PlayerId } from "./types";
import { FIRST_ROUND, START_NODE_ID } from "./types";

/**
 * Joining a room after the kickoff (patch 0.1.5): open from the draft until the
 * first round of the table is over, for the seats left. The newcomer sits last
 * in the turn order.
 */

export const MAX_TABLE_SIZE = 8;

/** Roles that are announced at the start: they cannot be handed out once the game runs. */
const ROLE_CARDS: PassiveId[] = ["devil", "guardian-angel"];

/** Whether a newcomer may still sit down at this table. */
export function canJoinLate(state: GameState): boolean {
  return (
    (state.phase === "draft" || state.phase === "playing") &&
    state.round <= FIRST_ROUND &&
    state.players.length < MAX_TABLE_SIZE
  );
}

/** A card of this kind that nobody holds or was dealt, for a newcomer; any card of the kind when none is left. */
function drawFreeCard(kind: "actif" | "passif", state: GameState, taken: Set<PassiveId>): PassiveId | undefined {
  const pool = getDraftPool(kind, state.players.length + 1).filter((cardId) => !ROLE_CARDS.includes(cardId));
  return randomChoice(pool.filter((cardId) => !taken.has(cardId))) ?? randomChoice(pool);
}

/** Cards the newcomer chooses from at the current stage: the ones nobody else was dealt, completed if too few. */
function dealLateOffer(state: GameState, draft: PassiveDraft): PassiveId[] {
  const pool = getDraftPool(draft.stage, state.players.length + 1);
  const dealt = new Set(Object.values(draft.offers).flat());
  const free = pool.filter((cardId) => !dealt.has(cardId));
  const size = getStageOfferSize(draft.stage);
  const source = free.length >= size ? free : pool;
  const lateOffers =
    draft.stage === "passif" ? dealUniquePassifs(["late"], source) : dealOffers(["late"], source, size);
  const offer = lateOffers["late"] ?? [];
  return offer.length > 0 ? offer : [draft.stage === "actif" ? "lambda" : (pool[0] ?? "lambda")];
}

export function joinLatePlayer(state: GameState, playerId: PlayerId, name: string, color: PlayerColor): GameState {
  if (!canJoinLate(state) || state.players.some((player) => player.id === playerId)) return state;
  const draft = state.draft;
  const held = new Set(state.players.flatMap((player) => getCards(player)));
  let actif: PassiveId;
  let passif: PassiveId | null = null;
  let nextDraft: PassiveDraft | null = null;

  if (draft) {
    const offer = dealLateOffer(state, draft);
    const dealtActifs = new Set(Object.values(draft.actifs).filter((cardId): cardId is PassiveId => Boolean(cardId)));
    // Arriving at the passif stage, the newcomer gets an actif no one picked.
    actif = draft.stage === "actif" ? offer[0] : (drawFreeCard("actif", state, dealtActifs) ?? "lambda");
    passif = draft.stage === "passif" ? offer[0] : null;
    nextDraft = {
      ...draft,
      offers: { ...draft.offers, [playerId]: offer },
      actifs: draft.stage === "passif" ? { ...draft.actifs, [playerId]: actif } : draft.actifs,
    };
  } else {
    actif = drawFreeCard("actif", state, held) ?? "lambda";
    passif = drawFreeCard("passif", state, held) ?? null;
  }

  const player: Player = {
    id: playerId,
    name: name.trim() || `Joueur ${state.players.length + 1}`,
    color,
    position: START_NODE_ID,
    currency: getStartingCurrency(actif, passif),
    inventory: [],
    passiveId: actif,
    passifId: passif,
    skippedTurns: 0,
    knockedOut: false,
    hellTurns: 0,
    noThanksReadyRound: FIRST_ROUND,
    previousNodeId: null,
  };
  const nextState: GameState = { ...state, players: [...state.players, player], draft: nextDraft ?? state.draft };
  return addLog(nextState, `${player.name} rejoint la partie.`, "event");
}
