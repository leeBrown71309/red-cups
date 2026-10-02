import { ITEM_CATALOG } from "./catalog";
import type { ItemId, PassiveId, Player } from "./types";
import { MUD_OWNER_REWARD, STARTING_CURRENCY, TOMATO_STUN_CHANCE } from "./types";

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

/** Items a passive may not buy: the Roller has no use for the Botte. */
export function canBuyItemKind(player: Player, itemId: ItemId): boolean {
  return !(player.passiveId === "roller" && itemId === "boot");
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

/**
 * Copies of an item a bag may hold: two, a single Gomme, and for Tomato
 * Enjoyer a stack of Tomates in every slot.
 */
export function getCopyLimit(player: Player, itemId: ItemId, capacity: number): number {
  if (itemId === "eraser") return 1;
  if (itemId === "tomato" && player.passiveId === "tomato-enjoyer") return capacity;
  return 2;
}
