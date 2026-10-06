import { hasCard } from "../cards";
import { getDraftOfferSize, getDraftPool } from "../draft";
import { getStartingCurrency } from "../passive-rules";
import { findPlayer } from "../state-utils";
import type { GameState, PassiveId } from "../types";
import { violation, type RuleViolation } from "./invariant-helpers";

/**
 * Checks for the draft (patch 0.1.4, two stages since patch 0.1.6): the cards
 * dealt at the table, picks among them, and the two cards each player ends
 * up with.
 */

/** Roles that exist once per table. */
const UNIQUE_CARDS: PassiveId[] = ["devil", "guardian-angel"];

export function checkDraftState(state: GameState): RuleViolation[] {
  const found: RuleViolation[] = [];
  const draft = state.draft;
  if (!draft) return [violation("draft-state", "a draft phase without a draft")];
  const size = getDraftOfferSize(state.players.length);
  const pool = getDraftPool(draft.stage, state.players.length);
  const dealt = state.players.flatMap((player) => draft.offers[player.id] ?? []);
  // Cards are only repeated at the table once the pool ran out; a role never is.
  if (draft.stage === "actif" && dealt.length <= pool.length && new Set(dealt).size !== dealt.length) {
    found.push(violation("draft-unique", "a card was dealt twice while others were left"));
  }
  for (const role of UNIQUE_CARDS) {
    if (dealt.filter((cardId) => cardId === role).length > 1)
      found.push(violation("draft-role", `${role} dealt twice`));
  }
  for (const player of state.players) {
    const offers = draft.offers[player.id] ?? [];
    // A player who joined late may get fewer cards than the usual offer, never none.
    if (offers.length === 0 || offers.length > size || new Set(offers).size !== offers.length) {
      found.push(violation("draft-offers", `${player.name} was dealt ${offers.join(", ")}`));
    }
    if (offers.some((cardId) => !pool.includes(cardId) && cardId !== "lambda")) {
      found.push(violation("draft-pool", `${player.name} was dealt a card of the wrong kind: ${offers.join(", ")}`));
    }
    const pick = draft.picks[player.id];
    if (pick !== undefined && !offers.includes(pick)) {
      found.push(violation("draft-pick", `${player.name} picked ${pick}, not one of their cards`));
    }
  }
  return found;
}

/** Once the draft closes, everybody plays the actif and the passif they picked, or one they were dealt. */
export function checkDraftTransition(previous: GameState, next: GameState): RuleViolation[] {
  const found: RuleViolation[] = [];
  const draft = previous.draft;
  if (!draft || next.phase === "draft") return found;
  for (const player of next.players) {
    const pick = draft.picks[player.id];
    const offers = draft.offers[player.id] ?? [];
    const actif = draft.actifs[player.id];
    // L'Ange-Gardien with nobody to protect plays Lambda.
    const angelTurnedLambda = hasCard(player, "lambda") && actif === "guardian-angel";
    const playedActif = actif === undefined || player.passiveId === actif;
    const playedPassif = pick !== undefined ? player.passifId === pick : offers.includes(player.passifId as PassiveId);
    if (!findPlayer(previous, player.id) || ((!playedActif || !playedPassif) && !angelTurnedLambda)) {
      found.push(violation("draft-close", `${player.name} plays ${player.passiveId} and ${player.passifId}`));
    }
    if (player.currency !== getStartingCurrency(player.passiveId, player.passifId)) {
      found.push(violation("draft-currency", `${player.name} starts with ${player.currency} coins`));
    }
  }
  return found;
}
