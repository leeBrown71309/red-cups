import { withCard } from "./cards";
import { getEnergyCapacity } from "./energy";
import { assignGuardian } from "./guardian";
import { getStartingCurrency } from "./passive-rules";
import type { GameState, PassiveId } from "./types";

/**
 * Puts chosen cards on the first seats of a game just started, as the tests
 * need: each card goes in its own slot (an actif or a passif), a seat given an
 * actif only keeps Lambda for the rest, and what follows from the cards at the
 * start comes along (coins, the active player's gauge, L'Ange-Gardien's protégé).
 * Give a seat both an actif and a passif by naming both: `["devil", "thief"]`
 * as two cards of the same seat is spelled `[["devil", "thief"]]`.
 */
export function withPassives(state: GameState, passives: (PassiveId | PassiveId[])[]): GameState {
  const players = state.players.map((player, index) => {
    const wanted = passives[index];
    if (!wanted) return player;
    const cards = Array.isArray(wanted) ? wanted : [wanted];
    let next = { ...player, passiveId: "lambda" as PassiveId, passifId: null as PassiveId | null };
    for (const card of cards) next = withCard(next, card);
    return { ...next, currency: getStartingCurrency(next.passiveId, next.passifId) };
  });
  const active = players[state.activePlayerIndex];
  return assignGuardian({ ...state, players, energyLeft: active ? getEnergyCapacity(active) : state.energyLeft });
}
