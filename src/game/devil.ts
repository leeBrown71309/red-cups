import { getBoard } from "./board";
import { createEngineId } from "./engine-random";
import { avoidsHell, getDevilGoal, isImmuneToItems } from "./passive-rules";
import { addLog, findPlayer, randomChoice, sendPlayerToHell, updatePlayer } from "./state-utils";
import type { DevilSpell, GameState, Player, PlayerId } from "./types";
import { BLACK_CUP_ROUNDS, DOOMSDAY_ROUNDS, HELL_NODE_ID, PORTAL_ROUNDS, START_NODE_ID } from "./types";

/**
 * Le diable (patch 0.1.4): announced to the whole table, they win once the
 * others entered Hell often enough, and their shop sells five items of their
 * own. Every function is pure: state in, state out.
 */

export function findDevil(state: GameState): Player | undefined {
  return state.players.find((player) => player.passiveId === "devil");
}

/** At the start, the whole table learns who le diable is and what they need. */
export function announceDevil(state: GameState): GameState {
  const devil = findDevil(state);
  if (!devil) return state;
  return addLog(
    state,
    `${devil.name} est le diable ! Il gagne dès que les autres seront entrés ${getDevilGoalFor(state)} fois en Enfer.`,
    "bad",
  );
}

/** Players stepping into Hell between two states, le diable aside: each one brings them closer to winning. */
export function countHellEntries(before: GameState, after: GameState): GameState {
  if (!findDevil(after)) return after;
  const entries = after.players.filter((player) => {
    const previous = findPlayer(before, player.id);
    return (
      player.passiveId !== "devil" &&
      player.position === HELL_NODE_ID &&
      previous !== undefined &&
      previous.position !== HELL_NODE_ID
    );
  }).length;
  return entries === 0 ? after : { ...after, devilHellEntries: after.devilHellEntries + entries };
}

export function getDevilGoalFor(state: GameState): number {
  return getDevilGoal(state.startingPlayerCount);
}

/** Le diable may leave Hell whenever it is their turn: back on the start, without the start bonus. */
export function leaveHell(state: GameState): GameState {
  const player = state.players[state.activePlayerIndex];
  if (!player || player.passiveId !== "devil" || state.turnStage !== "hell" || player.position !== HELL_NODE_ID) {
    return state;
  }
  const nextState = updatePlayer(state, player.id, (current) => ({
    ...current,
    position: START_NODE_ID,
    hellTurns: 0,
  }));
  return addLog({ ...nextState, turnStage: "move" }, `${player.name} sort de l’Enfer comme il lui plaît.`, "event");
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

/** Portail: a random tile, neither Hell nor the start nor the Red Cup's, opens onto Hell. */
export function openPortal(state: GameState, casterId: PlayerId): GameState {
  const taken = new Set([START_NODE_ID, HELL_NODE_ID, state.redCupNodeId, ...state.hellPortals.map((p) => p.nodeId)]);
  const nodeId = randomChoice(getBoard(state).normalNodeIds.filter((candidate) => !taken.has(candidate)));
  if (nodeId === undefined) return addLog(state, "Le Portail ne trouve aucune case où s’ouvrir.");
  const portal = { id: createEngineId(), nodeId, ...castSpell(state, casterId, PORTAL_ROUNDS) };
  const nextState: GameState = { ...state, hellPortals: [...state.hellPortals, portal] };
  return addLog(nextState, `Un Portail vers l’Enfer s’ouvre en case ${nodeId}.`, "bad");
}

/** Stopping on a Portail drops the player into Hell, le diable included, and closes it; Chance aveugle is spared. */
export function triggerPortal(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  const portal = state.hellPortals.find((candidate) => candidate.nodeId === player?.position);
  if (!player || !portal || isImmuneToItems(player)) return state;
  const closed: GameState = {
    ...state,
    hellPortals: state.hellPortals.filter((candidate) => candidate.id !== portal.id),
  };
  return sendPlayerToHell(addLog(closed, `${player.name} s’arrête sur le Portail !`, "bad"), playerId);
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
      player.skippedTurns > 0 &&
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
    nextState = addLog({ ...nextState, hellPortals: open }, "Un Portail se referme.", "event");
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
