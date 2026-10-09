import {
  getBlizzardCandidates,
  getBoard,
  getNeighbors,
  getOpenBoard,
  getSlideExits,
  hasIce,
  isBlockedRoad,
  isIce,
  type Board,
} from "./board";
import { drawEngineRandom } from "./engine-random";
import { addLog, findPlayer, randomChoice, updatePlayer } from "./state-utils";
import type { GameState, NodeId, PlayerId, SlideBump } from "./types";
import { ICE_FALL_CHANCE } from "./types";

/**
 * Banquise rules that need luck: where a slide goes, whether ice falls on a
 * player sliding towards the Red Cup, and where the blizzard lays its ice.
 * Luck goes through the engine source, so online devices all draw the same.
 *
 * Nobody stays on ice (patch 0.1.4, rule of the game's author): whatever
 * brings a player onto it, a walk, a wheel, a pull, a swap or a trip to a
 * frozen start, they slide on to a tile without ice. Only a player caught by
 * falling ice waits on it, halfway down the road, until their next turn.
 */

export interface SlideOutcome {
  /** Tiles slid on after the walk, in order; empty when the walk did not end on ice. */
  slide: NodeId[];
  /** Set when falling ice stopped the slide on its way to this tile. */
  interruptedTo: NodeId | null;
  /** The fall of ice, hit or missed, when the slide headed for the Red Cup. */
  iceFall: { from: NodeId; to: NodeId; hit: boolean } | null;
  /**
   * Barrières the slide ran into: it had slid `step` tiles on when it was about to take the barred road
   * towards `toward`, bounced back and drew another way from the tile it stood on.
   */
  bumps: { step: number; toward: NodeId }[];
}

/**
 * Where a slide may go on from `iceNodeId`: a road it has not crossed yet,
 * never back the way it came. When every road on was already crossed, it
 * stops on the first of them without ice; at a dead end (an arrow pointing
 * back the way it came), it goes back. Nobody stays on ice.
 */
export function getSlideChoices(board: Board, previous: NodeId, iceNodeId: NodeId, crossed: Set<NodeId>): NodeId[] {
  const onward = getSlideExits(board, previous, iceNodeId);
  const fresh = onward.filter((nodeId) => !crossed.has(nodeId));
  if (fresh.length > 0) return fresh;
  const solidOnward = onward.filter((nodeId) => !isIce(board, nodeId));
  if (solidOnward.length > 0) return solidOnward;
  return getNeighbors(board, iceNodeId).filter((nodeId) => !isIce(board, nodeId));
}

/**
 * A walk that ends on ice slides on, one random road at a time, until it
 * reaches a tile without ice (see `getSlideChoices`). Sliding towards the Red
 * Cup, the player may be caught by falling ice and stop halfway; `iceFall`
 * false leaves the ice out, for a player it merely carries away.
 */
export function drawSlide(state: GameState, walkFrom: NodeId, walkedPath: NodeId[], iceFall = true): SlideOutcome {
  const board = getBoard(state);
  // A Barrière does not hide a road from the slide: it may head for it, and run into it.
  const openBoard = getOpenBoard(state);
  const outcome: SlideOutcome = { slide: [], interruptedTo: null, iceFall: null, bumps: [] };
  if (walkedPath.length === 0) return outcome;

  const crossed = new Set<NodeId>([walkFrom, ...walkedPath]);
  let previous = walkedPath.length >= 2 ? walkedPath[walkedPath.length - 2] : walkFrom;
  let current = walkedPath[walkedPath.length - 1];

  // Each step either reaches a tile without ice or a new one: the board's size bounds the slide.
  for (let guard = 0; isIce(board, current) && guard < board.nodes.length; guard += 1) {
    let next = randomChoice(getSlideChoices(openBoard, previous, current, crossed));
    if (next !== undefined && isBlockedRoad(board, current, next)) {
      outcome.bumps.push({ step: outcome.slide.length, toward: next });
      // Back on the tile, the ice tries another way; with none left, as for a dead end, it goes back. Nobody
      // stays on ice: when the barred road is the only one, the slide goes through it after all.
      next = randomChoice(getSlideChoices(board, previous, current, crossed)) ?? next;
    }
    if (next === undefined) break;
    if (iceFall && next === state.redCupNodeId) {
      const hit = drawEngineRandom() < ICE_FALL_CHANCE;
      outcome.iceFall = { from: current, to: next, hit };
      if (hit) {
        outcome.interruptedTo = next;
        return outcome;
      }
    }
    outcome.slide.push(next);
    crossed.add(next);
    previous = current;
    current = next;
  }
  return outcome;
}

