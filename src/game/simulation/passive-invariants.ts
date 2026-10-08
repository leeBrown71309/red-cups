import { hasCard } from "../cards";
import { getOpenBoard, getShortestPath } from "../board";
import { ITEM_CATALOG } from "../catalog";
import { findPlayer, getActivePlayer } from "../state-utils";
import { isThrownItem } from "../turn-actions";
import type { GameState, NodeId } from "../types";
import {
  CALM_DOWN_DISTANCE,
  HELL_NODE_ID,
  NO_THANKS_COOLDOWN_ROUNDS,
  RED_GREEN_TRIGGERS_PER_CUP,
  START_BONUS,
  START_NODE_ID,
} from "../types";
import {
  expectedBalance,
  newLogTexts,
  slidOnIce,
  touchedByHell,
  violation,
  type RuleViolation,
  hellRewardCoins,
} from "./invariant-helpers";

/**
 * Checks for the passives reworked in patch 0.1.4: New Cup, New Me, Calme-toi,
 * Red light, Green light and Non merci.
 */

function distanceToCup(state: GameState, nodeId: NodeId): number {
  if (state.redCupNodeId === null) return Infinity;
  return getShortestPath(getOpenBoard(state), state.redCupNodeId, nodeId, true)?.length ?? Infinity;
}

/** New Cup, New Me: before the Cup appears, its holder goes to the start with the bonus, or stays put. */
export function checkNewCup(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const holderId = previous.pendingCupRepositionPlayerId;
  if (previous.turnStage !== "reposition" || !holderId || next.pendingCupRepositionPlayerId === holderId) return;
  const before = findPlayer(previous, holderId);
  const after = findPlayer(next, holderId);
  if (!before || !after) return;

  const logs = newLogTexts(previous, next);
  const toStart = logs.some((text) => text.startsWith(`${before.name} file au Départ`));
  // Knocked out on le diable's tile, the start may lead straight to Hell through their Toucher d'Enfer.
  const touched = logs.some((text) => text.includes("Toucher d’Enfer")) && after.position === HELL_NODE_ID;
  // A frozen start slides them on (Banquise).
  const landed = after.position === START_NODE_ID || touched || slidOnIce(previous, next, holderId);
  if (
    toStart &&
    (!landed || after.currency !== expectedBalance(before, START_BONUS + hellRewardCoins(logs, before.name)))
  ) {
    found.push(violation("new-cup-start", `${before.name} went to ${after.position} with ${after.currency} coins`));
  }
  // Staying on le diable's tile does not shelter from the Toucher d'Enfer: it may drop them to Hell right after.
  if (!toStart && !touched && after.position !== before.position) {
    found.push(violation("new-cup-stay", `${before.name} moved to ${after.position} instead of staying`));
  }
  if (next.redCupNodeId !== previous.pendingCupRevealNodeId) {
    found.push(violation("new-cup-reveal", `the Cup appeared on ${next.redCupNodeId}, not where it was drawn`));
  }
  const isActive = getActivePlayer(previous)?.id === holderId;
  if (after.position !== before.position && isActive && next.turnStage === "shop") {
    found.push(violation("new-cup-no-shop", `${before.name} shops on tile ${after.position} after leaving`));
  }
}

/**
 * Calme-toi: only players one or two steps from the new Cup, and closer to it
 * than the holder, may be set down, three steps from it, without a wheel.
 */
export function checkCalmDown(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const offered = next.pendingCalmDown;
  if (offered && previous.pendingCalmDown === null) {
    const holder = findPlayer(next, offered.passivePlayerId);
    const holderDistance = holder ? distanceToCup(next, holder.position) : -1;
    if (!hasCard(holder, "calm-down")) found.push(violation("calm-down-holder", "Calme-toi without its holder"));
    for (const targetId of offered.targetIds) {
      const target = findPlayer(next, targetId);
      const distance = target ? distanceToCup(next, target.position) : Infinity;
      if (!target || target.id === holder?.id || distance < 1 || distance > 2 || distance >= holderDistance) {
        found.push(violation("calm-down-target", `${targetId} is offered to Calme-toi from ${distance} steps`));
      }
    }
  }

  const pending = previous.pendingCalmDown;
  if (!pending || previous.turnStage !== "passive-choice" || next.pendingCalmDown !== null) return;
  // One player of the offered ones, at most, was set down.
  const movedIds = pending.targetIds.filter(
    (id) => findPlayer(previous, id)?.position !== findPlayer(next, id)?.position,
  );
  if (movedIds.length > 1) found.push(violation("calm-down-one", `Calme-toi moved ${movedIds.length} players`));
  const before = findPlayer(previous, movedIds[0]);
  const after = findPlayer(next, movedIds[0]);
  if (!before || !after || before.position === after.position) return;
  // Knocked out on le diable's tile, the player set down may go on to Hell through their Toucher d'Enfer.
  const touched = touchedByHell(previous, next, after.id);
  const offTarget = distanceToCup(previous, after.position) !== CALM_DOWN_DISTANCE || after.position === HELL_NODE_ID;
  if (offTarget && !touched) {
    found.push(violation("calm-down-distance", `${before.name} was set down on ${after.position}`));
  }
  // A wheel still owed on the tile left behind is dropped once the board settles.
  if (next.pendingTileWheels.some((entry) => entry.playerId === after.id && entry.nodeId === after.position)) {
    found.push(violation("calm-down-no-wheel", `${before.name} spins on the tile Calme-toi set them on`));
  }
}

