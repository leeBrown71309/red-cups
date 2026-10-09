import * as THREE from "three";
import type { NodeId } from "../game/types";
import { CARAVAN_STEP } from "../game/types";
import { FERRY_MOVE_MS } from "../theme/timing";
import type { BoardLayout } from "./board-layout";
import { addOutline, easeInOutCubic, type SceneKit } from "./scene-kit";

/** How far outside the road the caravan travels, so that it never stands on a tile. */
const LANE_OFFSET = 3;
const RETURN_DELAY_MS = 500;
const DECK_OFFSET = new THREE.Vector3(-0.1, 1.0, 0);
/** Each tile the caravan crosses at a new round takes this long. */
const MOVE_MS_PER_TILE = FERRY_MOVE_MS / CARAVAN_STEP / 1.4;

interface Journey {
  curve: THREE.CatmullRomCurve3;
  elapsed: number;
  duration: number;
  onArrive?: () => void;
}

/**
 * The caravan of the Désert: a covered wagon drawn by two camels, going round the outer loop outside the road. The
 * rules say which tile it stands at (two tiles on at every new round); the wagon walks there. A player who climbs
 * aboard rides the wagon four tiles along, and it comes back to where the rules keep it.
 */
export class CaravanActor {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly legs: THREE.Mesh[] = [];
  private readonly deck = new THREE.Vector3();
  private readonly loop: NodeId[];
  private readonly centre = new THREE.Vector3(0, 0, 0);
  private current: NodeId | null = null;
  private target: NodeId | null = null;
  private journey: Journey | null = null;
  private idleMs = 0;
  private clock = 0;

  constructor(
    kit: SceneKit,
    private readonly layout: BoardLayout,
  ) {
    this.loop = layout.map.desert?.outerLoop ?? [];
    this.body.add(createCaravanModel(kit, this.legs));
    this.group.add(this.body);
    this.group.visible = false;
  }

  /** Follows the rules: the caravan stands at this tile. The first call puts it there. */
  sync(nodeId: NodeId | null): void {
    this.target = nodeId;
    if (nodeId === null) {
      this.group.visible = false;
      return;
    }
    if (this.current === null) {
      this.current = nodeId;
      this.placeAt(nodeId);
    }
  }

  /** A player rides: the caravan sets out from `from`, walks the loop to `to`, then goes back to its place. */
  carry(from: NodeId, to: NodeId, durationMs: number): void {
    this.begin(from, to, durationMs, () => {
      this.current = to;
      this.idleMs = 0;
    });
  }

  getDeckPosition(): THREE.Vector3 {
    return this.deck.clone();
  }

  getDeckHeading(): THREE.Vector3 {
    const yaw = this.group.rotation.y;
    return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  }

  update(elapsed: number, delta: number): void {
    this.clock = elapsed;
    const walking = this.journey !== null;
    if (this.journey) {
      this.advance(delta);
    } else if (this.current !== null && this.target !== null && this.current !== this.target) {
      this.idleMs += delta * 1_000;
      if (this.idleMs >= RETURN_DELAY_MS) {
        const from = this.current;
        const to = this.target;
        const steps = this.stepsBetween(from, to);
        this.begin(from, to, Math.max(1_400, steps * MOVE_MS_PER_TILE), () => {
          this.current = to;
          this.idleMs = 0;
        });
      }
    }
    // The camels' legs swing while the caravan walks; the wagon sways a little on its axle.
    const swing = walking ? 1 : 0;
    this.legs.forEach((leg, index) => {
      leg.rotation.z = Math.sin(this.clock * 6 + index * Math.PI * 0.5) * 0.5 * swing;
    });
    this.body.rotation.z = Math.sin(this.clock * 5) * 0.025 * swing;
    this.body.position.y = Math.abs(Math.sin(this.clock * 6)) * 0.05 * swing;
    this.group.updateMatrixWorld(true);
    this.deck.copy(DECK_OFFSET).applyMatrix4(this.body.matrixWorld);
  }

  private stepsBetween(from: NodeId, to: NodeId): number {
    const a = this.loop.indexOf(from);
    const b = this.loop.indexOf(to);
    if (a < 0 || b < 0) return 1;
    return (b - a + this.loop.length) % this.loop.length;
  }

