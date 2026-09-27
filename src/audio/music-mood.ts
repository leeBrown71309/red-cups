import { HELL_NODE_ID, type GameState } from "../game/types";

export type MusicMood = "calm" | "tense";

type MoodState = Pick<GameState, "phase" | "players" | "activePlayerIndex" | "pendingDuel">;

/**
 * The music darkens while the player whose turn it is sits in Hell, or while
 * a duel is pending. Hell has the same id on every map, so each soundtrack
 * switches to its tense mood the same way.
 */
export function getMusicMood(state: MoodState): MusicMood {
  if (state.phase !== "playing") return "calm";
  const activePlayer = state.players[state.activePlayerIndex];
  return activePlayer?.position === HELL_NODE_ID || state.pendingDuel !== null ? "tense" : "calm";
}
