import * as THREE from "three";
import { getBoardNode } from "../game/board";
import type { NodeId } from "../game/types";
import { START_NODE_ID } from "../game/types";
import { SCENE_COLORS } from "../theme/palette";
import { getRoadSegments, type RoadSegment } from "./board-layout";
import { START_TILE_RADIUS, TILE_RADIUS } from "./models/tile-model";
import { createRandom, jitterGeometry, type SceneKit } from "./scene-kit";

const STONE_SPACING = 0.62;
const CHEVRON_SPACING = 1.35;
const STONE_COLOR = new THREE.Color(SCENE_COLORS.stone);
const TUNNEL_STONE_COLOR = new THREE.Color(SCENE_COLORS.stoneTunnel);
const HIGHLIGHT_COLOR = new THREE.Color("#ffd24a");

interface Chevron {
  holder: THREE.Group;
  segment: RoadSegment;
  offset: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

function edgeKey(first: NodeId, second: NodeId): string {
  return first < second ? `${first}-${second}` : `${second}-${first}`;
}

function getClearance(nodeId: NodeId, point: THREE.Vector3): number {
  const node = getBoardNode(nodeId);
  if (!node || Math.hypot(node.x - point.x, node.z - point.z) > 0.01) return 0.1;
  return (nodeId === START_NODE_ID ? START_TILE_RADIUS : TILE_RADIUS) + 0.12;
}

/**
 * Stepping-stone roads between tiles. One-way roads carry animated chevrons
 * flowing in the travel direction; free roads stay plain, as on the original.
 */
export class RoadNetwork {
  readonly group = new THREE.Group();
  private readonly stones: THREE.InstancedMesh;
  private readonly stoneEdgeKeys: string[] = [];
  private readonly stoneBaseColors: THREE.Color[] = [];
  private readonly chevrons: Chevron[] = [];
  private highlightedKeys = new Set<string>();

  constructor(kit: SceneKit) {
    const segments = getRoadSegments();
    const random = createRandom(77);
    const placements: { position: THREE.Vector3; key: string; tunnel: boolean }[] = [];

    for (const segment of segments) {
      const direction = segment.end.clone().sub(segment.start);
      const length = direction.length();
      direction.normalize();
      const startClearance = getClearance(segment.edge.from, segment.start);
      const endClearance = getClearance(segment.edge.to, segment.end);
      const usable = length - startClearance - endClearance;
      const count = Math.max(1, Math.round(usable / STONE_SPACING));
      const side = new THREE.Vector3(-direction.z, 0, direction.x);

      for (let index = 0; index <= count; index += 1) {
        const distance = startClearance + (usable * index) / count;
        const position = segment.start
          .clone()
          .addScaledVector(direction, distance)
          .addScaledVector(side, (random() - 0.5) * 0.12);
        placements.push({ position, key: edgeKey(segment.edge.from, segment.edge.to), tunnel: segment.tunnel });
      }

      if (segment.directed) this.addChevrons(kit, segment, startClearance, endClearance);
    }

    const stoneGeometry = kit.geometry("road-stone", () =>
      jitterGeometry(new THREE.CylinderGeometry(0.3, 0.33, 0.08, 6), 0.03, 9),
    );
    this.stones = new THREE.InstancedMesh(stoneGeometry, kit.flat("#ffffff"), placements.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    placements.forEach((placement, index) => {
      quaternion.setFromAxisAngle(up, random() * Math.PI);
      const size = 0.85 + random() * 0.25;
      matrix.compose(placement.position.setY(0.035), quaternion, new THREE.Vector3(size, 1, size));
      this.stones.setMatrixAt(index, matrix);
      const color = placement.tunnel ? TUNNEL_STONE_COLOR : STONE_COLOR;
      this.stoneBaseColors.push(color);
      this.stones.setColorAt(index, color);
      this.stoneEdgeKeys.push(placement.key);
    });
    this.stones.receiveShadow = true;
    this.group.add(this.stones);
  }

  /** Lights up the stones of every road walked by the previewed path. */
  highlightPath(from: NodeId | null, path: NodeId[] | null): void {
    const keys = new Set<string>();
    if (from !== null && path) {
      let previous = from;
      for (const nodeId of path) {
        keys.add(edgeKey(previous, nodeId));
        previous = nodeId;
      }
    }

    const unchanged =
      keys.size === this.highlightedKeys.size && [...keys].every((key) => this.highlightedKeys.has(key));
    if (unchanged) return;
    this.highlightedKeys = keys;

    this.stoneEdgeKeys.forEach((key, index) => {
      this.stones.setColorAt(index, keys.has(key) ? HIGHLIGHT_COLOR : this.stoneBaseColors[index]);
    });
    if (this.stones.instanceColor) this.stones.instanceColor.needsUpdate = true;
  }

  update(elapsed: number): void {
    for (const chevron of this.chevrons) {
      const progress = (elapsed * 0.32 + chevron.offset) % 1;
      chevron.holder.position.lerpVectors(chevron.from, chevron.to, progress);
      chevron.holder.position.y = 0.1;
      chevron.holder.scale.setScalar(Math.min(1, Math.sin(progress * Math.PI) * 1.8));
    }
  }

  private addChevrons(kit: SceneKit, segment: RoadSegment, startClearance: number, endClearance: number): void {
    const direction = segment.end.clone().sub(segment.start);
    const length = direction.length();
    direction.normalize();
    const from = segment.start.clone().addScaledVector(direction, startClearance);
    const to = segment.end.clone().addScaledVector(direction, -endClearance);
    const count = Math.max(2, Math.round((length - startClearance - endClearance) / CHEVRON_SPACING));
    const shapeGeometry = kit.geometry("chevron", () => new THREE.ShapeGeometry(createChevronShape()));
    const color = segment.tunnel ? SCENE_COLORS.chevronTunnel : "#ff8f3f";

    for (let index = 0; index < count; index += 1) {
      const holder = new THREE.Group();
      holder.rotation.y = Math.atan2(-direction.z, direction.x);

      const shadow = new THREE.Mesh(shapeGeometry, kit.unlit(SCENE_COLORS.ink, 0.35));
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.setScalar(1.25);
      shadow.position.y = -0.005;
      const arrow = new THREE.Mesh(shapeGeometry, kit.unlit(color));
      arrow.rotation.x = -Math.PI / 2;
      arrow.renderOrder = 1;
      holder.add(shadow, arrow);

      this.group.add(holder);
      this.chevrons.push({ holder, segment, offset: index / count, from, to });
    }
  }
}

function createChevronShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.24, 0.26);
  shape.lineTo(-0.06, 0.26);
  shape.lineTo(0.2, 0);
  shape.lineTo(-0.06, -0.26);
  shape.lineTo(-0.24, -0.26);
  shape.lineTo(0.02, 0);
  shape.closePath();
  return shape;
}
