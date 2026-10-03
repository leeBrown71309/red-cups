import * as THREE from "three";
import { findEdge } from "../game/board";
import type { NodeId, PlayerColor, PlayerMovement } from "../game/types";
import { HELL_NODE_ID, START_NODE_ID } from "../game/types";
import { emitFeedback } from "../feedback/event-bus";
import { getPlayerLook } from "../theme/player-looks";
import {
  FREEZE_MS,
  GHOST_CARRY_MS,
  GHOST_SLAP_IMPACT_MS,
  GHOST_SLAP_MS,
  GLIDE_MS,
  HOP_MS,
  SHATTER_MS,
  TUNNEL_EXTRA_MS,
  WOBBLE_MS,
} from "../theme/timing";
import type { BoardLayout } from "./board-layout";
import { createPawnVisual, type PawnVisual } from "./models/pawn-model";
import { TILE_HEIGHT } from "./models/tile-model";
import { easeInOutCubic, easeOutBack, type SceneKit } from "./scene-kit";

export interface PawnInput {
  id: string;
  color: PlayerColor;
  position: NodeId;
  isActive: boolean;
  isSleeping: boolean;
  /** Banquise: stuck in fallen ice halfway from `position` to this tile. */
  frozenTo?: NodeId;
  /** Banquise: frozen solid on its tile by the penguins' snowballs. */
  snowFrozen?: boolean;
  /** L'Ange-Gardien's protégé wears a halo, for the whole table to see. */
  halo?: boolean;
}

type PawnAction =
  | { type: "hop"; to: THREE.Vector3; duration: number }
  | { type: "slide"; to: THREE.Vector3; duration: number }
  | { type: "glide"; to: THREE.Vector3; duration: number }
  | { type: "wobble"; duration: number }
  | { type: "freeze"; duration: number }
  | { type: "shatter"; duration: number }
  | { type: "vanish"; duration: number }
  | { type: "appear"; at: THREE.Vector3; duration: number }
  | { type: "tumble"; duration: number }
  /** Luna Park: cowers, then reels from the ghost's slap; `source` is where the hand comes from. */
  | { type: "slapped"; duration: number; source?: THREE.Vector3 }
  /** Luna Park: dangling from the ghost's claws, flown high over the carousel down into Hell. */
  | { type: "carried"; to: THREE.Vector3; duration: number };

/** Lets the scene's other actors join in a pawn's animation. */
export interface PawnHooks {
  /** A pawn is about to be slapped and carried off by the ghost; returns where the ghost slaps from. */
  onGhostSlap?: (pawnId: string) => THREE.Vector3 | null;
}

const TUMBLE_MS = 820;
/** How high the ghost flies its victim over the carousel. */
const CARRY_ARC_HEIGHT = 2.4;
/** How far the slap knocks the pawn back. */
const SLAP_KNOCKBACK = 0.3;

interface Pawn {
  id: string;
  visual: PawnVisual;
  logicalNode: NodeId;
  actions: PawnAction[];
  actionElapsed: number;
  actionStart: THREE.Vector3;
  landingTimer: number;
  yaw: number;
  targetYaw: number;
  phase: number;
  nextBlink: number;
  active: boolean;
  sleeping: boolean;
  baseScale: number;
  /** Banquise: the ice block around a frozen pawn, grown by "freeze", burst by "shatter". */
  iceBlock: THREE.Mesh;
  /** L'Ange-Gardien's protégé: a golden ring floating over the head. */
  halo: THREE.Mesh;
}

const LANDING_MS = 150;
/** Where the protégé's halo floats, over the pawn's head. */
const HALO_HEIGHT = 1.08;

/**
 * Animates chibi pawns. The game store teleports positions instantly; this
 * controller replays the walk as hops, including the wrap-around tunnel.
 */
export class PawnController {
  readonly group = new THREE.Group();
  private readonly pawns = new Map<string, Pawn>();
  private lastMovementSeq = 0;
  private seedCounter = 0;

