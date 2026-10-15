import { ownsCard } from "./cards";
import { isHidden, isNearRedCup } from "./mist";
import { addOpenLog, findPlayer, getActivePlayer, updatePlayer } from "./state-utils";
import type { GameState, Player, PlayerId } from "./types";
import { HELL_NODE_ID, MIST_COOLDOWN_ROUNDS, MIST_HIDDEN_TURNS } from "./types";

/**
 * A turn of the player begins, played or skipped: their invisibility, if any, loses a turn, and the table is told
 * when they show again.
 */
export function advanceMist(state: GameState, playerId: PlayerId): GameState {
  const player = findPlayer(state, playerId);
  if (!player || !isHidden(player)) return state;
  const left = (player.hiddenTurns ?? 0) - 1;
  const nextState = updatePlayer(state, playerId, (current) => {
    const { hiddenTurns: _spent, ...visible } = current;
    return left > 0 ? { ...current, hiddenTurns: left } : visible;
  });
  return left > 0 ? nextState : addOpenLog(nextState, `${player.name} redevient visible.`);
}

/**
 * Puts the player under an invisibility for `turns` of their own turns, the one in progress included. A longer one
 * already running is kept, and the table is told.
 */
export function hidePlayer(state: GameState, playerId: PlayerId, turns: number): GameState {
  const player = findPlayer(state, playerId);
  if (!player) return state;
  const nextState = updatePlayer(state, playerId, (current) => ({
    ...current,
    hiddenTurns: Math.max(current.hiddenTurns ?? 0, turns),
  }));
  return addOpenLog(nextState, `${player.name} devient invisible pour ${turns === 1 ? "un tour" : `${turns} tours`}.`);
}

/**
 * Whether the active Mi-vu, Mi-vue may disappear now (patch 0.2.5): before their move, once every
 * `MIST_COOLDOWN_ROUNDS` rounds, not already hidden, and far enough from the Red Cup for the invisibility to hold.
 */
export function canVanish(state: GameState, player: Player | undefined): player is Player {
  return (
    player !== undefined &&
    state.phase === "playing" &&
    getActivePlayer(state)?.id === player.id &&
    ownsCard(player, "half-seen") &&
    (state.turnStage === "move" || state.turnStage === "hell") &&
    state.diceRoll === null &&
    state.moveDistance === 1 &&
    !isHidden(player) &&
    state.round >= (player.vanishReadyRound ?? 0) &&
    (player.position === HELL_NODE_ID || !isNearRedCup(state, player))
  );
}

/** Disparaître: the active Mi-vu, Mi-vue is invisible for `MIST_HIDDEN_TURNS` turns; the power is then away for a while. */
export function vanish(state: GameState): GameState {
  const player = getActivePlayer(state);
  if (!canVanish(state, player)) return state;
  const hidden = hidePlayer(state, player.id, MIST_HIDDEN_TURNS);
  return updatePlayer(hidden, player.id, (current) => ({
    ...current,
    vanishReadyRound: state.round + MIST_COOLDOWN_ROUNDS,
  }));
}
