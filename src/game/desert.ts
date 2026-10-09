import { getNodeKindOf, getShortestPath, resolveBoard } from "./board";
import { canAffordMove } from "./energy";
import { getBoardMap } from "./maps/map-registry";
import type { BoardMap, DesertConfig } from "./maps/map-types";
import { isTakenSeat } from "./quay";
import { addLog, applyCurrencyChange, findPlayer, getActivePlayer, randomChoice, updatePlayer } from "./state-utils";
import { getClosedPasses, getStormPhase } from "./tide";
import type { DesertEvent, DesertEventRecord, GameState, NodeId, Player, PlayerId } from "./types";
import { CARAVAN_RIDE, CARAVAN_STEP, HELL_NODE_ID, START_NODE_ID, WELL_PRICE } from "./types";

/**
 * Désert des Mirages (patch 0.2.4). Two Red Cups lie on the sand at all times, a real one (`redCupNodeId`, so every rule
 * that reads the Cup keeps working) and a mirage (`mirageNodeId`). This module holds what the desert adds around them:
 * the placing of a pair, the wells, the caravan, the sandstorms and the oases. What a player may know of the pair is
 * never in a log line: only `wellKnowledge`, which the interface shows to the player who drank.
 */

const MAX_KEPT_EVENTS = 12;

export function getDesert(state: Pick<GameState, "mapId">): DesertConfig | undefined {
  return getBoardMap(state.mapId).desert;
}

export function isDesert(state: Pick<GameState, "mapId">): boolean {
  return getDesert(state) !== undefined;
}

/** Writes events down, in order, for the scene and the sounds to replay. */
export function recordDesertEvents(state: GameState, events: DesertEvent[]): GameState {
  if (events.length === 0) return state;
  let seq = state.lastDesertEvents.reduce((highest, record) => Math.max(highest, record.seq), 0);
  const records: DesertEventRecord[] = events.map((event) => {
    seq += 1;
    return { ...event, seq };
  });
  return { ...state, lastDesertEvents: [...state.lastDesertEvents, ...records].slice(-MAX_KEPT_EVENTS) };
}

/** Whether a Red Cup lies on this tile, real or mirage: the two are the same to everyone until they are reached. */
export function isCupNode(state: Pick<GameState, "redCupNodeId" | "mirageNodeId">, nodeId: NodeId): boolean {
  return nodeId === state.redCupNodeId || (state.mirageNodeId !== null && nodeId === state.mirageNodeId);
}

/** Every Cup tile of the board, one on most maps, two in the desert. */
export function getCupNodeIds(state: Pick<GameState, "redCupNodeId" | "mirageNodeId">): NodeId[] {
  return [state.redCupNodeId, state.mirageNodeId].filter((nodeId): nodeId is NodeId => nodeId !== null);
}

// ------------------------------------------------------------------------------------------------ the pair

/** Tiles a Cup may lie on: ordinary ones, never the start, a pass, a well, an oasis, nor a tile somebody stands on. */
function canLieOn(state: GameState, map: BoardMap, nodeId: NodeId): boolean {
  const kind = getNodeKindOf(map, nodeId);
  if (kind === undefined || ["well", "oasis", "pass", "hell", "start"].includes(kind) || nodeId === START_NODE_ID) {
    return false;
  }
  return !state.players.some((player) => player.position === nodeId);
}

interface PairRules {
  real: [number, number];
  mirage: [number, number];
  apart: number;
  collector: number;
}

const PAIR_RULES: PairRules = { real: [5, 7], mirage: [4, 8], apart: 6, collector: 6 };

/**
 * Draws a new pair of Cups: the real one five to seven steps from the player nearest to it, the mirage four to eight,
 * the two at least six steps apart, neither on a tile of the pair that just went away (both old tiles are excluded
 * together, or the one that did not move would be the real one), and neither near whoever has just picked one up.
 * The rules loosen step by step when the board leaves no room. Roads count without the sandstorms.
 */
