import type { BulletFlight, GameLogEntry, NodeId, PlayerId, PowerEvent } from "../game/types";

/**
 * Presentation events derived from game state changes. The scene, the HUD
 * and the audio engine react to them without knowing about each other.
 */
export type FeedbackEvent =
  | { type: "turn-start"; playerId: PlayerId }
  /** `purchase` marks the price paid in the shop, which has its own sound. */
  | { type: "currency"; playerId: PlayerId; delta: number; purchase: boolean }
  | { type: "cup-collected"; playerId: PlayerId; nodeId: NodeId }
  | { type: "cup-spawned"; nodeId: NodeId }
  /** Roller: the throws made for the Red Cup, shown to the whole table, then announced on the banner. */
  | { type: "cup-roll"; playerId: PlayerId; rolls: number[]; success: boolean }
  | { type: "shop-opened"; playerId: PlayerId }
  | { type: "purchase"; playerId: PlayerId }
  | { type: "hell-entered"; playerId: PlayerId }
  | { type: "hell-escaped"; playerId: PlayerId }
  | { type: "teleport"; playerId: PlayerId }
  | { type: "duel-started" }
  /** Double or nothing: the coin flip of a gamble, shown to the whole table. */
  | { type: "gamble-result"; playerId: PlayerId; doubled: boolean }
  | { type: "mud-placed"; nodeId: NodeId }
  | { type: "mud-triggered"; nodeId: NodeId }
  | { type: "bullet-launched" }
  | { type: "bullet-flight"; flight: BulletFlight }
  | { type: "bullet-hit"; playerId: PlayerId; nodeId: NodeId }
  | { type: "blessing-started" }
  | { type: "doomsday-started" }
  /** Online: the player whose turn starts has one chance left before a forfeit. */
  | { type: "last-chance"; playerId: PlayerId }
  | { type: "black-cup-cast" }
  | { type: "carousel-flipped"; reversed: boolean }
  | { type: "player-left"; playerId: PlayerId }
  | { type: "turn-skipped" }
  | { type: "item-used" }
  | { type: "reaction-opened" }
  | { type: "action-cancelled" }
  | { type: "victory"; playerId: PlayerId }
  | { type: "log"; entry: GameLogEntry }
  | { type: "pawn-hop" }
  | { type: "pawn-tunnel" }
  | { type: "pawn-slide" }
  /** Portail: the pawn landed on the tile and the portal is swallowing it whole. */
  | { type: "portal-swallowed"; nodeId: NodeId }
  /** Portail: a portal opens on the Hell side for the pawn to drop through. */
  | { type: "hell-portal-open" }
  /** Banquise: a slide ran into a Barrière on the road between two tiles and bounced back. */
  | { type: "barrier-bump"; from: NodeId; toward: NodeId }
  | { type: "ice-shatter"; playerId: PlayerId }
  | { type: "ice-fall"; playerId: PlayerId; from: NodeId; to: NodeId; hit: boolean }
  | { type: "blizzard"; from: NodeId | null; to: NodeId | null }
  /** Luna Park: the ghost shows up on a carousel tile. */
  | { type: "ghost-appeared"; nodeId: NodeId }
  /** Luna Park: the ghost drifts one to three tiles along the roads, whichever way they run. */
  | { type: "ghost-moved"; from: NodeId; to: NodeId; path: NodeId[] }
  /** Luna Park: the ghost vanishes and reappears somewhere else on the board. */
  | { type: "ghost-teleported"; from: NodeId; to: NodeId }
  /** Luna Park: the ghost pounces on a player: a duel follows. */
  | { type: "ghost-attack"; playerId: PlayerId; nodeId: NodeId }
  /** Luna Park: beaten, the ghost fades away for a few rounds. */
  | { type: "ghost-vanished"; nodeId: NodeId | null }
  /** Luna Park: the ghost slaps a player and carries them off to Hell. */
  | { type: "ghost-flung"; playerId: PlayerId; from: NodeId }
  /** Banquise: a penguin throws a snowball at a player; the third hit freezes them. */
  | { type: "snowball-thrown"; targetId: PlayerId; hit: boolean; frozen: boolean }
  /** A volley of Tomates flies from one player to another; `stunned` when one knocked the target out. */
  | { type: "tomato-thrown"; throwerId: PlayerId; targetId: PlayerId; count: number; stunned: boolean }
  /** Luna Park: the ghost won and took coins or an item. */
  | { type: "ghost-stole"; playerId: PlayerId }
  /** Patch 0.2.3: the last deed of a Cups Power (a copy, a tunnel, a pentagram, a swap...), as the engine recorded it. */
  | { type: "power"; event: PowerEvent }
  /** Mi-vu, Mi-vue: the player is no longer seen (`hidden`), or shows again, whatever the reason. */
  | { type: "invisibility"; playerId: PlayerId; hidden: boolean };

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