  constructor(
    private readonly kit: SceneKit,
    private readonly layout: BoardLayout,
    private readonly hooks: PawnHooks = {},
  ) {}

  sync(inputs: PawnInput[], movement: PlayerMovement | null): void {
    const inputIds = new Set(inputs.map((input) => input.id));
    for (const [id, pawn] of this.pawns) {
      if (inputIds.has(id)) continue;
      this.group.remove(pawn.visual.root);
      this.pawns.delete(id);
    }

    const slots = this.computeSlots(inputs);
    const isNewMovement = movement !== null && movement.seq !== this.lastMovementSeq;

    for (const input of inputs) {
      const slot = slots.get(input.id) ?? { position: this.layout.getNodePosition(input.position), scale: 1 };
      let pawn = this.pawns.get(input.id);

      if (!pawn) {
        pawn = this.createPawn(input, slot.position);
        // A restored game shows a frozen pawn in its ice straight away.
        if (input.frozenTo !== undefined || input.snowFrozen) pawn.iceBlock.scale.setScalar(1);
        this.pawns.set(input.id, pawn);
      } else if (isNewMovement && movement?.playerId === input.id && pawn.logicalNode === movement.from) {
        this.queueWalk(pawn, movement, slot.position);
      } else if (pawn.logicalNode !== input.position) {
        pawn.actions.push({ type: "vanish", duration: 240 }, { type: "appear", at: slot.position, duration: 320 });
      } else if (pawn.actions.length === 0 && pawn.visual.root.position.distanceTo(slot.position) > 0.02) {
        pawn.actions.push({ type: "slide", to: slot.position, duration: 260 });
      }

      // Out of the ice (moved by a Corde or a swap, or thawed after a lost turn): the block bursts.
      const iceQueued = pawn.actions.some((action) => action.type === "freeze" || action.type === "shatter");
      const iceHeld = input.frozenTo !== undefined || input.snowFrozen === true;
      if (!iceHeld && !iceQueued && pawn.iceBlock.scale.x > 0.5) {
        pawn.actions.push({ type: "shatter", duration: SHATTER_MS });
      }

      pawn.logicalNode = input.position;
      pawn.active = input.isActive;
      pawn.sleeping = input.isSleeping;
      pawn.halo.visible = input.halo === true;
      pawn.baseScale = slot.scale;
    }

    if (movement) this.lastMovementSeq = movement.seq;
  }

  /** Marks the current movement as already displayed, e.g. on first mount. */
  acknowledgeMovement(movement: PlayerMovement | null): void {
    if (movement) this.lastMovementSeq = movement.seq;
  }

  getPawnPosition(id: string): THREE.Vector3 | null {
    const pawn = this.pawns.get(id);
    return pawn ? pawn.visual.root.position.clone() : null;
  }

  /** The pawn standing closest to `point`, if one is within `maxDistance`. */
  getNearestPawnPosition(point: THREE.Vector3, maxDistance: number): THREE.Vector3 | null {
    let nearest: THREE.Vector3 | null = null;
    let nearestDistance = maxDistance;
    for (const pawn of this.pawns.values()) {
      const distance = pawn.visual.root.position.distanceTo(point);
      if (distance > nearestDistance) continue;
      nearestDistance = distance;
      nearest = pawn.visual.root.position;
    }
    return nearest ? nearest.clone() : null;
  }

  /** Banquise: the third snowball lands and the ice closes around the pawn where it stands. */
  freezeSolid(id: string): void {
    const pawn = this.pawns.get(id);
    if (pawn && pawn.iceBlock.scale.x < 0.5) pawn.actions.push({ type: "freeze", duration: FREEZE_MS });
  }

  /** Blown into the air by Bullet Bill: a cartwheel on the spot. */
  knockOut(id: string): void {
    const pawn = this.pawns.get(id);
    if (pawn && pawn.actions.length === 0) pawn.actions.push({ type: "tumble", duration: TUMBLE_MS });
  }

