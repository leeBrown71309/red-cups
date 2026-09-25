import { findEdge } from "../game/board";
import type { NodeId } from "../game/types";

/** Duration of one pawn hop between two neighbouring tiles. */
export const HOP_MS = 360;

/** Extra time spent disappearing in and popping out of the tunnel. */
export const TUNNEL_EXTRA_MS = 560;

/** Pause after a Red Cup pickup before modals open, so the celebration reads. */
export const CUP_CELEBRATION_MS = 900;

/**
 * Game rules resolve instantly, while the board animates. The HUD uses this
 * estimate to delay modals and feedback until the pawn has landed.
 */
export function estimateMovementMs(from: NodeId, path: NodeId[]): number {
  let total = 0;
  let previous = from;

  for (const nodeId of path) {
    total += HOP_MS;
    if (findEdge(previous, nodeId)?.kind === "tunnel") total += HOP_MS + TUNNEL_EXTRA_MS;
    previous = nodeId;
  }

  return total;
}
