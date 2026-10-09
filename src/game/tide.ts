import type { BoardMap, CausewayConfig, CausewayOpening } from "./maps/map-types";
import type { NodeId } from "./types";
import { FIRST_ROUND, STORM_ROUNDS, TIDE_ROUNDS } from "./types";

/**
 * Archipel des Marées: the tide is a pure function of the round, so nothing is stored for it and every device
 * agrees. Rounds 1 and 2 are at low tide, 3 and 4 at high tide, and so on.
 */
export type TideLevel = "low" | "high";

export function getTideLevel(round: number): TideLevel {
  return Math.floor((Math.max(round, FIRST_ROUND) - FIRST_ROUND) / TIDE_ROUNDS) % 2 === 0 ? "low" : "high";
}

/** Rounds left, this one included, before the tide turns: 1 means it turns when the next round opens. */
export function getRoundsUntilTideTurns(round: number): number {
  return TIDE_ROUNDS - ((Math.max(round, FIRST_ROUND) - FIRST_ROUND) % TIDE_ROUNDS);
}

export function isOpenAt(opensAt: CausewayOpening, level: TideLevel): boolean {
  return opensAt === "always" || opensAt === level;
}

/** The causeways of the map that are under water at `round`; none on a map without tide. */
export function getDrownedCauseways(map: BoardMap, round: number): CausewayConfig[] {
  const level = getTideLevel(round);
  return (map.tidal?.causeways ?? []).filter((causeway) => !isOpenAt(causeway.opensAt, level));
}

/** Désert: which of the two sets of passes is shut by the sandstorm at `round` (the storm changes every few rounds). */
export function getStormPhase(round: number): number {
  return Math.floor((Math.max(round, FIRST_ROUND) - FIRST_ROUND) / STORM_ROUNDS) % 2;
}

/** Désert: rounds left, this one included, before the sandstorm shifts: 1 means it shifts when the next round opens. */
export function getRoundsUntilStorm(round: number): number {
  return STORM_ROUNDS - ((Math.max(round, FIRST_ROUND) - FIRST_ROUND) % STORM_ROUNDS);
}

/** The passes the sandstorm has shut at `round`; none on a map without storms. */
export function getClosedPasses(map: BoardMap, round: number): NodeId[] {
  const phases = map.desert?.stormPhases;
  return phases ? (phases[getStormPhase(round)] ?? []) : [];
}

/**
 * The tiles nobody can stand on or walk through at `round`: the causeways the tide has drowned (Archipel) and the
 * passes a sandstorm has shut (Désert).
 */
export function getFloodedNodeIds(map: BoardMap, round: number): NodeId[] {
  return [...getDrownedCauseways(map, round).flatMap((causeway) => causeway.nodes), ...getClosedPasses(map, round)];
}

/** The quay the ferry moors at after `quayId`; the circuit closes on itself. */
export function getNextFerryQuay(map: BoardMap, quayId: NodeId): NodeId | null {
  const quays = map.tidal?.ferryQuays ?? [];
  const index = quays.indexOf(quayId);
  return index < 0 ? null : quays[(index + 1) % quays.length];
}
