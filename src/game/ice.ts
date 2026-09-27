import { getBlizzardCandidates, getBoard, getSlideExits, isIce } from "./board";
import { drawEngineRandom } from "./engine-random";
import { addLog, randomChoice } from "./state-utils";
import type { GameState, NodeId } from "./types";
import { ICE_FALL_CHANCE } from "./types";

/**
 * Banquise rules that need luck: where a slide goes, whether ice falls on a
 * player sliding towards the Red Cup, and where the blizzard lays its ice.
 * Luck goes through the engine source, so online devices all draw the same.
 */

export interface SlideOutcome {
  /** Tiles slid on after the walk, in order; empty when the walk did not end on ice. */
  slide: NodeId[];
  /** Set when falling ice stopped the slide on its way to this tile. */
  interruptedTo: NodeId | null;
  /** The fall of ice, hit or missed, when the slide headed for the Red Cup. */
  iceFall: { from: NodeId; to: NodeId; hit: boolean } | null;
}

/**
 * A walk that ends on ice slides on, one random road at a time, until it
 * reaches a tile without ice. It never goes back the way it came nor loops
 * over a tile it already crossed. Sliding towards the Red Cup, the player may
 * be caught by falling ice and stop halfway.
 */
export function drawSlide(state: GameState, walkFrom: NodeId, walkedPath: NodeId[]): SlideOutcome {
  const board = getBoard(state);
  const outcome: SlideOutcome = { slide: [], interruptedTo: null, iceFall: null };
  if (walkedPath.length === 0) return outcome;

  const visited = new Set<NodeId>([walkFrom, ...walkedPath]);
  let previous = walkedPath.length >= 2 ? walkedPath[walkedPath.length - 2] : walkFrom;
  let current = walkedPath[walkedPath.length - 1];

  while (isIce(board, current)) {
    const next = randomChoice(getSlideExits(board, previous, current).filter((nodeId) => !visited.has(nodeId)));
    if (next === undefined) break;
    if (next === state.redCupNodeId) {
      const hit = drawEngineRandom() < ICE_FALL_CHANCE;
      outcome.iceFall = { from: current, to: next, hit };
      if (hit) {
        outcome.interruptedTo = next;
        return outcome;
      }
    }
    outcome.slide.push(next);
    visited.add(next);
    previous = current;
    current = next;
  }
  return outcome;
}

/** A tile for the blizzard's ice, never under the Red Cup (one waiting to be revealed included). */
export function pickBlizzardTile(state: GameState): NodeId | null {
  const candidates = getBlizzardCandidates(getBoard(state), [
    state.iceTileNodeId,
    state.redCupNodeId,
    state.pendingCupRevealNodeId,
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
  return addLog(nextState, text, "event");
}