export function drawCupPair(
  state: GameState,
  avoid: NodeId[],
  collectorId: PlayerId | null,
): { real: NodeId; mirage: NodeId } {
  const map = getBoardMap(state.mapId);
  const roads = resolveBoard(state.mapId);
  const distance = (from: NodeId, to: NodeId) => getShortestPath(roads, from, to, true)?.length ?? Infinity;
  const walkers = state.players.filter((player) => player.position !== HELL_NODE_ID);
  const nearest = (nodeId: NodeId) => Math.min(...walkers.map((player) => distance(player.position, nodeId)));
  const collector = findPlayer(state, collectorId);
  const farFromCollector = (nodeId: NodeId, minimum: number) =>
    !collector || collector.position === HELL_NODE_ID || distance(collector.position, nodeId) >= minimum;

  const tiles = roads.normalNodeIds.filter((nodeId) => canLieOn(state, map, nodeId) && !avoid.includes(nodeId));
  const within =
    ([least, most]: [number, number], loosen: number) =>
    (nodeId: NodeId) => {
      const steps = nearest(nodeId);
      return steps >= least - loosen && steps <= most + loosen;
    };

  for (const loosen of [0, 1, 2, 4, 99]) {
    const collectorRule = loosen === 0 ? PAIR_RULES.collector : Math.max(0, PAIR_RULES.collector - loosen);
    const reals = tiles.filter(
      (nodeId) => within(PAIR_RULES.real, loosen)(nodeId) && farFromCollector(nodeId, collectorRule),
    );
    // Drawn in random order, so that the first real tile with a mirage that fits is a fair draw.
    const order = [...reals];
    while (order.length > 0) {
      const real = randomChoice(order) as NodeId;
      order.splice(order.indexOf(real), 1);
      const mirages = tiles.filter(
        (nodeId) =>
          nodeId !== real &&
          within(PAIR_RULES.mirage, loosen)(nodeId) &&
          farFromCollector(nodeId, collectorRule) &&
          distance(real, nodeId) >= Math.max(1, PAIR_RULES.apart - loosen),
      );
      const mirage = randomChoice(mirages);
      if (mirage !== undefined) return { real, mirage };
    }
  }
  const real = randomChoice(tiles) ?? tiles[0] ?? START_NODE_ID;
  const mirage = randomChoice(tiles.filter((nodeId) => nodeId !== real)) ?? real;
  return { real, mirage };
}

/** Puts a fresh pair on the sand: both old tiles in `avoid` are left empty, and what a well taught is forgotten. */
export function placeCupPair(state: GameState, avoid: NodeId[], collectorId: PlayerId | null): GameState {
  const pair = drawCupPair(state, avoid, collectorId);
  return {
    ...state,
    redCupNodeId: pair.real,
    mirageNodeId: pair.mirage,
    cupPairId: state.cupPairId + 1,
    wellKnowledge: {},
  };
}

// ------------------------------------------------------------------------------------------------- the wells

/** Whether the active player may drink at the well they stand on: once for each pair of Cups, and the price paid. */
export function canDrinkAtWell(state: GameState, player: Player | undefined = getActivePlayer(state)): boolean {
  const desert = getDesert(state);
  if (!player || !desert || state.phase !== "playing") return false;
  if (!desert.wells.includes(player.position) || getActivePlayer(state)?.id !== player.id) return false;
  if (!["move", "shop", "turn-end"].includes(state.turnStage)) return false;
  if (state.redCupNodeId === null || player.currency < WELL_PRICE) return false;
  return state.wellKnowledge[player.id]?.pair !== state.cupPairId;
}

/**
 * Pays at the well and learns, in secret, which Cup is the real one. The log says only that they drank, the same line
 * for everybody; what they learned is `wellKnowledge`, which only their own screen reads.
 */
export function drinkAtWell(state: GameState): GameState {
  const player = getActivePlayer(state);
  if (!player || !canDrinkAtWell(state, player) || state.redCupNodeId === null) return state;
  let nextState = applyCurrencyChange(state, player.id, -WELL_PRICE);
  nextState = {
    ...nextState,
    wellKnowledge: {
      ...nextState.wellKnowledge,
      [player.id]: { pair: state.cupPairId, realNodeId: state.redCupNodeId },
    },
  };
  nextState = addLog(nextState, `${player.name} puise au puits.`, "event");
  return recordDesertEvents(nextState, [{ kind: "well", playerId: player.id, nodeId: player.position }]);
}

/** The tile a player learned at a well is the real Cup, if the pair they drank for is still the one in play. */
export function getKnownRealCup(
  state: Pick<GameState, "wellKnowledge" | "cupPairId">,
  playerId: PlayerId | null,
): NodeId | null {
  const knowledge = playerId === null ? undefined : state.wellKnowledge[playerId];
  return knowledge && knowledge.pair === state.cupPairId ? knowledge.realNodeId : null;
}

// ----------------------------------------------------------------------------------------------- the caravan

/** The caravan walks two tiles clockwise, and every few rounds the sandstorm turns: called as a round opens. */
export function openDesertRound(state: GameState, round: number): GameState {
  const desert = getDesert(state);
  if (!desert || state.caravanNodeId === null) return state;
  const events: DesertEvent[] = [];
  let nextState = state;

  const loop = desert.outerLoop;
  const at = loop.indexOf(state.caravanNodeId);
  if (at >= 0) {
    const to = loop[(at + CARAVAN_STEP) % loop.length];
    events.push({ kind: "caravan-moved", from: state.caravanNodeId, to });
    nextState = { ...nextState, caravanNodeId: to };
  }
  const map = getBoardMap(state.mapId);
  if (round > 1 && getStormPhase(round) !== getStormPhase(round - 1)) {
    const closed = getClosedPasses(map, round);
    events.push({ kind: "storm", closed });
    nextState = addLog(
      nextState,
      `Tempête de sable : les passes ${closed.join(" et ")} se ferment, les deux autres s’ouvrent.`,
      "event",
    );
  }
  return recordDesertEvents(nextState, events);
}

