import { hasCard } from "./cards";
import { ITEM_CATALOG } from "./catalog";
import { createEngineId, drawEngineRandom } from "./engine-random";
import { avoidsHell, getInsurerPayout, offersGamble } from "./passive-rules";
import type { GameLogEntry, GameState, InventoryEntry, ItemId, Player, PlayerId } from "./types";
import { CURRENCY_RESET_THRESHOLD, HELL_NODE_ID } from "./types";

/** Small immutable helpers shared by every rule of the engine. */

const MAX_LOG_ENTRIES = 120;

export function makeLog(
  text: string,
  tone: GameLogEntry["tone"] = "neutral",
  secret?: GameLogEntry["secret"],
  fog?: Pick<GameLogEntry, "by" | "open">,
): GameLogEntry {
  return {
    id: createEngineId(),
    text,
    tone,
    ...(secret ? { secret } : {}),
    ...(fog?.by ? { by: fog.by } : {}),
    ...(fog?.open ? { open: true as const } : {}),
  };
}

/** A line is written in the turn of the active player, which is what Mi-vu, Mi-vue's fog reads. */
export function addLog(
  state: GameState,
  text: string,
  tone: GameLogEntry["tone"] = "neutral",
  secret?: GameLogEntry["secret"],
): GameState {
  const by = state.phase === "playing" ? getActivePlayer(state)?.id : undefined;
  return { ...state, log: [makeLog(text, tone, secret, { by }), ...state.log].slice(0, MAX_LOG_ENTRIES) };
}

/**
 * What a player's Cups Power of patch 0.2.3 remember (cooldowns, chances, the sister, visited tiles...): it follows
 * the card to whoever inherits it (L'Ange-Gardien taking a leaving protégé's place).
 */
export function getCupPowerState(
  player: Player,
): Pick<
  Player,
  | "mimeReadyRound"
  | "visitedNodeIds"
  | "moleReadyRound"
  | "luck"
  | "luckReturnRound"
  | "sisterNodeId"
  | "mistTurns"
  | "hermitLostUntilRound"
  | "insurerEarned"
> {
  const {
    mimeReadyRound,
    visitedNodeIds,
    moleReadyRound,
    luck,
    luckReturnRound,
    sisterNodeId,
    mistTurns,
    hermitLostUntilRound,
    insurerEarned,
  } = player;
  // A mage out of chances is out of the game: whoever takes their place starts with a fresh set.
  const exhausted = luck !== undefined && luck <= 0;
  return {
    ...(mimeReadyRound === undefined ? {} : { mimeReadyRound }),
    ...(visitedNodeIds === undefined ? {} : { visitedNodeIds }),
    ...(moleReadyRound === undefined ? {} : { moleReadyRound }),
    ...(luck === undefined || exhausted ? {} : { luck }),
    ...(luckReturnRound === undefined || exhausted ? {} : { luckReturnRound }),
    ...(sisterNodeId === undefined ? {} : { sisterNodeId }),
    ...(mistTurns === undefined ? {} : { mistTurns }),
    ...(hermitLostUntilRound === undefined ? {} : { hermitLostUntilRound }),
    ...(insurerEarned === undefined ? {} : { insurerEarned }),
  };
}

/** Mime: the actif copied for a turn is given back as the turn ends. */
export function dropCopies(state: GameState): GameState {
  if (!state.players.some((player) => player.mimicId)) return state;
  return { ...state, players: state.players.map(({ mimicId: _copy, ...player }) => player) };
}

/** A line the fog never hides: whose turn it is, who turns invisible, who leaves the table. */
export function addOpenLog(state: GameState, text: string, tone: GameLogEntry["tone"] = "event"): GameState {
  return { ...state, log: [makeLog(text, tone, undefined, { open: true }), ...state.log].slice(0, MAX_LOG_ENTRIES) };
}

/** A line about what is in somebody's bag: the others online read `publicText` instead. */
export function addBagLog(
  state: GameState,
  ownerId: PlayerId,
  text: string,
  publicText: string,
  tone: GameLogEntry["tone"] = "neutral",
): GameState {
  return addLog(state, text, tone, { ownerId, publicText });
}

/** Draws from the engine source, so a local game and an online game share one code path. */
export function randomChoice<T>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  return values[Math.floor(drawEngineRandom() * values.length)];
}

export function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(drawEngineRandom() * (index + 1));
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

/**
 * A fresh trip to Hell restarts the countdown; a player already there keeps
 * theirs. L'Ange-Gardien never goes: they lose their next turn instead.
 */