  /** A point beside the road at a tile: the tile pushed away from the middle of the world. */
  private lanePoint(nodeId: NodeId): THREE.Vector3 {
    const tile = this.layout.getNodePosition(nodeId);
    const outward = tile.clone().sub(this.centre).setY(0).normalize();
    return tile.addScaledVector(outward, LANE_OFFSET).setY(0.05);
  }

  private headingAt(nodeId: NodeId): number {
    const at = this.loop.indexOf(nodeId);
    if (at < 0) return 0;
    const next = this.lanePoint(this.loop[(at + 1) % this.loop.length]);
    const here = this.lanePoint(nodeId);
    return Math.atan2(-(next.z - here.z), next.x - here.x);
  }

  private placeAt(nodeId: NodeId): void {
    this.group.visible = true;
    this.group.position.copy(this.lanePoint(nodeId));
    this.group.rotation.y = this.headingAt(nodeId);
  }

  private begin(from: NodeId, to: NodeId, durationMs: number, onArrive: () => void): void {
    const start = this.loop.indexOf(from);
    const steps = this.stepsBetween(from, to);
    if (start < 0 || steps === 0) {
      onArrive();
      return;
    }
    // Always clockwise round the loop, the way the caravan goes.
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= steps; step += 1)
      points.push(this.lanePoint(this.loop[(start + step) % this.loop.length]));
    if (points.length < 2) {
      onArrive();
      return;
    }
    this.group.visible = true;
    this.journey = {
      curve: new THREE.CatmullRomCurve3(points, false, "centripetal"),
      elapsed: 0,
      duration: durationMs,
      onArrive,
    };
    this.group.position.copy(points[0]);
  }

  private advance(delta: number): void {
    const journey = this.journey;
    if (!journey) return;
    journey.elapsed += delta * 1_000;
    const progress = Math.min(1, journey.elapsed / journey.duration);
    const eased = easeInOutCubic(progress);
    this.group.position.copy(journey.curve.getPointAt(eased));
    const tangent = journey.curve.getTangentAt(Math.min(0.999, eased));
    if (tangent.lengthSq() > 1e-4) this.group.rotation.y = Math.atan2(-tangent.z, tangent.x);
    if (progress >= 1) {
      this.journey = null;
      journey.onArrive?.();
      if (this.current !== null) this.placeAt(this.current);
    }
  }
}

/** A canvas-covered wagon with striped awning, and two camels in harness in front of it. The bow points along +x. */
function createCaravanModel(kit: SceneKit, legs: THREE.Mesh[]): THREE.Group {
  const model = new THREE.Group();

  const bed = new THREE.Mesh(
    kit.geometry("wagon-bed", () => new THREE.BoxGeometry(2.1, 0.22, 1.1)),
    kit.flat("#8a5a3c"),
  );
  bed.position.y = 0.52;
  bed.castShadow = true;
  addOutline(bed, kit, 1.04);
  model.add(bed);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      kit.geometry("wagon-rail", () => new THREE.BoxGeometry(2.1, 0.3, 0.08)),
      kit.flat("#a8693a"),
    );
    rail.position.set(0, 0.78, side * 0.55);
    model.add(rail);
    for (const end of [-1, 1]) {
      const wheel = new THREE.Mesh(
        kit.geometry("wagon-wheel", () => new THREE.CylinderGeometry(0.42, 0.42, 0.1, 10)),
        kit.flat("#5b3a24"),
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(end * 0.7, 0.42, side * 0.62);
      wheel.castShadow = true;
      model.add(wheel);
    }
  }
  // The awning: two stripes of canvas over hoops.
  const stripes = ["#e8453c", "#f7efe0", "#e8453c", "#f7efe0"];
  stripes.forEach((color, index) => {
    const canopy = new THREE.Mesh(
      kit.geometry(`wagon-canopy-${index}`, () => new THREE.CylinderGeometry(0.62, 0.62, 0.52, 8, 1, true, 0, Math.PI)),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, flatShading: true, roughness: 0.9 }),
    );
    // Half a cylinder lying along the wagon, its open side down: an arch of canvas.
    canopy.rotation.z = Math.PI / 2;
    canopy.position.set(-0.78 + index * 0.52, 0.66, 0);
    canopy.castShadow = true;
    model.add(canopy);
  });
  const lantern = new THREE.Mesh(
    kit.geometry("wagon-lantern", () => new THREE.SphereGeometry(0.1, 8, 6)),
    new THREE.MeshStandardMaterial({ color: "#ffe9a8", emissive: "#ffb347", emissiveIntensity: 0.9 }),
  );
  lantern.position.set(1.12, 0.95, 0);
  model.add(lantern);

  for (const [offset, tint] of [
    [2.1, "#c8965a"],
    [3.6, "#b98650"],
  ] as const) {
    const camel = createCamel(kit, tint, legs);
    camel.position.set(offset, 0, 0);
    model.add(camel);
  }
  const harness = new THREE.Mesh(
    kit.geometry("harness", () => new THREE.BoxGeometry(2.4, 0.06, 0.06)),
    kit.flat("#5b3a24"),
  );
  harness.position.set(1.7, 0.78, 0.22);
  model.add(harness);
  const harnessTwo = harness.clone();
  harnessTwo.position.z = -0.22;
  model.add(harnessTwo);
  return model;
}

