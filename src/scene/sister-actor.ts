import * as THREE from "three";
import { findEdge } from "../game/board";
import type { NodeId, PlayerMovement, PowerEvent } from "../game/types";
import {
  GLIDE_MS,
  HOP_MS,
  SISTER_CONDENSE_MS,
  SISTER_DISSOLVE_MS,
  SISTER_SNAP_IN_MS,
  SISTER_SNAP_OUT_MS,
  SISTER_TRANSIT_MS,
  TUNNEL_DIVE_MS,
  TUNNEL_EXTRA_MS,
  TUNNEL_POP_MS,
  WOBBLE_MS,
  BUMP_MS,
} from "../theme/timing";
import type { BoardLayout } from "./board-layout";
import { SISTER_MIST_COLORS, type EffectsLayer } from "./effects-layer";
import { createSisterModel, type SisterVisual } from "./models/sister-model";
import { TILE_HEIGHT } from "./models/tile-model";
import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, type SceneKit } from "./scene-kit";

/** One little ghost to draw: whose she is, where she floats, and whether the fog hides her from this viewer. */
export interface SisterView {
  ownerId: string;
  /** The owner's colour: it tints the glow under her. */
  color: string;
  nodeId: NodeId;
  hidden: boolean;
}

type SisterAction =
  /** A hop to the next tile, in step with the owner's. */
  | { type: "hop"; node: NodeId; duration: number }
  /** Stays where she is while the owner takes a step that leaves her in place. */
  | { type: "wait"; duration: number }
  /** Dissolves into mist where she floats. */
  | { type: "dissolve"; duration: number }
  /** Condenses out of mist on `node`. */
  | { type: "condense"; node: NodeId; duration: number }
  /** Does nothing for a while: the mist is crossing the board. */
  | { type: "hover"; duration: number };

/** Where she floats on a tile: left of the middle, clear of the owner's pawn, the mud and the Portail. */
const REST_OFFSET = new THREE.Vector3(-0.74, 0, 0.12);
const SISTER_SCALE = 0.86;
const HOP_ARC = 0.55;
/** How long a swap or a Hell trip may keep her held in place waiting for its event, before she catches up. */
const HELD_TIMEOUT_SECONDS = 6;
/** A move explained by a deed that was played first (its event beat the board's update) stays valid this long. */
const EXPLAINED_SECONDS = 1.5;

interface SisterActor {
  ownerId: string;
  visual: SisterVisual;
  /** The tile she was last told to float on. */
  logicalNode: NodeId;
  /** The tile she is shown on, which lags behind while a deed waits to be played. */
  shownNode: NodeId;
  actions: SisterAction[];
  actionElapsed: number;
  actionStart: THREE.Vector3;
  /** Opacity the running action asks for, before the fog. */
  actionOpacity: number;
  fogOpacity: number;
  hidden: boolean;
  /** Set while a power event (a swap) has moved her and she waits for it to be played. */
  heldSeconds: number | null;
  explainedSeconds: number;
  phase: number;
}

/**
 * The Sœur Fantôme of every player who holds the card. Where each one floats comes from the board view; she hops in
 * step with her owner (the walk's `sister` record: one tile for each of their steps, repeating the tile where she
 * stays), and any other move (a trip to Hell sends her back to the start) is a quick fade out and in. The swap is
 * played from its event, as the rules move her the instant it is played: she is held in place until then.
 */
export class SisterController {
  readonly group = new THREE.Group();
  private readonly actors = new Map<string, SisterActor>();
  private lastMovementSeq = 0;
  private seed = 0;

  constructor(
    private readonly kit: SceneKit,
    private readonly effects: EffectsLayer,
    private readonly layout: BoardLayout,
  ) {}

  acknowledgeMovement(movement: PlayerMovement | null): void {
    if (movement) this.lastMovementSeq = movement.seq;
  }

  /**
   * `pending` is the power event the board knows of and has not played: a swap holds her in place for it.
   * A swap played before the board's update reached her is told apart by `explainedSeconds`.
   */
  sync(views: SisterView[], movement: PlayerMovement | null, pending: PowerEvent | null): void {
    const wanted = new Set(views.map((view) => view.ownerId));
    for (const [ownerId, actor] of this.actors) {
      if (wanted.has(ownerId)) continue;
      this.group.remove(actor.visual.group);
      actor.visual.dispose();
      this.actors.delete(ownerId);
    }

    const isNewMovement = movement !== null && movement.seq !== this.lastMovementSeq;
    for (const view of views) {
      let actor = this.actors.get(view.ownerId);
      if (!actor) {
        actor = this.createActor(view);
        this.actors.set(view.ownerId, actor);
        continue;
      }
      actor.hidden = view.hidden;

      const mirror = movement?.sister;
      if (isNewMovement && mirror && mirror.playerId === view.ownerId && actor.logicalNode === mirror.from) {
        this.queueMirror(actor, movement, mirror.path);
      } else if (actor.logicalNode !== view.nodeId) {
        if (pending?.kind === "sister-swap" && pending.playerId === view.ownerId) {
          actor.heldSeconds = 0;
        } else if (actor.explainedSeconds > 0) {
          actor.explainedSeconds = 0;
        } else {
          this.queueSnap(actor, view.nodeId);
        }
      }
      actor.logicalNode = view.nodeId;
    }
    if (movement) this.lastMovementSeq = movement.seq;
  }

