import { getStartingCurrency, isMalefactor } from "./passive-rules";
import { addLog, findPlayer, getActivePlayer, placeInHell, randomChoice, updatePlayer } from "./state-utils";
import type { GameState, Player } from "./types";
import { HELL_NODE_ID, RESCUE_SKIPPED_TURNS } from "./types";

/**
 * L'Ange-Gardien (patch 0.1.4): protects a player drawn at the start, known to
 * the whole table, and wins along with them. Every function is pure.
 */

export function findAngel(state: GameState): Player | undefined {
  return state.players.find((player) => player.passiveId === "guardian-angel");
}

/**
 * Draws the protégé among the players who are no malefactor (le diable, the
 * Voleur, the Goblin, the Corrupteur). With nobody to protect, the angel
 * becomes Lambda.
 */
export function assignGuardian(state: GameState): GameState {
  const angel = findAngel(state);
  if (!angel) return state.guardian ? { ...state, guardian: null } : state;
  const protege = randomChoice(state.players.filter((player) => player.id !== angel.id && !isMalefactor(player)));
  if (!protege) {
    const lambda = updatePlayer(state, angel.id, (player) => ({
      ...player,
      passiveId: "lambda",
      currency: getStartingCurrency("lambda"),
    }));
    return addLog({ ...lambda, guardian: null }, `${angel.name} n’a personne à protéger : il sera Lambda.`, "event");
  }
  const nextState: GameState = { ...state, guardian: { angelId: angel.id, protegeId: protege.id } };
  return addLog(nextState, `${angel.name} est l’Ange-Gardien de ${protege.name}.`, "event");
}

/** Whether the active angel may pull their protégé out of Hell now. */
export function canRescueProtege(state: GameState): boolean {
  const angel = getActivePlayer(state);
  const protege = findPlayer(state, state.guardian?.protegeId);
  return (
    state.phase === "playing" &&
    state.turnStage === "move" &&
    angel !== undefined &&
    angel.id === state.guardian?.angelId &&
    protege?.position === HELL_NODE_ID
  );
}

/**
 * The angel gives up their next two turns to bring the protégé out of Hell,
 * onto the angel's own tile, without any effect of that tile. Their turn goes on.
 */
export function rescueProtege(state: GameState): GameState {
  if (!canRescueProtege(state)) return state;
  const angel = getActivePlayer(state)!;
  const protege = findPlayer(state, state.guardian?.protegeId)!;
  let nextState = updatePlayer(state, protege.id, (player) => ({ ...player, position: angel.position, hellTurns: 0 }));
  nextState = updatePlayer(nextState, angel.id, (player) => ({
    ...player,
    skippedTurns: player.skippedTurns + RESCUE_SKIPPED_TURNS,
  }));
  return addLog(
    { ...nextState, turnActionTaken: true },
    `${angel.name} sacrifie ses ${RESCUE_SKIPPED_TURNS} prochains tours pour tirer ${protege.name} de l’Enfer.`,
    "good",
  );
}

/**
 * The protégé left the game: the angel takes their place, with their passive,
 * bag, Red Cups and coins, but starts over in Hell. The angel leaving frees
 * the protégé of them.
 */
export function replaceLeavingProtege(state: GameState, leaver: Player): GameState {
  const guardian = state.guardian;
  if (!guardian) return state;
  if (guardian.angelId === leaver.id) return { ...state, guardian: null };
  const angel = findPlayer(state, guardian.angelId);
  if (guardian.protegeId !== leaver.id || !angel) return state;

  const heir: Player = placeInHell({
    ...angel,
    passiveId: leaver.passiveId,
    inventory: leaver.inventory,
    currency: leaver.currency,
    noThanksReadyRound: leaver.noThanksReadyRound,
  });
  const nextState: GameState = {
    ...state,
    guardian: null,
    players: state.players.map((player) => (player.id === angel.id ? heir : player)),
  };
  return addLog(nextState, `${angel.name} reprend la place de ${leaver.name}, mais depuis l’Enfer.`, "event");
}
