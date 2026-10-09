import { hasCard, ownsCard } from "./cards";
import { getOpenBoard, getShortestPath } from "./board";
import { DEVIL_ITEMS, ITEM_CATALOG, ITEM_ORDER } from "./catalog";
import { isInvisible } from "./mist";
import type { GameState, ItemId, PassiveId, Player, PlayerId, WheelId } from "./types";
import {
  BASE_INVENTORY_CAPACITY,
  HERMIT_DISTANCE,
  INSURER_RATE,
  INSURER_ROUND_CAP,
  MUD_OWNER_REWARD,
  STARTING_CURRENCY,
  THEFT_PENALTY_RATE,
  THEFT_RISK_PER_TEN_COINS,
  TOMATO_STUN_CHANCE,
  HELL_TURN_LIMIT,
} from "./types";

/**
 * What the passives of patch 0.1.4 change to the common rules, gathered here
 * rather than as `passiveId === …` checks spread through the engine.
 */

/**
 * What a card adds to or takes from the usual 2 000 coins at the start. Deltas
 * add up across a player's two cards: Nepo Baby with eShop starts with 2 000.
 */
const STARTING_CURRENCY_DELTAS: Partial<Record<PassiveId, number>> = {
  "nepo-baby": 1_000,
  eshop: -1_000,
  "guardian-angel": -1_200,
};

/** The balance a player holding these cards starts the game with. */
export function getStartingCurrency(...cards: (PassiveId | null | undefined)[]): number {
  return cards.reduce<number>(
    (sum, card) => sum + (card ? (STARTING_CURRENCY_DELTAS[card] ?? 0) : 0),
    STARTING_CURRENCY,
  );
}

/** eShop: the shop opens after every move, wherever the player stands. */
export function shopsAnywhere(player: Player): boolean {
  return hasCard(player, "eshop");
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
  "parachute",
  "barrier",
  "mirror",
];

/** The shelf as `player` sees it: everything but the items of other passives, and none that L'Ange-Gardien may not use. */
export function getShopItems(player: Player): ItemId[] {
  return ITEM_ORDER.filter((itemId) => {
    const owner = EXCLUSIVE_ITEMS[itemId];
    return (owner === undefined || hasCard(player, owner)) && canUseItemKind(player, itemId);
  });
}

/** L'Ange-Gardien never uses an item that could harm (one won on a wheel stays in the bag). */
export function canUseItemKind(player: Player, itemId: ItemId): boolean {
  return !hasCard(player, "guardian-angel") || !GUARDIAN_FORBIDDEN_ITEMS.includes(itemId);
}

/** Items a passive may not buy: the Roller has no use for the Botte, and exclusive items stay with their passive. */
export function canBuyItemKind(player: Player, itemId: ItemId): boolean {
  if (hasCard(player, "roller") && itemId === "boot") return false;
  // The Miroir is sold once to each player, however it ended.
  if (itemId === "mirror" && player.mirrorUsed) return false;
  return getShopItems(player).includes(itemId);
}

/** L'Ange-Gardien carries two items only. */
export function getBagSlots(player: Player): number {
  return hasCard(player, "guardian-angel") ? 2 : BASE_INVENTORY_CAPACITY;
}

/** Cupide and the Piégeur pay less for the mud; Cupide earns more when somebody steps in theirs. */
export function getMudPrice(buyer: Player | undefined): number {
  return hasCard(buyer, "greedy") || hasCard(buyer, "trapper") ? 100 : ITEM_CATALOG.mud.price;
}

/** The Piégeur keeps a single patch of mud on the board: they cannot lay another while theirs waits. */
export function mustWaitForMudToBeSteppedOn(state: Pick<GameState, "mudTraps">, player: Player): boolean {
  return hasCard(player, "trapper") && state.mudTraps.some((trap) => trap.ownerId === player.id);
}

export function getMudOwnerReward(owner: Player): number {
  return hasCard(owner, "greedy") ? 200 : MUD_OWNER_REWARD;
}