/**
 * The bumps of a slide as the path of a movement tells them: the player stands on `path[slideStart - 1 + step]`
 * when the barred road stops them.
 */
export function toPathBumps(slideStart: number, bumps: SlideOutcome["bumps"]): SlideBump[] {
  return bumps.map((bump) => ({ index: slideStart - 1 + bump.step, toward: bump.toward }));
}

/** Whether falling ice holds `playerId` on the tile they stand on, until their next turn. */
export function isHeldByIce(state: GameState, playerId: PlayerId): boolean {
  const player = findPlayer(state, playerId);
  return state.frozenSlides.some((entry) => entry.playerId === playerId && entry.from === player?.position);
}

/**
 * Writes down a slide already applied to the player's position: its log line,
 * the fall of ice it met and, when the ice caught them on `stuckOn`, the slide
 * put on hold until their next turn.
 */
export function recordSlide(state: GameState, playerId: PlayerId, outcome: SlideOutcome, stuckOn: NodeId): GameState {
  const player = findPlayer(state, playerId);
  if (!player) return state;
  let nextState = state;
  const end = outcome.slide[outcome.slide.length - 1];
  if (end !== undefined) {
    nextState = addLog(nextState, `${player.name} glisse sur la glace jusqu’en case ${end}.`, "event");
  }
  for (const _bump of outcome.bumps) {
    nextState = addLog(nextState, `${player.name} glisse contre une Barrière et rebondit.`, "event");
  }
  if (outcome.iceFall) {
    const { to, hit } = outcome.iceFall;
    nextState = {
      ...nextState,
      lastIceFall: { seq: (state.lastIceFall?.seq ?? 0) + 1, playerId, ...outcome.iceFall },
    };
    nextState = addLog(
      nextState,
      hit
        ? `La glace tombe sur ${player.name}, pris au piège sur la route de la case ${to}.`
        : `La glace tombe à côté de ${player.name}, qui file vers la case ${to}.`,
      hit ? "bad" : "event",
    );
  }
  if (outcome.interruptedTo !== null) {
    nextState = {
      ...nextState,
      frozenSlides: [
        ...nextState.frozenSlides.filter((entry) => entry.playerId !== playerId),
        { playerId, from: stuckOn, to: outcome.interruptedTo },
      ],
    };
  }
  return nextState;
}

/**
 * A wheel set `playerId` down on a tile (the start, the tile they came from),
 * coming from `cameFrom`: on ice, they slide on as at the end of a walk, and
 * the caller makes them arrive where the slide stops. Falling ice is a walk's
 * hazard only: nobody set down is caught by it.
 */
export function slideOnArrival(state: GameState, playerId: PlayerId, cameFrom: NodeId): GameState {
  const player = findPlayer(state, playerId);
  if (!player || !isIce(getBoard(state), player.position)) return state;
  const outcome = drawSlide(state, cameFrom, [player.position], false);
  const end = outcome.slide[outcome.slide.length - 1] ?? player.position;
  const moved = updatePlayer(state, playerId, (current) => ({ ...current, position: end }));
  return recordSlide(moved, playerId, outcome, end);
}

/**
 * `playerId` was just set down on ice some other way than walking, coming
 * from `cameFrom`: the blizzard froze their tile, or a trip to a frozen start,
 * a swap, a pull or a step back out of the mud left them there. The ice
 * carries them away at once, so whatever follows sees them where they end up.
 * It only carries them: the tile it leaves them on is no arrival, neither
 * wheel, shop, mud nor Red Cup, and no ice falls on them.
 */
