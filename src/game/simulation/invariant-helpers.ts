import type { GameState, Player } from "../types";
import { CURRENCY_RESET_THRESHOLD } from "../types";

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

/** Compares players, not seats: a seat emptied before the active one shifts its index without a turn change. */
export function turnChanged(previous: GameState, next: GameState): boolean {
  const activeId = (state: GameState) => state.players[state.activePlayerIndex]?.id;
  return activeId(previous) !== activeId(next) || previous.round !== next.round;
}
