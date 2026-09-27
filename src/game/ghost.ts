import { getBoard } from "./board";
import { ITEM_CATALOG } from "./catalog";
import { createDuel, drawGhostShots, getDuelModes } from "./duel-setup";
import { drawEngineRandom } from "./engine-random";
import { settleBoard, sendPlayerToHell } from "./game-effects";
import { getBoardMap } from "./maps/map-registry";
import { countItemCopies, getInventoryCapacity } from "./rules";
import {
  addLog,
  appendItem,
  applyCurrencyChange,
  findPlayer,
  getActivePlayer,
  randomChoice,
  removeInventoryEntry,
  updatePlayer,
} from "./state-utils";
import type { GameState, GhostPenalty, GhostReward, GhostState, NodeId, Player, PlayerId, TurnStage } from "./types";
import {
  GHOST_COOLDOWN_ROUNDS,
  GHOST_EMPTY_LOOT_REWARD,
  GHOST_ID,
  GHOST_LOOT_COINS,
  GHOST_STEAL_COINS,
  HELL_NODE_ID,
} from "./types";

/**
 * Luna Park's ghost haunts the four carousel tiles. It shows up a round or
 * two into the game, then moves one tile along the ride at every turn change,
 * so the table can see it coming: chase it for its loot, or keep away. When
 * it lands on a player, or a player stops on its tile, the two duel. Winning
 * it steals (Hell, coins or an item, kept as loot); losing, it gives back one
 * piece of that loot, or pays a reward when it has none, then goes away for a
 * while. Everything it draws comes from the engine's luck, so an online table
 * sees the same ghost on every device.
 */

/** The ghost of a new game, or null on maps it does not haunt. */
export function createGhost(state: GameState): GhostState | null {
  if (!getBoardMap(state.mapId).ghostTiles) return null;
  // First seen in round 2 or 3: the table gets a round to spread out before it.
  const returnsAtRound = state.round + 1 + (drawEngineRandom() < 0.5 ? 0 : 1);
  return { nodeId: null, returnsAtRound, loot: { coins: 0, items: [] }, metPlayerIds: [] };
}

/** The carousel tile after `nodeId`, the way the ride currently turns. */
export function getNextGhostTile(state: GameState, nodeId: NodeId): NodeId {
  const tiles = getBoardMap(state.mapId).ghostTiles ?? [];
  const next = getBoard(state).edges.find(
    (edge) => edge.kind === "carousel" && edge.from === nodeId && tiles.includes(edge.to),
  );
  return next?.to ?? nodeId;
}

function withGhost(state: GameState, ghost: GhostState): GameState {
  return { ...state, ghost };
}

function recordGhostEvent(state: GameState, event: Omit<NonNullable<GameState["lastGhostEvent"]>, "seq">): GameState {
  return { ...state, lastGhostEvent: { seq: (state.lastGhostEvent?.seq ?? 0) + 1, ...event } };
}

/**
 * Turn change: an absent ghost comes back once its round has come, on a free
 * carousel tile if there is one; a present one rides one tile on.
 */
export function advanceGhost(state: GameState): GameState {
  const ghost = state.ghost;
  const tiles = getBoardMap(state.mapId).ghostTiles;
  if (!ghost || !tiles || state.phase !== "playing") return state;

  if (ghost.nodeId === null) {
    if (state.round < ghost.returnsAtRound) return state;
    const occupied = new Set(state.players.map((player) => player.position));
    const tile = randomChoice(tiles.filter((nodeId) => !occupied.has(nodeId))) ?? randomChoice(tiles) ?? tiles[0];
    const appeared = withGhost(state, { ...ghost, nodeId: tile, metPlayerIds: [] });
    const logged = addLog(appeared, `Un fantôme surgit sur la case ${tile} du carrousel !`, "event");
    return recordGhostEvent(logged, { kind: "appear", from: null, to: tile });
  }

  const next = getNextGhostTile(state, ghost.nodeId);
  const moved = withGhost(state, { ...ghost, nodeId: next, metPlayerIds: [] });
  return recordGhostEvent(moved, { kind: "move", from: ghost.nodeId, to: next });
}

/**
 * Who the ghost duels now: a player on its tile it has not met there yet,
 * the one whose turn it is first, then in seat order.
 */