  /** The swap: she and her owner dissolve into mist, trade places, and condense again. */
  playSwap(event: Extract<PowerEvent, { kind: "sister-swap" }>): void {
    const actor = this.actors.get(event.playerId);
    if (!actor) return;
    actor.heldSeconds = null;
    actor.explainedSeconds = EXPLAINED_SECONDS;
    actor.actions.length = 0;
    actor.actionElapsed = 0;
    // She is told apart from the others by the tile she stands on: it is the one she swaps from.
    actor.shownNode = event.sisterFrom;
    actor.actions.push(
      { type: "dissolve", duration: SISTER_DISSOLVE_MS },
      { type: "hover", duration: SISTER_TRANSIT_MS },
      { type: "condense", node: event.playerFrom, duration: SISTER_CONDENSE_MS },
    );
  }

  /** Whatever a skipped event left held in place catches up with the board. */
  releaseHolds(): void {
    for (const actor of this.actors.values()) {
      if (actor.heldSeconds === null) continue;
      actor.heldSeconds = null;
      this.queueSnap(actor, actor.logicalNode);
    }
  }

  /** The point on the board she floats over, for the effects that fly to or from her. */
  getFloorPoint(ownerId: string): THREE.Vector3 | null {
    const actor = this.actors.get(ownerId);
    return actor ? this.restingPoint(actor, actor.shownNode) : null;
  }

  /** Where she floats on `nodeId` for the effects of a swap, even if she is not shown there yet. */
  getRestingPoint(ownerId: string, nodeId: NodeId): THREE.Vector3 {
    const actor = this.actors.get(ownerId);
    return actor ? this.restingPoint(actor, nodeId) : this.layout.getNodePosition(nodeId).setY(TILE_HEIGHT);
  }

  update(elapsed: number, delta: number): void {
    for (const actor of this.actors.values()) {
      if (actor.heldSeconds !== null) {
        actor.heldSeconds += delta;
        if (actor.heldSeconds > HELD_TIMEOUT_SECONDS) {
          actor.heldSeconds = null;
          this.queueSnap(actor, actor.logicalNode);
        }
      }
      if (actor.explainedSeconds > 0) actor.explainedSeconds = Math.max(0, actor.explainedSeconds - delta);

      const pose = actor.visual.pose;
      Object.assign(pose, { stretch: 1, lean: 0, lift: 0, flutter: 1 });
      actor.actionOpacity = 1;
      const action = actor.actions[0];
      if (action) this.play(actor, action, delta);
      else this.idle(actor, delta);

      // The fog fades her in and out on its own, whatever she is doing.
      const fogTarget = actor.hidden ? 0 : 1;
      actor.fogOpacity += (fogTarget - actor.fogOpacity) * Math.min(1, delta * 9);
      pose.opacity = actor.actionOpacity * actor.fogOpacity;
      actor.visual.figure.scale.setScalar(SISTER_SCALE);
      actor.visual.update(elapsed, delta);
    }
  }

  dispose(): void {
    for (const actor of this.actors.values()) actor.visual.dispose();
    this.actors.clear();
  }

  private createActor(view: SisterView): SisterActor {
    const visual = createSisterModel(this.kit, view.color, this.seed);
    this.seed += 1;
    this.group.add(visual.group);
    const actor: SisterActor = {
      ownerId: view.ownerId,
      visual,
      logicalNode: view.nodeId,
      shownNode: view.nodeId,
      actions: [],
      actionElapsed: 0,
      actionStart: new THREE.Vector3(),
      actionOpacity: 1,
      fogOpacity: view.hidden ? 0 : 1,
      hidden: view.hidden,
      heldSeconds: null,
      explainedSeconds: 0,
      phase: this.seed * 1.9,
    };
    visual.group.position.copy(this.restingPoint(actor, view.nodeId));
    return actor;
  }

  /** Where she floats on a tile: a second sister on the same tile takes the opposite side. */
  private restingPoint(actor: SisterActor, nodeId: NodeId): THREE.Vector3 {
    let rank = 0;
    for (const other of this.actors.values()) {
      if (other === actor) break;
      if (other.shownNode === nodeId) rank += 1;
    }
    const offset = REST_OFFSET.clone();
    if (rank % 2 === 1) offset.x *= -1;
    return this.layout.getNodePosition(nodeId).add(offset).setY(TILE_HEIGHT);
  }

