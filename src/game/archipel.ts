import { getBoard, getNodeKindOf } from "./board";
import { canAffordMove } from "./energy";
import { getBoardMap } from "./maps/map-registry";
import type { BoardMap, CausewayConfig } from "./maps/map-types";
import { addLog, applyCurrencyChange, findPlayer, getActivePlayer, randomChoice, updatePlayer } from "./state-utils";
import { getFloodedNodeIds, getNextFerryQuay, getTideLevel } from "./tide";
import type { ArchipelEvent, ArchipelEventRecord, GameState, NodeId, Player, PlayerId } from "./types";
import { HELL_NODE_ID, QUAY_HOLDER_REWARD } from "./types";

/**
 * Archipel des Marées (patch 0.2.4). Four rules live here, none of them in the reducer's main flow:
 *
 * - the tide: at every change of round, and the ferry with it, see `openArchipelRound`;
 * - the ferry: a player on its quay may ride it instead of walking, see `planFerryRide`;
 * - the quays hold a single player, the whirlpools hold nobody, the drowned causeways nobody either: whatever set a
 *   player down there (a walk, a wheel, a pull, the tide itself), `settleArchipel` moves them on after every action.
 */

const MAX_KEPT_EVENTS = 12;

function getTidal(state: Pick<GameState, "mapId">): BoardMap["tidal"] {
  return getBoardMap(state.mapId).tidal;
}

export function isArchipel(state: Pick<GameState, "mapId">): boolean {
  return getTidal(state) !== undefined;
}

/** Writes events down, in order, for the scene and the sounds to replay. */
function recordEvents(state: GameState, events: ArchipelEvent[]): GameState {
  if (events.length === 0) return state;
  let seq = state.lastArchipelEvents.reduce((highest, record) => Math.max(highest, record.seq), 0);
  const records: ArchipelEventRecord[] = events.map((event) => {
    seq += 1;
    return { ...event, seq };
  });
  return { ...state, lastArchipelEvents: [...state.lastArchipelEvents, ...records].slice(-MAX_KEPT_EVENTS) };
}

function islandNameOf(map: BoardMap, nodeId: NodeId): string {
  const tidal = map.tidal;
  const index = tidal ? tidal.islands.findIndex((tiles) => tiles.includes(nodeId)) : -1;
  return index >= 0 && tidal ? tidal.islandNames[index] : "l’archipel";
}

/** The ferry starts its circuit at the first quay. */
export function getInitialFerryQuay(map: BoardMap): NodeId | null {
  return map.tidal?.ferryQuays[0] ?? null;
}

/**
 * A new round opens: the ferry moors at the next quay and, every second round, the tide turns. Called before the
 * round's first turn begins, with the round that is about to start.
 */
export function openArchipelRound(state: GameState, round: number): GameState {
  const map = getBoardMap(state.mapId);
  if (!map.tidal || state.ferryQuayId === null) return state;
  const events: ArchipelEvent[] = [];
  let nextState = state;

  const nextQuay = getNextFerryQuay(map, state.ferryQuayId);
  if (nextQuay !== null) {
    events.push({ kind: "ferry-moved", from: state.ferryQuayId, to: nextQuay });
    nextState = { ...nextState, ferryQuayId: nextQuay };
  }
  const level = getTideLevel(round);
  if (level !== getTideLevel(round - 1)) {
    events.push({ kind: "tide", level });
    nextState = addLog(
      nextState,
      level === "high"
        ? "Marée haute : les chaussées basses disparaissent sous l’eau."
        : "Marée basse : les chaussées basses émergent, les hautes se noient.",
      "event",
    );
  }
  return recordEvents(nextState, events);
}

/** Whether `playerId` shares the tile with nobody but themselves. */
function isOccupiedByOther(state: GameState, nodeId: NodeId, playerId: PlayerId): boolean {
  return state.players.some((player) => player.id !== playerId && player.position === nodeId);
}