export function findGhostOpponent(state: GameState): Player | undefined {
  const ghost = state.ghost;
  if (!ghost || ghost.nodeId === null) return undefined;
  const candidates = state.players.filter(
    (player) => player.position === ghost.nodeId && !ghost.metPlayerIds.includes(player.id),
  );
  const active = getActivePlayer(state);
  return candidates.find((player) => player.id === active?.id) ?? candidates[0];
}

/** An item the winner may hold: never a third copy, never a second Gomme; a full bag makes room. */
function canTakeLootItem(player: Player, itemId: GhostState["loot"]["items"][number]["itemId"]): boolean {
  const copies = countItemCopies(player, itemId);
  if (copies >= 2 || (itemId === "eraser" && copies >= 1)) return false;
  const bagFull = player.inventory.length >= getInventoryCapacity(player);
  return !bagFull || player.inventory.some((entry) => entry.kind === "item");
}

function drawPenalty(player: Player): GhostPenalty {
  const options: GhostPenalty[] = [{ kind: "hell" }];
  if (player.currency > 0) options.push({ kind: "coins", amount: Math.min(GHOST_STEAL_COINS, player.currency) });
  const item = randomChoice(player.inventory.filter((entry) => entry.kind === "item"));
  if (item?.kind === "item") options.push({ kind: "item", entryId: item.id, itemId: item.itemId });
  return randomChoice(options) ?? { kind: "hell" };
}

/** One piece of loot at a time: coins or one item, drawn; a reward of its own when the loot is empty. */
function drawReward(ghost: GhostState, player: Player): GhostReward {
  const items = ghost.loot.items.filter((entry) => canTakeLootItem(player, entry.itemId));
  const kinds: ("coins" | "item")[] = [];
  if (ghost.loot.coins > 0) kinds.push("coins");
  if (items.length > 0) kinds.push("item");
  const kind = randomChoice(kinds);
  if (kind === "coins") return { kind: "coins", amount: Math.min(GHOST_LOOT_COINS, ghost.loot.coins), fromLoot: true };
  const item = kind === "item" ? randomChoice(items) : undefined;
  if (item) return { kind: "item", entryId: item.id, itemId: item.itemId };
  return { kind: "coins", amount: GHOST_EMPTY_LOOT_REWARD, fromLoot: false };
}

/** The ghost meets `playerId`: the duel, its game and what is at stake are all drawn now. */
export function startGhostDuel(state: GameState, playerId: PlayerId, resumeStage: TurnStage): GameState {
  const ghost = state.ghost;
  const player = findPlayer(state, playerId);
  if (!ghost || !player) return state;

  // The whole table but the duellist may vote: the ghost has no friends to count.
  const mode = randomChoice(getDuelModes(state.players.length > 1)) ?? "coin-flip";
  const duel = createDuel(playerId, GHOST_ID, mode, resumeStage);
  const nextState: GameState = {
    ...state,
    ghost: { ...ghost, metPlayerIds: [...ghost.metPlayerIds, playerId] },
    pendingDuel: {
      ...duel,
      basket: duel.basket && { ...duel.basket, ghostShots: drawGhostShots() },
      ghost: { penalty: drawPenalty(player), reward: drawReward(ghost, player) },
    },
    turnStage: "duel",
    duelResumeStage: resumeStage,
  };
  return addLog(nextState, `Le fantôme attaque ${player.name} sur la case ${ghost.nodeId} !`, "event");
}

function describeLoot(reward: GhostReward): string {
  return reward.kind === "item" ? ITEM_CATALOG[reward.itemId].name : `${reward.amount} pièces`;
}