/** Where a ride on the caravan would take the active player: four tiles clockwise, if they stand with it. Null if not. */
export function planCaravanRide(state: GameState, player: Player | undefined = getActivePlayer(state)): NodeId | null {
  const desert = getDesert(state);
  if (!player || !desert || state.caravanNodeId === null) return null;
  if (state.phase !== "playing" || state.turnStage !== "move" || !canAffordMove(state)) return null;
  if (state.moveDistance > 1 || player.position !== state.caravanNodeId) return null;
  const loop = desert.outerLoop;
  const at = loop.indexOf(player.position);
  if (at < 0) return null;
  const destination = loop[(at + CARAVAN_RIDE) % loop.length];
  // An oasis holds one traveller: the caravan does not set a second one down on it.
  return isTakenSeat(state, destination, player.id) ? null : destination;
}

// --------------------------------------------------------------------------------------- the safety net

/**
 * The sandstorm shut a pass under somebody: set down on the tile of the caravan loop the pass leaves from, or on the
 * next one if that tile is an oasis somebody holds.
 */
function dropFromShutPasses(state: GameState): GameState {
  const desert = getDesert(state);
  if (!desert) return state;
  const closed = getClosedPasses(getBoardMap(state.mapId), state.round);
  let nextState = state;
  for (const player of state.players) {
    const pass = desert.passes.find((candidate) => candidate.node === player.position);
    if (!pass || !closed.includes(pass.node)) continue;
    const landing = isTakenSeat(nextState, pass.outer, player.id) ? pass.inner : pass.outer;
    nextState = updatePlayer(nextState, player.id, (current) => ({ ...current, position: landing }));
    nextState = recordDesertEvents(nextState, [
      { kind: "storm-drop", playerId: player.id, from: player.position, to: landing },
    ]);
    nextState = addLog(
      nextState,
      `La tempête ferme la passe sur ${player.name} : le sable le dépose en case ${landing}.`,
      "bad",
    );
  }
  return nextState;
}

/** An oasis holds one traveller: whoever else was set down on it goes back to where they came from. */
function pushBackFromCrowdedOases(before: GameState, state: GameState): GameState {
  const desert = getDesert(state);
  if (!desert) return state;
  const closed = getClosedPasses(getBoardMap(state.mapId), state.round);
  let nextState = state;
  for (const oasisId of desert.oases) {
    const crowd = nextState.players.filter((player) => player.position === oasisId);
    if (crowd.length < 2) continue;
    const holder = crowd.find((player) => findPlayer(before, player.id)?.position === oasisId) ?? crowd[0];
    for (const intruder of crowd.filter((player) => player.id !== holder.id)) {
      const cameFrom = findPlayer(before, intruder.id)?.position ?? oasisId;
      const usable =
        cameFrom !== oasisId &&
        cameFrom !== HELL_NODE_ID &&
        !closed.includes(cameFrom) &&
        !isTakenSeat(nextState, cameFrom, intruder.id);
      // With nowhere to go back to, the next tile of the loop will do.
      const loop = desert.outerLoop;
      const next = loop[(loop.indexOf(oasisId) + 1) % loop.length];
      const target = usable ? cameFrom : next;
      nextState = updatePlayer(nextState, intruder.id, (current) => ({ ...current, position: target }));
      nextState = recordDesertEvents(nextState, [
        { kind: "oasis-bump", playerId: intruder.id, nodeId: oasisId, to: target },
      ]);
      nextState = addLog(nextState, `L’oasis est prise : ${intruder.name} est repoussé.`, "event");
      // The shop of the oasis they were turned away from stays shut: nothing was reached.
      if (nextState.turnStage === "shop" && getActivePlayer(nextState)?.id === intruder.id) {
        nextState = { ...nextState, turnStage: "turn-end" };
      }
    }
  }
  return nextState;
}

/** The safety net after every action, as `settleArchipel` is on the water: shut passes and crowded oases. */
export function settleDesert(before: GameState, after: GameState): GameState {
  if (!isDesert(after)) return after;
  let state = after;
  for (let pass = 0; pass < 3; pass += 1) {
    const pushed = pushBackFromCrowdedOases(before, dropFromShutPasses(state));
    if (pushed === state) break;
    state = pushed;
  }
  return state === after ? after : markOasisOnMovement(before, state);
}

/** The walk the player just played ended on a taken oasis: the scene pushes them back after the last hop. */
function markOasisOnMovement(before: GameState, state: GameState): GameState {
  const movement = state.lastMovement;
  if (!movement || movement.seq === before.lastMovement?.seq) return state;
  const seen = before.lastDesertEvents.reduce((highest, record) => Math.max(highest, record.seq), 0);
  const walkEnd = movement.path[movement.path.length - 1];
  const bumped = state.lastDesertEvents.some(
    (record) =>
      record.seq > seen &&
      record.kind === "oasis-bump" &&
      record.playerId === movement.playerId &&
      record.nodeId === walkEnd,
  );
  return bumped ? { ...state, lastMovement: { ...movement, water: "bumped" } } : state;
}
