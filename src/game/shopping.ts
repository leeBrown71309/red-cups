import { ITEM_CATALOG } from "./catalog";
import { hasCard } from "./cards";
import { canBuyItemKind } from "./passive-rules";
import { canAddItem, getItemPrice, getPriceFor, isOnSale, opensShop } from "./rules";
import {
  addBagLog,
  appendItem,
  applyCurrencyChange,
  getActivePlayer,
  spendItemEntry,
  updatePlayer,
} from "./state-utils";
import type { GameState, ItemId, Player } from "./types";

/**
 * Buying at the shop. Several copies of an item can be bought in one go (a
 * stack of Tomates, a second Corde): the shop offers a quantity instead of a
 * button pressed again and again.
 */

/** No purchase ever asks for more: five Tomates in each of the bag's slots at the very most. */
const MAX_PURCHASE_COUNT = 40;

/** Whether the shop open to `player` sells them `itemId`: their passive, their bag and the Red Cup allow it. */
export function isOnShelf(state: GameState, player: Player, itemId: ItemId): boolean {
  if (state.turnStage !== "shop" || !opensShop(state, player)) return false;
  return canAddItem(player, itemId) && canBuyItemKind(player, itemId) && isOnSale(state, itemId);
}

/**
 * How many of `itemId` the active player can buy right now, one after the
 * other: as many as their purse, their bag and the copy limits allow.
 */
export function getMaxPurchaseCount(state: GameState, itemId: ItemId): number {
  const player = getActivePlayer(state);
  if (!player || !isOnShelf(state, player, itemId)) return 0;
  const price = getPriceFor(state, itemId, player);
  let bag = player;
  let count = 0;
  while (count < MAX_PURCHASE_COUNT && canAddItem(bag, itemId) && player.currency >= price * (count + 1)) {
    // Only the shape of the bag matters here: the slot ids are placeholders.
    bag = appendItem(bag, itemId, `planned-${count}`);
    count += 1;
  }
  return count;
}

/** Buys `count` of an item at once, or nothing at all when the shop cannot sell that many. */
export function buyItem(state: GameState, itemId: ItemId, count = 1): GameState {
  const player = getActivePlayer(state);
  if (!player || !Number.isInteger(count) || count < 1 || count > getMaxPurchaseCount(state, itemId)) return state;

  // Shopping costs no energy: what is bought is used from the next turn on, Bullet Bill included.
  const total = getPriceFor(state, itemId, player) * count;
  let nextState = applyCurrencyChange(state, player.id, -total, { gamble: false });
  for (let bought = 0; bought < count; bought += 1) {
    nextState = updatePlayer(nextState, player.id, (current) => appendItem(current, itemId));
  }
  if (itemId === "boot" && !state.bootFirstPurchased) {
    nextState = { ...nextState, bootFirstPurchased: true, bootLastPriceRound: state.round };
  }
  const name = ITEM_CATALOG[itemId].name;
  const what = count > 1 ? `${name} ×${count}` : name;
  return addBagLog(
    nextState,
    player.id,
    `${player.name} achète ${what} pour ${total} pièces.`,
    `${player.name} a effectué un achat.`,
    "good",
  );
}

/** What the Brocanteur is paid for an item: 60 % of its price, to the nearest five coins. */
export const RESALE_RATE = 0.6;

export function getResalePrice(
  state: Pick<GameState, "bootPrice" | "players">,
  itemId: ItemId,
  seller: Player,
): number {
  return Math.round((getItemPrice(itemId, state.bootPrice, seller) * RESALE_RATE) / 5) * 5;
}

/** Whether the active Brocanteur may sell this entry of their bag now: in the shop, one item, never a Red Cup. */
export function canSellEntry(state: GameState, player: Player, entryId: string): boolean {
  if (!hasCard(player, "junk-dealer") || state.turnStage !== "shop" || !opensShop(state, player)) return false;
  return player.inventory.some((entry) => entry.id === entryId && entry.kind === "item");
}

/** The Brocanteur sells one item of their bag back to the shop. */
export function sellItem(state: GameState, entryId: string): GameState {
  const player = getActivePlayer(state);
  if (!player || !canSellEntry(state, player, entryId)) return state;
  const entry = player.inventory.find((candidate) => candidate.id === entryId);
  if (entry?.kind !== "item") return state;

  const price = getResalePrice(state, entry.itemId, player);
  let nextState = updatePlayer(state, player.id, (current) => spendItemEntry(current, entryId));
  // Like a purchase, a sale is chosen: it is not staked.
  nextState = applyCurrencyChange(nextState, player.id, price, { gamble: false });
  const name = ITEM_CATALOG[entry.itemId].name;
  return addBagLog(
    nextState,
    player.id,
    `${player.name} revend ${name} pour ${price} pièces.`,
    `${player.name} revend un objet.`,
    "good",
  );
}