function applyReward(state: GameState, player: Player, reward: GhostReward): GameState {
  const ghost = state.ghost;
  if (!ghost) return state;
  if (reward.kind === "coins") {
    const loot = reward.fromLoot ? { ...ghost.loot, coins: ghost.loot.coins - reward.amount } : ghost.loot;
    const nextState = applyCurrencyChange(withGhost(state, { ...ghost, loot }), player.id, reward.amount);
    return addLog(
      nextState,
      reward.fromLoot
        ? `${player.name} reprend ${reward.amount} pièces dans le butin du fantôme.`
        : `Le butin du fantôme est vide : ${player.name} gagne ${reward.amount} pièces.`,
      "good",
    );
  }

  const loot = { ...ghost.loot, items: ghost.loot.items.filter((entry) => entry.id !== reward.entryId) };
  const nextState = withGhost(state, { ...ghost, loot });
  if (player.inventory.length >= getInventoryCapacity(player)) {
    return {
      ...nextState,
      turnStage: "discard",
      pendingDiscard: { playerId: player.id, reason: "loot", itemId: reward.itemId, resumeStage: state.turnStage },
    };
  }
  const withItem = updatePlayer(nextState, player.id, (current) => appendItem(current, reward.itemId));
  return addLog(withItem, `${player.name} reprend ${describeLoot(reward)} dans le butin du fantôme.`, "good");
}

function applyPenalty(state: GameState, player: Player, penalty: GhostPenalty): GameState {
  const ghost = state.ghost;
  if (!ghost) return state;
  switch (penalty.kind) {
    case "hell": {
      let nextState = addLog(state, `Le fantôme gifle ${player.name} et l’emporte en Enfer !`, "bad");
      nextState = sendPlayerToHell(nextState, player.id);
      nextState = {
        ...nextState,
        lastMovement: {
          seq: (state.lastMovement?.seq ?? 0) + 1,
          playerId: player.id,
          from: player.position,
          path: [HELL_NODE_ID],
          flungByGhost: true,
        },
      };
      return recordGhostEvent(nextState, { kind: "fling", from: ghost.nodeId, to: ghost.nodeId, playerId: player.id });
    }
    case "coins": {
      // What the purse no longer holds cannot be stolen.
      const amount = Math.min(penalty.amount, Math.max(0, player.currency));
      if (amount === 0) return addLog(state, `Le fantôme fouille ${player.name} mais ne trouve pas une pièce.`);
      const loot = { ...ghost.loot, coins: ghost.loot.coins + amount };
      const nextState = applyCurrencyChange(withGhost(state, { ...ghost, loot }), player.id, -amount);
      return addLog(nextState, `Le fantôme vole ${amount} pièces à ${player.name}.`, "bad");
    }
    case "item": {
      if (!player.inventory.some((entry) => entry.id === penalty.entryId)) return state;
      const loot = { ...ghost.loot, items: [...ghost.loot.items, { id: penalty.entryId, itemId: penalty.itemId }] };
      const nextState = updatePlayer(withGhost(state, { ...ghost, loot }), player.id, (current) =>
        removeInventoryEntry(current, penalty.entryId),
      );
      return addLog(nextState, `Le fantôme vole ${ITEM_CATALOG[penalty.itemId].name} à ${player.name}.`, "bad");
    }
  }
}

/**
 * Settles a duel with the ghost. Beaten, it hands over the reward drawn at
 * the start and vanishes for a few rounds; winning, it takes the penalty and
 * stays on its tile until the ride moves it on.
 */
export function resolveGhostDuel(state: GameState, winnerId: PlayerId): GameState {
  const duel = state.pendingDuel;
  const ghost = state.ghost;
  const player = findPlayer(state, duel?.playerOneId);
  if (!duel?.ghost || !ghost || !player) return state;

  let nextState: GameState = { ...state, pendingDuel: null, turnStage: duel.resumeStage };
  if (winnerId === player.id) {
    nextState = addLog(nextState, `${player.name} bat le fantôme !`, "good");
    nextState = applyReward(nextState, player, duel.ghost.reward);
    const current = nextState.ghost ?? ghost;
    const returnsAtRound = state.round + GHOST_COOLDOWN_ROUNDS;
    nextState = withGhost(nextState, { ...current, nodeId: null, returnsAtRound, metPlayerIds: [] });
    nextState = addLog(nextState, `Le fantôme s’évapore… il reviendra au tour ${returnsAtRound}.`, "event");
    nextState = recordGhostEvent(nextState, { kind: "vanish", from: ghost.nodeId, to: null });
  } else {
    nextState = addLog(nextState, `Le fantôme l’emporte sur ${player.name}.`, "bad");
    nextState = applyPenalty(nextState, player, duel.ghost.penalty);
  }

  if (nextState.pendingDiscard) return nextState;
  return settleBoard(nextState, duel.resumeStage);
}