/** Tomato Enjoyer's Tomates knock out more often. */
export function getTomatoStunChance(thrower: Player): number {
  return hasCard(thrower, "tomato-enjoyer") ? 0.05 : TOMATO_STUN_CHANCE;
}

/** Tomato Enjoyer: each Tomate received pays this. */
export const TOMATO_ENJOYER_HIT_REWARD = 5;

/** Items a bag holds a single copy of. */
const SINGLE_COPY_ITEMS: ItemId[] = ["eraser", "made-in-heaven", "mirror"];

/**
 * Copies of an item a bag may hold: two, a single Gomme or Made In Heaven, a
 * single stack of Tomates, and for Tomato Enjoyer a stack in every slot.
 */
export function getCopyLimit(player: Player, itemId: ItemId, capacity: number): number {
  if (itemId === "tomato") return hasCard(player, "tomato-enjoyer") ? capacity : 1;
  // Le diable never holds the same item twice.
  if (SINGLE_COPY_ITEMS.includes(itemId) || hasCard(player, "devil")) return 1;
  return 2;
}

/** Tomates of a turn come from a single stack, but for Tomato Enjoyer, who throws as many as they hold. */
export function throwsOneStackPerTurn(player: Player): boolean {
  return !hasCard(player, "tomato-enjoyer");
}

/**
 * Chance aveugle: no item can harm them, whoever uses it. They never appear
 * among the targets, Draven and Bullet Bill spare them, and the mud only
 * pushes them back a tile.
 */
export function isImmuneToItems(player: Player): boolean {
  return hasCard(player, "blind-luck");
}

/** What the rules that pick a player out of the table read: the angel's protégé, and where the Red Cup stands. */
export type TargetingState = Pick<
  GameState,
  "guardian" | "mapId" | "carouselReversed" | "iceTileNodeId" | "redCupNodeId"
>;

/**
 * Whether `user` may aim an item at `target`: never Chance aveugle, nobody in the dark of Mi-vu, Mi-vue (they aim at
 * nobody, nobody aims at them), and L'Ange-Gardien only at their protégé.
 */
export function canTargetPlayer(state: TargetingState, user: Player, target: Player): boolean {
  if (isImmuneToItems(target) || isInvisible(state, user) || isInvisible(state, target)) return false;
  return !hasCard(user, "guardian-angel") || state.guardian?.protegeId === target.id;
}

/** Le diable and L'Ange-Gardien never pick up a Red Cup. */
export function canCollectRedCup(player: Player): boolean {
  return !hasCard(player, "devil") && !hasCard(player, "guardian-angel");
}

/** L'Ange-Gardien never goes to Hell: they lose their next turn instead. */
export function avoidsHell(player: Player): boolean {
  return hasCard(player, "guardian-angel");
}

/**
 * Who the Hell wheel's duel may call down: never L'Ange-Gardien, who never
 * goes to Hell, nor Chance aveugle, whom nothing may harm, nor anybody Mi-vu, Mi-vue hides (the table, or the one
 * who chooses, when it is they).
 */
export function canBeChallenged(
  challengerId: PlayerId | undefined,
  target: Player,
  state?: Pick<GameState, "players" | "mapId" | "carouselReversed" | "iceTileNodeId" | "redCupNodeId">,
): boolean {
  if (target.id === challengerId || avoidsHell(target) || isImmuneToItems(target)) return false;
  if (!state) return true;
  return (
    !isInvisible(state, target) &&
    !isInvisible(
      state,
      state.players.find((player) => player.id === challengerId),
    )
  );
}

/** Players L'Ange-Gardien may not protect. */
const MALEFACTORS: PassiveId[] = ["devil", "thief", "goblin", "corrupter", "black-mage"];

export function isMalefactor(player: Player): boolean {
  return MALEFACTORS.some((cardId) => ownsCard(player, cardId));
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
  return hasCard(player, "blind-luck");
}

/** Double or nothing: every gain or loss of coins may be staked on a coin flip. */
export function offersGamble(player: Player): boolean {
  return hasCard(player, "double-or-nothing");
}

