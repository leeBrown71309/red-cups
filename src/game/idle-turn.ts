import { canDrinkAtWell } from "./desert";
import { canRescueProtege } from "./guardian";
import { canPlaceMark, canTeleportInTurn } from "./mage-queries";
import { getMimeTargets } from "./mime";
import { canVanish } from "./mist-cycle";
import { canDig } from "./mole";
import { canSwap } from "./sister";
import { getActivePlayer } from "./state-utils";
import { getBarrierRoads, planItemUse } from "./turn-actions";
import type { GameState } from "./types";

/**
 * Turns that have nothing left to offer (patch 0.3.0): the player has played, has no energy left and no Cups Power,
 * passif or free item they could still use. Their turn then ends by itself, as pressing « Fin du tour » would.
 */

/** Stages where the player is only resting: nothing is being decided, no dialog is open. */
const RESTING_STAGES = ["move", "hell", "turn-end"];

/** Whether the active player could still do anything at all this turn. */
export function hasActionLeft(state: GameState): boolean {
  const player = getActivePlayer(state);
  if (!player) return false;
  // Booleans, not the type guards the rules return: nothing here narrows the player.
  const vanishes: boolean = canVanish(state, player);
  const swaps: boolean = canSwap(state, player);
  if (getMimeTargets(state, player).length > 0 || vanishes || swaps) return true;
  if (canPlaceMark(state, player) || canTeleportInTurn(state, player) || canDig(state, player)) return true;
  if (canDrinkAtWell(state, player) || canRescueProtege(state)) return true;
  const roads = getBarrierRoads(state);
  return player.inventory.some(
    (entry) =>
      entry.kind === "item" &&
      (planItemUse(state, entry.id) !== null ||
        state.players.some((other) => planItemUse(state, entry.id, other.id, 1) !== null) ||
        (roads.length > 0 && planItemUse(state, entry.id, undefined, 1, roads[0]) !== null)),
  );
}

/** Whether the turn of the active player should end now, with nothing left for them to do. */
export function shouldEndTurnAutomatically(state: GameState): boolean {
  if (state.phase !== "playing" || !RESTING_STAGES.includes(state.turnStage)) return false;
  if (!state.turnActionTaken || state.energyLeft > 0) return false;
  return !hasActionLeft(state);
}