export function placeInHell(player: Player): Player {
  if (avoidsHell(player)) return loseTurns(player);
  if (player.position === HELL_NODE_ID) return player;
  // A Parachute opens instead: whatever sent them there, they stay where they are.
  const parachute = findItemEntry(player, "parachute");
  if (parachute) return withSpent(spendItemEntry(player, parachute.id), "parachute");
  return { ...player, position: HELL_NODE_ID, hellTurns: 0 };
}

/** The first entry of the bag holding `itemId`, if any. */
export function findItemEntry(player: Player, itemId: ItemId): (InventoryEntry & { kind: "item" }) | undefined {
  return player.inventory.find(
    (entry): entry is InventoryEntry & { kind: "item" } => entry.kind === "item" && entry.itemId === itemId,
  );
}

/**
 * The player loses `amount` of their next turns and carries the knocked-out status until they can
 * play again (patch 0.2.0). A Réveil in the bag cancels the first of them and is used up (patch 0.1.6).
 */
export function loseTurns(player: Player, amount = 1): Player {
  const alarm = amount > 0 ? findItemEntry(player, "wake-up") : undefined;
  if (!alarm) return { ...player, skippedTurns: player.skippedTurns + amount, knockedOut: true };
  const woken = withSpent(spendItemEntry(player, alarm.id), "wake-up");
  const skipped = woken.skippedTurns + amount - 1;
  return { ...woken, skippedTurns: skipped, knockedOut: skipped > 0 || woken.knockedOut };
}

function withSpent(player: Player, itemId: ItemId): Player {
  return { ...player, spentItems: [...(player.spentItems ?? []), itemId] };
}

const SPENT_ITEM_LOGS: Partial<Record<ItemId, string>> = {
  "wake-up": "active son Réveil : le tour sauté est annulé.",
  parachute: "ouvre son Parachute : il évite l’Enfer.",
};

/** Says in the journal which items acted on their own during the action, and clears the marks. */
export function announceSpentItems(state: GameState): GameState {
  if (!state.players.some((player) => player.spentItems?.length)) return state;
  let nextState = state;
  for (const player of state.players) {
    for (const itemId of player.spentItems ?? []) {
      const text = SPENT_ITEM_LOGS[itemId];
      if (text) nextState = addLog(nextState, `${player.name} ${text}`, "good");
    }
  }
  return {
    ...nextState,
    players: nextState.players.map(({ spentItems: _spent, ...player }) => player),
  };
}

/** Sends a player to Hell; L'Ange-Gardien loses their next turn instead. */
export function sendPlayerToHell(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!player) return state;
  const nextState = updatePlayer(state, playerId, placeInHell);
  if (avoidsHell(player)) {
    return addLog(nextState, `${player.name} ne va jamais en Enfer : il perd son prochain tour à la place.`, "bad");
  }
  // A Parachute kept them out: the journal says so with the item that opened.
  if (findPlayer(nextState, playerId)?.position !== HELL_NODE_ID) return nextState;
  return addLog(nextState, `${player.name} est envoyé en Enfer.`, "bad");
}

/** How many items an entry stands for: a stack of Tomates counts several, anything else one. */
export function getEntryUnits(entry: InventoryEntry): number {
  return entry.kind === "item" ? (entry.count ?? 1) : 1;
}

/** Adds one item; a stackable one joins its stack when there is one (callers check the stack's limit). */
/** A stack of this item that still has room, if the bag holds one; never for an item that does not stack. */
export function findStackWithRoom(player: Player, itemId: ItemId): InventoryEntry | undefined {
  const stackLimit = ITEM_CATALOG[itemId].stackLimit;
  if (!stackLimit) return undefined;
  return player.inventory.find(
    (entry) => entry.kind === "item" && entry.itemId === itemId && getEntryUnits(entry) < stackLimit,
  );
}

/** Adds one item: onto a stack that has room, otherwise into a slot of its own (`entryId` names that slot). */
export function appendItem(player: Player, itemId: ItemId, entryId: string = createEngineId()): Player {
  const stack = findStackWithRoom(player, itemId);
  if (stack) {
    return {
      ...player,
      inventory: player.inventory.map((entry) =>
        entry.id === stack.id ? { ...entry, count: getEntryUnits(entry) + 1 } : entry,
      ),
    };
  }
  const entry: InventoryEntry = { id: entryId, kind: "item", itemId };
  return { ...player, inventory: [...player.inventory, entry] };
}

/** Empties a whole bag slot, a full stack included (a discard, a lost Red Cup slot). */
export function removeInventoryEntry(player: Player, entryId: string): Player {
  return { ...player, inventory: player.inventory.filter((entry) => entry.id !== entryId) };
}