/**
 * Where a player is set down when they were meant to reach `quayId`: the quay itself when it is free, otherwise the
 * island's inner tile next to it, so two players never end up on one quay.
 */
export function getQuayLanding(state: GameState, quayId: NodeId, playerId: PlayerId): NodeId {
  if (!isOccupiedByOther(state, quayId, playerId)) return quayId;
  const island = getTidal(state)?.islands.find((tiles) => tiles.includes(quayId));
  return island?.[1] ?? quayId;
}

/**
 * Whether the active player may ride the ferry now, and where it takes them: from the quay it is moored at, in
 * place of walking, to the next quay if nobody holds it. Null when they may not.
 */
export function planFerryRide(state: GameState, player: Player | undefined = getActivePlayer(state)): NodeId | null {
  const map = getBoardMap(state.mapId);
  if (!player || !map.tidal || state.ferryQuayId === null) return null;
  if (state.phase !== "playing" || state.turnStage !== "move" || !canAffordMove(state)) return null;
  // The Botte prepared for a two-tile walk is not spent on a crossing.
  if (state.moveDistance > 1 || player.position !== state.ferryQuayId) return null;
  const destination = getNextFerryQuay(map, state.ferryQuayId);
  if (destination === null || isOccupiedByOther(state, destination, player.id)) return null;
  return destination;
}

/** The causeway a drowned tile belongs to. */
function findCauseway(map: BoardMap, nodeId: NodeId): CausewayConfig | undefined {
  return map.tidal?.causeways.find((causeway) => causeway.nodes.includes(nodeId));
}

/** Players the drowning of a causeway found standing on it: set down on the quay it leads to. */
function dropFromDrownedCauseways(state: GameState): GameState {
  const map = getBoardMap(state.mapId);
  const flooded = getFloodedNodeIds(map, state.round);
  if (flooded.length === 0) return state;
  let nextState = state;
  for (const player of state.players) {
    const causeway = findCauseway(map, player.position);
    if (!causeway || !flooded.includes(player.position)) continue;
    const landing = getQuayLanding(nextState, causeway.quayId, player.id);
    nextState = updatePlayer(nextState, player.id, (current) => ({ ...current, position: landing }));
    nextState = recordEvents(nextState, [
      { kind: "flood-drop", playerId: player.id, from: player.position, to: landing },
    ]);
    nextState = addLog(
      nextState,
      `La mer recouvre la chaussée : ${player.name} est déposé sur le Quai de ${islandNameOf(map, landing)}.`,
      "bad",
    );
  }
  return nextState;
}

/** Nobody stays on a whirlpool: whoever is on one is drawn to the quay of another island. */
function suckIntoWhirlpools(state: GameState): GameState {
  const map = getBoardMap(state.mapId);
  const tidal = map.tidal;
  if (!tidal) return state;
  let nextState = state;
  for (const player of state.players) {
    if (getNodeKindOf(map, player.position) !== "whirlpool") continue;
    const here = tidal.islands.findIndex((tiles) => tiles.includes(player.position));
    const quays = tidal.islands.filter((_, index) => index !== here).map((tiles) => tiles[0]);
    const free = quays.filter((quayId) => !isOccupiedByOther(nextState, quayId, player.id));
    const quayId = randomChoice(free.length > 0 ? free : quays);
    if (quayId === undefined) continue;
    const landing = getQuayLanding(nextState, quayId, player.id);
    nextState = updatePlayer(nextState, player.id, (current) => ({ ...current, position: landing }));
    nextState = recordEvents(nextState, [
      { kind: "whirlpool", playerId: player.id, from: player.position, to: landing },
    ]);
    nextState = addLog(
      nextState,
      `Le tourbillon aspire ${player.name} : il refait surface sur le Quai de ${islandNameOf(map, landing)}.`,
      "event",
    );
  }
  return nextState;
}

/**
 * A quay holds one player. When several stand on one, the one who held it before the action keeps it and is paid;
 * the others are pushed back to the tile they came from (the island's inner tile if that is no place to stand).
 */
