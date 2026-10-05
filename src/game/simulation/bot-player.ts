import { hasCard } from "../cards";
import { canAbandon } from "../abandon";
import { getDuelVoterIds, getHumanDuellistIds, getNextBasketShooterId } from "../duel";
import { getBoard, getShortestPath } from "../board";
import { DEVIL_ITEMS, ITEM_CATALOG } from "../catalog";
import { canAffordItem, canAffordMove, canEndTurn } from "../energy";
import { getForwardTiles } from "../game-actions";
import { getCalmDownTiles } from "../game-effects";
import { getHandValue } from "../blackjack";
import { canLeaveHell } from "../devil";
import { canRescueProtege } from "../guardian";
import { canBeChallenged, canBuyItemKind, getShopItems, isBlindToRedCup } from "../passive-rules";
import { canAddItem, canUseCorrupter, canUseNoThanks, getPriceFor, getTurnMoveOptions, isOnSale } from "../rules";
import { findPlayer, getActivePlayer } from "../state-utils";
import type { GameStore } from "../store";
import { getBarrierRoads, planItemUse } from "../turn-actions";
import type { InventoryEntry, ItemId, NodeId, PlayerId, RpsChoice } from "../types";
import type { AppliedItem } from "./rule-invariants";

/**
 * A bot that plays every seat, like the host of a local game. It only picks
 * among legal choices, with a bit of intent (chasing the Red Cup) so games end.
 */

export interface BotAction {
  /** Stable name used for coverage statistics, e.g. "use:rope" or "move". */
  label: string;
  perform: (store: GameStore) => void;
  /** Set when the action uses an item, so the rule checker can verify its effect. */
  item?: AppliedItem;
}

type Random = () => number;

const RPS_CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];

function pick<T>(values: T[], random: Random): T | undefined {
  return values.length === 0 ? undefined : values[Math.floor(random() * values.length)];
}

function distanceToCup(store: GameStore, nodeId: NodeId): number {
  if (store.redCupNodeId === null) return 0;
  return getShortestPath(getBoard(store), nodeId, store.redCupNodeId, false)?.length ?? 99;
}

interface ItemOption {
  entry: InventoryEntry & { kind: "item" };
  targetId?: PlayerId;
  /** The neighbouring tile a Barrière shuts the road to. */
  roadNodeId?: NodeId;
  /** A whole volley of Tomates, or part of the stack. */
  count?: number;
}

function useItemAction(store: GameStore, option: ItemOption): BotAction {
  const userId = getActivePlayer(store)?.id ?? "";
  return {
    label: `use:${option.entry.itemId}`,
    perform: (current) => current.useItem(option.entry.id, option.targetId, option.count, option.roadNodeId),
    item: {
      itemId: option.entry.itemId,
      entryId: option.entry.id,
      userId,
      targetPlayerId: option.targetId,
      count: option.count,
    },
  };
}

function listUsableItems(store: GameStore): ItemOption[] {
  const player = getActivePlayer(store);
  if (!player) return [];
  return player.inventory.flatMap((entry): ItemOption[] => {
    if (entry.kind !== "item") return [];
    if (ITEM_CATALOG[entry.itemId].target === "road") {
      return getBarrierRoads(store, player.position)
        .filter((nodeId) => planItemUse(store, entry.id, undefined, 1, nodeId) !== null)
        .map((roadNodeId) => ({ entry, roadNodeId }));
    }
    if (ITEM_CATALOG[entry.itemId].target !== "player") {
      return planItemUse(store, entry.id) ? [{ entry }] : [];
    }
    // A stack is thrown all at once: the table picks the volley's size in the dialog, the bot empties it.
    const count = entry.count ?? 1;
    return store.players
      .filter((target) => planItemUse(store, entry.id, target.id, count) !== null)
      .map((target) => ({ entry, targetId: target.id, ...(count > 1 ? { count } : {}) }));
  });
}

/** Now and then a turn ends after an item, without moving. */
const EARLY_END_CHANCE = 0.05;

function endTurnAction(label: string): BotAction {
  return { label, perform: (current) => current.endTurn() };
}

