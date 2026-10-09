import * as THREE from "three";
import type { NodeId } from "../game/types";
import type { BoardLayout } from "./board-layout";
import { WATER_Y, getIslandShapes } from "./models/lagoon-scenery-model";
import { addOutline, easeInOutCubic, type SceneKit } from "./scene-kit";
import { FERRY_MOVE_MS } from "../theme/timing";

/** How long the ferry waits at a quay after carrying somebody, before it goes back to where the rules moor it. */
const RETURN_DELAY_MS = 500;
/** How far from the sand of an island the ferry's route goes round it. */
const ROUTE_CLEARANCE = 1.5;
/** Where a berth lies from its quay: out from the island along its radius, and along the shore towards the Maelström. */
const BERTH_RADIAL = 2;
const BERTH_TANGENT = 2.6;
const DECK_OFFSET = new THREE.Vector3(0.62, 0.46, 0);

interface Voyage {
  curve: THREE.CatmullRomCurve3;
  elapsed: number;
  duration: number;
  /** Called when the boat reaches the other berth. */
  onArrive?: () => void;
}

/**
 * The ferry of the Archipel: a little red and white boat that goes round the quays. The rules say which quay it is
 * moored at; the boat follows them (a long turn round the island at every new round), and when a player takes it
 * the pawn stands on its deck for the crossing, after which the boat goes back to its mooring.
 */
export class FerryActor {
  readonly group = new THREE.Group();
  private readonly hull = new THREE.Group();
  private readonly ripple: THREE.Mesh;
  private readonly flag: THREE.Mesh;
  private readonly berths = new Map<NodeId, THREE.Vector3>();
  private readonly headings = new Map<NodeId, THREE.Vector3>();
  /** The way from each quay to the next, as points round the island between them (inner side of the ring). */
  private readonly routes = new Map<string, THREE.Vector3[]>();
  private readonly quayOrder: NodeId[];
  private readonly ringCentre: THREE.Vector3;
  private readonly deck = new THREE.Vector3();
  private current: NodeId | null = null;
  private target: NodeId | null = null;
  private voyage: Voyage | null = null;
  private idleMs = 0;
  private bob = 0;

