import type { GameLogEntry, NodeId, PlayerId } from "../game/types";

/**
 * Presentation events derived from game state changes. The scene, the HUD
 * and the audio engine react to them without knowing about each other.
 */
export type FeedbackEvent =
  | { type: "turn-start"; playerId: PlayerId }
  | { type: "currency"; playerId: PlayerId; delta: number }
  | { type: "cup-collected"; playerId: PlayerId; nodeId: NodeId }
  | { type: "cup-spawned"; nodeId: NodeId }
  | { type: "shop-opened"; playerId: PlayerId }
  | { type: "purchase"; playerId: PlayerId }
  | { type: "hell-entered"; playerId: PlayerId }
  | { type: "hell-escaped"; playerId: PlayerId }
  | { type: "teleport"; playerId: PlayerId }
  | { type: "duel-started" }
  | { type: "mud-placed"; nodeId: NodeId }
  | { type: "mud-triggered"; nodeId: NodeId }
  | { type: "bullet-spawned" }
  | { type: "bullet-hit"; playerId: PlayerId }
  | { type: "turn-skipped" }
  | { type: "item-used" }
  | { type: "victory"; playerId: PlayerId }
  | { type: "log"; entry: GameLogEntry }
  | { type: "pawn-hop" }
  | { type: "pawn-tunnel" };

type Listener = (event: FeedbackEvent) => void;

const listeners = new Set<Listener>();

export function emitFeedback(event: FeedbackEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("A feedback listener failed.", error);
    }
  }
}

export function onFeedback(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
