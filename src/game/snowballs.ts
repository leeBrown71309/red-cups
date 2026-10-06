import { drawEngineRandom } from "./engine-random";
import { getBoardMap } from "./maps/map-registry";
import { addLog, findPlayer, loseTurns, randomChoice, updatePlayer } from "./state-utils";
import type { GameState, PlayerId } from "./types";
import { HELL_NODE_ID, SNOWBALL_HIT_CHANCE, SNOWBALL_HITS_TO_FREEZE } from "./types";

/**
 * Banquise's penguins wake up once somebody took a Red Cup: at every turn
 * change they throw a snowball at a player drawn at random. One in three
 * misses. Three hits and the target freezes solid, losing their next turn,
 * then starts counting again from zero. Nobody in Hell (out of reach, down
 * the crevasse) or already stuck in ice is aimed at.
 */

export function areSnowballsFlying(state: GameState): boolean {
  return getBoardMap(state.mapId).snowballs === true && state.redCupCycle > 0 && state.phase === "playing";
}

function canBeAimedAt(state: GameState, playerId: PlayerId): boolean {
  const player = state.players.find((candidate) => candidate.id === playerId);
  return (
    player !== undefined &&
    player.position !== HELL_NODE_ID &&
    !state.snowFrozenPlayerIds.includes(playerId) &&
    !state.frozenSlides.some((entry) => entry.playerId === playerId)
  );
}

export function throwSnowball(state: GameState): GameState {
  if (!areSnowballsFlying(state)) return state;
  const target = randomChoice(state.players.filter((player) => canBeAimedAt(state, player.id)));
  if (!target) return state;

  const hit = drawEngineRandom() < SNOWBALL_HIT_CHANCE;
  const hits = (state.snowballHits[target.id] ?? 0) + (hit ? 1 : 0);
  const frozen = hits >= SNOWBALL_HITS_TO_FREEZE;
  let nextState: GameState = {
    ...state,
    snowballHits: { ...state.snowballHits, [target.id]: frozen ? 0 : hits },
    lastSnowball: { seq: (state.lastSnowball?.seq ?? 0) + 1, targetId: target.id, hit, frozen },
  };

  if (!hit) return addLog(nextState, `Un pingouin lance une boule de neige sur ${target.name}… raté !`);
  if (!frozen) {
    return addLog(
      nextState,
      `Un pingouin touche ${target.name} avec une boule de neige (${hits}/${SNOWBALL_HITS_TO_FREEZE}).`,
      "event",
    );
  }
  const frozenTurns = findPlayer(nextState, target.id)?.skippedTurns ?? 0;
  nextState = updatePlayer(nextState, target.id, (player) => loseTurns(player));
  // A Réveil woke them: no lost turn, so no ice to melt later.
  if ((findPlayer(nextState, target.id)?.skippedTurns ?? 0) === frozenTurns) {
    return addLog(nextState, `Troisième boule de neige : ${target.name} se réveille à temps.`, "good");
  }
  nextState = { ...nextState, snowFrozenPlayerIds: [...nextState.snowFrozenPlayerIds, target.id] };
  return addLog(nextState, `Troisième boule de neige : ${target.name} est gelé et passera son prochain tour !`, "bad");
}

/** The turn a frozen player loses is over: the ice melts away. */
export function thawSnowFrozen(state: GameState, playerId: PlayerId): GameState {
  if (!state.snowFrozenPlayerIds.includes(playerId)) return state;
  const name = state.players.find((player) => player.id === playerId)?.name ?? "";
  const nextState = { ...state, snowFrozenPlayerIds: state.snowFrozenPlayerIds.filter((id) => id !== playerId) };
  return addLog(nextState, `${name} se dégèle.`, "event");
}