/** Red light, Green light: two green and two red tiles at most per Red Cup, counted afresh with each Cup. */
export function checkRedGreen(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const { green, red } = next.redGreenTriggers;
  if (green < 0 || red < 0 || green > RED_GREEN_TRIGGERS_PER_CUP || red > RED_GREEN_TRIGGERS_PER_CUP) {
    found.push(violation("red-green-limit", `Red light, Green light counted ${green} green and ${red} red`));
  }
  const newCup = next.redCupCycle > previous.redCupCycle;
  const counted = previous.redGreenTriggers;
  if (newCup && (green !== 0 || red !== 0)) {
    found.push(violation("red-green-reset", "the new Red Cup did not reset Red light, Green light"));
  }
  if (!newCup && (green < counted.green || red < counted.red)) {
    found.push(violation("red-green-reset", "Red light, Green light was reset without a new Red Cup"));
  }
}

/**
 * Non merci: spent only by its ready holder, on an item used against them,
 * on a wheel spun for them or on Bullet Bill about to hit them.
 */
export function checkNoThanksUsage(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const pending = previous.pendingReaction;
  for (const player of next.players) {
    const before = findPlayer(previous, player.id);
    if (!before || before.noThanksReadyRound === player.noThanksReadyRound) continue;
    // L'Ange-Gardien took the place of a protégé who left, Non merci and its cooldown included.
    if (before.passiveId !== player.passiveId) continue;
    const reacted =
      previous.turnStage === "reaction" &&
      pending !== null &&
      pending.reactorIds.includes(player.id) &&
      pending.actorId !== player.id;
    const wheel = previous.turnStage === "wheel-result" && previous.pendingWheel?.playerId === player.id;
    // Bullet Bill hits as a new round starts: Non merci is spent in that round.
    const round = reacted && pending?.action.type === "bullet-bill" ? previous.round + 1 : previous.round;
    const legal =
      (reacted || wheel) &&
      hasCard(player, "no-thanks") &&
      before.noThanksReadyRound <= round &&
      player.noThanksReadyRound === round + NO_THANKS_COOLDOWN_ROUNDS;
    if (!legal) found.push(violation("no-thanks-usage", `${player.name} spent Non merci illegally`));
  }

  const opened = next.pendingReaction;
  if (opened && opened !== pending && opened.action.type === "item") {
    const { itemId, targetPlayerId } = opened.action;
    // L'Ange-Gardien's Bouclier answers for their protégé.
    const guards = (reactorId: string) =>
      next.guardian?.angelId === reactorId && next.guardian.protegeId === targetPlayerId && itemId !== "draven";
    const ownTarget = (reactorId: string) => itemId === "draven" || reactorId === targetPlayerId || guards(reactorId);
    const hurtsSomeone = itemId === "draven" || ITEM_CATALOG[itemId].target === "player";
    if (isThrownItem(itemId) || !hurtsSomeone || !opened.reactorIds.every(ownTarget)) {
      found.push(violation("no-thanks-own-target", `Non merci offered on ${itemId} aimed at someone else`));
    }
  }

  const cancelled = newLogTexts(previous, next).some((text) => text.includes("utilise Non merci"));
  if (!pending || !cancelled || pending.action.type !== "item") return;
  const actorBefore = findPlayer(previous, pending.actorId);
  const actorAfter = findPlayer(next, pending.actorId);
  const reactor = next.players.find((player) => pending.reactorIds.includes(player.id));
  if (pending.action.itemId === "draven") {
    const reactorBefore = findPlayer(previous, reactor?.id);
    if (reactor && reactorBefore && reactor.position !== reactorBefore.position) {
      found.push(violation("no-thanks-spares", `Draven still moved ${reactor.name} after Non merci`));
    }
    return;
  }
  const target = findPlayer(previous, pending.action.targetPlayerId);
  const targetAfter = findPlayer(next, pending.action.targetPlayerId);
  if (actorBefore?.position !== actorAfter?.position || target?.position !== targetAfter?.position) {
    found.push(violation("no-thanks-cancels", `${actorBefore?.name}'s item still moved someone after Non merci`));
  }
  // A cancelled item leaves the actor their turn.
  if (next.turnStage !== pending.resumeStage) {
    found.push(violation("no-thanks-keeps-turn", `after Non merci the stage is ${next.turnStage}`));
  }
}