/** Items first, while the energy lasts; then the move, which takes what is left and ends the turn. */
function chooseMoveTurn(store: GameStore, random: Random): BotAction | null {
  const player = getActivePlayer(store);
  if (!player) return null;

  const boot = player.inventory.find((entry) => entry.kind === "item" && entry.itemId === "boot");
  const roller = hasCard(player, "roller");
  if (boot && !roller && store.moveDistance === 1 && canAffordItem(store, "boot") && random() < 0.2) {
    return { label: "prepare-boot", perform: (current) => current.prepareBoot(boot.id) };
  }

  if (canRescueProtege(store) && random() < 0.5) {
    return { label: "rescue-protege", perform: (current) => current.rescueProtege() };
  }

  const items = listUsableItems(store);
  if (items.length > 0 && random() < 0.35) return useItemAction(store, pick(items, random)!);
  if (!canAffordMove(store)) return endTurnAction("end-turn-tired");
  if (store.turnActionTaken && random() < EARLY_END_CHANCE) return endTurnAction("end-turn-early");
  if (roller && store.diceRoll === null) return { label: "roll-dice", perform: (current) => current.rollDice() };

  const destinationsOf = (ignoreArrows: boolean) => [
    ...new Set(getTurnMoveOptions(store, player, ignoreArrows).map((path) => path[path.length - 1])),
  ];
  const regular = destinationsOf(false);
  const rebel = canUseCorrupter(player, store.round)
    ? destinationsOf(true).filter((nodeId) => !regular.includes(nodeId))
    : [];

  if (rebel.length > 0 && random() < 0.25) {
    const destination = pick(rebel, random)!;
    return { label: "move-rebel", perform: (current) => current.movePlayer(destination, true) };
  }

  if (regular.length === 0) {
    const option = pick(items, random);
    if (option) return useItemAction(store, option);
    return endTurnAction("end-turn-stuck");
  }

  // Chance aveugle cannot see the Red Cup to chase it.
  const chaseCup = !isBlindToRedCup(player) && random() < 0.55;
  const destination = chaseCup
    ? [...regular].sort((left, right) => distanceToCup(store, left) - distanceToCup(store, right))[0]
    : pick(regular, random)!;
  return { label: "move", perform: (current) => current.movePlayer(destination) };
}

/** Voleur: now and then, a theft rather than a purchase. */
const THEFT_CHANCE = 0.3;
/** Items of a role, which its holder goes for first: le diable's shop, Made In Heaven, the Bouclier. */
const ROLE_ITEMS: ItemId[] = [...DEVIL_ITEMS, "made-in-heaven", "shield"];
const ROLE_ITEM_CHANCE = 0.8;

function chooseShopping(store: GameStore, random: Random): BotAction {
  const player = getActivePlayer(store);
  const onShelf = player
    ? getShopItems(player).filter(
        (itemId) => canAddItem(player, itemId) && canBuyItemKind(player, itemId) && isOnSale(store, itemId),
      )
    : [];

  const loot = hasCard(player, "thief") && !store.theftAttempted ? pick(onShelf, random) : undefined;
  if (loot && random() < THEFT_CHANCE) return { label: `steal:${loot}`, perform: (current) => current.stealItem(loot) };

  const affordable = onShelf.filter((itemId) => player!.currency >= getPriceFor(store, itemId, player));
  const roleItem = pick(
    affordable.filter((itemId) => ROLE_ITEMS.includes(itemId)),
    random,
  );
  if (roleItem && random() < ROLE_ITEM_CHANCE) {
    return { label: `buy:${roleItem}`, perform: (current) => current.buyItem(roleItem) };
  }
  const itemId = pick(affordable, random);
  if (itemId && random() < 0.55) return { label: `buy:${itemId}`, perform: (current) => current.buyItem(itemId) };
  return endTurnAction("end-turn");
}

/** Rare enough that most games still end on three Red Cups. */
const ABANDON_CHANCE = 0.0005;

