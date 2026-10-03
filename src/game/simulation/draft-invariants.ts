import { getDraftOfferSize, getDraftPool } from "../draft";
import { getStartingCurrency } from "../passive-rules";
import { findPlayer } from "../state-utils";
import type { GameState } from "../types";
import { violation, type RuleViolation } from "./invariant-helpers";

/** Checks for the passive draft (patch 0.1.4): cards dealt once at the table, picks among them. */

export function checkDraftState(state: GameState): RuleViolation[] {
  const found: RuleViolation[] = [];
  const draft = state.draft;
  if (!draft) return [violation("draft-state", "a draft phase without a draft")];
  const size = getDraftOfferSize(state.players.length);
  const pool = getDraftPool(state.players.length);
  const dealt = state.players.flatMap((player) => draft.offers[player.id] ?? []);
  if (new Set(dealt).size !== dealt.length) found.push(violation("draft-unique", "a passive card was dealt twice"));
  for (const player of state.players) {
    const offers = draft.offers[player.id] ?? [];
    if (offers.length !== size || offers.some((passiveId) => !pool.includes(passiveId))) {
      found.push(violation("draft-offers", `${player.name} was dealt ${offers.join(", ")}`));
    }
    const pick = draft.picks[player.id];
    if (pick !== undefined && !offers.includes(pick)) {
      found.push(violation("draft-pick", `${player.name} picked ${pick}, not one of their cards`));
    }
  }
  return found;
}

/** Once the draft closes, everybody plays a passive they were dealt, the one they picked if any. */
export function checkDraftTransition(previous: GameState, next: GameState): RuleViolation[] {
  const found: RuleViolation[] = [];
  const draft = previous.draft;
  if (!draft || next.phase === "draft") return found;
  for (const player of next.players) {
    const pick = draft.picks[player.id];
    const offers = draft.offers[player.id] ?? [];
    // L'Ange-Gardien with nobody to protect plays Lambda.
    const angelTurnedLambda =
      player.passiveId === "lambda" &&
      (pick === "guardian-angel" || (pick === undefined && offers.includes("guardian-angel")));
    const played = pick !== undefined ? player.passiveId === pick : offers.includes(player.passiveId);
    if (!findPlayer(previous, player.id) || (!played && !angelTurnedLambda)) {
      found.push(violation("draft-close", `${player.name} plays ${player.passiveId}`));
    }
    if (player.currency !== getStartingCurrency(player.passiveId)) {
      found.push(violation("draft-currency", `${player.name} starts with ${player.currency} coins`));
    }
  }
  return found;
}
