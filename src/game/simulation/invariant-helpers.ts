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

/**
 * Coins a player was paid for Hell in these lines: le diable's 50 for each
 * other descent and 100 for their own, the Habitué de l'Enfer's 150. They come
 * on top of whatever else the action did.
 */
export function hellRewardCoins(texts: string[], name: string): number {
  let coins = 0;
  for (const text of texts) {
    if (text.includes(`${name} gagne 50 pièces et un point`)) coins += 50;
    const own = new RegExp(String.raw`^${name} est chez lui en Enfer : \+(\d+) pièces`).exec(text);
    if (own) coins += Number(own[1]);
  }
  return coins;
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

/**
 * Banquise: `playerId` slid on during this action, after a wheel set them
 * down on ice, or carried away by it (see `carriedByIce`).
 */
export function slidOnIce(previous: GameState, next: GameState, playerId: string): boolean {
  const name = previous.players.find((player) => player.id === playerId)?.name;
  const slid =
    name !== undefined && newLogTexts(previous, next).some((text) => text.startsWith(`${name} glisse sur la glace`));
  return slid || carriedByIce(previous, next, playerId);
}

/**
 * Banquise: the ice carried `playerId` away in this action, after a swap, a
 * trip to a frozen start or the blizzard freezing their tile; the tile it
 * leaves them on is no arrival.
 */
export function carriedByIce(previous: GameState, next: GameState, playerId: string): boolean {
  const name = previous.players.find((player) => player.id === playerId)?.name;
  return name !== undefined && newLogTexts(previous, next).some((text) => text.startsWith(`La glace emporte ${name} `));
}

/** Knocked out on le diable's tile, `playerId` went straight to Hell through their Toucher d'Enfer. */
export function touchedByHell(previous: GameState, next: GameState, playerId: string): boolean {
  const player = next.players.find((candidate) => candidate.id === playerId);
  return (
    player?.position === HELL_NODE_ID && newLogTexts(previous, next).some((text) => text.includes("Toucher d’Enfer"))
  );
}

/** Compares players, not seats: a seat emptied before the active one shifts its index without a turn change. */
export function turnChanged(previous: GameState, next: GameState): boolean {
  const activeId = (state: GameState) => state.players[state.activePlayerIndex]?.id;
  return activeId(previous) !== activeId(next) || previous.round !== next.round;
}
