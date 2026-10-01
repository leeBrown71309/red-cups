import { getBoard } from "../board";
import { getEnergyCapacity, getItemEnergyCost } from "../energy";
import { canUseDelinquent, getUniqueLegalDestinations } from "../rules";
import { getActivePlayer } from "../state-utils";
import type { GameState } from "../types";
import { MOVE_MINIMUM_ENERGY } from "../types";
import { newLogTexts, turnChanged, violation, type RuleViolation } from "./invariant-helpers";
import type { AppliedItem } from "./rule-invariants";

/**
 * Checks for the energy of the turn (patch 0.1.4): a full gauge when a turn
 * begins, items paid for at their cost, the move and the Hell wheel taking
 * what is left, and no end of turn before moving without a reason.
 */

/** The gauge stays within its bounds whatever happened. */
export function checkEnergyRange(state: GameState, found: RuleViolation[]): void {
  const active = getActivePlayer(state);
  if (!active || state.phase !== "playing") return;
  const capacity = getEnergyCapacity(active);
  if (!Number.isInteger(state.energyLeft) || state.energyLeft < 0 || state.energyLeft > capacity) {
    found.push(violation("energy-range", `${active.name} has ${state.energyLeft}/${capacity} energy`));
  }
}

export function checkEnergy(
  previous: GameState,
  next: GameState,
  found: RuleViolation[],
  appliedItem?: AppliedItem,
): void {
  if (next.phase !== "playing") return;
  const active = getActivePlayer(previous);
  if (!active) return;

  if (turnChanged(previous, next)) {
    const nextActive = getActivePlayer(next);
    if (nextActive && next.energyLeft !== getEnergyCapacity(nextActive)) {
      found.push(violation("energy-refill", `${nextActive.name} starts the turn with ${next.energyLeft} energy`));
    }
    checkEndOfTurn(previous, next, found);
    return;
  }
  if (next.turnStage === "blessing" && previous.turnStage !== "blessing") checkEndOfTurn(previous, next, found);

  if (next.energyLeft > previous.energyLeft) {
    found.push(violation("energy-no-refill", `energy rose from ${previous.energyLeft} to ${next.energyLeft}`));
  }
  if (appliedItem) checkItemCost(previous, next, appliedItem, found);
  checkCancelledCost(previous, next, found);

  // The Botte: one point spent, one kept for the two-tile move.
  if (previous.moveDistance === 1 && next.moveDistance === 2) {
    if (previous.energyLeft < 2 || next.energyLeft !== previous.energyLeft - getItemEnergyCost("boot")) {
      found.push(violation("energy-boot", `the Botte took energy from ${previous.energyLeft} to ${next.energyLeft}`));
    }
  }

  // A walk, or the Hell wheel standing for it, needs a point and takes the rest.
  const movement = next.lastMovement;
  const walked =
    movement !== null &&
    movement.seq !== previous.lastMovement?.seq &&
    movement.playerId === active.id &&
    ["move", "reaction"].includes(previous.turnStage) &&
    !movement.thawed &&
    !movement.flungByGhost;
  const wheel = next.pendingWheel;
  const spunHell = previous.turnStage === "hell" && wheel?.origin === "hell" && wheel.id !== previous.pendingWheel?.id;
  if (walked || spunHell) {
    const what = walked ? "the move" : "the Hell wheel";
    if (previous.energyLeft < MOVE_MINIMUM_ENERGY) {
      found.push(violation("energy-move-needs-one", `${active.name} played ${what} with no energy`));
    }
    if (next.energyLeft !== 0 || !next.turnActionTaken) {
      found.push(violation("energy-move-takes-all", `${what} left ${next.energyLeft} energy`));
    }
  }
}

/** An item costs exactly its energy, the Botte's point kept aside, and the turn goes on. */
function checkItemCost(previous: GameState, next: GameState, item: AppliedItem, found: RuleViolation[]): void {
  const cost = getItemEnergyCost(item.itemId);
  const kept = previous.moveDistance > 1 ? MOVE_MINIMUM_ENERGY : 0;
  if (previous.energyLeft - cost < kept) {
    found.push(violation("energy-item-affordable", `${item.itemId} used with ${previous.energyLeft} energy`));
  }
  if (next.energyLeft !== previous.energyLeft - cost || !next.turnActionTaken) {
    found.push(violation("energy-item-cost", `${item.itemId} took ${previous.energyLeft} to ${next.energyLeft}`));
  }
  if (["turn-end", "shop"].includes(next.turnStage)) {
    found.push(violation("item-keeps-turn", `${item.itemId} ended the turn on ${next.turnStage}`));
  }
}

/** Non merci: a cancelled item still costs its energy, a cancelled move all of it. */
function checkCancelledCost(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const pending = previous.pendingReaction;
  const cancelled = newLogTexts(previous, next).some((text) => text.includes("utilise Non merci"));
  if (!pending || !cancelled) return;
  const expected = pending.action.type === "item" ? previous.energyLeft - getItemEnergyCost(pending.action.itemId) : 0;
  if (next.energyLeft !== expected) {
    found.push(violation("energy-cancelled", `a cancelled ${pending.action.type} left ${next.energyLeft} energy`));
  }
}

/** Before moving, a turn only ends once something was done, without energy to move, or with no road open. */
function checkEndOfTurn(previous: GameState, next: GameState, found: RuleViolation[]): void {
  if (!["move", "hell"].includes(previous.turnStage) || next.players.length !== previous.players.length) return;
  const active = getActivePlayer(previous);
  if (!active || previous.turnActionTaken || previous.energyLeft < MOVE_MINIMUM_ENERGY) return;
  const stuck =
    previous.turnStage === "move" &&
    getUniqueLegalDestinations(
      getBoard(previous),
      active,
      previous.moveDistance,
      canUseDelinquent(active, previous.round),
    ).length === 0;
  if (!stuck) found.push(violation("energy-early-end", `${active.name} ended the turn without doing anything`));
}
