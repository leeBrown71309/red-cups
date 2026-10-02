import * as THREE from "three";
import type { BoardNode } from "../../game/types";
import { TILE_COLORS } from "../../theme/palette";
import { addOutline, type SceneKit } from "../scene-kit";
import type { AnimatedProp } from "./props-model";
import { TILE_HEIGHT } from "./tile-model";

const ARROW_THICKNESS = 0.16;
const SHAFT_HALF_WIDTH = 0.2;
const HEAD_HALF_WIDTH = 0.46;
/** The arrow starts under the tile's top, so it reads as part of the tile rather than of the road. */
const BURIED_LENGTH = 0.35;
/** How far the arrow nudges towards its exit, now and then, to catch the eye. */
const NUDGE_DISTANCE = 0.09;

export interface TileArrowOptions {
  node: BoardNode;
  radius: number;
  /** Unit vector, on the ground, from the tile's centre towards its forced exit. */
  direction: THREE.Vector3;
  /** Length of the arrow beyond the tile's rim. */
  reach: number;
  neon?: boolean;
}

/**
 * The forced exit of an arrow tile, drawn the way the original board drew it:
 * a block arrow of the tile's own colour, sticking out of its rim towards the
 * road it must be left by. It belongs in the tile's lifting group, so it rises
 * with the tile when the tile is highlighted.
 */
export function createTileArrow(kit: SceneKit, options: TileArrowOptions): AnimatedProp {
  const { node, radius, direction, reach } = options;
  const colors = TILE_COLORS[node.kind];
  const group = new THREE.Group();
  group.rotation.y = Math.atan2(-direction.z, direction.x);

  const rim = radius * 0.92;
  const headLength = Math.min(0.62, reach * 0.7);
  const shaftEnd = rim + reach - headLength;
  const shape = new THREE.Shape();
  shape.moveTo(rim - BURIED_LENGTH, SHAFT_HALF_WIDTH);
  shape.lineTo(shaftEnd, SHAFT_HALF_WIDTH);
  shape.lineTo(shaftEnd, HEAD_HALF_WIDTH);
  shape.lineTo(rim + reach, 0);
  shape.lineTo(shaftEnd, -HEAD_HALF_WIDTH);
  shape.lineTo(shaftEnd, -SHAFT_HALF_WIDTH);
  shape.lineTo(rim - BURIED_LENGTH, -SHAFT_HALF_WIDTH);
  shape.closePath();

  const geometry = kit.geometry(`tile-arrow:${radius}:${reach.toFixed(2)}`, () => {
    const extruded = new THREE.ExtrudeGeometry(shape, {
      depth: ARROW_THICKNESS,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 1,
    });
    // Lie the shape on the ground and centre it, so the ink outline wraps it evenly.
    extruded.rotateX(-Math.PI / 2);
    extruded.computeBoundingBox();
    const middle = extruded.boundingBox!.getCenter(new THREE.Vector3());
    extruded.translate(-middle.x, -middle.y, -middle.z);
    extruded.userData.center = middle;
    return extruded;
  });
  const center = geometry.userData.center as THREE.Vector3;

  const top = options.neon
    ? kit.flat(colors.top, { emissive: colors.top, emissiveIntensity: 0.35 })
    : kit.flat(colors.top);
  const arrow = new THREE.Mesh(geometry, [top, kit.flat(colors.side)]);
  arrow.position.set(center.x, TILE_HEIGHT - 0.04 - ARROW_THICKNESS / 2, center.z);
  arrow.castShadow = true;
  arrow.receiveShadow = true;
  addOutline(arrow, kit, 1.05);
  group.add(arrow);

  const phase = node.id * 0.7;
  return {
    group,
    update: (elapsed) => {
      // A short push every couple of seconds, like a finger pointing the way.
      const push = Math.max(0, Math.sin(elapsed * 2.4 + phase)) ** 6;
      arrow.position.x = center.x + push * NUDGE_DISTANCE;
    },
  };
}
