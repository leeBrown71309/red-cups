import * as THREE from "three";
import type { BulletFlight, NodeId } from "../game/types";
import { START_NODE_ID } from "../game/types";
import { BULLET_HOP_MS, BULLET_WINDUP_MS } from "../theme/timing";
import type { BoardLayout } from "./board-layout";
import { SISTER_MIST_COLORS, type EffectsLayer } from "./effects-layer";
import { createBulletBillModel, type BulletBillVisual } from "./models/bullet-bill-model";
import { TILE_HEIGHT } from "./models/tile-model";
import { easeInOutCubic, easeOutBack, type SceneKit } from "./scene-kit";

export interface BulletView {
  nodeId: NodeId;
  status: "waiting" | "active";
}

/** Sœur Fantôme: the sister's swap carries Bullet Bill from one tile to another, in an arc. */
export interface BulletCarry {
  /** The power event it belongs to, so the actor knows one is about to be played. */
  seq: number;
  from: NodeId;
  to: NodeId;
}

/** Bullet Bill hovers beside the pawns of its tile rather than inside them. */
const HOVER_OFFSET = new THREE.Vector3(0.8, 0, -0.6);
/** The start is wider and gathers the whole table at first: Bullet Bill waits on its edge. */
const START_HOVER_REACH = 1.7;
const ARRIVAL_SECONDS = 0.9;
const ARRIVAL_DROP = 3.5;
const FLIGHT_ARC_HEIGHT = 0.9;
const SMOKE_INTERVAL_SECONDS = 0.045;
/** How high the sister's swap throws Bullet Bill, and how long a carry the board waits for before it gives up. */
const CARRY_ARC_HEIGHT = 2.2;
const PENDING_CARRY_TIMEOUT_SECONDS = 6;
/** Height of the engine above the ground, where the smoke trail starts. */
const EXHAUST_HEIGHT = 1.35;

interface Charge {
  points: THREE.Vector3[];
  elapsedMs: number;
  explodes: boolean;
}

/**
 * Drives Bullet Bill on the board. Its resting place comes from the board
 * view; a charge is replayed from the feedback event, so the flight, the HUD
 * banner and the explosion happen together. While a charge is announced but
 * not played yet, the actor holds its previous place instead of jumping ahead.
 */
export class BulletBillActor {
  private readonly visual: BulletBillVisual;
  /** What the scene shows: the fog may hide Bullet Bill from this viewer without stopping its life on the board. */
  private readonly root = new THREE.Group();
  private view: BulletView | null = null;
  private announcedCarry: BulletCarry | null = null;
  private playedCarrySeq: number | null = null;
  private pendingCarrySeconds = 0;
  private carryFlight: { from: THREE.Vector3; to: THREE.Vector3; elapsedMs: number; durationMs: number } | null = null;
  private announcedFlightSeq: number | null = null;
  private playedFlightSeq: number | null = null;
  private charge: Charge | null = null;
  private firstSync = true;
  private arrival = 1;
  private smokeClock = 0;
  private yaw = 0;

  constructor(
    kit: SceneKit,
    private readonly effects: EffectsLayer,
    private readonly layout: BoardLayout,
  ) {
    this.visual = createBulletBillModel(kit);
    this.visual.group.visible = false;
    this.root.add(this.visual.group);
  }

  get group(): THREE.Group {
    return this.root;
  }

  /** Mi-vu, Mi-vue: an invisible viewer does not see Bullet Bill; it goes on all the same. */
  setHidden(hidden: boolean): void {
    this.root.visible = !hidden;
  }

  sync(view: BulletView | null, flightSeq: number | null, carry: BulletCarry | null = null): void {
    const appeared = this.view === null && view !== null;
    this.view = view;
    this.announcedFlightSeq = flightSeq;
    this.announcedCarry = carry;
    // A restored game or a fresh table has nothing left to replay.
    if (this.firstSync || flightSeq === null) this.playedFlightSeq = flightSeq;
    if (this.firstSync || carry === null) this.playedCarrySeq = carry?.seq ?? null;

    if (appeared && !this.firstSync && !this.isChargePending()) {
      this.arrival = 0;
      this.effects.spawnPoof(this.restingPoint(view.nodeId).setY(TILE_HEIGHT), "#ff9f43");
    }
    this.firstSync = false;
    if (!this.charge && !this.isChargePending() && !this.carryFlight) this.settle();
  }

  /** The swap is played: Bullet Bill is thrown from `carry.from` to `carry.to` in an arc, over `durationMs`. */
  carry(carry: BulletCarry, durationMs: number): void {
    this.playedCarrySeq = carry.seq;
    this.pendingCarrySeconds = 0;
    if (this.charge || !this.view) return;
    this.carryFlight = {
      from: this.restingPoint(carry.from),
      to: this.restingPoint(carry.to),
      elapsedMs: 0,
      durationMs,
    };
    this.visual.group.visible = true;
    this.visual.setMood("charging");
  }

  launch(flight: BulletFlight): void {
    const nodes = [flight.from, ...flight.path];
    const points = nodes.map((nodeId) => this.restingPoint(nodeId));
    // The last hop dives into the victim, in the middle of the tile.
    if (flight.victimId) points[points.length - 1] = this.layout.getNodePosition(nodes[nodes.length - 1]).setY(0);

    this.playedFlightSeq = flight.seq;
    this.charge = { points, elapsedMs: 0, explodes: flight.victimId !== null };
    this.arrival = 1;
    this.visual.group.visible = true;
    this.visual.group.position.copy(points[0]);
    this.visual.setMood("charging");
  }