/** Takes one item out of a slot: a stack loses one unit, anything else leaves the bag. */
export function spendItemEntry(player: Player, entryId: string): Player {
  const entry = player.inventory.find((candidate) => candidate.id === entryId);
  if (!entry || getEntryUnits(entry) <= 1) return removeInventoryEntry(player, entryId);
  return {
    ...player,
    inventory: player.inventory.map((candidate) =>
      candidate.id === entryId ? { ...candidate, count: getEntryUnits(candidate) - 1 } : candidate,
    ),
  };
}

export function getItemEntry(player: Player, entryId: string): ItemId | undefined {
  const entry = player.inventory.find((item) => item.id === entryId);
  return entry?.kind === "item" ? entry.itemId : undefined;
}

export interface CurrencyChangeOptions {
  /**
   * False for what Double or nothing may not stake: voluntary spending (a
   * purchase, Corrupteur, a theft gone wrong) and the coin flip's own outcome.
   */
  gamble?: boolean;
  /** No journal line, so a toast never gives away what the coins were spent on (a purchase). */
  silent?: boolean;
}

/** A holder left below −300 while their gamble was pending is knocked out now: balance back to 0, next turn lost. */
export function settleKnockout(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!player || player.currency > CURRENCY_RESET_THRESHOLD) return state;
  const nextState = updatePlayer(state, playerId, (current) => loseTurns({ ...current, currency: 0 }));
  return addLog(
    nextState,
    `${player.name} tombe à −300 pièces : son solde revient à 0 et son prochain tour sera sauté.`,
    "bad",
  );
}

/**
 * Applies a coin change with the two money rules: the Casque absorbs a drop
 * below zero, and reaching −300 resets the balance and cancels the next turn.
 * A Double or nothing holder may then stake the amount, once the table is at rest.
 */
export function applyCurrencyChange(
  state: GameState,
  playerId: PlayerId,
  amount: number,
  options: CurrencyChangeOptions = {},
): GameState {
  const player = findPlayer(state, playerId);
  if (!player || amount === 0) return state;

  let nextState = state;
  const staked = options.gamble !== false && offersGamble(player) && state.phase === "playing";
  if (staked) nextState = { ...nextState, pendingGambles: [...nextState.pendingGambles, { playerId, amount }] };
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
  // L'Assureur is paid for what the others lose, voluntary spending aside (the same line Double or nothing draws).
  const lostCoins = amount < 0 && options.gamble !== false ? Math.max(0, player.currency - nextCurrency) : 0;
  const insure = (current: GameState): GameState =>
    lostCoins > 0 ? payInsurer(current, playerId, lostCoins) : current;

  // A loss the holder may stake does not knock them out yet: wiping it out lets them play on.
  const knockedOut = nextCurrency <= CURRENCY_RESET_THRESHOLD;
  const awaitsGamble = staked && amount < 0 && knockedOut;
  if (awaitsGamble) {
    const queued = nextState.pendingGambles;
    nextState = {
      ...nextState,
      pendingGambles: queued.map((gamble, index) =>
        index === queued.length - 1 ? { ...gamble, knockout: true } : gamble,
      ),
    };
  }
  const reachedResetThreshold = knockedOut && !awaitsGamble;
  if (reachedResetThreshold) nextCurrency = 0;

  nextState = updatePlayer(nextState, playerId, (currentPlayer) => {
    const updated = { ...currentPlayer, currency: nextCurrency, inventory: nextInventory };
    return reachedResetThreshold ? loseTurns(updated) : updated;
  });

  if (reachedResetThreshold) {
    return insure(
      addLog(
        nextState,
        `${player.name} tombe à −300 pièces : son solde revient à 0 et son prochain tour sera sauté.`,
        "bad",
      ),
    );
  }

  if (options.silent) return insure(nextState);
  const sign = amount > 0 ? "+" : "−";
  return insure(addLog(nextState, `${player.name} ${sign}${Math.abs(amount)} pièces.`, amount > 0 ? "good" : "bad"));
}

/**
 * L'Assureur (patch 0.2.3): the bank pays them a share of the coins another player lost, up to a cap for the
 * round. Nobody pays it: the coins come out of thin air.
 */
function payInsurer(state: GameState, victimId: PlayerId, lost: number): GameState {
  const insurer = state.players.find((player) => player.id !== victimId && hasCard(player, "insurer"));
  if (!insurer) return state;
  const payout = getInsurerPayout(insurer, state.round, lost);
  if (payout <= 0) return state;
  const earned = insurer.insurerEarned?.round === state.round ? insurer.insurerEarned.amount : 0;
  const paid = updatePlayer(state, insurer.id, (current) => ({
    ...current,
    currency: current.currency + payout,
    insurerEarned: { round: state.round, amount: earned + payout },
  }));
  return addLog(paid, `${insurer.name} touche ${payout} pièces de la banque : une assurance bien placée.`, "good");
}