/** Voleur: the chance of being caught grows with the price, 1 % for every 10 coins. */
export function getTheftRisk(price: number): number {
  return Math.min(1, Math.round(price / 10) * THEFT_RISK_PER_TEN_COINS);
}

/** Voleur: what a thief caught stealing at `price` owes, in items first, then in coins. */
export function getTheftPenalty(price: number): number {
  return Math.ceil(price * THEFT_PENALTY_RATE);
}

/** Turns a player may spend in Hell before the toll lets them out: three for the Habitué de l'Enfer, else five. */
export function getHellTurnLimit(player: Pick<Player, "passiveId" | "passifId">): number {
  return hasCard(player, "hell-regular") ? HELL_REGULAR_TURN_LIMIT : HELL_TURN_LIMIT;
}

/** Coins the Habitué de l'Enfer is paid for each descent into Hell. */
export const HELL_REGULAR_REWARD = 150;
const HELL_REGULAR_TURN_LIMIT = 3;

/** Red Cups a player holds, as the rules compare them. */
function holdsCups(player: Player): number {
  return player.inventory.filter((entry) => entry.kind === "red-cup").length;
}

/**
 * Dernier de la classe: the player holds strictly fewer Red Cups than every
 * other player who can collect them. Le diable, L'Ange-Gardien and Cupide
 * never keep a Cup, so they stay out of the comparison.
 */
export function isLastInClass(state: Pick<GameState, "players">, player: Player): boolean {
  if (!hasCard(player, "last-in-class")) return false;
  const rivals = state.players.filter(
    (other) => other.id !== player.id && canCollectRedCup(other) && !hasCard(other, "greedy"),
  );
  return rivals.length > 0 && rivals.every((other) => holdsCups(player) < holdsCups(other));
}

/** Dernier de la classe pays a tenth less in the shop, never below ten coins. */
export const LAST_IN_CLASS_DISCOUNT = 0.1;

/** Main verte on the wheel of fortune, Main rouge on the wheel of misfortune: two draws, the better one kept. */
export function drawsTwiceKeepingBest(player: Player | undefined, wheelId: WheelId): boolean {
  return (
    (wheelId === "fortune" && hasCard(player, "green-hand")) ||
    (wheelId === "misfortune" && hasCard(player, "red-hand"))
  );
}

/**
 * L'Ermite (patch 0.2.3): whether the player stands on their own, nobody within two steps (arrows and Barrières
 * ignored, a player in Hell is nowhere near anybody), and was not disturbed since: somebody arriving on their tile
 * takes the prime away up to the end of their next turn.
 */
export function isHermitPrimeActive(
  state: Pick<GameState, "players" | "round" | "mapId" | "carouselReversed" | "iceTileNodeId">,
  player: Player,
): boolean {
  if (!hasCard(player, "hermit") || state.round <= (player.hermitLostUntilRound ?? 0)) return false;
  const board = getOpenBoard(state);
  return state.players.every((other) => {
    if (other.id === player.id) return true;
    if (other.position === player.position) return false;
    const path = getShortestPath(board, player.position, other.position, true);
    return path === null || path.length > HERMIT_DISTANCE;
  });
}

/** L'Assureur: what the bank pays them for `lost` coins another player loses in `round`, the round's cap applied. */
export function getInsurerPayout(insurer: Pick<Player, "insurerEarned">, round: number, lost: number): number {
  const earned = insurer.insurerEarned?.round === round ? insurer.insurerEarned.amount : 0;
  return Math.max(0, Math.min(Math.floor(lost * INSURER_RATE), INSURER_ROUND_CAP - earned));
}

/**
 * Touché angélique spins the wheel of fortune twice, Touché funeste the wheel
 * of misfortune and the wheel of Hell: both results count, good or bad.
 */
export function spinsTwice(player: Player | undefined, wheelId: WheelId): boolean {
  if (hasCard(player, "angelic-touch")) return wheelId === "fortune";
  return hasCard(player, "devils-hand") && (wheelId === "misfortune" || wheelId === "hell");
}
