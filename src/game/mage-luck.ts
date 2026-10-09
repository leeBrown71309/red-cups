import { ownsCard } from "./cards";
import { addOpenLog, updatePlayer } from "./state-utils";
import type { GameState, Player } from "./types";
import { MAGE_LUCK_RETURN_ROUNDS, MAGE_MAX_LUCK } from "./types";

/**
 * Mage noir (patch 0.2.3): a mage starts with three chances, spends one for every teleport and wins one back every
 * fifteen rounds. At zero, the game is over for them.
 */

/** The chances a mage has left; a mage whose count was never written holds all of them. */
export function getLuck(player: Pick<Player, "luck">): number {
  return player.luck ?? MAGE_MAX_LUCK;
}

/**
 * Spends one chance. The clock of the next one starts with the first spent, and keeps running while the mage is
 * missing any.
 */
export function spendLuck(player: Player, round: number): Player {
  const luck = getLuck(player) - 1;
  if (getLuck(player) < MAGE_MAX_LUCK && player.luckReturnRound !== undefined) return { ...player, luck };
  return { ...player, luck, luckReturnRound: round + MAGE_LUCK_RETURN_ROUNDS };
}

/** As a round begins, every mage who waited long enough gets a chance back. */
export function regainMageLuck(state: GameState, round: number): GameState {
  let nextState = state;
  for (const mage of state.players) {
    if (!ownsCard(mage, "black-mage") || getLuck(mage) >= MAGE_MAX_LUCK) continue;
    if (round < (mage.luckReturnRound ?? round)) continue;
    const luck = getLuck(mage) + 1;
    nextState = updatePlayer(nextState, mage.id, (current) => {
      const { luckReturnRound: _due, ...rest } = current;
      return luck >= MAGE_MAX_LUCK
        ? { ...rest, luck }
        : { ...rest, luck, luckReturnRound: round + MAGE_LUCK_RETURN_ROUNDS };
    });
    nextState = addOpenLog(nextState, `${mage.name} regagne un pentagramme (${luck}/${MAGE_MAX_LUCK}).`, "good");
  }
  return nextState;
}
