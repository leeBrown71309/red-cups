import { hasCard } from "./cards";
import { createDuel, drawGhostShots, drawTwoDuelModes, DUEL_MODE_LOG_NAMES } from "./duel-setup";
import { addLog, findPlayer } from "./state-utils";
import type { DuelMode, GameState, GhostStakes, PlayerId, TurnStage } from "./types";

/**
 * Meneur de jeu: in a duel they take part in, two mini-games are drawn and
 * they pick the one played. Everyone else's duels draw their game as before.
 */

/** The duellist who holds Meneur de jeu, the first one if both do. */
export function findGameMaster(state: GameState, playerIds: PlayerId[]): PlayerId | undefined {
  return playerIds.find((playerId) => hasCard(findPlayer(state, playerId), "game-master"));
}

/** Draws the two games and waits for the Meneur de jeu to pick. */
export function openDuelChoice(
  state: GameState,
  duellistIds: [PlayerId, PlayerId],
  chooserId: PlayerId,
  resumeStage: TurnStage,
  hasVoters: boolean,
  ghost: GhostStakes | null = null,
): GameState {
  const chooser = findPlayer(state, chooserId);
  const modes = drawTwoDuelModes(hasVoters);
  const nextState: GameState = {
    ...state,
    pendingDuelChoice: {
      playerOneId: duellistIds[0],
      playerTwoId: duellistIds[1],
      modes,
      chooserId,
      resumeStage,
      ghost,
    },
    turnStage: "duel-choice",
    duelResumeStage: resumeStage,
  };
  const names = modes.map((mode) => DUEL_MODE_LOG_NAMES[mode]).join(" ou ");
  return addLog(nextState, `${chooser?.name ?? "Le meneur de jeu"} choisit le mini-jeu du duel : ${names}.`, "event");
}

/** The Meneur de jeu picked: the duel starts with that game. */
export function chooseDuelMode(state: GameState, mode: DuelMode): GameState {
  const choice = state.pendingDuelChoice;
  if (state.turnStage !== "duel-choice" || !choice || !choice.modes.includes(mode)) return state;
  const duel = createDuel(choice.playerOneId, choice.playerTwoId, mode, choice.resumeStage);
  const nextState: GameState = {
    ...state,
    pendingDuelChoice: null,
    pendingDuel: choice.ghost
      ? {
          ...duel,
          basket: duel.basket && { ...duel.basket, ghostShots: drawGhostShots() },
          ghost: choice.ghost,
        }
      : duel,
    turnStage: "duel",
    duelResumeStage: choice.resumeStage,
  };
  const chooser = findPlayer(state, choice.chooserId);
  return addLog(nextState, `${chooser?.name ?? "Le meneur de jeu"} a choisi : ${DUEL_MODE_LOG_NAMES[mode]}.`, "event");
}