  isAnimating(): boolean {
    for (const pawn of this.pawns.values()) if (pawn.actions.length > 0) return true;
    return false;
  }

  update(elapsed: number, deltaSeconds: number): void {
    const deltaMs = deltaSeconds * 1_000;
    for (const pawn of this.pawns.values()) {
      this.advance(pawn, deltaMs);
      this.animateIdle(pawn, elapsed, deltaSeconds);
    }
  }

  private createPawn(input: PawnInput, position: THREE.Vector3): Pawn {
    const visual = createPawnVisual(getPlayerLook(input.color), this.kit, this.seedCounter);
    this.seedCounter += 1;
    visual.root.position.copy(position);
    this.group.add(visual.root);

    const iceBlock = new THREE.Mesh(
      this.kit.geometry("pawn-ice-block", () => new THREE.BoxGeometry(1.15, 1.5, 1.15, 1, 1, 1)),
      new THREE.MeshStandardMaterial({
        color: "#cfefff",
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
        metalness: 0.2,
        flatShading: true,
        depthWrite: false,
      }),
    );
    iceBlock.position.y = 0.72;
    iceBlock.rotation.y = 0.35;
    iceBlock.scale.setScalar(0.001);
    visual.root.add(iceBlock);

    const halo = new THREE.Mesh(
      this.kit.geometry("pawn-halo", () => new THREE.TorusGeometry(0.2, 0.045, 8, 24)),
      this.kit.flat("#ffd166", { emissive: "#ffb800", emissiveIntensity: 0.6 }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = HALO_HEIGHT;
    halo.visible = input.halo === true;
    visual.root.add(halo);
    return {
      id: input.id,
      visual,
      logicalNode: input.position,
      actions: [],
      actionElapsed: 0,
      actionStart: position.clone(),
      landingTimer: 0,
      yaw: 0,
      targetYaw: 0,
      phase: this.seedCounter * 1.7,
      nextBlink: 1 + this.seedCounter * 0.6,
      active: input.isActive,
      sleeping: input.isSleeping,
      baseScale: 1,
      iceBlock,
      halo,
    };
  }

  /**
   * Replays a walk as hops. At Banquise the steps slid on ice come after the
   * walk: the pawn wobbles on the ice, as if hesitating, then glides off the
   * way the slide was drawn. A slide stopped by falling ice ends halfway down
   * the road, in a block of ice; breaking free bursts the block first.
   */
  private queueWalk(pawn: Pawn, movement: PlayerMovement, finalSlot: THREE.Vector3): void {
    const { from, path } = movement;
    const slideStart = movement.slideStart ?? path.length;
    const interrupted = movement.interruptedTo !== undefined;

    // Slapped by the ghost, then carried through the air: no hops, the ghost does the travelling.
    if (movement.flungByGhost) {
      pawn.actions.push(
        { type: "slapped", duration: GHOST_SLAP_MS },
        { type: "carried", to: finalSlot, duration: GHOST_CARRY_MS },
      );
      return;
    }

    if (movement.thawed) {
      pawn.actions.push(
        { type: "shatter", duration: SHATTER_MS },
        { type: "glide", to: finalSlot, duration: GLIDE_MS },
      );
      return;
    }

    let previous = from;
    path.forEach((nodeId, index) => {
      const isLast = index === path.length - 1 && !interrupted;
      const target = isLast ? finalSlot : this.getStandingPoint(nodeId);
      const edge = findEdge(this.layout.board, previous, nodeId);

      if (index >= slideStart) {
        pawn.actions.push({ type: "wobble", duration: WOBBLE_MS }, { type: "glide", to: target, duration: GLIDE_MS });
        previous = nodeId;
        return;
      }

      if (edge?.kind === "tunnel") {
        const tunnel = this.layout.getTunnelLayout(edge);
        pawn.actions.push(
          { type: "hop", to: tunnel.entrance.clone().setY(0.05), duration: HOP_MS },
          { type: "vanish", duration: TUNNEL_EXTRA_MS / 2 },
          { type: "appear", at: tunnel.exit.clone().setY(0.05), duration: TUNNEL_EXTRA_MS / 2 },
        );
      }

      pawn.actions.push({ type: "hop", to: target, duration: HOP_MS });
      previous = nodeId;
    });

    if (interrupted) {
      pawn.actions.push(
        { type: "wobble", duration: WOBBLE_MS },
        { type: "glide", to: finalSlot, duration: GLIDE_MS / 2 },
        { type: "freeze", duration: FREEZE_MS },
      );
    }
  }

  private advance(pawn: Pawn, deltaMs: number): void {
    const root = pawn.visual.root;
    const body = pawn.visual.body;
    const action = pawn.actions[0];

    if (!action) {
      if (pawn.landingTimer > 0) {
        pawn.landingTimer = Math.max(0, pawn.landingTimer - deltaMs);
        const squash = Math.sin((pawn.landingTimer / LANDING_MS) * Math.PI) * 0.2;
        body.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      }
      return;
    }

    if (pawn.actionElapsed === 0) {
      if (action.type === "appear") root.position.copy(action.at);
      pawn.actionStart.copy(root.position);
      if (action.type === "vanish") emitFeedback({ type: "pawn-tunnel" });
      if (action.type === "glide") emitFeedback({ type: "pawn-slide" });
      if (action.type === "shatter") emitFeedback({ type: "ice-shatter", playerId: pawn.id });
      if (action.type === "slapped") {
        action.source = this.hooks.onGhostSlap?.(pawn.id) ?? undefined;
        if (action.source) pawn.targetYaw = yawTowards(root.position, action.source) ?? pawn.targetYaw;
      }
    }
    pawn.actionElapsed += deltaMs;
    const progress = Math.min(1, pawn.actionElapsed / action.duration);

    switch (action.type) {
      case "hop": {
        root.position.lerpVectors(pawn.actionStart, action.to, easeInOutCubic(progress));
        root.position.y += Math.sin(progress * Math.PI) * 1.05;
        const direction = action.to.clone().sub(pawn.actionStart);
        if (direction.lengthSq() > 0.001) pawn.targetYaw = Math.atan2(direction.x, direction.z);
        const stretch = progress < 0.15 ? -progress / 0.15 : progress < 0.85 ? 1 : 0;
        body.scale.set(1 - stretch * 0.08, 1 + stretch * 0.14, 1 - stretch * 0.08);
        break;
      }
      case "slide":
        root.position.lerpVectors(pawn.actionStart, action.to, easeInOutCubic(progress));
        break;
      case "glide": {
        // Steady speed and a lean backwards, like skidding on ice.
        root.position.lerpVectors(pawn.actionStart, action.to, progress);
        const direction = action.to.clone().sub(pawn.actionStart);
        if (direction.lengthSq() > 0.001) pawn.targetYaw = Math.atan2(direction.x, direction.z);
        body.rotation.x = -0.25 * Math.sin(progress * Math.PI);
        break;
      }
      case "wobble":
        // A quick spin on the spot: the ice decides where the pawn goes next.
        body.rotation.y = pawn.yaw + Math.sin(progress * Math.PI * 3) * 0.9;
        body.rotation.z = Math.sin(progress * Math.PI * 4) * 0.12;
        break;
      case "freeze":
        // The falling ice lands, then closes around the pawn.
        pawn.iceBlock.scale.setScalar(Math.max(0.001, easeOutBack(Math.max(0, (progress - 0.45) / 0.55))));
        break;
      case "shatter":
        pawn.iceBlock.scale.setScalar(Math.max(0.001, 1 - progress));
        body.rotation.z = Math.sin(progress * Math.PI * 6) * 0.15;
        break;
      case "vanish": {
        const scale = 1 - progress;
        body.scale.setScalar(Math.max(0.001, scale));
        body.rotation.y = progress * Math.PI * 2;
        break;
      }
      case "appear": {
        body.scale.setScalar(Math.max(0.001, easeOutBack(progress)));
        body.rotation.y = (1 - progress) * Math.PI * 2;
        break;
      }
      case "tumble": {
        root.position.y = pawn.actionStart.y + Math.sin(progress * Math.PI) * 1.6;
        body.rotation.z = easeInOutCubic(progress) * Math.PI * 2;
        break;
      }
      case "slapped":
        this.animateSlap(pawn, action);
        break;
      case "carried": {
        // Lifted off, flown high over the carousel, then dropped into Hell, kicking all the way.
        root.position.lerpVectors(pawn.actionStart, action.to, easeInOutCubic(progress));
        root.position.y += Math.sin(progress * Math.PI) * CARRY_ARC_HEIGHT;
        body.rotation.x = Math.sin(progress * Math.PI) * 0.45;
        body.rotation.y = pawn.yaw + easeInOutCubic(progress) * Math.PI * 2;
        body.rotation.z = Math.sin(progress * Math.PI * 7) * 0.3 * (1 - progress);
        pawn.visual.eyes.scale.y = 0.35;
        break;
      }
    }

    if (progress >= 1) {
      pawn.actions.shift();
      pawn.actionElapsed = 0;
      body.rotation.y = 0;
      body.rotation.z = 0;
      body.rotation.x = 0;
      if (action.type === "tumble") root.position.y = pawn.actionStart.y;
      if (action.type === "slapped" || action.type === "carried") pawn.visual.eyes.scale.y = 1;
      if (action.type === "hop" || action.type === "carried") {
        root.position.copy(action.to);
        pawn.landingTimer = LANDING_MS;
        emitFeedback({ type: "pawn-hop" });
      }
      if (action.type === "appear") body.scale.setScalar(1);
      if (action.type === "freeze") pawn.iceBlock.scale.setScalar(1);
      if (action.type === "shatter") pawn.iceBlock.scale.setScalar(0.001);
      if (pawn.actions.length === 0) pawn.targetYaw = 0;
    }
  }

  /** Shivers in front of the ghost, then the hand lands: the pawn reels away, dazed, and wobbles. */
  private animateSlap(pawn: Pawn, action: Extract<PawnAction, { type: "slapped" }>): void {
    const { root, body, eyes } = pawn.visual;
    if (pawn.actionElapsed < GHOST_SLAP_IMPACT_MS) {
      const dread = pawn.actionElapsed / GHOST_SLAP_IMPACT_MS;
      body.rotation.z = Math.sin(pawn.actionElapsed * 0.09) * 0.06 * dread;
      body.scale.set(1 + dread * 0.06, 1 - dread * 0.1, 1 + dread * 0.06);
      return;
    }

    const since = (pawn.actionElapsed - GHOST_SLAP_IMPACT_MS) / (action.duration - GHOST_SLAP_IMPACT_MS);
    const hit = Math.min(1, since);
    const away = action.source ? pawn.actionStart.clone().sub(action.source).setY(0) : new THREE.Vector3();
    if (away.lengthSq() > 0.0001) away.normalize();
    root.position.copy(pawn.actionStart).addScaledVector(away, SLAP_KNOCKBACK * (1 - Math.exp(-hit * 7)));
    body.rotation.z = 0.9 * Math.exp(-hit * 4) * Math.cos(hit * 16);
    const squash = Math.exp(-hit * 6) * 0.25;
    body.scale.set(1 + squash, 1 - squash, 1 + squash);
    eyes.scale.y = 0.2;
  }

  private animateIdle(pawn: Pawn, elapsed: number, deltaSeconds: number): void {
    const { root, body, eyes, activeRing, activeArrow, sleepLabel } = pawn.visual;
    const moving = pawn.actions.length > 0;

    const yawDelta = Math.atan2(Math.sin(pawn.targetYaw - pawn.yaw), Math.cos(pawn.targetYaw - pawn.yaw));
    pawn.yaw += yawDelta * Math.min(1, deltaSeconds * 10);
    const spinning = moving && ["vanish", "appear", "wobble", "carried"].includes(pawn.actions[0].type);
    if (!spinning) body.rotation.y = pawn.yaw;

    const scaleTarget = pawn.baseScale * (pawn.active ? 1.12 : 1);
    const currentScale = root.scale.x + (scaleTarget - root.scale.x) * Math.min(1, deltaSeconds * 8);
    root.scale.setScalar(currentScale);

    if (!moving && pawn.landingTimer === 0) {
      const breath = Math.sin(elapsed * 3 + pawn.phase) * 0.035;
      body.scale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5);
    }

    if (elapsed > pawn.nextBlink) {
      const blinkProgress = (elapsed - pawn.nextBlink) / 0.14;
      eyes.scale.y = blinkProgress < 1 ? Math.max(0.1, Math.abs(1 - blinkProgress * 2)) : 1;
      if (blinkProgress >= 1) pawn.nextBlink = elapsed + 2.5 + ((pawn.phase * 7) % 3);
    }

    // Frozen in place: no breathing, just a faint shiver.
    if (pawn.iceBlock.scale.x > 0.5 && !moving) body.scale.set(1, 1, 1);
    activeRing.visible = pawn.active && !moving;
    activeRing.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.08);
    activeArrow.visible = pawn.active && !moving;
    activeArrow.position.y = 1.6 + Math.sin(elapsed * 3.5) * 0.12;
    activeArrow.rotation.y = elapsed * 2;
    pawn.halo.position.y = HALO_HEIGHT + Math.sin(elapsed * 2 + pawn.phase) * 0.04;
    sleepLabel.visible = pawn.sleeping && !moving;
    sleepLabel.position.y = 1.25 + Math.sin(elapsed * 1.5 + pawn.phase) * 0.08;
  }

