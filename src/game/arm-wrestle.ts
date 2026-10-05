import { hasCard } from "./cards";
import { getNeighbors, getOpenBoard, getShortestPath } from "./board";
import { createEngineId } from "./engine-random";
import { settleBoard } from "./game-effects";
import { carryOffIce } from "./ice";
import { addLog, findPlayer, placeInHell } from "./state-utils";
import type { GameState, NodeId, Player, PlayerId } from "./types";
import { ARM_WRESTLE_MAX_TAPS, HELL_NODE_ID, TANK_ARM_STRENGTH } from "./types";

/**
 * Baraqué against the Monopoly Man (patch 0.1.4): instead of the swap, an arm
 * wrestle. Each side taps for ten seconds, on their own device online, and
 * sends their count; Baraqué's taps count 1.2 times. The attacker winning
 * swaps the tiles; Baraqué winning keeps them; a draw nudges them (Q20).
 */

export function startArmWrestle(state: GameState, attacker: Player, defender: Player): GameState {
  const nextState: GameState = {
    ...state,
    turnStage: "arm-wrestle",
    pendingArmWrestle: {
      id: createEngineId(),
      attackerId: attacker.id,
      defenderId: defender.id,
      taps: {},
      resumeStage: state.turnStage,
    },
  };
  return addLog(nextState, `${defender.name} refuse l’échange : bras de fer contre ${attacker.name} !`, "event");
}

export function getArmStrength(state: Pick<GameState, "players">, playerId: PlayerId, taps: number): number {
  const player = state.players.find((candidate) => candidate.id === playerId);
  return hasCard(player, "built-like-a-tank") ? taps * TANK_ARM_STRENGTH : taps;
}

/** One side's count, once their ten seconds are over; with both in, the wrestle is settled. */
export function submitArmTaps(state: GameState, playerId: PlayerId, taps: number): GameState {
  const pending = state.pendingArmWrestle;
  if (state.turnStage !== "arm-wrestle" || !pending || !Number.isFinite(taps)) return state;
  if (playerId !== pending.attackerId && playerId !== pending.defenderId) return state;
  if (pending.taps[playerId] !== undefined) return state;

  const count = Math.max(0, Math.min(ARM_WRESTLE_MAX_TAPS, Math.floor(taps)));
  const next = { ...pending, taps: { ...pending.taps, [playerId]: count } };
  const attackerTaps = next.taps[pending.attackerId];
  const defenderTaps = next.taps[pending.defenderId];
  if (attackerTaps === undefined || defenderTaps === undefined) return { ...state, pendingArmWrestle: next };
  return settleArmWrestle({ ...state, pendingArmWrestle: next }, attackerTaps, defenderTaps);
}

function settleArmWrestle(state: GameState, attackerTaps: number, defenderTaps: number): GameState {
  const pending = state.pendingArmWrestle!;
  const attacker = findPlayer(state, pending.attackerId);
  const defender = findPlayer(state, pending.defenderId);
  let nextState: GameState = { ...state, pendingArmWrestle: null, turnStage: pending.resumeStage };
  if (!attacker || !defender) return settleBoard(nextState, pending.resumeStage);

  const attackerForce = getArmStrength(state, attacker.id, attackerTaps);
  const defenderForce = getArmStrength(state, defender.id, defenderTaps);
  if (attackerForce > defenderForce) {
    nextState = {
      ...nextState,
      players: nextState.players.map((player) => {
        if (player.id === attacker.id) return setDown(player, defender.position);
        if (player.id === defender.id) return setDown(player, attacker.position);
        return player;
      }),
    };
    nextState = addLog(
      nextState,
      `${attacker.name} gagne le bras de fer et échange sa place avec ${defender.name}.`,
      "event",
    );
  } else if (defenderForce > attackerForce) {
    nextState = addLog(nextState, `${defender.name} gagne le bras de fer : pas d’échange.`, "good");
  } else {
    nextState = nudgeAfterDraw(addLog(nextState, "Égalité au bras de fer !", "event"), attacker, defender);
  }
  // Swapped or nudged onto ice, the ice carries them on.
  nextState = carryOffIce(carryOffIce(nextState, attacker.id, attacker.position), defender.id, defender.position);
  // Like the swap itself, nothing here is an arrival: no wheel, no shop.
  return settleBoard(nextState, pending.resumeStage);
}

/** A swap into Hell is a trip there, which L'Ange-Gardien never makes. */
function setDown(player: Player, nodeId: NodeId): Player {
  return nodeId === HELL_NODE_ID ? placeInHell(player) : { ...player, position: nodeId };
}

/**
 * A draw (Q20): with at least one tile between them, the attacker steps one
 * tile towards Baraqué and Baraqué one tile back; side by side, only Baraqué
 * steps back. Back means onto the neighbouring tile farthest from the
 * attacker; none farther, Baraqué stays. Nobody moves from or into Hell.
 */
function nudgeAfterDraw(state: GameState, attacker: Player, defender: Player): GameState {
  if (attacker.position === HELL_NODE_ID || defender.position === HELL_NODE_ID) return state;
  const board = getOpenBoard(state);
  const path = getShortestPath(board, attacker.position, defender.position, true);
  if (!path || path.length === 0) return state;

  const attackerTile = path.length >= 2 ? path[0] : attacker.position;
  const distanceFromAttacker = (nodeId: NodeId) =>
    getShortestPath(board, attackerTile, nodeId, true)?.length ?? Number.POSITIVE_INFINITY;
  const current = distanceFromAttacker(defender.position);
  const back = getNeighbors(board, defender.position, true)
    .filter((nodeId) => nodeId !== HELL_NODE_ID && distanceFromAttacker(nodeId) > current)
    .sort((left, right) => distanceFromAttacker(right) - distanceFromAttacker(left))[0];

  let nextState: GameState = {
    ...state,
    players: state.players.map((player) => {
      if (player.id === attacker.id) return { ...player, position: attackerTile };
      if (player.id === defender.id && back !== undefined) return { ...player, position: back };
      return player;
    }),
  };
  if (attackerTile !== attacker.position) {
    nextState = addLog(nextState, `${attacker.name} avance en case ${attackerTile}.`, "event");
  }
  if (back !== undefined) nextState = addLog(nextState, `${defender.name} recule en case ${back}.`, "event");
  return nextState;
}
