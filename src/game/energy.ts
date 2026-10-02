import { ITEM_CATALOG } from "./catalog";
import { canUseCorrupter, hasTurnMove } from "./rules";
import { getActivePlayer } from "./state-utils";
import type { GameState, ItemId, PassiveId, Player } from "./types";
import { BASE_ENERGY, HELL_NODE_ID, MOVE_MINIMUM_ENERGY } from "./types";

/**
 * Energy (patch 0.1.4): every turn opens with a full gauge. Items are used
 * first, each for its own cost; the move then needs at least one point, uses
 * up whatever is left and ends the turn. In Hell the wheel stands for the move.
 */

/** Passives that enlarge the gauge. */
const ENERGY_BONUSES: Partial<Record<PassiveId, number>> = { "red-bull": 1 };

/** Energy a player's turn opens with. */
export function getEnergyCapacity(player: Player): number {
  return BASE_ENERGY + (ENERGY_BONUSES[player.passiveId] ?? 0);
}

export function getItemEnergyCost(itemId: ItemId): number {
  return ITEM_CATALOG[itemId].energyCost;
}

/**
 * Whether the active player can pay for this item now. A prepared Botte keeps
 * a point back for the two-tile move, so preparing it takes two points.
 */
export function canAffordItem(state: GameState, itemId: ItemId): boolean {
  const keptForMove = itemId === "boot" || state.moveDistance > 1 ? MOVE_MINIMUM_ENERGY : 0;
  return state.energyLeft - getItemEnergyCost(itemId) >= keptForMove;
}

/** Whether enough energy is left to move, or to spin the Hell wheel. */
export function canAffordMove(state: GameState): boolean {
  return state.energyLeft >= MOVE_MINIMUM_ENERGY;
}

/**
 * Pays for an item, the Botte or le diable's way out of Hell. Only what costs
 * energy counts as having done something this turn (author's answer): a
 * Tomate, free, does not let the player end their turn without moving.
 */
export function spendEnergy(state: GameState, amount: number): GameState {
  return {
    ...state,
    energyLeft: Math.max(0, state.energyLeft - amount),
    turnActionTaken: state.turnActionTaken || amount > 0,
  };
}

/** The move, or the Hell wheel: it takes whatever energy is left. */
export function spendAllEnergy(state: GameState): GameState {
  return { ...state, energyLeft: 0, turnActionTaken: true };
}

function hasLegalMove(state: GameState, player: Player): boolean {
  return hasTurnMove(state, player, canUseCorrupter(player, state.round));
}

/**
 * The turn ends at any time once the player moved (shop, end of turn). Before
 * moving, only once they did something that cost energy (an item, the Botte),
 * when too little energy is left to move, or when no road leads anywhere.
 */
export function canEndTurn(state: GameState): boolean {
  if (state.phase !== "playing") return false;
  if (state.turnStage === "shop" || state.turnStage === "turn-end") return true;
  const player = getActivePlayer(state);
  if (!player || (state.turnStage !== "move" && state.turnStage !== "hell")) return false;
  if (state.turnActionTaken || !canAffordMove(state)) return true;
  return state.turnStage === "move" && player.position !== HELL_NODE_ID && !hasLegalMove(state, player);
}