function chooseAbandon(store: GameStore, random: Random): BotAction | null {
  if (!canAbandon(store) || random() >= ABANDON_CHANCE) return null;
  const leaver = pick(store.players, random);
  if (!leaver) return null;
  return { label: "abandon", perform: (current) => current.abandonGame(leaver.id) };
}

/** Plays the duel the way the table would: flip the coin, pick hands, cast votes, then settle. */
function chooseDuelAction(store: GameStore, random: Random): BotAction | null {
  const duel = store.pendingDuel;
  if (!duel) return null;
  const { winnerId } = duel;
  if (winnerId) return { label: `duel:${duel.mode}`, perform: (current) => current.resolveDuel(winnerId) };

  if (duel.mode === "coin-flip") return { label: "duel:flip", perform: (current) => current.flipDuelCoin() };
  if (duel.mode === "blackjack") {
    const turnId = duel.blackjack?.turnId;
    if (!turnId) return null;
    // Like most players: draw below 17, sometimes a little bolder or shyer.
    const hit = getHandValue(duel.blackjack?.hands[turnId] ?? []) < 15 + Math.floor(random() * 4);
    return hit
      ? { label: "duel:blackjack-hit", perform: (current) => current.blackjackHit(turnId) }
      : { label: "duel:blackjack-stand", perform: (current) => current.blackjackStand(turnId) };
  }
  if (duel.mode === "basket") {
    const shooterId = duel.basket?.shooterId ?? getNextBasketShooterId(duel);
    if (!shooterId) return null;
    if (duel.basket?.shooterId !== shooterId) {
      return { label: "duel:basket-start", perform: (current) => current.startBasketRound(shooterId) };
    }
    // A table of humans scores anywhere from a couple of baskets to a dozen.
    const score = Math.floor(random() * 13);
    return { label: "duel:basket-score", perform: (current) => current.submitBasketScore(shooterId, score) };
  }
  if (duel.mode === "rock-paper-scissors") {
    const chooserId = getHumanDuellistIds(duel).find((id) => !duel.rpsChoices[id]);
    const choice = pick(RPS_CHOICES, random);
    if (!chooserId || !choice) return null;
    return { label: "duel:hand", perform: (current) => current.pickDuelHand(chooserId, choice) };
  }
  const voterId = getDuelVoterIds(store, duel).find((id) => !duel.votes[id]);
  const candidateId = pick([duel.playerOneId, duel.playerTwoId], random);
  if (!voterId || !candidateId) return null;
  return { label: "duel:vote", perform: (current) => current.castDuelVote(voterId, candidateId) };
}

/** The passive draft: the next player still to pick takes one of their cards; now and then a pick changes. */
function chooseDraftPick(store: GameStore, random: Random): BotAction | null {
  const draft = store.draft;
  const chooser = store.players.find((player) => draft?.picks[player.id] === undefined) ?? pick(store.players, random);
  const passiveId = chooser && draft ? pick(draft.offers[chooser.id] ?? [], random) : undefined;
  if (!chooser || !passiveId) return null;
  return { label: "draft:pick", perform: (current) => current.pickPassive(chooser.id, passiveId) };
}