  private getStandingPoint(nodeId: NodeId): THREE.Vector3 {
    const point = this.layout.getNodePosition(nodeId);
    point.y = nodeId === HELL_NODE_ID ? this.layout.config.hellFloorY : TILE_HEIGHT;
    return point;
  }

  /** Spreads players sharing a tile on a ring so nobody hides behind anyone. */
  private computeSlots(inputs: PawnInput[]): Map<string, { position: THREE.Vector3; scale: number }> {
    const byNode = new Map<NodeId, PawnInput[]>();
    const slots = new Map<string, { position: THREE.Vector3; scale: number }>();
    for (const input of inputs) {
      // Stuck in the ice halfway down the road, away from everybody on the tiles.
      if (input.frozenTo !== undefined) {
        const halfway = this.getStandingPoint(input.position).lerp(this.getStandingPoint(input.frozenTo), 0.5);
        slots.set(input.id, { position: halfway.setY(0.05), scale: 1 });
        continue;
      }
      const list = byNode.get(input.position) ?? [];
      list.push(input);
      byNode.set(input.position, list);
    }

    for (const [nodeId, group] of byNode) {
      const center = this.getStandingPoint(nodeId);
      const crowded = group.length > 4;
      const roomy = nodeId === START_NODE_ID ? 0.22 : 0;
      const radius = group.length === 1 ? 0 : nodeId === HELL_NODE_ID ? 0.75 : (crowded ? 0.82 : 0.6) + roomy;
      group.forEach((input, index) => {
        const angle = (index / group.length) * Math.PI * 2 + Math.PI / 2;
        slots.set(input.id, {
          position: center.clone().add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius * 0.85)),
          scale: crowded ? 0.8 : 1,
        });
      });
    }
    return slots;
  }
}

/** Yaw that turns a pawn at `from` to face `to`, or null when they stand on the same spot. */
function yawTowards(from: THREE.Vector3, to: THREE.Vector3): number | null {
  const direction = to.clone().sub(from);
  return direction.x * direction.x + direction.z * direction.z > 0.0004 ? Math.atan2(direction.x, direction.z) : null;
}
