import { hasCard } from "./cards";
import { getBoard, isIce } from "./board";
import { spendEnergy } from "./energy";
import { createEngineId } from "./engine-random";
import { isKnockedOut } from "./rules";
import { avoidsHell, getDevilGoal, isImmuneToItems } from "./passive-rules";
import { carryOffIce } from "./ice";
import { addLog, applyCurrencyChange, findPlayer, randomChoice, sendPlayerToHell, updatePlayer } from "./state-utils";
import type { DevilSpell, GameState, HellPortal, Player, PlayerId } from "./types";
import { BLACK_CUP_ROUNDS, DOOMSDAY_ROUNDS, HELL_NODE_ID, PORTAL_ROUNDS, START_NODE_ID } from "./types";

/**
 * Le diable (patch 0.1.4): announced to the whole table, they win once the
 * others entered Hell often enough, and their shop sells five items of their
 * own. Every function is pure: state in, state out.
 */

export function findDevil(state: GameState): Player | undefined {
  return state.players.find((player) => hasCard(player, "devil"));
}

/** Coins le diable earns each time they go to Hell themselves (author's buff). */
export const DEVIL_HELL_REWARD = 100;

/** Coins le diable earns each time another player goes to Hell (patch 0.1.5). */
export const DEVIL_OTHERS_HELL_REWARD = 50;

/** At the start, the whole table learns who le diable is and what they need. */
export function announceDevil(state: GameState): GameState {
  const devil = findDevil(state);
  if (!devil) return state;
  return addLog(
    state,
    `${devil.name} est le diable ! Il gagne dès que les autres auront passé ${getDevilGoalFor(state)} tours en Enfer.`,
    "bad",
  );
}

/**
 * A player other than le diable begins one more of their turns in Hell,
 * played or skipped: it brings le diable closer to winning (author's buff).
 */
export function countDevilHellTurn(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!findDevil(state) || !player || hasCard(player, "devil")) return state;
  return { ...state, devilHellTurns: state.devilHellTurns + 1 };
}

/**
 * Every step into Hell between two states pays le diable (patch 0.1.5): 100
 * coins for their own, and 50 coins plus a point of their score for another
 * player's, on top of the point each turn spent there brings.
 */
export function rewardDevilInHell(before: GameState, after: GameState): GameState {
  const devil = findDevil(after);
  if (!devil) return after;
  let nextState = after;
  for (const player of after.players) {
    const previous = findPlayer(before, player.id);
    if (!previous || player.position !== HELL_NODE_ID || previous.position === HELL_NODE_ID) continue;
    if (player.id === devil.id) {
      nextState = applyCurrencyChange(nextState, devil.id, DEVIL_HELL_REWARD);
      nextState = addLog(nextState, `${devil.name} est chez lui en Enfer : +${DEVIL_HELL_REWARD} pièces.`, "good");
      continue;
    }
    nextState = applyCurrencyChange(nextState, devil.id, DEVIL_OTHERS_HELL_REWARD);
    nextState = { ...nextState, devilHellTurns: nextState.devilHellTurns + 1 };
    nextState = addLog(
      nextState,
      `${player.name} entre en Enfer : ${devil.name} gagne ${DEVIL_OTHERS_HELL_REWARD} pièces et un point.`,
      "bad",
    );
  }
  return nextState;
}

export function getDevilGoalFor(state: GameState): number {
  return getDevilGoal(state.startingPlayerCount);
}

/** Energy le diable pays to leave Hell (author's answer). */
export const DEVIL_HELL_EXIT_ENERGY = 1;

/** Whether the active player is le diable in Hell with the energy to leave it. */
export function canLeaveHell(state: GameState): boolean {
  const player = state.players[state.activePlayerIndex];
  return (
    hasCard(player, "devil") &&
    state.turnStage === "hell" &&
    player.position === HELL_NODE_ID &&
    state.energyLeft >= DEVIL_HELL_EXIT_ENERGY
  );
}

/**
 * Le diable may leave Hell whenever it is their turn, for a point of energy:
 * back on the start, without the start bonus, the rest of the turn ahead.
 */