  constructor(kit: SceneKit, layout: BoardLayout) {
    const tidal = layout.map.tidal;
    this.quayOrder = tidal?.ferryQuays ?? [];
    this.ringCentre = layout.getNodePosition(11);
    const islands = getIslandShapes(layout);

    // A berth lies in the water beside the end of its causeway, on the side of the Maelström: out of the way of the
    // causeway's tiles, past the sand of the island, and well inside the tray.
    this.quayOrder.forEach((quayId, index) => {
      const quay = layout.getNodePosition(quayId);
      const island = islands[index];
      if (!island) return;
      const radial = new THREE.Vector3(quay.x - island.x, 0, quay.z - island.z).normalize();
      const tangent = new THREE.Vector3(-radial.z, 0, radial.x);
      if (tangent.dot(this.ringCentre.clone().sub(quay)) < 0) tangent.negate();
      const berth = quay.clone().addScaledVector(radial, BERTH_RADIAL).addScaledVector(tangent, BERTH_TANGENT);
      this.berths.set(quayId, berth.setY(WATER_Y));
      // Moored with the bow along the shore, pointing the way the ferry will sail.
      const after = islands[(index + 1) % islands.length];
      const before = islands[(index + islands.length - 1) % islands.length];
      const ringForward = new THREE.Vector3(after.x - before.x, 0, after.z - before.z);
      this.headings.set(quayId, tangent.dot(ringForward) >= 0 ? tangent.clone() : tangent.clone().negate());
    });

    // The route from a quay to the next goes round the island that lies between them, on the side of the Maelström:
    // the outer side has no room, the tray's rim is too close.
    this.quayOrder.forEach((quayId, index) => {
      const next = this.quayOrder[(index + 1) % this.quayOrder.length];
      const island = islands[index];
      const start = this.berths.get(quayId);
      const end = this.berths.get(next);
      if (!island || !start || !end) return;
      const centre = new THREE.Vector3(island.x, WATER_Y, island.z);
      const radius = island.radius + ROUTE_CLEARANCE;
      const angleOf = (point: THREE.Vector3) => Math.atan2(point.z - centre.z, point.x - centre.x);
      const towardRing = angleOf(this.ringCentre);
      const towardNext = angleOf(this.berths.get(next) ?? end);
      const signedGap = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
      const first = signedGap(angleOf(start), towardRing);
      // Round the island through the angle that faces the Maelström, then on towards the next quay.
      const direction = first >= 0 ? 1 : -1;
      const sweep = (from: number, to: number) => {
        let gap = signedGap(from, to);
        if (direction > 0 && gap < 0) gap += Math.PI * 2;
        if (direction < 0 && gap > 0) gap -= Math.PI * 2;
        return gap;
      };
      const total = sweep(angleOf(start), towardRing) + sweep(towardRing, towardNext);
      const points = [start.clone()];
      const samples = Math.max(2, Math.ceil(Math.abs(total) / (Math.PI / 6)));
      for (let step = 1; step <= samples; step += 1) {
        const angle = angleOf(start) + (total * step) / samples;
        points.push(
          new THREE.Vector3(centre.x + Math.cos(angle) * radius, WATER_Y, centre.z + Math.sin(angle) * radius),
        );
      }
      points.push(end.clone());
      this.routes.set(`${quayId}>${next}`, points);
    });

    this.hull.add(createFerryModel(kit));
    this.group.add(this.hull);
    this.flag = this.hull.getObjectByName("ferry-flag") as THREE.Mesh;
    this.ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 28),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.ripple.rotation.x = -Math.PI / 2;
    this.ripple.scale.set(1.5, 1, 0.9);
    this.ripple.position.y = 0.01;
    this.ripple.raycast = () => undefined;
    this.hull.add(this.ripple);
    this.group.visible = false;
  }

  /** Follows the rules: the boat belongs at this quay. The first call puts it there at once. */
  sync(quayId: NodeId | null): void {
    this.target = quayId;
    if (quayId === null) {
      this.group.visible = false;
      return;
    }
    if (this.current === null) {
      this.current = quayId;
      this.placeAtBerth(quayId);
    }
  }

  /** A player rides the boat from one quay to the next: it sails with them aboard, over `durationMs`. */
  carry(from: NodeId, to: NodeId, durationMs: number): void {
    this.begin(from, to, durationMs, () => {
      this.current = to;
      this.idleMs = 0;
    });
  }

  /** Where a passenger stands, in the world. */
  getDeckPosition(): THREE.Vector3 {
    return this.deck.clone();
  }

  /** The way the bow points, on the water. */
  getDeckHeading(): THREE.Vector3 {
    const yaw = this.group.rotation.y;
    return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  }

  update(elapsed: number, delta: number): void {
    this.bob = elapsed;
    if (this.voyage) {
      this.advanceVoyage(delta);
    } else if (this.current !== null && this.target !== null && this.current !== this.target) {
      this.idleMs += delta * 1_000;
      if (this.idleMs >= RETURN_DELAY_MS) {
        const from = this.current;
        const to = this.target;
        this.begin(from, to, FERRY_MOVE_MS, () => {
          this.current = to;
          this.idleMs = 0;
        });
      }
    }

    const hullRoll = Math.sin(this.bob * 1.4) * 0.045;
    this.hull.rotation.z = hullRoll;
    this.hull.rotation.x = Math.cos(this.bob * 1.1) * 0.03;
    this.hull.position.y = Math.sin(this.bob * 1.7) * 0.04;
    this.flag.rotation.y = Math.sin(this.bob * 5) * 0.3;
    (this.ripple.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(this.bob * 2.2) * 0.12;
    this.ripple.scale.setScalar(1 + Math.sin(this.bob * 1.6) * 0.06);
    this.group.updateMatrixWorld(true);
    this.deck.copy(DECK_OFFSET).applyMatrix4(this.hull.matrixWorld);
  }

  private placeAtBerth(quayId: NodeId): void {
    const berth = this.berths.get(quayId);
    if (!berth) return;
    this.group.visible = true;
    this.group.position.copy(berth);
    // Moored with its side to the island, bow along the shore.
    const heading = this.headings.get(quayId);
    if (heading) this.group.rotation.y = Math.atan2(-heading.z, heading.x);
  }

  private begin(from: NodeId, to: NodeId, durationMs: number, onArrive: () => void): void {
    const start = this.berths.get(from);
    const end = this.berths.get(to);
    if (!start || !end) {
      onArrive();
      return;
    }
    const forward = this.routes.get(`${from}>${to}`);
    const backward = this.routes.get(`${to}>${from}`);
    const points = forward ?? (backward ? [...backward].reverse() : [start.clone(), end.clone()]);
    this.group.visible = true;
    this.voyage = {
      curve: new THREE.CatmullRomCurve3(
        points.map((point) => point.clone()),
        false,
        "centripetal",
      ),
      elapsed: 0,
      duration: durationMs,
      onArrive,
    };
    this.group.position.copy(start);
  }

  private advanceVoyage(delta: number): void {
    const voyage = this.voyage;
    if (!voyage) return;
    voyage.elapsed += delta * 1_000;
    const progress = Math.min(1, voyage.elapsed / voyage.duration);
    const eased = easeInOutCubic(progress);
    const position = voyage.curve.getPointAt(eased);
    // Heading: the curve's tangent, so the bow leads the way.
    const tangent = voyage.curve.getTangentAt(Math.min(0.999, eased));
    this.group.position.copy(position).setY(WATER_Y);
    if (tangent.lengthSq() > 1e-4) this.group.rotation.y = Math.atan2(-tangent.z, tangent.x);
    if (progress >= 1) {
      this.voyage = null;
      voyage.onArrive?.();
      // Moored again: the bow along the shore like a boat tied up.
      if (this.current !== null) this.placeAtBerth(this.current);
    }
  }
}