  update(elapsed: number, delta: number): void {
    const group = this.visual.group;
    this.pendingCarrySeconds = this.isCarryPending() ? this.pendingCarrySeconds + delta : 0;
    if (this.pendingCarrySeconds > PENDING_CARRY_TIMEOUT_SECONDS && this.announcedCarry) {
      this.playedCarrySeq = this.announcedCarry.seq;
      this.pendingCarrySeconds = 0;
      if (!this.charge && !this.carryFlight) this.settle();
    }
    if (!group.visible) return;
    if (this.charge) this.advanceCharge(delta);
    if (this.carryFlight) this.advanceCarry(delta);

    if (this.arrival < 1) this.arrival = Math.min(1, this.arrival + delta / ARRIVAL_SECONDS);
    const landed = easeOutBack(this.arrival);
    group.scale.setScalar(Math.max(0.001, Math.min(1.1, landed)));
    this.visual.update(elapsed, delta);
    this.visual.body.position.y += (1 - Math.min(1, landed)) * ARRIVAL_DROP;
    this.visual.body.rotation.y = this.yaw;
  }

  private restingPoint(nodeId: NodeId): THREE.Vector3 {
    const offset = HOVER_OFFSET.clone().multiplyScalar(nodeId === START_NODE_ID ? START_HOVER_REACH : 1);
    return this.layout.getNodePosition(nodeId).add(offset).setY(0);
  }

  private isChargePending(): boolean {
    return this.announcedFlightSeq !== null && this.announcedFlightSeq !== this.playedFlightSeq;
  }

  /** The swap that carries Bullet Bill is announced, and not yet played: it stays on the tile it is leaving. */
  private isCarryPending(): boolean {
    const carry = this.announcedCarry;
    return carry !== null && carry.seq !== this.playedCarrySeq;
  }

  /** Thrown in an arc, turning over as it goes, with a trail of smoke. */
  private advanceCarry(delta: number): void {
    const flight = this.carryFlight;
    if (!flight) return;
    flight.elapsedMs += delta * 1_000;
    const progress = Math.min(1, flight.elapsedMs / flight.durationMs);
    const position = this.visual.group.position;
    position.lerpVectors(flight.from, flight.to, easeInOutCubic(progress));
    position.y += Math.sin(progress * Math.PI) * CARRY_ARC_HEIGHT;
    this.yaw += delta * 6 * Math.sin(progress * Math.PI);
    this.smokeClock += delta;
    if (this.smokeClock >= SMOKE_INTERVAL_SECONDS * 1.6) {
      this.smokeClock = 0;
      this.effects.spawnGhostMist(
        position.clone().setY(position.y + EXHAUST_HEIGHT * 0.6),
        1,
        SISTER_MIST_COLORS,
        true,
      );
    }
    if (progress >= 1) {
      this.carryFlight = null;
      this.settle();
    }
  }

  private settle(): void {
    const view = this.view;
    const group = this.visual.group;
    group.visible = view !== null;
    if (!view) return;
    // A swap that carries it away is announced but not played: it stays where it was.
    const carry = this.isCarryPending() ? this.announcedCarry : null;
    group.position.copy(this.restingPoint(carry ? carry.from : view.nodeId));
    this.visual.setMood(view.status === "waiting" ? "waiting" : "hunting");
  }

  private advanceCharge(delta: number): void {
    const charge = this.charge;
    if (!charge) return;
    charge.elapsedMs += delta * 1_000;
    const hops = charge.points.length - 1;
    const flightMs = charge.elapsedMs - BULLET_WINDUP_MS;

    if (flightMs < 0) {
      if (hops > 0) this.aimAt(charge.points[1], delta);
      return;
    }
    if (flightMs >= hops * BULLET_HOP_MS) {
      this.finishCharge(charge);
      return;
    }

    const hop = Math.floor(flightMs / BULLET_HOP_MS);
    const progress = (flightMs - hop * BULLET_HOP_MS) / BULLET_HOP_MS;
    const from = charge.points[hop];
    const to = charge.points[hop + 1];
    const position = this.visual.group.position;
    position.lerpVectors(from, to, easeInOutCubic(progress));
    position.y += Math.sin(progress * Math.PI) * FLIGHT_ARC_HEIGHT;
    this.aimAt(to, delta);

    this.smokeClock += delta;
    if (this.smokeClock >= SMOKE_INTERVAL_SECONDS) {
      this.smokeClock = 0;
      const exhaust = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).multiplyScalar(0.95);
      this.effects.spawnSmokePuff(
        position
          .clone()
          .add(exhaust)
          .setY(position.y + EXHAUST_HEIGHT),
      );
    }
  }

  /** The explosion itself is spawned by the world on the matching "bullet-hit" event. */
  private finishCharge(charge: Charge): void {
    this.charge = null;
    this.visual.group.position.copy(charge.points[charge.points.length - 1]);
    if (charge.explodes) {
      this.visual.group.visible = false;
      return;
    }
    this.settle();
  }

  private aimAt(point: THREE.Vector3, delta: number): void {
    const direction = point.clone().sub(this.visual.group.position);
    if (direction.lengthSq() < 0.0004) return;
    const target = Math.atan2(direction.x, direction.z);
    const turn = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
    this.yaw += turn * Math.min(1, delta * 12);
  }
}