/** Returns the bot's next decision, or null when the game offers none (a blocked state). */
export function chooseBotAction(store: GameStore, random: Random): BotAction | null {
  if (store.phase === "draft") return chooseDraftPick(store, random);
  if (store.phase !== "playing") return null;
  const abandon = chooseAbandon(store, random);
  if (abandon) return abandon;

  switch (store.turnStage) {
    case "move":
      return chooseMoveTurn(store, random);

    case "hell": {
      if (canLeaveHell(store) && random() < 0.5) {
        return { label: "leave-hell", perform: (current) => current.leaveHell() };
      }
      const items = listUsableItems(store);
      if (items.length > 0 && random() < 0.3) return useItemAction(store, pick(items, random)!);
      if (!canAffordMove(store)) return endTurnAction("end-turn-tired");
      if (canEndTurn(store) && random() < EARLY_END_CHANCE) return endTurnAction("end-turn-early");
      return { label: "spin-hell", perform: (current) => current.spinHellWheel() };
    }

    case "shop":
      return chooseShopping(store, random);

    case "tile-wheel":
      return { label: "spin-tile", perform: (current) => current.spinTileWheel() };

    case "blessing":
      return { label: "spin-blessing", perform: (current) => current.spinBlessingWheel() };

    case "turn-end":
      return endTurnAction("end-turn");

    case "wheel-result": {
      const target = findPlayer(store, store.pendingWheel?.playerId);
      const hasEraser = target?.inventory.some((entry) => entry.kind === "item" && entry.itemId === "eraser");
      if (hasEraser && random() < 0.3) return { label: "cancel-wheel", perform: (current) => current.cancelWheel() };
      if (target && canUseNoThanks(target, store.round) && random() < 0.3) {
        return { label: "no-thanks:wheel", perform: (current) => current.cancelWheel(true) };
      }
      return { label: `wheel:${store.pendingWheel?.result.id}`, perform: (current) => current.resolveWheel() };
    }

    case "duel-choice": {
      const mode = pick(store.pendingDuelChoice?.modes ?? [], random);
      if (!mode) return null;
      return { label: `duel-mode:${mode}`, perform: (current) => current.chooseDuelMode(mode) };
    }

    case "duel":
      return chooseDuelAction(store, random);

    case "target": {
      const challengerId = store.pendingChallenge?.playerId;
      const opponent = pick(
        store.players.filter((player) => canBeChallenged(challengerId, player)),
        random,
      );
      if (!opponent) return null;
      return { label: "challenge", perform: (current) => current.challengePlayer(opponent.id) };
    }

    case "discard": {
      const owner = findPlayer(store, store.pendingDiscard?.playerId);
      const entry = pick(owner?.inventory.filter((candidate) => candidate.kind === "item") ?? [], random);
      if (!entry) return null;
      return { label: "discard", perform: (current) => current.discardInventoryEntry(entry.id) };
    }

    case "reposition": {
      const goToStart = random() < 0.5;
      return {
        label: `new-cup:${goToStart ? "start" : "stay"}`,
        perform: (current) => current.resolveNewCup(goToStart),
      };
    }

    case "advance": {
      const walker = findPlayer(store, store.pendingAdvance?.playerId);
      const nodeId = walker ? pick(getForwardTiles(store, walker), random) : undefined;
      if (nodeId === undefined) return null;
      return { label: "advance", perform: (current) => current.advanceOneTile(nodeId) };
    }

    case "arm-wrestle": {
      const wrestle = store.pendingArmWrestle;
      const side = wrestle && [wrestle.attackerId, wrestle.defenderId].find((id) => wrestle.taps[id] === undefined);
      if (!side) return null;
      const taps = 20 + Math.floor(random() * 70);
      return { label: "arm-wrestle", perform: (current) => current.submitArmTaps(side, taps) };
    }

    case "gamble": {
      const accept = random() < 0.5;
      return { label: `gamble:${accept ? "stake" : "keep"}`, perform: (current) => current.resolveGamble(accept) };
    }

    case "passive-choice": {
      const tile = random() < 0.6 ? pick(getCalmDownTiles(store), random) : undefined;
      if (tile === undefined) return { label: "calm-down:skip", perform: (current) => current.resolveCalmDown(null) };
      return { label: "calm-down:place", perform: (current) => current.resolveCalmDown(tile) };
    }

    case "reaction": {
      const pending = store.pendingReaction;
      if (!pending) return null;
      const kind = pending.action.type === "bullet-bill" ? "bullet" : "item";
      const reactorId = random() < 0.4 ? pick(pending.reactorIds, random) : undefined;
      if (reactorId) {
        return { label: `reaction:cancel-${kind}`, perform: (current) => current.resolveReaction(reactorId) };
      }
      const { action, actorId } = pending;
      const item =
        action.type === "item" && actorId
          ? { itemId: action.itemId, userId: actorId, targetPlayerId: action.targetPlayerId }
          : undefined;
      return { label: `reaction:allow-${kind}`, perform: (current) => current.resolveReaction(null), item };
    }

    default:
      return null;
  }
}