export function leaveHell(state: GameState): GameState {
  if (!canLeaveHell(state)) return state;
  const player = state.players[state.activePlayerIndex];
  const nextState = updatePlayer(spendEnergy(state, DEVIL_HELL_EXIT_ENERGY), player.id, (current) => ({
    ...current,
    position: START_NODE_ID,
    hellTurns: 0,
  }));
  const left = addLog(
    { ...nextState, turnStage: "move" },
    `${player.name} sort de l’Enfer comme il lui plaît.`,
    "event",
  );
  // A start frozen by the blizzard carries them on.
  return carryOffIce(left, player.id, HELL_NODE_ID);
}

/** A spell cast now that lasts `rounds` rounds of the table. */
function castSpell(state: GameState, casterId: PlayerId, rounds: number): DevilSpell {
  return { casterId, untilRound: state.round + rounds };
}

/** Whether a spell ran its course as the active player's turn begins. */
function hasExpired(state: GameState, spell: DevilSpell): boolean {
  if (state.round !== spell.untilRound) return state.round > spell.untilRound;
  const casterIndex = state.players.findIndex((player) => player.id === spell.casterId);
  return casterIndex === -1 || state.activePlayerIndex >= casterIndex;
}

/**
 * Whether a Portail shows on the board. Hidden for the round it opened in,
 * the first of the pair shows during the second round and both during the
 * third (patch 0.1.5).
 */
export function isPortalVisible(state: Pick<GameState, "round">, portal: HellPortal): boolean {
  if (portal.castRound === undefined) return true;
  const age = state.round - portal.castRound;
  return age >= 2 || (age === 1 && portal.rank === 0);
}

/** Portails: two random tiles, neither Hell nor the start nor the Red Cup's, open onto Hell, unseen at first. */
export function openPortals(state: GameState, casterId: PlayerId): GameState {
  // Never on ice: nobody stops there, so a Portail would wait for nothing.
  const board = getBoard(state);
  const taken = new Set([START_NODE_ID, HELL_NODE_ID, state.redCupNodeId, ...state.hellPortals.map((p) => p.nodeId)]);
  let free = board.normalNodeIds.filter((candidate) => !taken.has(candidate) && !isIce(board, candidate));
  const nodeIds: number[] = [];
  while (nodeIds.length < 2) {
    const nodeId = randomChoice(free);
    if (nodeId === undefined) break;
    nodeIds.push(nodeId);
    free = free.filter((candidate) => candidate !== nodeId);
  }
  if (nodeIds.length < 2) return addLog(state, "Les Portails ne trouvent pas deux cases où s’ouvrir.");
  const pairId = createEngineId();
  const portals: HellPortal[] = nodeIds.map((nodeId, index) => ({
    id: createEngineId(),
    pairId,
    nodeId,
    castRound: state.round,
    rank: index === 0 ? 0 : 1,
    ...castSpell(state, casterId, PORTAL_ROUNDS),
  }));
  const nextState: GameState = { ...state, hellPortals: [...state.hellPortals, ...portals] };
  return addLog(nextState, "Deux Portails vers l’Enfer s’ouvrent, cachés, quelque part sur la carte.", "bad");
}

/**
 * Stopping on a Portail drops the player into Hell, le diable excepted, and
 * closes both Portails of its pair; Chance aveugle is spared.
 */
export function triggerPortal(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  const portal = state.hellPortals.find((candidate) => candidate.nodeId === player?.position);
  // Le diable placed them: they never take him.
  if (!player || !portal || isImmuneToItems(player) || hasCard(player, "devil")) return state;
  const pairId = portal.pairId ?? portal.id;
  const closed: GameState = {
    ...state,
    hellPortals: state.hellPortals.filter((candidate) => (candidate.pairId ?? candidate.id) !== pairId),
  };
  const swallowed = addLog(closed, `${player.name} s’arrête sur un Portail !`, "bad");
  // Tell the scene: finish the walk on the Portail's tile first, then fall through it (patch 0.2.0).
  const walked = swallowed.lastMovement;
  const marked: GameState =
    walked && walked.playerId === playerId && walked.path[walked.path.length - 1] === portal.nodeId
      ? { ...swallowed, lastMovement: { ...walked, portalNodeId: portal.nodeId } }
      : swallowed;
  return sendPlayerToHell(marked, playerId);
}