function createCamel(kit: SceneKit, coat: string, legs: THREE.Mesh[]): THREE.Group {
  const camel = new THREE.Group();
  const torso = new THREE.Mesh(
    kit.geometry("camel-torso", () => new THREE.BoxGeometry(1.2, 0.6, 0.55)),
    kit.flat(coat),
  );
  torso.position.y = 1.0;
  torso.castShadow = true;
  addOutline(torso, kit, 1.05);
  camel.add(torso);
  for (const hump of [-0.18, 0.2]) {
    const bump = new THREE.Mesh(
      kit.geometry("camel-hump", () => new THREE.SphereGeometry(0.28, 8, 6)),
      kit.flat(coat),
    );
    bump.position.set(hump, 1.45, 0);
    bump.scale.y = 1.15;
    camel.add(bump);
  }
  const neck = new THREE.Mesh(
    kit.geometry("camel-neck", () => new THREE.CylinderGeometry(0.12, 0.17, 0.85, 6)),
    kit.flat(coat),
  );
  neck.position.set(0.7, 1.35, 0);
  neck.rotation.z = -0.6;
  camel.add(neck);
  const head = new THREE.Mesh(
    kit.geometry("camel-head", () => new THREE.BoxGeometry(0.42, 0.22, 0.24)),
    kit.flat(coat),
  );
  head.position.set(1.0, 1.8, 0);
  head.rotation.z = -0.15;
  camel.add(head);
  const nose = new THREE.Mesh(
    kit.geometry("camel-nose", () => new THREE.BoxGeometry(0.12, 0.14, 0.2)),
    kit.flat("#a8784f"),
  );
  nose.position.set(1.22, 1.76, 0);
  camel.add(nose);
  for (const eye of [-1, 1]) {
    const dot = new THREE.Mesh(
      kit.geometry("camel-eye", () => new THREE.SphereGeometry(0.03, 5, 4)),
      kit.flat("#3a2530"),
    );
    dot.position.set(1.05, 1.86, eye * 0.1);
    camel.add(dot);
  }
  const tail = new THREE.Mesh(
    kit.geometry("camel-tail", () => new THREE.CylinderGeometry(0.03, 0.05, 0.5, 4)),
    kit.flat("#a8784f"),
  );
  tail.position.set(-0.65, 0.95, 0);
  tail.rotation.z = 0.5;
  camel.add(tail);
  const cloth = new THREE.Mesh(
    kit.geometry("camel-cloth", () => new THREE.BoxGeometry(0.5, 0.06, 0.6)),
    kit.flat("#3a7ca5"),
  );
  cloth.position.set(0.0, 1.32, 0);
  camel.add(cloth);
  for (const [x, z] of [
    [0.45, 0.2],
    [0.45, -0.2],
    [-0.45, 0.2],
    [-0.45, -0.2],
  ]) {
    const leg = new THREE.Mesh(
      kit.geometry("camel-leg", () => {
        const geometry = new THREE.CylinderGeometry(0.07, 0.06, 0.85, 5);
        geometry.translate(0, -0.42, 0);
        return geometry;
      }),
      kit.flat(coat),
    );
    leg.position.set(x, 0.85, z);
    leg.castShadow = true;
    camel.add(leg);
    legs.push(leg);
  }
  return camel;
}
