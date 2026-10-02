import type { GameState, NodeId, Player } from "../types";
import { CURRENCY_RESET_THRESHOLD, HELL_NODE_ID } from "../types";

/** Building blocks shared by the rule checks run after every bot action. */

export interface RuleViolation {
  rule: string;
  message: string;
}

export function violation(rule: string, message: string): RuleViolation {
  return { rule, message };
}

/** Log lines written by a single action, newest first. */
export function newLogTexts(previous: GameState, next: GameState): string[] {
  const texts: string[] = [];
  for (const entry of next.log) {
    if (entry.id === previous.log[0]?.id) break;
    texts.push(entry.text);
  }
  return texts;
}

/** Expected balance after a single coin change, including the Casque and the −300 reset. */
export function expectedBalance(player: Player, delta: number): number {
  let balance = player.currency + delta;
  const hasHelmet = player.inventory.some((entry) => entry.kind === "item" && entry.itemId === "helmet");
  if (delta < 0 && balance < 0 && hasHelmet) balance = 0;
  if (balance <= CURRENCY_RESET_THRESHOLD) balance = 0;
  return balance;
}

/**
 * Le diable's Portail on `nodeId`, or their Toucher d'Enfer on a knocked-out
 * player, sent `playerId` from that tile straight to Hell in this action.
 */
export function fellIntoHell(previous: GameState, next: GameState, playerId: string, nodeId: NodeId): boolean {
  if (next.players.find((player) => player.id === playerId)?.position !== HELL_NODE_ID) return false;
  const portal = previous.hellPortals.some((candidate) => candidate.nodeId === nodeId);
  return portal || newLogTexts(previous, next).some((text) => text.includes("Toucher d’Enfer"));
}

/** Compares players, not seats: a seat emptied before the active one shifts its index without a turn change. */
export function turnChanged(previous: GameState, next: GameState): boolean {
  const activeId = (state: GameState) => state.players[state.activePlayerIndex]?.id;
  return activeId(previous) !== activeId(next) || previous.round !== next.round;
}