export function carryOffIce(state: GameState, playerId: PlayerId, cameFrom: NodeId): GameState {
  const player = findPlayer(state, playerId);
  if (!player || !isIce(getBoard(state), player.position) || isHeldByIce(state, playerId)) return state;
  const outcome = drawSlide(state, cameFrom, [player.position], false);
  const end = outcome.slide[outcome.slide.length - 1];
  if (end === undefined) return state;
  const moved = updatePlayer(state, playerId, (current) => ({ ...current, position: end }));
  // No arrival: a wheel still owed from an earlier visit to that tile is not spun now. A slide the ice
  // held them on earlier, before something moved them off it, is over too.
  const carried: GameState = {
    ...moved,
    pendingTileWheels: moved.pendingTileWheels.filter((entry) => entry.playerId !== playerId || entry.nodeId !== end),
    frozenSlides: moved.frozenSlides.filter((entry) => entry.playerId !== playerId),
  };
  return addLog(carried, `La glace emporte ${player.name} jusqu’en case ${end}.`, "event");
}

/**
 * A slide the ice holds is over once the player was moved off it (pulled,
 * swapped, sent to Hell): coming back to that tile later must not finish it.
 */
function forgetBrokenHolds(state: GameState): GameState {
  const held = state.frozenSlides.filter((entry) => findPlayer(state, entry.playerId)?.position === entry.from);
  return held.length === state.frozenSlides.length ? state : { ...state, frozenSlides: held };
}

/**
 * After every action, a safety net: anybody still left on ice is carried off
 * it (see `carryOffIce`), from where they stood before the action, and the
 * holds of players moved off their ice are forgotten.
 */
export function slideOffIce(before: GameState, after: GameState): GameState {
  if (!hasIce(getBoard(after))) return after;
  const carried = after.players.reduce(
    (state, player) => carryOffIce(state, player.id, findPlayer(before, player.id)?.position ?? player.position),
    after,
  );
  return forgetBrokenHolds(carried);
}

/**
 * A tile for the blizzard's ice, never under the Red Cup (one waiting to be
 * revealed included), nor on `excluded`. It may freeze a tile a player stands
 * on: the ice then carries them away at once (see `slideOffIce`).
 */
export function pickBlizzardTile(state: GameState, excluded: NodeId[] = []): NodeId | null {
  const candidates = getBlizzardCandidates(getBoard(state), [
    state.iceTileNodeId,
    state.redCupNodeId,
    state.pendingCupRevealNodeId,
    ...excluded,
  ]);
  return randomChoice(candidates) ?? null;
}

/** Whether the board has a blizzard due at the start of `round`: every few rounds after the first. */
export function isBlizzardRound(state: GameState, round: number): boolean {
  const every = getBoard(state).map.blizzardEveryRounds;
  return every !== undefined && round > 1 && (round - 1) % every === 0;
}

/** The blizzard melts the old temporary ice and freezes a new tile somewhere else. */
export function blowBlizzard(state: GameState): GameState {
  const previousTile = state.iceTileNodeId;
  const nextTile = pickBlizzardTile(state);
  const nextState: GameState = {
    ...state,
    iceTileNodeId: nextTile,
    lastBlizzard: { seq: (state.lastBlizzard?.seq ?? 0) + 1, from: previousTile, to: nextTile },
  };
  const melted = previousTile === null ? "" : ` (la glace de la case ${previousTile} a fondu)`;
  const text =
    nextTile === null
      ? "Blizzard ! Aucune case ne gèle."
      : `Blizzard ! La case ${nextTile} devient glissante${melted}.`;
  // Whoever stands on the tile it froze slides off at once, before the round goes on.
  return state.players
    .filter((player) => player.position === nextTile)
    .reduce((current, player) => carryOffIce(current, player.id, player.position), addLog(nextState, text, "event"));
}
