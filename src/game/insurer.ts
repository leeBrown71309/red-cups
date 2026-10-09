import { hasCard } from "./cards";
import { addLog, applyCurrencyChange, findPlayer } from "./state-utils";
import type { GameState } from "./types";
import { HELL_NODE_ID, INSURER_HELL_REWARD } from "./types";

/**
 * L'Assureur (patch 0.2.3): every other player who falls into Hell between two states pays the insurer a flat
 * reward, from the bank. The share of lost coins is paid where the coins are lost (`applyCurrencyChange`).
 */
export function rewardInsurerInHell(before: GameState, after: GameState): GameState {
  const insurer = after.players.find((player) => hasCard(player, "insurer"));
  if (!insurer) return after;
  let nextState = after;
  for (const player of after.players) {
    const previous = findPlayer(before, player.id);
    if (player.id === insurer.id || !previous) continue;
    if (player.position !== HELL_NODE_ID || previous.position === HELL_NODE_ID) continue;
    nextState = applyCurrencyChange(nextState, insurer.id, INSURER_HELL_REWARD, { gamble: false, silent: true });
    nextState = addLog(
      nextState,
      `${player.name} descend en Enfer : ${insurer.name} touche ${INSURER_HELL_REWARD} pièces de la banque.`,
      "good",
    );
  }
  return nextState;
}