/** The boat itself: a red hull with a pointed bow, a white deck house, a funnel, a flag and two life rings. */
function createFerryModel(kit: SceneKit): THREE.Group {
  const boat = new THREE.Group();
  const outline = new THREE.Shape();
  outline.moveTo(-1.05, -0.5);
  outline.lineTo(0.75, -0.5);
  outline.quadraticCurveTo(1.3, -0.34, 1.5, 0);
  outline.quadraticCurveTo(1.3, 0.34, 0.75, 0.5);
  outline.lineTo(-1.05, 0.5);
  outline.closePath();
  const hullGeometry = kit.geometry("ferry-hull", () => {
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth: 0.36,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  });
  const hull = new THREE.Mesh(hullGeometry, kit.flat("#e8453c"));
  hull.position.y = -0.1;
  hull.castShadow = true;
  hull.receiveShadow = true;
  addOutline(hull, kit, 1.03);
  boat.add(hull);

  const stripe = new THREE.Mesh(
    kit.geometry("ferry-stripe", () => new THREE.BoxGeometry(2.5, 0.07, 1.04)),
    kit.flat("#ffffff"),
  );
  stripe.position.set(0.2, 0.2, 0);
  boat.add(stripe);

  const deck = new THREE.Mesh(
    kit.geometry("ferry-deck", () => new THREE.BoxGeometry(2.2, 0.05, 0.9)),
    kit.flat("#e8d4a8"),
  );
  deck.position.set(0.15, 0.27, 0);
  deck.receiveShadow = true;
  boat.add(deck);

  const cabin = new THREE.Mesh(
    kit.geometry("ferry-cabin", () => new THREE.BoxGeometry(0.85, 0.46, 0.66)),
    kit.flat("#ffffff"),
  );
  cabin.position.set(-0.5, 0.52, 0);
  cabin.castShadow = true;
  addOutline(cabin, kit, 1.05);
  boat.add(cabin);
  const roof = new THREE.Mesh(
    kit.geometry("ferry-roof", () => new THREE.BoxGeometry(0.95, 0.07, 0.76)),
    kit.flat("#3a7ca5"),
  );
  roof.position.set(-0.5, 0.79, 0);
  boat.add(roof);
  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(
      kit.geometry("ferry-window", () => new THREE.BoxGeometry(0.5, 0.17, 0.02)),
      new THREE.MeshStandardMaterial({ color: "#7fd6ff", emissive: "#3aa8e0", emissiveIntensity: 0.4 }),
    );
    window.position.set(-0.5, 0.56, side * 0.335);
    boat.add(window);
  }

  const funnel = new THREE.Mesh(
    kit.geometry("ferry-funnel", () => new THREE.CylinderGeometry(0.1, 0.13, 0.4, 8)),
    kit.flat("#e8453c"),
  );
  funnel.position.set(-0.7, 0.98, 0);
  addOutline(funnel, kit, 1.08);
  const funnelBand = new THREE.Mesh(
    kit.geometry("ferry-band", () => new THREE.CylinderGeometry(0.108, 0.118, 0.07, 8)),
    kit.flat("#ffffff"),
  );
  funnelBand.position.set(-0.7, 1.0, 0);
  boat.add(funnel, funnelBand);

  const pole = new THREE.Mesh(
    kit.geometry("ferry-pole", () => new THREE.CylinderGeometry(0.02, 0.02, 0.8, 5)),
    kit.flat("#3a2530"),
  );
  pole.position.set(1.0, 0.67, 0);
  const flag = new THREE.Mesh(
    kit.geometry("ferry-flag", () => {
      const geometry = new THREE.PlaneGeometry(0.34, 0.2);
      geometry.translate(0.17, 0, 0);
      return geometry;
    }),
    new THREE.MeshStandardMaterial({ color: "#ffd24a", side: THREE.DoubleSide }),
  );
  flag.name = "ferry-flag";
  flag.position.set(1.0, 0.95, 0);
  boat.add(pole, flag);

  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(
      kit.geometry("ferry-ring", () => new THREE.TorusGeometry(0.12, 0.04, 5, 10)),
      kit.flat("#ffffff"),
    );
    ring.position.set(0.2, 0.42, side * 0.5);
    boat.add(ring);
  }
  return boat;
}
