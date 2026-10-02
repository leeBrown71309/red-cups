import { getBoard } from "./board";
import { ITEM_CATALOG } from "./catalog";
import { createDuel, drawGhostShots, getDuelModes } from "./duel-setup";
import { createEngineId, drawEngineRandom } from "./engine-random";
import { settleBoard, sendPlayerToHell } from "./game-effects";
import { getBoardMap } from "./maps/map-registry";
import { avoidsHell } from "./passive-rules";
import { canAddItem, canReceiveItem } from "./rules";
import {
  addLog,
  appendItem,
  applyCurrencyChange,
  findPlayer,
  getActivePlayer,
  randomChoice,
  spendItemEntry,
  updatePlayer,
} from "./state-utils";
import type { GameState, GhostPenalty, GhostReward, GhostState, NodeId, Player, PlayerId, TurnStage } from "./types";
import {
  GHOST_COOLDOWN_ROUNDS,
  GHOST_EMPTY_LOOT_REWARD,
  GHOST_ID,
  GHOST_LOOT_COINS,
  GHOST_MAX_DRIFT_STEPS,
  GHOST_STEAL_COINS,
  GHOST_TELEPORT_CHANCE,
  GHOST_TELEPORT_MIN_DISTANCE,
  HELL_NODE_ID,
} from "./types";

/**
 * Luna Park's ghost haunts the whole board. It shows up a round or two into
 * the game, then at every turn change drifts a few tiles along the roads,
 * whichever way they run, or vanishes and reappears far away. When
 * it lands on a player, or a player stops on its tile, the two duel. Winning
 * it steals (Hell, coins or an item, kept as loot); losing, it gives back one
 * piece of that loot, or pays a reward when it has none, then goes away for a
 * while. Everything it draws comes from the engine's luck, so an online table
 * sees the same ghost on every device.
 */

/** The ghost of a new game, or null on maps it does not haunt. */
export function createGhost(state: GameState): GhostState | null {
  if (!getBoardMap(state.mapId).haunted) return null;
  // First seen in round 2 or 3: the table gets a round to spread out before it.
  const returnsAtRound = state.round + 1 + (drawEngineRandom() < 0.5 ? 0 : 1);
  return { nodeId: null, returnsAtRound, loot: { coins: 0, items: [] }, metPlayerIds: [] };
}

function withGhost(state: GameState, ghost: GhostState): GameState {
  return { ...state, ghost };
}

function recordGhostEvent(state: GameState, event: Omit<NonNullable<GameState["lastGhostEvent"]>, "seq">): GameState {
  return { ...state, lastGhostEvent: { seq: (state.lastGhostEvent?.seq ?? 0) + 1, ...event } };
}

/** Every tile the ghost may haunt: the whole board but Hell. */
function getHauntedTiles(state: GameState): NodeId[] {
  return getBoardMap(state.mapId).haunted ? getBoard(state).normalNodeIds : [];
}

/** Tiles one road away, whichever way the road runs: arrows, tunnels and the carousel do not bind a ghost. */
function getGhostNeighbors(state: GameState, nodeId: NodeId): NodeId[] {
  const neighbors = getBoard(state).edges.flatMap((edge) =>
    edge.from === nodeId ? [edge.to] : edge.to === nodeId ? [edge.from] : [],
  );
  return [...new Set(neighbors)].filter((neighbor) => neighbor !== HELL_NODE_ID);
}

/** Roads between two tiles for a ghost, which takes any road either way. */
function getGhostDistances(state: GameState, from: NodeId): Map<NodeId, number> {
  const distances = new Map<NodeId, number>([[from, 0]]);
  const queue = [from];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    for (const neighbor of getGhostNeighbors(state, nodeId)) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, (distances.get(nodeId) ?? 0) + 1);
      queue.push(neighbor);
    }
  }
  return distances;
}

/**
 * One to three tiles along the roads, picked at random at every crossroads
 * and never straight back where it came from unless the road ends there.
 * It stops on the first tile where somebody stands: the scene shows every
 * tile of the drift, so gliding over a pawn without a duel would look like
 * the ghost ignored it.
 */
function drawGhostDrift(state: GameState, from: NodeId): NodeId[] {
  const steps = 1 + Math.floor(drawEngineRandom() * GHOST_MAX_DRIFT_STEPS);
  const occupied = new Set(state.players.map((player) => player.position));
  const path: NodeId[] = [];
  let previous: NodeId | null = null;
  let current = from;
  for (let step = 0; step < steps; step += 1) {
    const neighbors = getGhostNeighbors(state, current);
    const onwards = neighbors.filter((neighbor) => neighbor !== previous);
    const next = randomChoice(onwards.length > 0 ? onwards : neighbors);
    if (next === undefined) break;
    path.push(next);
    if (occupied.has(next)) break;
    previous = current;
    current = next;
  }
  return path;
}

