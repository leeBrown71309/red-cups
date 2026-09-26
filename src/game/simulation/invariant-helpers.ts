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

export function turnChanged(previous: GameState, next: GameState): boolean {
  return previous.activePlayerIndex !== next.activePlayerIndex || previous.round !== next.round;
}