function pushBackFromCrowdedQuays(before: GameState, state: GameState): GameState {
  const map = getBoardMap(state.mapId);
  const tidal = map.tidal;
  if (!tidal) return state;
  const flooded = getFloodedNodeIds(map, state.round);
  let nextState = state;
  for (const quayId of tidal.islands.map((tiles) => tiles[0])) {
    const crowd = nextState.players.filter((player) => player.position === quayId);
    if (crowd.length < 2) continue;
    const holder = crowd.find((player) => findPlayer(before, player.id)?.position === quayId) ?? crowd[0];
    const wasHeld = findPlayer(before, holder.id)?.position === quayId;
    for (const intruder of crowd.filter((player) => player.id !== holder.id)) {
      const cameFrom = findPlayer(before, intruder.id)?.position ?? quayId;
      const canStandThere =
        cameFrom !== quayId &&
        cameFrom !== HELL_NODE_ID &&
        !flooded.includes(cameFrom) &&
        getNodeKindOf(map, cameFrom) !== "whirlpool" &&
        !(getNodeKindOf(map, cameFrom) === "quay" && isOccupiedByOther(nextState, cameFrom, intruder.id));
      const target = canStandThere ? cameFrom : getQuayLanding(nextState, quayId, intruder.id);
      nextState = updatePlayer(nextState, intruder.id, (current) => ({ ...current, position: target }));
      nextState = recordEvents(nextState, [
        { kind: "quay-bump", playerId: intruder.id, quayId, to: target, holderId: wasHeld ? holder.id : null },
      ]);
      nextState = addLog(
        nextState,
        wasHeld
          ? `Le Quai est pris : ${intruder.name} est repoussé et ${holder.name} touche ${QUAY_HOLDER_REWARD} pièces.`
          : `Le Quai est pris : ${intruder.name} est repoussé.`,
        "event",
      );
      if (wasHeld) nextState = applyCurrencyChange(nextState, holder.id, QUAY_HOLDER_REWARD);
    }
  }
  return nextState;
}

/**
 * The safety net after every action, as `slideOffIce` is on the Banquise: the drowned causeways give back their
 * players, the whirlpools draw theirs away, the quays hold one player each. A push can land a player on another
 * tile that needs the same treatment, so the passes repeat until nothing moves.
 */
export function settleArchipel(before: GameState, after: GameState): GameState {
  if (!isArchipel(after)) return after;
  let state = after;
  for (let pass = 0; pass < 4; pass += 1) {
    const dropped = dropFromDrownedCauseways(state);
    const drawn = suckIntoWhirlpools(dropped);
    const pushed = pushBackFromCrowdedQuays(before, drawn);
    if (pushed === state) break;
    state = pushed;
  }
  return state === after ? after : markWaterOnMovement(before, state);
}

/**
 * The walk the player just played ended on a whirlpool or a taken quay: the scene needs to know, to draw the whirl or
 * the push-back after the last hop instead of hopping straight to where the player ended up.
 */
function markWaterOnMovement(before: GameState, state: GameState): GameState {
  const movement = state.lastMovement;
  if (!movement || movement.seq === before.lastMovement?.seq) return state;
  const seen = before.lastArchipelEvents.reduce((highest, record) => Math.max(highest, record.seq), 0);
  const walkEnd = movement.path[movement.path.length - 1];
  for (const record of state.lastArchipelEvents.filter((entry) => entry.seq > seen)) {
    if (record.kind === "whirlpool" && record.playerId === movement.playerId && record.from === walkEnd) {
      return { ...state, lastMovement: { ...movement, water: "whirlpool" } };
    }
    if (record.kind === "quay-bump" && record.playerId === movement.playerId && record.quayId === walkEnd) {
      return { ...state, lastMovement: { ...movement, water: "bumped" } };
    }
  }
  return state;
}

/** The drowned causeways at the round the state is in, for the HUD. */
export function getFlooded(state: GameState): NodeId[] {
  return getBoard(state).flooded;
}
