import { hasCard } from "./cards";
import { HELL_REGULAR_REWARD } from "./passive-rules";
import { addLog, applyCurrencyChange, findPlayer } from "./state-utils";
import type { GameState } from "./types";
import { HELL_NODE_ID } from "./types";

/**
 * The Habitué de l'Enfer is paid every time they step into Hell, whatever
 * sent them there. Like le diable's reward, it compares the positions of two
 * states, so every road into Hell is covered; a descent a Parachute cancelled
 * leaves them where they were and pays nothing.
 */
export function rewardHellRegulars(before: GameState, after: GameState): GameState {
  let nextState = after;
  for (const player of after.players) {
    const previous = findPlayer(before, player.id);
    if (!previous || !hasCard(player, "hell-regular")) continue;
    if (player.position !== HELL_NODE_ID || previous.position === HELL_NODE_ID) continue;
    nextState = applyCurrencyChange(nextState, player.id, HELL_REGULAR_REWARD);
    nextState = addLog(nextState, `${player.name} est chez lui en Enfer : +${HELL_REGULAR_REWARD} pièces.`, "good");
  }
  return nextState;
}