  /**
   * The walk's tiles for her, one for each of the owner's steps, timed as the owner's own steps are: a step that
   * leaves her where she is makes her wait, and she lands on a new tile as the owner lands.
   */
  private queueMirror(actor: SisterActor, movement: PlayerMovement, tiles: NodeId[]): void {
    const durations = this.getStepDurations(movement);
    let previous = actor.logicalNode;
    tiles.forEach((node, index) => {
      const duration = durations[index] ?? HOP_MS;
      if (node === previous) {
        actor.actions.push({ type: "wait", duration });
      } else {
        // On a longer step (a slide on the ice, a tunnel) she waits first, so that she lands as the owner does.
        if (duration > HOP_MS) actor.actions.push({ type: "wait", duration: duration - HOP_MS });
        actor.actions.push({ type: "hop", node, duration: Math.min(duration, HOP_MS) });
      }
      previous = node;
    });
  }

  /** How long each step of a walk takes the owner, as `estimateMovementMs` counts it. */
  private getStepDurations(movement: PlayerMovement): number[] {
    if (movement.tunnel) return [TUNNEL_DIVE_MS + TUNNEL_POP_MS];
    const slideStart = movement.slideStart ?? movement.path.length;
    let previous = movement.from;
    return movement.path.map((nodeId, index) => {
      let duration = index >= slideStart ? WOBBLE_MS + GLIDE_MS : HOP_MS;
      if (index < slideStart && findEdge(this.layout.board, previous, nodeId)?.kind === "tunnel") {
        duration += HOP_MS + TUNNEL_EXTRA_MS;
      }
      duration += (movement.bumps ?? []).filter((bump) => bump.index === index).length * BUMP_MS;
      previous = nodeId;
      return duration;
    });
  }

  /** A move nobody explains (the owner fell into Hell, a late sync): she fades out where she was, in where she is. */
  private queueSnap(actor: SisterActor, node: NodeId): void {
    actor.actions.push(
      { type: "dissolve", duration: SISTER_SNAP_OUT_MS },
      { type: "condense", node, duration: SISTER_SNAP_IN_MS },
    );
  }

  private idle(actor: SisterActor, delta: number): void {
    if (actor.heldSeconds === null) {
      actor.visual.group.position.lerp(this.restingPoint(actor, actor.shownNode), Math.min(1, delta * 7));
    }
  }

  private play(actor: SisterActor, action: SisterAction, delta: number): void {
    const { visual } = actor;
    if (actor.actionElapsed === 0) this.beginAction(actor, action);
    actor.actionElapsed += delta * 1_000;
    const progress = clamp01(actor.actionElapsed / action.duration);
    const pose = visual.pose;

    switch (action.type) {
      case "hop": {
        const target = this.restingPoint(actor, action.node);
        visual.group.position.lerpVectors(actor.actionStart, target, easeInOutCubic(progress));
        // A little crouch, a stretch in the air, a squash on landing: a small ghost's hop.
        const arc = Math.sin(progress * Math.PI);
        pose.lift = arc * HOP_ARC;
        pose.stretch = 1 + arc * 0.1 - (progress > 0.88 ? 0.08 : 0);
        pose.lean = arc * 0.22;
        pose.flutter = 3;
        break;
      }
      case "wait":
        // A shimmy: she is staying, and she lets the owner know.
        pose.lift = Math.sin(progress * Math.PI * 2) * 0.04;
        pose.flutter = 1.6;
        break;
      case "dissolve": {
        const out = easeOutCubic(progress);
        actor.actionOpacity = 1 - out;
        pose.stretch = 1 + out * 0.9;
        pose.lift = out * 0.3;
        pose.flutter = 4;
        break;
      }
      case "condense": {
        const rise = easeOutBack(progress);
        actor.actionOpacity = clamp01(progress * 1.6);
        pose.stretch = 1 + (1 - Math.min(1, rise)) * 0.8;
        pose.lift = (1 - easeOutCubic(progress)) * 0.3;
        pose.flutter = 3;
        break;
      }
      case "hover":
        actor.actionOpacity = 0;
        break;
    }

    if (progress >= 1) this.finishAction(actor, action);
  }

  private beginAction(actor: SisterActor, action: SisterAction): void {
    const { group } = actor.visual;
    actor.actionStart.copy(group.position);
    switch (action.type) {
      case "dissolve":
        this.effects.spawnGhostMist(group.position.clone(), 10, SISTER_MIST_COLORS, true);
        break;
      case "condense": {
        actor.shownNode = action.node;
        group.position.copy(this.restingPoint(actor, action.node));
        actor.actionStart.copy(group.position);
        this.effects.spawnGhostMist(group.position.clone(), 10, SISTER_MIST_COLORS, true);
        break;
      }
      default:
        break;
    }
  }

  private finishAction(actor: SisterActor, action: SisterAction): void {
    if (action.type === "hop") {
      actor.shownNode = action.node;
      actor.visual.group.position.copy(this.restingPoint(actor, action.node));
    }
    actor.actions.shift();
    actor.actionElapsed = 0;
  }
}
