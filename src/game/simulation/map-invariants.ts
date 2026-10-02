import { getBoard, isIce } from "../board";
import type { GameState } from "../types";
import { violation, type RuleViolation } from "./invariant-helpers";

/**
 * Map rules that every feature must respect, whatever moved the player: the
 * checks hold on the three boards, so a new item, wheel or passive that
 * forgets a map's mechanic shows up on that map's campaign.
 */

/**
 * Banquise: nobody stands on ice. Whatever set a player down there (a walk, a
 * wheel, a pull, a swap, a trip to a frozen start) slides them on; only a
 * player caught by falling ice waits on it, halfway down the road.
 */
export function checkMapState(state: GameState, found: RuleViolation[]): void {
  const board = getBoard(state);
  for (const player of state.players) {
    if (!isIce(board, player.position)) continue;
    const stuck = state.frozenSlides.some((entry) => entry.playerId === player.id && entry.from === player.position);
    if (!stuck) found.push(violation("no-rest-on-ice", `${player.name} stands on the ice of tile ${player.position}`));
  }
}

/**
 * Names the action that left a player on ice, and checks le diable's Portail
 * only opens where a player can stop: never on ice, which nobody stops on.
 */
export function checkMapTransition(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const board = getBoard(next);
  for (const player of next.players) {
    const before = previous.players.find((candidate) => candidate.id === player.id);
    const stuck = next.frozenSlides.some((entry) => entry.playerId === player.id && entry.from === player.position);
    if (!isIce(board, player.position) || stuck) continue;
    if (before?.position !== player.position) {
      found.push(violation("lands-on-ice", `${player.name} was left on the ice of tile ${player.position}`));
    } else if (!isIce(getBoard(previous), player.position)) {
      found.push(violation("ice-under-player", `tile ${player.position} froze under ${player.name}`));
    }
  }
  for (const portal of next.hellPortals) {
    if (previous.hellPortals.some((candidate) => candidate.id === portal.id)) continue;
    if (isIce(board, portal.nodeId)) {
      found.push(violation("portal-on-ice", `a Portail opened on the ice of tile ${portal.nodeId}`));
    }
  }
}
