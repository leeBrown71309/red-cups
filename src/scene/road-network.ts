import * as THREE from "three";
import type { NodeId } from "../game/types";
import { HELL_NODE_ID, START_NODE_ID } from "../game/types";
import { SCENE_COLORS } from "../theme/palette";
import type { SceneTheme } from "../theme/map-themes";
import type { BoardLayout, RoadSegment } from "./board-layout";
import { START_TILE_RADIUS, TILE_RADIUS } from "./models/tile-model";
import { createRandom, jitterGeometry, type SceneKit } from "./scene-kit";

const STONE_SPACING = 0.62;
const CHEVRON_SPACING = 1.35;
const HIGHLIGHT_COLOR = new THREE.Color("#ffd24a");
/** How fast the stones of a drowned causeway sink, and rise again. */
const FLOOD_SPEED = 2.4;

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

/**
 * Stepping-stone roads between tiles. Tunnels and the carousel, the roads that
 * run one way, carry animated chevrons all the way; every other road stays
 * plain, arrow tiles drawing their forced exit on the tile itself. Carousel
 * chevrons turn around when the carousel does.
 */
export class RoadNetwork {
  readonly group = new THREE.Group();
  private readonly stones: THREE.InstancedMesh;
  private readonly stoneEdgeKeys: string[] = [];
  private readonly stoneBaseColors: THREE.Color[] = [];
  private readonly chevrons: Chevron[] = [];
  private highlightedKeys = new Set<string>();
  private carouselReversed = false;
  /** Archipel: the stones as laid, and which of them lie on each road, so a drowned road can sink them. */
  private readonly stoneLaid: { position: THREE.Vector3; quaternion: THREE.Quaternion; size: number }[] = [];
  private readonly stonesOfRoad = new Map<string, number[]>();
  private readonly flood = new Map<string, { a: NodeId; b: NodeId; value: number }>();
  private floodedNodeIds = new Set<NodeId>();
  private readonly roadY: number;

  constructor(
    kit: SceneKit,
    private readonly layout: BoardLayout,
    private readonly colors: SceneTheme["roads"],
  ) {
    const random = createRandom(77);
    this.roadY = layout.config.roadY ?? 0.035;
    const placements: { position: THREE.Vector3; key: string; color: THREE.Color }[] = [];
    const stoneColor = new THREE.Color(colors.stone);
    const tunnelStoneColor = new THREE.Color(colors.tunnelStone);
    const carouselStoneColor = new THREE.Color(colors.carouselStone);

    for (const segment of layout.getRoadSegments()) {
      const direction = segment.end.clone().sub(segment.start);
      const length = direction.length();
      direction.normalize();
      const startClearance = this.getClearance(segment.edge.from, segment.start);
      const endClearance = this.getClearance(segment.edge.to, segment.end);
      const usable = length - startClearance - endClearance;
      const count = Math.max(1, Math.round(usable / STONE_SPACING));
      const side = new THREE.Vector3(-direction.z, 0, direction.x);
      const color = segment.tunnel ? tunnelStoneColor : segment.carousel ? carouselStoneColor : stoneColor;

      for (let index = 0; index <= count; index += 1) {
        const distance = startClearance + (usable * index) / count;
        const position = segment.start
          .clone()
          .addScaledVector(direction, distance)
          .addScaledVector(side, (random() - 0.5) * 0.12);
        placements.push({ position, key: edgeKey(segment.edge.from, segment.edge.to), color });
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
      matrix.compose(placement.position.setY(this.roadY), quaternion, new THREE.Vector3(size, 1, size));
      this.stones.setMatrixAt(index, matrix);
      this.stoneLaid.push({ position: placement.position.clone(), quaternion: quaternion.clone(), size });
      const onRoad = this.stonesOfRoad.get(placement.key) ?? [];
      onRoad.push(index);
      this.stonesOfRoad.set(placement.key, onRoad);
      if (!this.flood.has(placement.key)) {
        const [a, b] = placement.key.split("-").map(Number);
        this.flood.set(placement.key, { a, b, value: 0 });
      }
      this.stoneBaseColors.push(placement.color);
      this.stones.setColorAt(index, placement.color);
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

  /** The carousel changed direction: its chevrons now run the other way. */
  setCarouselReversed(reversed: boolean): void {
    if (reversed === this.carouselReversed) return;
    this.carouselReversed = reversed;
    for (const chevron of this.chevrons) {
      if (!chevron.segment.carousel) continue;
      [chevron.from, chevron.to] = [chevron.to, chevron.from];
      chevron.holder.rotation.y += Math.PI;
    }
  }

  /** Archipel: the roads that touch a drowned causeway tile sink under the water, and rise with it. */
  setFlooded(nodeIds: NodeId[]): void {
    this.floodedNodeIds = new Set(nodeIds);
  }

  update(elapsed: number, delta = 0): void {
    if (this.flood.size > 0 && delta > 0) this.animateFlood(delta);
    for (const chevron of this.chevrons) {
      const progress = (elapsed * 0.32 + chevron.offset) % 1;
      chevron.holder.position.lerpVectors(chevron.from, chevron.to, progress);
      chevron.holder.position.y = 0.1;
      chevron.holder.scale.setScalar(Math.min(1, Math.sin(progress * Math.PI) * 1.8));
    }
  }

  private animateFlood(delta: number): void {
    const matrix = new THREE.Matrix4();
    let changed = false;
    for (const [key, road] of this.flood) {
      const target = this.floodedNodeIds.has(road.a) || this.floodedNodeIds.has(road.b) ? 1 : 0;
      if (road.value === target) continue;
      road.value += (target - road.value) * Math.min(1, delta * FLOOD_SPEED);
      if (Math.abs(target - road.value) < 0.01) road.value = target;
      for (const index of this.stonesOfRoad.get(key) ?? []) {
        const laid = this.stoneLaid[index];
        const size = laid.size * (1 - road.value * 0.92);
        matrix.compose(
          laid.position.clone().setY(this.roadY - road.value * 0.22),
          laid.quaternion,
          new THREE.Vector3(size, 1 - road.value * 0.8, size),
        );
        this.stones.setMatrixAt(index, matrix);
      }
      changed = true;
    }
    if (changed) this.stones.instanceMatrix.needsUpdate = true;
  }

  /** Roads stop at the edge of the tiles they join; tunnel ends and Hell need no room. */
  private getClearance(nodeId: NodeId, point: THREE.Vector3): number {
    const node = this.layout.getNode(nodeId);
    if (!node || node.id === HELL_NODE_ID || Math.hypot(node.x - point.x, node.z - point.z) > 0.01) return 0.1;
    return (nodeId === START_NODE_ID ? START_TILE_RADIUS : TILE_RADIUS) + 0.12;
  }

  private addChevrons(kit: SceneKit, segment: RoadSegment, startClearance: number, endClearance: number): void {
    const direction = segment.end.clone().sub(segment.start);
    direction.normalize();
    const from = segment.start.clone().addScaledVector(direction, startClearance);
    const to = segment.end.clone().addScaledVector(direction, -endClearance);
    const count = Math.max(2, Math.round(from.distanceTo(to) / CHEVRON_SPACING));
    const shapeGeometry = kit.geometry("chevron", () => new THREE.ShapeGeometry(createChevronShape()));
    const color = segment.tunnel ? this.colors.tunnel : this.colors.carousel;

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
