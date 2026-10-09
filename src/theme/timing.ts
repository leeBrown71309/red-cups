import { findEdge, type Board } from "../game/board";
import type { NodeId, PlayerMovement, PowerEvent } from "../game/types";

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

/** Chance aveugle: a beat standing in the mud, then the skid that throws them back a tile. */
export const MUD_SLIP_MS = 1_000;

/** Taupe: the pawn digs down in a burst of dirt, then pops out of the ground at the other end of the tunnel. */
export const TUNNEL_DIVE_MS = 750;
export const TUNNEL_POP_MS = 650;

/** Mage noir: the pentagram draws itself on the tile under the mage. */
export const MARK_DRAW_MS = 1_100;
/** Mage noir: the mage is sucked into a dark vortex and lands on their pentagram. */
export const MARK_TELEPORT_MS = 1_700;
/** Mage noir: what the pentagram does to players left on it (a column of flame), after the landing. */
export const MARK_VICTIM_MS = 900;
/** Mage noir: the last chance is gone and the mage crumbles to ash. */
export const MAGE_FALL_MS = 1_900;

/** Sœur Fantôme: the two figures dissolve into mist and trade places, carrying what lay under the sister. */
export const SISTER_SWAP_MS = 1_500;

/** Mime: the mask flashes on the copier, and the copied card shines over them. */
export const MIME_COPY_MS = 1_300;

/**
 * The phases inside those animations, which the scene plays one after the other. Each set adds up to at most the
 * estimate above, because the dialogs open when the estimate runs out.
 *
 * Mage noir: sucked in at the mage's tile, a dark streak across the board, out of the light on the pentagram
 * (1 600 of 1 700); the flame that swallows the players left on it runs from the landing on.
 */
export const MARK_SUCK_MS = 700;
export const MARK_TRANSIT_MS = 250;
export const MARK_EMERGE_MS = 650;
/** Mage noir: a player on the pentagram is swallowed by the flame, then drops out of a Hell portal. */
export const MARK_BURN_MS = 520;
/** Mage noir: crumbling to ash (the rest of MAGE_FALL_MS is the ring that spreads over the tile). */
export const MAGE_CRUMBLE_MS = 1_500;
/** Sœur Fantôme: dissolving, the mist crossing the board, condensing (1 250 of 1 500). */
export const SISTER_DISSOLVE_MS = 450;
export const SISTER_TRANSIT_MS = 300;
export const SISTER_CONDENSE_MS = 500;
/** Sœur Fantôme: what the sister carries flies over in an arc, from the start of the swap (ends at 1 100). */
export const SISTER_CARRY_DELAY_MS = 250;
export const SISTER_CARRY_MS = 850;
/** Sœur Fantôme: a move nobody explains (a trip to Hell sends her back to the start) is a quick fade out and in. */
export const SISTER_SNAP_OUT_MS = 260;
export const SISTER_SNAP_IN_MS = 380;
/** Mime: the beam from the copied pawn, then the mask over the copier (the rest is the mask floating away). */
export const MIME_BEAM_MS = 550;
export const MIME_MASK_DELAY_MS = 380;
/** Mi-vu, Mi-vue: a pawn fades from sight, or pops back with a flash. */
export const INVISIBILITY_FADE_MS = 420;
export const INVISIBILITY_POP_MS = 420;

/** Pause after a Red Cup pickup before modals open, so the celebration reads. */
export const CUP_CELEBRATION_MS = 900;

/** Roller: one throw of the die for the Red Cup, from the tumble to the end of the pause on its face. */
export const CUP_ROLL_THROW_MS = 1_600;

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
 * How long the animation of a Cups Power's deed holds the dialogs back, once the walk (if any) is over. A tunnel
 * and the mirror steps of the sister belong to the walk itself (`estimateMovementMs`), so they add nothing here.
 */
export function estimatePowerEventMs(event: PowerEvent): number {
  switch (event.kind) {
    case "mime-copy":
      return MIME_COPY_MS;
    case "mark-place":
      return MARK_DRAW_MS;
    case "mark-teleport":
      return MARK_TELEPORT_MS + (event.victimIds.length > 0 || event.mudHell ? MARK_VICTIM_MS : 0);
    case "mage-fallen":
      return MAGE_FALL_MS;
    case "sister-swap":
      return SISTER_SWAP_MS;
    case "tunnel-dig":
    case "tunnel-cross":
      return 0;
  }
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
  // Taupe: the dive into the ground and the pop out of it replace the hop.
  if (movement.tunnel) return TUNNEL_DIVE_MS + TUNNEL_POP_MS;
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
  // Chance aveugle: the slip in the mud, before the mud is gone.
  if (movement.slippedInMud) total += MUD_SLIP_MS;
  return total;
}
