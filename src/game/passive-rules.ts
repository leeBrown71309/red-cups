import { ITEM_CATALOG, ITEM_ORDER } from "./catalog";
import type { ItemId, PassiveId, Player } from "./types";
import {
  MUD_OWNER_REWARD,
  STARTING_CURRENCY,
  THEFT_PENALTY_RATE,
  THEFT_RISK_PER_TEN_COINS,
  TOMATO_STUN_CHANCE,
} from "./types";

/**
 * What the passives of patch 0.1.4 change to the common rules, gathered here
 * rather than as `passiveId === …` checks spread through the engine.
 */

/** Balances that differ from the usual 2 000 at the start of a game. */
const STARTING_CURRENCIES: Partial<Record<PassiveId, number>> = {
  "nepo-baby": 3_000,
  eshop: 1_000,
};

export function getStartingCurrency(passiveId: PassiveId): number {
  return STARTING_CURRENCIES[passiveId] ?? STARTING_CURRENCY;
}

/** eShop: the shop opens after every move, wherever the player stands. */
export function shopsAnywhere(player: Player): boolean {
  return player.passiveId === "eshop";
}

/** Items only one passive finds at the shop: Made In Heaven is Chance aveugle's. */
const EXCLUSIVE_ITEMS: Partial<Record<ItemId, PassiveId>> = { "made-in-heaven": "blind-luck" };

/** The shelf as `player` sees it: everything but the items of other passives. */
export function getShopItems(player: Player): ItemId[] {
  return ITEM_ORDER.filter((itemId) => (EXCLUSIVE_ITEMS[itemId] ?? player.passiveId) === player.passiveId);
}

/** Items a passive may not buy: the Roller has no use for the Botte, and exclusive items stay with their passive. */
export function canBuyItemKind(player: Player, itemId: ItemId): boolean {
  if (player.passiveId === "roller" && itemId === "boot") return false;
  return getShopItems(player).includes(itemId);
}

/** Cupide pays less for the mud, and earns more when somebody steps in theirs. */
export function getMudPrice(buyer: Player | undefined): number {
  return buyer?.passiveId === "greedy" ? 100 : ITEM_CATALOG.mud.price;
}

export function getMudOwnerReward(owner: Player): number {
  return owner.passiveId === "greedy" ? 200 : MUD_OWNER_REWARD;
}

/** Tomato Enjoyer's Tomates knock out more often. */
export function getTomatoStunChance(thrower: Player): number {
  return thrower.passiveId === "tomato-enjoyer" ? 0.05 : TOMATO_STUN_CHANCE;
}

/** Tomato Enjoyer: each Tomate received pays this. */
export const TOMATO_ENJOYER_HIT_REWARD = 5;

/** Items a bag holds a single copy of. */
const SINGLE_COPY_ITEMS: ItemId[] = ["eraser", "made-in-heaven"];

/**
 * Copies of an item a bag may hold: two, a single Gomme or Made In Heaven, and
 * for Tomato Enjoyer a stack of Tomates in every slot.
 */
export function getCopyLimit(player: Player, itemId: ItemId, capacity: number): number {
  if (SINGLE_COPY_ITEMS.includes(itemId)) return 1;
  if (itemId === "tomato" && player.passiveId === "tomato-enjoyer") return capacity;
  return 2;
}

/**
 * Chance aveugle: no item can harm them, whoever uses it. They never appear
 * among the targets, Draven and Bullet Bill spare them, and the mud only
 * pushes them back a tile.
 */
export function isImmuneToItems(player: Player): boolean {
  return player.passiveId === "blind-luck";
}

/** Whether an item may be aimed at `target`. */
export function canTargetPlayer(target: Player): boolean {
  return !isImmuneToItems(target);
}

/** Chance aveugle never sees the Red Cup. */
export function isBlindToRedCup(player: Player): boolean {
  return player.passiveId === "blind-luck";
}

/** Double or nothing: every gain or loss of coins may be staked on a coin flip. */
export function offersGamble(player: Player): boolean {
  return player.passiveId === "double-or-nothing";
}

/** Voleur: the chance of being caught grows with the price, 1 % for every 10 coins. */
export function getTheftRisk(price: number): number {
  return Math.min(1, Math.round(price / 10) * THEFT_RISK_PER_TEN_COINS);
}

/** Voleur: what a thief caught stealing at `price` owes, in items first, then in coins. */
export function getTheftPenalty(price: number): number {
  return Math.ceil(price * THEFT_PENALTY_RATE);
}