/** A tile far across the board, the way a ghost vanishes and turns up somewhere else. */
function drawGhostTeleport(state: GameState, from: NodeId): NodeId | undefined {
  const distances = getGhostDistances(state, from);
  const others = getHauntedTiles(state).filter((nodeId) => nodeId !== from);
  const far = others.filter((nodeId) => (distances.get(nodeId) ?? Infinity) >= GHOST_TELEPORT_MIN_DISTANCE);
  return randomChoice(far.length > 0 ? far : others);
}

/**
 * Turn change: an absent ghost comes back once its round has come, on a free
 * tile if there is one. A present one is no slave to the roads: it mostly
 * drifts one to three tiles along them, whichever way they run, and now and
 * then vanishes to reappear far across the board.
 */
export function advanceGhost(state: GameState): GameState {
  const ghost = state.ghost;
  const tiles = getHauntedTiles(state);
  if (!ghost || tiles.length === 0 || state.phase !== "playing") return state;

  if (ghost.nodeId === null) {
    if (state.round < ghost.returnsAtRound) return state;
    const occupied = new Set(state.players.map((player) => player.position));
    const tile = randomChoice(tiles.filter((nodeId) => !occupied.has(nodeId))) ?? randomChoice(tiles) ?? tiles[0];
    const appeared = withGhost(state, { ...ghost, nodeId: tile, metPlayerIds: [] });
    const logged = addLog(appeared, `Un fantôme surgit sur la case ${tile} !`, "event");
    return recordGhostEvent(logged, { kind: "appear", from: null, to: tile });
  }

  const from = ghost.nodeId;
  const teleportTo = drawEngineRandom() < GHOST_TELEPORT_CHANCE ? drawGhostTeleport(state, from) : undefined;
  if (teleportTo !== undefined) {
    const teleported = withGhost(state, { ...ghost, nodeId: teleportTo, metPlayerIds: [] });
    const logged = addLog(teleported, `Le fantôme disparaît… et réapparaît en case ${teleportTo} !`, "event");
    return recordGhostEvent(logged, { kind: "teleport", from, to: teleportTo });
  }

  const path = drawGhostDrift(state, from);
  const to = path[path.length - 1] ?? from;
  const moved = withGhost(state, { ...ghost, nodeId: to, metPlayerIds: [] });
  return recordGhostEvent(moved, { kind: "move", from, to, path });
}

/**
 * A player in Hell has suffered enough: whoever gets out of it (Bouteille
 * d’eau, Monopoly Man, New Cup, New Me…) and lands on the ghost's tile is left
 * alone until the ghost rides on. Run before every action, it counts everyone
 * standing in Hell at that moment as already met.
 */
export function spareHellPlayers(state: GameState): GameState {
  const ghost = state.ghost;
  if (!ghost || ghost.nodeId === null || state.phase !== "playing") return state;
  const spared = state.players
    .filter((player) => player.position === HELL_NODE_ID && !ghost.metPlayerIds.includes(player.id))
    .map((player) => player.id);
  return spared.length === 0 ? state : withGhost(state, { ...ghost, metPlayerIds: [...ghost.metPlayerIds, ...spared] });
}

/**
 * Who the ghost duels now: a player on its tile it has not met there yet,
 * the one whose turn it is first, then in seat order. Never anybody in Hell.
 */
export function findGhostOpponent(state: GameState): Player | undefined {
  const ghost = state.ghost;
  if (!ghost || ghost.nodeId === null) return undefined;
  const candidates = state.players.filter(
    (player) =>
      player.position === ghost.nodeId && player.position !== HELL_NODE_ID && !ghost.metPlayerIds.includes(player.id),
  );
  const active = getActivePlayer(state);
  return candidates.find((player) => player.id === active?.id) ?? candidates[0];
}

/** L'Ange-Gardien never goes to Hell: the ghost takes coins or an item from them, if anything. */
function drawPenalty(player: Player): GhostPenalty {
  const options: GhostPenalty[] = avoidsHell(player) ? [] : [{ kind: "hell" }];
  if (player.currency > 0) options.push({ kind: "coins", amount: Math.min(GHOST_STEAL_COINS, player.currency) });
  const item = randomChoice(player.inventory.filter((entry) => entry.kind === "item"));
  if (item?.kind === "item") options.push({ kind: "item", entryId: item.id, itemId: item.itemId });
  return randomChoice(options) ?? { kind: "coins", amount: 0 };
}

/** One piece of loot at a time: coins or one item, drawn; a reward of its own when the loot is empty. */
function drawReward(ghost: GhostState, player: Player): GhostReward {
  const items = ghost.loot.items.filter((entry) => canReceiveItem(player, entry.itemId));
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
  if (!canAddItem(player, reward.itemId)) {
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
      // One item only: a stack of Tomates loses a single one.
      const loot = { ...ghost.loot, items: [...ghost.loot.items, { id: createEngineId(), itemId: penalty.itemId }] };
      const nextState = updatePlayer(withGhost(state, { ...ghost, loot }), player.id, (current) =>
        spendItemEntry(current, penalty.entryId),
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
