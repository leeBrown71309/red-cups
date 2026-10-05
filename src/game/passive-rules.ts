import { DEVIL_ITEMS, ITEM_CATALOG, ITEM_ORDER } from "./catalog";
import type { GameState, ItemId, PassiveId, Player, PlayerId } from "./types";
import {
  BASE_INVENTORY_CAPACITY,
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
  "guardian-angel": 800,
};

export function getStartingCurrency(passiveId: PassiveId): number {
  return STARTING_CURRENCIES[passiveId] ?? STARTING_CURRENCY;
}

/** eShop: the shop opens after every move, wherever the player stands. */
export function shopsAnywhere(player: Player): boolean {
  return player.passiveId === "eshop";
}

/** Items only one passive finds at the shop: Made In Heaven, le diable's shop, the Bouclier. */
const EXCLUSIVE_ITEMS: Partial<Record<ItemId, PassiveId>> = {
  "made-in-heaven": "blind-luck",
  ...Object.fromEntries(DEVIL_ITEMS.map((itemId) => [itemId, "devil"])),
  shield: "guardian-angel",
};

/** L'Ange-Gardien may harm nobody: these never reach their bag through the shop, nor leave it. */
const GUARDIAN_FORBIDDEN_ITEMS: ItemId[] = [
  "ndoye",
  "hollow-purple",
  "mud",
  "tomato",
  "bullet-bill",
  "middle-finger",
  "draven",
  "helmet",
];

/** The shelf as `player` sees it: everything but the items of other passives, and none that L'Ange-Gardien may not use. */
export function getShopItems(player: Player): ItemId[] {
  return ITEM_ORDER.filter(
    (itemId) => (EXCLUSIVE_ITEMS[itemId] ?? player.passiveId) === player.passiveId && canUseItemKind(player, itemId),
  );
}

/** L'Ange-Gardien never uses an item that could harm (one won on a wheel stays in the bag). */
export function canUseItemKind(player: Player, itemId: ItemId): boolean {
  return player.passiveId !== "guardian-angel" || !GUARDIAN_FORBIDDEN_ITEMS.includes(itemId);
}

/** Items a passive may not buy: the Roller has no use for the Botte, and exclusive items stay with their passive. */
export function canBuyItemKind(player: Player, itemId: ItemId): boolean {
  if (player.passiveId === "roller" && itemId === "boot") return false;
  return getShopItems(player).includes(itemId);
}

/** L'Ange-Gardien carries two items only. */
export function getBagSlots(player: Player): number {
  return player.passiveId === "guardian-angel" ? 2 : BASE_INVENTORY_CAPACITY;
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
 * Copies of an item a bag may hold: two, a single Gomme or Made In Heaven, a
 * single stack of Tomates, and for Tomato Enjoyer a stack in every slot.
 */
export function getCopyLimit(player: Player, itemId: ItemId, capacity: number): number {
  if (itemId === "tomato") return player.passiveId === "tomato-enjoyer" ? capacity : 1;
  // Le diable never holds the same item twice.
  if (SINGLE_COPY_ITEMS.includes(itemId) || player.passiveId === "devil") return 1;
  return 2;
}

/** Tomates of a turn come from a single stack, but for Tomato Enjoyer, who throws as many as they hold. */
export function throwsOneStackPerTurn(player: Player): boolean {
  return player.passiveId !== "tomato-enjoyer";
}

/**
 * Chance aveugle: no item can harm them, whoever uses it. They never appear
 * among the targets, Draven and Bullet Bill spare them, and the mud only
 * pushes them back a tile.
 */
export function isImmuneToItems(player: Player): boolean {
  return player.passiveId === "blind-luck";
}

/** Whether `user` may aim an item at `target`: never Chance aveugle, and L'Ange-Gardien only at their protégé. */
export function canTargetPlayer(state: Pick<GameState, "guardian">, user: Player, target: Player): boolean {
  if (isImmuneToItems(target)) return false;
  return user.passiveId !== "guardian-angel" || state.guardian?.protegeId === target.id;
}

/** Le diable and L'Ange-Gardien never pick up a Red Cup. */
export function canCollectRedCup(player: Player): boolean {
  return player.passiveId !== "devil" && player.passiveId !== "guardian-angel";
}

/** L'Ange-Gardien never goes to Hell: they lose their next turn instead. */
export function avoidsHell(player: Player): boolean {
  return player.passiveId === "guardian-angel";
}

/**
 * Who the Hell wheel's duel may call down: never L'Ange-Gardien, who never
 * goes to Hell, nor Chance aveugle, whom nothing may harm.
 */
export function canBeChallenged(challengerId: PlayerId | undefined, target: Player): boolean {
  return target.id !== challengerId && !avoidsHell(target) && !isImmuneToItems(target);
}

/** Players L'Ange-Gardien may not protect. */
const MALEFACTORS: PassiveId[] = ["devil", "thief", "goblin", "corrupter"];

export function isMalefactor(player: Player): boolean {
  return MALEFACTORS.includes(player.passiveId);
}

/** Le diable wins once the others entered Hell ⌊4N − N/2⌋ times, N players at the start (2 → 7, 4 → 14). */
export function getDevilGoal(playerCount: number): number {
  return Math.floor(4 * playerCount - playerCount / 2);
}

/** Le diable's Doomsday turns every tile into a wheel of misfortune; Chance aveugle is spared. */
export function isDoomed(state: Pick<GameState, "doomsday">, player: Player): boolean {
  return state.doomsday !== null && !isImmuneToItems(player);
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