/** Black Cup: the Red Cup waits in Hell; whoever already stood there does not pick it up. */
export function castBlackCup(state: GameState, casterId: PlayerId): GameState {
  if (state.redCupNodeId === null || state.blackCup) return state;
  const nextState: GameState = {
    ...state,
    redCupNodeId: HELL_NODE_ID,
    blackCup: {
      returnNodeId: state.redCupNodeId,
      bystanderIds: state.players.filter((player) => player.position === HELL_NODE_ID).map((player) => player.id),
      ...castSpell(state, casterId, BLACK_CUP_ROUNDS),
    },
  };
  return addLog(nextState, "Black Cup : la Red Cup plonge en Enfer pour deux tours de table.", "bad");
}

/** Sentence: every other player at 0 coins or less goes to Hell. */
export function passSentence(state: GameState, casterId: PlayerId): GameState {
  let nextState = addLog(state, "Sentence : les fauchés partent en Enfer.", "bad");
  for (const player of state.players) {
    if (player.id === casterId || player.currency > 0 || isImmuneToItems(player)) continue;
    nextState = sendPlayerToHell(nextState, player.id);
  }
  return nextState;
}

export function startDoomsday(state: GameState, casterId: PlayerId): GameState {
  const nextState: GameState = { ...state, doomsday: castSpell(state, casterId, DOOMSDAY_ROUNDS) };
  return addLog(nextState, "Doomsday : pendant un tour de table, chaque case fait tourner la roue du malheur !", "bad");
}

/**
 * Toucher d'Enfer works on its own: every knocked-out player, or one bound to
 * lose a turn, on le diable's tile goes to Hell, all at once. It is then spent.
 */
export function applyHellTouch(state: GameState): GameState {
  const devil = findDevil(state);
  const touch = devil?.inventory.find((entry) => entry.kind === "item" && entry.itemId === "hell-touch");
  if (!devil || !touch || devil.position === HELL_NODE_ID) return state;
  const victims = state.players.filter(
    (player) =>
      player.id !== devil.id &&
      player.position === devil.position &&
      isKnockedOut(player) &&
      !isImmuneToItems(player) &&
      !avoidsHell(player),
  );
  if (victims.length === 0) return state;

  let nextState = updatePlayer(state, devil.id, (current) => ({
    ...current,
    inventory: current.inventory.filter((entry) => entry.id !== touch.id),
  }));
  nextState = addLog(nextState, `${devil.name} active son Toucher d’Enfer !`, "bad");
  for (const victim of victims) nextState = sendPlayerToHell(nextState, victim.id);
  return nextState;
}

/** As a turn begins: Portails close, the Black Cup comes back and Doomsday ends once their rounds are over. */
export function expireDevilSpells(state: GameState): GameState {
  let nextState = state;
  const open = state.hellPortals.filter((portal) => !hasExpired(state, portal));
  if (open.length !== state.hellPortals.length) {
    nextState = addLog({ ...nextState, hellPortals: open }, "Des Portails se referment.", "event");
  }
  if (state.doomsday && hasExpired(state, state.doomsday)) {
    nextState = addLog(
      { ...nextState, doomsday: null },
      "Doomsday prend fin : les cases redeviennent normales.",
      "event",
    );
  }
  if (state.blackCup && hasExpired(state, state.blackCup)) nextState = returnBlackCup(nextState);
  return nextState;
}

/** The Black Cup's time is up: the Red Cup goes back to its tile, melting Banquise's blizzard ice there. */
function returnBlackCup(state: GameState): GameState {
  const nodeId = state.blackCup?.returnNodeId;
  if (nodeId === undefined) return state;
  const meltsIce = state.iceTileNodeId === nodeId;
  const nextState: GameState = {
    ...state,
    blackCup: null,
    redCupNodeId: nodeId,
    iceTileNodeId: meltsIce ? null : state.iceTileNodeId,
  };
  return addLog(nextState, `La Red Cup remonte de l’Enfer et retrouve la case ${nodeId}.`, "event");
}

/** Made In Heaven sets the Cup down on its tile: a Cup waiting in Hell comes up with it. */
export function dropBlackCup(state: GameState): GameState {
  return state.blackCup ? { ...state, blackCup: null } : state;
}
