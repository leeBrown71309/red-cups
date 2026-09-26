import { canAbandon } from "../abandon";
import { getDuelVoterIds } from "../duel";
import { NORMAL_NODE_IDS, getShortestPath } from "../board";
import { ITEM_CATALOG, ITEM_ORDER } from "../catalog";
import { canAddItem, canUseDelinquent, getItemPrice, getUniqueLegalDestinations } from "../rules";
import { findPlayer, getActivePlayer } from "../state-utils";
import type { GameStore } from "../store";
import { planItemUse } from "../turn-actions";
import type { InventoryEntry, NodeId, PlayerId, RpsChoice } from "../types";
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
  return getShortestPath(nodeId, store.redCupNodeId, false)?.length ?? 99;
}

interface ItemOption {
  entry: InventoryEntry & { kind: "item" };
  targetId?: PlayerId;
}

function useItemAction(store: GameStore, option: ItemOption): BotAction {
  const userId = getActivePlayer(store)?.id ?? "";
  return {
    label: `use:${option.entry.itemId}`,
    perform: (current) => current.useItem(option.entry.id, option.targetId),
    item: { itemId: option.entry.itemId, userId, targetPlayerId: option.targetId },
  };
}

function listUsableItems(store: GameStore): ItemOption[] {
  const player = getActivePlayer(store);
  if (!player) return [];
  return player.inventory.flatMap((entry): ItemOption[] => {
    if (entry.kind !== "item") return [];
    if (ITEM_CATALOG[entry.itemId].target !== "player") {
      return planItemUse(store, entry.id) ? [{ entry }] : [];
    }
    return store.players
      .filter((target) => planItemUse(store, entry.id, target.id) !== null)
      .map((target) => ({ entry, targetId: target.id }));
  });
}

function chooseMoveTurn(store: GameStore, random: Random): BotAction | null {
  const player = getActivePlayer(store);
  if (!player) return null;

  const boot = player.inventory.find((entry) => entry.kind === "item" && entry.itemId === "boot");
  if (boot && store.moveDistance === 1 && random() < 0.2) {
    return { label: "prepare-boot", perform: (current) => current.prepareBoot(boot.id) };
  }

  const items = listUsableItems(store);
  if (items.length > 0 && random() < 0.3) return useItemAction(store, pick(items, random)!);

  const regular = getUniqueLegalDestinations(player, store.moveDistance, false);
  const rebel = canUseDelinquent(player, store.round)
    ? getUniqueLegalDestinations(player, store.moveDistance, true).filter((nodeId) => !regular.includes(nodeId))
    : [];

  if (rebel.length > 0 && random() < 0.25) {
    const destination = pick(rebel, random)!;
    return { label: "move-rebel", perform: (current) => current.movePlayer(destination, true) };
  }

  if (regular.length === 0) {
    const option = pick(items, random);
    if (option) return useItemAction(store, option);
    return { label: "end-turn-stuck", perform: (current) => current.endTurn() };
  }

  const chaseCup = random() < 0.55;
  const destination = chaseCup
    ? [...regular].sort((left, right) => distanceToCup(store, left) - distanceToCup(store, right))[0]
    : pick(regular, random)!;
  return { label: "move", perform: (current) => current.movePlayer(destination) };
}

function chooseShopping(store: GameStore, random: Random): BotAction {
  const player = getActivePlayer(store);
  const affordable = player
    ? ITEM_ORDER.filter((itemId) => {
        if (player.currency < getItemPrice(itemId, store.bootPrice)) return false;
        return itemId === "bullet-bill" ? store.bulletBill === null : canAddItem(player, itemId);
      })
    : [];

  const itemId = pick(affordable, random);
  if (itemId && random() < 0.55) return { label: `buy:${itemId}`, perform: (current) => current.buyItem(itemId) };
  return { label: "end-turn", perform: (current) => current.endTurn() };
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
  if (duel.mode === "rock-paper-scissors") {
    const chooserId = [duel.playerOneId, duel.playerTwoId].find((id) => !duel.rpsChoices[id]);
    const choice = pick(RPS_CHOICES, random);
    if (!chooserId || !choice) return null;
    return { label: "duel:hand", perform: (current) => current.pickDuelHand(chooserId, choice) };
  }
  const voterId = getDuelVoterIds(store, duel).find((id) => !duel.votes[id]);
  const candidateId = pick([duel.playerOneId, duel.playerTwoId], random);
  if (!voterId || !candidateId) return null;
  return { label: "duel:vote", perform: (current) => current.castDuelVote(voterId, candidateId) };
}

/** Returns the bot's next decision, or null when the game offers none (a blocked state). */
export function chooseBotAction(store: GameStore, random: Random): BotAction | null {
  if (store.phase !== "playing") return null;
  const abandon = chooseAbandon(store, random);
  if (abandon) return abandon;

  switch (store.turnStage) {
    case "move":
      return chooseMoveTurn(store, random);

    case "hell": {
      const items = listUsableItems(store);
      if (items.length > 0 && random() < 0.3) return useItemAction(store, pick(items, random)!);
      return { label: "spin-hell", perform: (current) => current.spinHellWheel() };
    }

    case "shop":
      return chooseShopping(store, random);

    case "tile-wheel":
      return { label: "spin-tile", perform: (current) => current.spinTileWheel() };

    case "blessing":
      return { label: "spin-blessing", perform: (current) => current.spinBlessingWheel() };

    case "turn-end":
      return { label: "end-turn", perform: (current) => current.endTurn() };

    case "wheel-result": {
      const target = findPlayer(store, store.pendingWheel?.playerId);
      const hasEraser = target?.inventory.some((entry) => entry.kind === "item" && entry.itemId === "eraser");
      if (hasEraser && random() < 0.3) return { label: "cancel-wheel", perform: (current) => current.cancelWheel() };
      return { label: `wheel:${store.pendingWheel?.result.id}`, perform: (current) => current.resolveWheel() };
    }

    case "duel":
      return chooseDuelAction(store, random);

    case "target": {
      const challengerId = store.pendingChallenge?.playerId;
      const opponent = pick(
        store.players.filter((player) => player.id !== challengerId),
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
      const nodeId = pick(NORMAL_NODE_IDS, random)!;
      return { label: "reposition", perform: (current) => current.repositionBeforeCup(nodeId) };
    }

    case "passive-choice": {
      const useEffect = random() < 0.5;
      return { label: `calm-down:${useEffect}`, perform: (current) => current.resolveCalmDown(useEffect) };
    }

    case "reaction": {
      const pending = store.pendingReaction;
      if (!pending) return null;
      const reactorId = random() < 0.4 ? pick(pending.reactorIds, random) : undefined;
      if (reactorId) return { label: "reaction:cancel", perform: (current) => current.resolveReaction(reactorId) };
      const { action } = pending;
      const item =
        action.type === "item"
          ? { itemId: action.itemId, userId: pending.actorId, targetPlayerId: action.targetPlayerId }
          : undefined;
      return { label: "reaction:allow", perform: (current) => current.resolveReaction(null), item };
    }

    default:
      return null;
  }
}
