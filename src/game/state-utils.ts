import type { GameLogEntry, GameState, InventoryEntry, ItemId, Player, PlayerId } from "./types";
import { CURRENCY_RESET_THRESHOLD, HELL_NODE_ID } from "./types";

/** Small immutable helpers shared by every rule of the engine. */

const MAX_LOG_ENTRIES = 60;

export function makeLog(text: string, tone: GameLogEntry["tone"] = "neutral"): GameLogEntry {
  return { id: crypto.randomUUID(), text, tone };
}

export function addLog(state: GameState, text: string, tone: GameLogEntry["tone"] = "neutral"): GameState {
  return { ...state, log: [makeLog(text, tone), ...state.log].slice(0, MAX_LOG_ENTRIES) };
}

/** Uses Math.random so simulations can seed the whole engine from one place. */
export function randomChoice<T>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  return values[Math.floor(Math.random() * values.length)];
}

export function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function findPlayer(state: GameState, playerId: PlayerId | null | undefined): Player | undefined {
  return state.players.find((player) => player.id === playerId);
}

export function getActivePlayer(state: GameState): Player | undefined {
  return state.players[state.activePlayerIndex];
}

export function updatePlayer(state: GameState, playerId: PlayerId, updater: (player: Player) => Player): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? updater(player) : player)),
  };
}

/** A fresh trip to Hell restarts the countdown; a player already there keeps theirs. */
export function placeInHell(player: Player): Player {
  return player.position === HELL_NODE_ID ? player : { ...player, position: HELL_NODE_ID, hellTurns: 0 };
}

export function appendItem(player: Player, itemId: ItemId): Player {
  const entry: InventoryEntry = { id: crypto.randomUUID(), kind: "item", itemId };
  return { ...player, inventory: [...player.inventory, entry] };
}

export function removeInventoryEntry(player: Player, entryId: string): Player {
  return { ...player, inventory: player.inventory.filter((entry) => entry.id !== entryId) };
}

export function getItemEntry(player: Player, entryId: string): ItemId | undefined {
  const entry = player.inventory.find((item) => item.id === entryId);
  return entry?.kind === "item" ? entry.itemId : undefined;
}

/**
 * Applies a coin change with the two money rules: the Casque absorbs a drop
 * below zero, and reaching −300 resets the balance and cancels the next turn.
 */
export function applyCurrencyChange(state: GameState, playerId: PlayerId, amount: number): GameState {
  const player = findPlayer(state, playerId);
  if (!player || amount === 0) return state;

  let nextState = state;
  let nextCurrency = player.currency + amount;
  let nextInventory = player.inventory;

  if (amount < 0 && nextCurrency < 0) {
    const helmet = player.inventory.find((entry) => entry.kind === "item" && entry.itemId === "helmet");
    if (helmet) {
      nextCurrency = 0;
      nextInventory = player.inventory.filter((entry) => entry.id !== helmet.id);
      nextState = addLog(nextState, `${player.name} active son Casque et évite de passer sous zéro.`, "good");
    }
  }

  const reachedResetThreshold = nextCurrency <= CURRENCY_RESET_THRESHOLD;
  if (reachedResetThreshold) nextCurrency = 0;

  nextState = updatePlayer(nextState, playerId, (currentPlayer) => ({
    ...currentPlayer,
    currency: nextCurrency,
    inventory: nextInventory,
    skippedTurns: currentPlayer.skippedTurns + Number(reachedResetThreshold),
  }));

  if (reachedResetThreshold) {
    return addLog(
      nextState,
      `${player.name} tombe à −300 pièces : son solde revient à 0 et son prochain tour sera sauté.`,
      "bad",
    );
  }

  const sign = amount > 0 ? "+" : "−";
  return addLog(nextState, `${player.name} ${sign}${Math.abs(amount)} pièces.`, amount > 0 ? "good" : "bad");
}
