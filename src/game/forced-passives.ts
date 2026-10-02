import { getEnergyCapacity } from "./energy";
import { assignGuardian } from "./guardian";
import { getStartingCurrency } from "./passive-rules";
import type { GameState, PassiveId } from "./types";

/**
 * Puts chosen passives on the first seats of a game just started, as the
 * tests need: what follows from a passive at the start comes along (coins,
 * the active player's gauge, L'Ange-Gardien's protégé).
 */
export function withPassives(state: GameState, passives: PassiveId[]): GameState {
  const players = state.players.map((player, index) => {
    const passiveId = passives[index];
    return passiveId ? { ...player, passiveId, currency: getStartingCurrency(passiveId) } : player;
  });
  const active = players[state.activePlayerIndex];
  return assignGuardian({ ...state, players, energyLeft: active ? getEnergyCapacity(active) : state.energyLeft });
}
