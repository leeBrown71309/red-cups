import { findEdge, type Board } from "../game/board";
import type { NodeId, PlayerMovement } from "../game/types";

/** Duration of one pawn hop between two neighbouring tiles. */
export const HOP_MS = 360;

/** Extra time spent disappearing in and popping out of the tunnel. */
export const TUNNEL_EXTRA_MS = 560;

/** Banquise: the spin on the ice before a slide sets off, then one tile of gliding. */
export const WOBBLE_MS = 280;
/** A pawn sliding into a Barrière: the lunge, the knock and the rebound. */
export const BUMP_MS = 620;
export const GLIDE_MS = 440;

/** Banquise: falling ice lands and closes around a pawn; later, the pawn bursts out of it. */
export const FREEZE_MS = 1_100;
export const SHATTER_MS = 450;

/** Banquise: a penguin's snowball in the air. */
export const SNOWBALL_FLIGHT_MS = 700;

/** A Tomate's flight from the thrower to the target. */
export const TOMATO_FLIGHT_MS = 560;
/** Between two Tomates of a volley: a quick rapid fire. */
export const TOMATO_VOLLEY_GAP_MS = 150;

/** Luna Park: the ghost drifting from one tile to the next. */
export const GHOST_DRIFT_STEP_MS = 620;
/** Luna Park: the ghost fading out on one tile and back in on another. */
export const GHOST_TELEPORT_MS = 1_400;

/** Luna Park: the ghost winds up and slaps its victim. */
export const GHOST_SLAP_MS = 650;
/** Luna Park: when, within the slap, the ghost's hand lands; the scene and the sound meet there. */
export const GHOST_SLAP_IMPACT_MS = 430;
/** Luna Park: the ghost carries its victim through the air down into Hell. */
export const GHOST_CARRY_MS = 1_300;

/** Portail: the swirl widens across the tile and swallows the pawn standing on it. */
export const PORTAL_SWALLOW_MS = 900;
/** Hell: a portal opens and the pawn drops through it onto the Hell floor. */
export const HELL_DROP_MS = 700;

/** Pause after a Red Cup pickup before modals open, so the celebration reads. */
export const CUP_CELEBRATION_MS = 900;

/** How long a table-wide banner (Bullet Bill, Bénédiction, carousel) stays on screen. */
export const ALERT_BANNER_MS = 3_400;

/** Bullet Bill revs up on its tile before charging, so the whole table looks at it. */
export const BULLET_WINDUP_MS = 700;

/** One tile of Bullet Bill's charge. */
export const BULLET_HOP_MS = 560;

/** Time to take in the explosion before the next turn is announced. */
export const BULLET_IMPACT_PAUSE_MS = 1_400;

/** Short beat after a charge that hit nobody. */
export const BULLET_LANDING_PAUSE_MS = 400;

/** From the first rev of the engine to the impact (or the landing). */
export function estimateBulletFlightMs(path: NodeId[]): number {
  return BULLET_WINDUP_MS + path.length * BULLET_HOP_MS;
}

/**
 * Game rules resolve instantly, while the board animates. The HUD uses this
 * estimate to delay modals and feedback until the pawn has landed.
 */
export function estimateMovementMs(
  board: Board,
  movement: Pick<PlayerMovement, "from" | "path"> & Partial<PlayerMovement>,
): number {
  if (movement.thawed) {
    return SHATTER_MS + GLIDE_MS + (movement.portalNodeId !== undefined ? PORTAL_SWALLOW_MS + HELL_DROP_MS : 0);
  }
  if (movement.flungByGhost) return GHOST_SLAP_MS + GHOST_CARRY_MS;
  const slideStart = movement.slideStart ?? movement.path.length;
  let total = 0;
  let previous = movement.from;

  movement.path.forEach((nodeId: NodeId, index) => {
    if (index >= slideStart) {
      total += WOBBLE_MS + GLIDE_MS;
    } else {
      total += HOP_MS;
      if (findEdge(board, previous, nodeId)?.kind === "tunnel") total += HOP_MS + TUNNEL_EXTRA_MS;
    }
    previous = nodeId;
  });

  total += (movement.bumps?.length ?? 0) * BUMP_MS;
  if (movement.interruptedTo !== undefined) total += WOBBLE_MS + GLIDE_MS / 2;
  // A Portail at the walk's end: the pawn lands on the tile, is swallowed, then drops into Hell.
  if (movement.portalNodeId !== undefined) total += PORTAL_SWALLOW_MS + HELL_DROP_MS;
  return total;
}
