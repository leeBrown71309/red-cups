import * as THREE from "three";
import type { NodeId } from "../game/types";
import { HELL_NODE_ID } from "../game/types";
import { GHOST_CARRY_MS, GHOST_SLAP_IMPACT_MS, GHOST_SLAP_MS } from "../theme/timing";
import type { BoardLayout } from "./board-layout";
import type { EffectsLayer } from "./effects-layer";
import { createGhostModel, type GhostVisual } from "./models/ghost-model";
import { TILE_HEIGHT } from "./models/tile-model";
import { clamp01, easeInOutCubic, easeOutBack, type SceneKit } from "./scene-kit";

export interface GhostView {
  /** Null while the ghost is away. */
  nodeId: NodeId | null;
  /** Pieces of loot it carries: its coins count as one, each item as one more. */
  lootCount: number;
}

/** Where the pawns stand right now, as the ghost needs to know to chase, slap and carry them. */
export interface PawnLocator {
  getPawnPosition(id: string): THREE.Vector3 | null;
  getNearestPawnPosition(point: THREE.Vector3, maxDistance: number): THREE.Vector3 | null;
}

type GhostAction =
  | { type: "appear"; nodeId: NodeId }
  | { type: "move"; to: NodeId }
  | { type: "attack"; playerId: string }
  | { type: "vanish" }
  | { type: "stole"; playerId: string }
  /** `forward` points from the victim towards Hell, flat on the board. */
  | { type: "fling"; playerId: string; slapPoint: THREE.Vector3; forward: THREE.Vector3 }
  | { type: "return" };

const ACTION_SECONDS: Record<GhostAction["type"], number> = {
  appear: 1.4,
  move: 0.95,
  attack: 1.25,
  vanish: 1.25,
  stole: 1.1,
  // The HUD waits exactly this long for the victim to land in Hell.
  fling: (GHOST_SLAP_MS + GHOST_CARRY_MS) / 1_000,
  return: 0.85,
};

/**
 * The ghost floats on the left edge of its tile, clear of the painted number
 * and of the pawns, on the other side from Bullet Bill. Behind the tile it
 * would stand in front of Hell, seen from the table's side of tile 1.
 */
const REST_OFFSET = new THREE.Vector3(-1.35, 0, -0.1);
/** How far from its victim the ghost stands to slap it. */
const SLAP_DISTANCE = 0.8;
/** Where the ghost holds a pawn it carries off: behind it and above, its claws on its head. */
const CARRY_BEHIND = 0.5;
const CARRY_ABOVE = 0.55;
const APPEAR_DEPTH = 1.9;
const MOVE_ARC_HEIGHT = 0.6;
const RETURN_ARC_HEIGHT = 1.3;
const TRAIL_INTERVAL_SECONDS = 0.05;
/** Every so often the ghost turns to stare at the nearest pawn, then back at the table. */
const STARE_CYCLE_SECONDS = 7;
const STARE_SECONDS = 2.4;
const STARE_REACH = 3;
/**
 * A deed's event comes once the walks and banners before it are over; one
 * that never comes (the table left the game meanwhile) must not freeze the
 * ghost, which then simply catches up with the board.
 */
const PENDING_DEED_TIMEOUT_SECONDS = 12;

/**
 * Drives Luna Park's ghost. Where it rests, and whether it is there at all,
 * comes from the board view; its deeds are replayed from feedback events. The
 * rules move it the instant a turn changes, while the events wait for the
 * walk to finish, so as long as a deed is announced but not played the actor
 * holds its previous place instead of jumping ahead. The fling is the one
 * deed started by the pawn controller: the victim's flight begins with the
 * state change, and the ghost has to be there to slap it and carry it.
 */
export class GhostActor {
  private readonly visual: GhostVisual;
  private readonly hellCenter: THREE.Vector3;
  private view: GhostView | null = null;
  private announcedSeq: number | null = null;
  private playedSeq: number | null = null;
  /** The tile the ghost is shown on, which lags behind the view while a deed waits to be played. */
  private shownNode: NodeId | null = null;
  private presence = 0;
  private readonly actions: GhostAction[] = [];
  private actionElapsed = 0;
  private readonly actionStart = new THREE.Vector3();
  private actionTarget: THREE.Vector3 | null = null;
  private slapLanded = false;
  private yaw = 0;
  private trailClock = 0;
  private stareClock = 0;
  private pendingSeconds = 0;

  constructor(
    kit: SceneKit,
    private readonly effects: EffectsLayer,
    private readonly layout: BoardLayout,
    private readonly pawns: PawnLocator,
    private readonly shake: (strength: number, durationMs: number) => void,
  ) {
    this.visual = createGhostModel(kit);
    this.visual.pose.opacity = 0;
    this.hellCenter = layout.getNodePosition(HELL_NODE_ID).setY(TILE_HEIGHT);
  }

  get group(): THREE.Group {
    return this.visual.group;
  }

  sync(view: GhostView | null, eventSeq: number | null): void {
    const fresh = this.view === null;
    this.view = view;
    this.announcedSeq = eventSeq;
    // A restored game, a table joined online or a fresh one has nothing left to replay.
    if (fresh || view === null || eventSeq === null) this.playedSeq = eventSeq;
    this.visual.setLoot(view?.lootCount ?? 0);
    if (view === null) this.snapTo(null);
    else if (fresh) this.snapTo(view.nodeId);
  }

  appeared(nodeId: NodeId): void {
    this.markPlayed();
    this.actions.push({ type: "appear", nodeId });
  }

  moved(to: NodeId): void {
    this.markPlayed();
    // Its appearance was missed (say, a reconnection): it shows up where it went.
    this.actions.push(this.projectedNode() === null ? { type: "appear", nodeId: to } : { type: "move", to });
  }

  attacked(playerId: string): void {
    if (this.projectedNode() !== null) this.actions.push({ type: "attack", playerId });
  }

  stole(playerId: string): void {
    if (this.projectedNode() !== null) this.actions.push({ type: "stole", playerId });
  }

  vanished(): void {
    this.markPlayed();
    if (this.projectedNode() !== null) this.actions.push({ type: "vanish" });
  }

  /** The fling's event comes once the victim has landed: the scene played it already. */
  flung(): void {
    this.markPlayed();
  }

  /**
   * The pawn controller starts a victim's flight to Hell: the ghost drops
   * whatever it was doing to slap it and carry it. Returns where the slap
   * comes from, so the pawn reels the right way.
   */
  fling(playerId: string): THREE.Vector3 | null {
    const pawn = this.pawns.getPawnPosition(playerId);
    if (!pawn || !this.view) return null;
    this.markPlayed();
    for (const action of this.actions) this.finishAction(action);
    this.actions.length = 0;
    this.actionElapsed = 0;

    const forward = this.hellCenter.clone().sub(pawn).setY(0);
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();
    // It slaps from the victim's side, on its own side, so it can then grab it from behind without
    // passing through it.
    const side = new THREE.Vector3(forward.z, 0, -forward.x);
    const towardsGhost = this.visual.figure.position.clone().sub(pawn);
    if (this.presence > 0 && side.dot(towardsGhost) < 0) side.negate();
    const slapPoint = pawn.clone().addScaledVector(side, SLAP_DISTANCE);
    this.actions.push({ type: "fling", playerId, slapPoint, forward }, { type: "return" });
    return slapPoint.clone();
  }

  /** Distance to the ghost along the ray, or null when it is not there to be clicked. */
  hitDistance(raycaster: THREE.Raycaster): number | null {
    if (!this.view || this.visual.pose.opacity < 0.3) return null;
    return raycaster.intersectObject(this.visual.pickMesh, false)[0]?.distance ?? null;
  }

  update(elapsed: number, delta: number): void {
    const pose = this.visual.pose;
    Object.assign(pose, { armsUp: 0, slap: 0, grip: 0, lean: 0, glare: 0.25, mouth: 0, stretch: 1, flutter: 1 });
    pose.opacity = this.presence;
    this.visual.figure.scale.setScalar(1);

    this.pendingSeconds = this.isDeedPending() ? this.pendingSeconds + delta : 0;
    if (this.pendingSeconds > PENDING_DEED_TIMEOUT_SECONDS) this.markPlayed();
    if (this.view && this.actions.length === 0 && !this.isDeedPending()) this.reconcile();
    const action = this.actions[0];
    if (action) this.play(action, delta);
    else this.idle(delta);

    this.visual.figure.rotation.y = this.yaw;
    this.visual.update(elapsed, delta);
  }

  private isDeedPending(): boolean {
    return this.announcedSeq !== null && this.announcedSeq !== this.playedSeq;
  }

  private markPlayed(): void {
    this.playedSeq = this.announcedSeq;
  }

  /** The tile the ghost will be on once its queued deeds are played. */
  private projectedNode(): NodeId | null {
    let nodeId = this.shownNode;
    for (const action of this.actions) {
      if (action.type === "appear") nodeId = action.nodeId;
      if (action.type === "move") nodeId = action.to;
      if (action.type === "vanish") nodeId = null;
    }
    return nodeId;
  }

  /** With nothing left to replay, catches up with the view if a deed was never announced. */
  private reconcile(): void {
    const target = this.view?.nodeId ?? null;
    if (target === this.shownNode) return;
    if (this.shownNode === null && target !== null) this.actions.push({ type: "appear", nodeId: target });
    else if (target === null) this.actions.push({ type: "vanish" });
    else this.actions.push({ type: "move", to: target });
  }

  private snapTo(nodeId: NodeId | null): void {
    this.actions.length = 0;
    this.actionElapsed = 0;
    this.shownNode = nodeId;
    this.presence = nodeId === null ? 0 : 1;
    this.yaw = 0;
    if (nodeId !== null) this.visual.figure.position.copy(this.restingPoint(nodeId));
  }

  private restingPoint(nodeId: NodeId): THREE.Vector3 {
    return this.layout.getNodePosition(nodeId).add(REST_OFFSET).setY(TILE_HEIGHT);
  }

  private idle(delta: number): void {
    if (this.shownNode === null) return;
    const position = this.visual.figure.position;
    position.lerp(this.restingPoint(this.shownNode), Math.min(1, delta * 6));

    // Most of the time it glares at the table; now and then it turns to stare at a pawn nearby.
    this.stareClock = (this.stareClock + delta) % STARE_CYCLE_SECONDS;
    const staring = this.stareClock > STARE_CYCLE_SECONDS - STARE_SECONDS;
    const prey = staring ? this.pawns.getNearestPawnPosition(position, STARE_REACH) : null;
    this.turnTowards(prey, delta, 3);
    if (prey) this.visual.pose.glare = 0.6;
  }

  private play(action: GhostAction, delta: number): void {
    if (this.actionElapsed === 0) this.beginAction(action);
    this.actionElapsed += delta;
    const duration = ACTION_SECONDS[action.type];
    const progress = Math.min(1, this.actionElapsed / duration);

    switch (action.type) {
      case "appear":
        this.playAppear(progress);
        break;
      case "move":
        this.playMove(action.to, progress, delta);
        break;
      case "attack":
        this.playAttack(progress, delta);
        break;
      case "vanish":
        this.playVanish(progress, delta);
        break;
      case "stole":
        this.playStole(progress, delta);
        break;
      case "fling":
        this.playFling(action, delta);
        break;
      case "return":
        this.playReturn(progress, delta);
        break;
    }

    if (progress >= 1) {
      this.finishAction(action);
      this.actions.shift();
      this.actionElapsed = 0;
    }
  }

  private beginAction(action: GhostAction): void {
    const position = this.visual.figure.position;
    this.actionStart.copy(position);
    this.actionTarget = null;
    this.slapLanded = false;
    switch (action.type) {
      case "appear": {
        const rest = this.restingPoint(action.nodeId);
        position.copy(rest);
        this.actionStart.copy(rest);
        this.shownNode = action.nodeId;
        this.effects.spawnGhostMist(rest, 20);
        break;
      }
      case "attack":
        this.actionTarget = this.pawns.getPawnPosition(action.playerId);
        break;
      case "vanish":
        this.effects.spawnGhostMist(position.clone(), 18);
        break;
      case "stole": {
        const victim = this.pawns.getPawnPosition(action.playerId);
        if (victim) this.effects.spawnLootSuck(victim, () => this.sackPosition());
        break;
      }
      default:
        break;
    }
  }

  private finishAction(action: GhostAction): void {
    switch (action.type) {
      case "appear":
        this.shownNode = action.nodeId;
        this.presence = 1;
        break;
      case "move":
        this.shownNode = action.to;
        break;
      case "vanish":
        this.shownNode = null;
        this.presence = 0;
        break;
      case "stole":
        this.visual.gulpLoot();
        break;
      default:
        break;
    }
  }

  /** Rises out of the ground, spinning, arms up and wailing, in a burst of mist. */
  private playAppear(progress: number): void {
    const pose = this.visual.pose;
    const rise = easeOutBack(clamp01(progress / 0.7));
    const position = this.visual.figure.position;
    position.copy(this.actionStart).setY(this.actionStart.y - APPEAR_DEPTH * (1 - Math.min(1, rise)));
    this.visual.figure.scale.setScalar(Math.max(0.001, 0.4 + 0.6 * rise));
    this.yaw = (1 - easeInOutCubic(progress)) * Math.PI * 3;
    pose.opacity = clamp01(progress * 1.8);
    pose.armsUp = Math.sin(progress * Math.PI);
    pose.mouth = Math.sin(progress * Math.PI);
    pose.glare = 1 - progress * 0.6;
    pose.stretch = 1 + (1 - Math.min(1, rise)) * 0.6;
    pose.flutter = 3;
    if (progress < 0.6) this.trail(position, 0.01);
  }

  /** Glides round the carousel to the next tile, leaning into the ride, leaving wisps behind. */
  private playMove(to: NodeId, progress: number, delta: number): void {
    const pose = this.visual.pose;
    const target = this.restingPoint(to);
    const position = this.visual.figure.position;
    this.pointOnRing(this.actionStart, target, easeInOutCubic(progress), position);
    position.y += Math.sin(progress * Math.PI) * MOVE_ARC_HEIGHT;
    const ahead = this.pointOnRing(this.actionStart, target, easeInOutCubic(Math.min(1, progress + 0.05)));
    this.turnTowards(progress < 0.9 ? ahead : null, delta, 10);
    pose.lean = Math.sin(progress * Math.PI) * 0.45;
    pose.armsUp = Math.sin(progress * Math.PI) * 0.35;
    pose.mouth = Math.sin(progress * Math.PI) * 0.4;
    pose.flutter = 3;
    this.trail(position, delta);
  }

  /** Rears up screeching, eyes flaring, lunges at its victim, then drifts back to its place. */
  private playAttack(progress: number, delta: number): void {
    const pose = this.visual.pose;
    const rest = this.actionStart;
    const victim = this.actionTarget ?? rest;
    const lunge = rest
      .clone()
      .lerp(victim, 0.55)
      .setY(rest.y + 0.25);
    const position = this.visual.figure.position;
    this.turnTowards(victim, delta, 12);

    if (progress < 0.3) {
      const rear = easeInOutCubic(progress / 0.3);
      position.copy(rest).setY(rest.y + rear * 0.35);
      pose.lean = -0.35 * rear;
      pose.armsUp = rear;
      pose.mouth = rear;
      pose.glare = 0.3 + rear * 0.7;
    } else if (progress < 0.5) {
      const dash = easeOutBack((progress - 0.3) / 0.2);
      position.lerpVectors(rest.clone().setY(rest.y + 0.35), lunge, Math.min(1.1, dash));
      pose.lean = 0.5;
      pose.armsUp = 1 - dash * 0.7;
      pose.mouth = 1;
      pose.glare = 1;
      pose.flutter = 3;
      if (!this.slapLanded) {
        this.slapLanded = true;
        this.effects.spawnGhostMist(lunge.clone().setY(rest.y), 10);
        this.shake(0.12, 260);
      }
    } else {
      const back = easeInOutCubic(clamp01((progress - 0.6) / 0.4));
      position.lerpVectors(lunge, rest, back);
      pose.lean = 0.5 * (1 - back);
      pose.armsUp = 0.3 * (1 - back);
      pose.mouth = 1 - back * 0.7;
      pose.glare = 1 - back * 0.5;
    }
  }

  /** Spins faster and faster, stretches thin and melts into mist. */
  private playVanish(progress: number, delta: number): void {
    const pose = this.visual.pose;
    const position = this.visual.figure.position;
    position.copy(this.actionStart).setY(this.actionStart.y + easeInOutCubic(progress) * 0.9);
    this.yaw += delta * (4 + progress * 18);
    pose.stretch = 1 + easeInOutCubic(progress) * 1.8;
    pose.opacity = 1 - clamp01((progress - 0.2) / 0.8);
    pose.armsUp = 1;
    pose.mouth = 1;
    pose.glare = 1 - progress;
    pose.flutter = 4;
    this.trail(position, delta);
  }

  /** A gleeful cackle, hands up, while the loot flies into its sack. */
  private playStole(progress: number, delta: number): void {
    const pose = this.visual.pose;
    this.turnTowards(null, delta, 4);
    this.visual.figure.position.copy(this.actionStart).setY(this.actionStart.y + Math.sin(progress * Math.PI) * 0.3);
    const cackle = Math.abs(Math.sin(progress * Math.PI * 6));
    pose.lean = -0.25 * cackle * (1 - progress);
    pose.armsUp = 0.6 * Math.sin(progress * Math.PI);
    pose.mouth = 0.4 + cackle * 0.6;
    pose.glare = 0.8;
  }

  /**
   * Timed on the victim's own flight: it closes in and winds up, slaps at
   * `GHOST_SLAP_IMPACT_MS`, grabs the pawn by the end of `GHOST_SLAP_MS` and
   * then holds it all the way down into Hell.
   */
  private playFling(action: Extract<GhostAction, { type: "fling" }>, delta: number): void {
    const pose = this.visual.pose;
    const position = this.visual.figure.position;
    const elapsedMs = this.actionElapsed * 1_000;
    const pawn = this.pawns.getPawnPosition(action.playerId) ?? action.slapPoint;
    pose.opacity = 1;
    pose.glare = 1;
    this.presence = 1;

    const { forward } = action;
    const carryPoint = pawn
      .clone()
      .addScaledVector(forward, -CARRY_BEHIND)
      .setY(pawn.y + CARRY_ABOVE);

    const windUpEnd = GHOST_SLAP_IMPACT_MS - 80;
    const swingEnd = GHOST_SLAP_IMPACT_MS + 60;
    if (elapsedMs < GHOST_SLAP_MS) {
      position.lerpVectors(this.actionStart, action.slapPoint, easeInOutCubic(clamp01(elapsedMs / 240)));
      this.turnTowards(pawn, delta, 14);
      pose.mouth = 0.7;
      if (elapsedMs < windUpEnd) {
        pose.slap = -easeInOutCubic(clamp01(elapsedMs / windUpEnd));
        pose.lean = -0.2 * -pose.slap;
      } else if (elapsedMs < swingEnd) {
        pose.slap = -1 + 2 * clamp01((elapsedMs - windUpEnd) / (swingEnd - windUpEnd));
        pose.lean = 0.35;
      } else {
        const grab = easeInOutCubic(clamp01((elapsedMs - swingEnd) / (GHOST_SLAP_MS - swingEnd)));
        pose.slap = 1 - grab;
        pose.grip = grab;
        pose.lean = 0.35;
        position.lerpVectors(action.slapPoint, carryPoint, grab);
      }
      if (!this.slapLanded && elapsedMs >= GHOST_SLAP_IMPACT_MS) {
        this.slapLanded = true;
        this.effects.spawnSlapImpact(pawn.clone().setY(pawn.y + 0.75));
        this.shake(0.22, 280);
      }
      return;
    }

    position.copy(carryPoint);
    this.turnTowards(carryPoint.clone().add(forward), delta, 14);
    pose.grip = 1;
    pose.lean = 0.35;
    pose.mouth = 0.5 + Math.abs(Math.sin(elapsedMs * 0.018)) * 0.5;
    pose.flutter = 4;
    this.trail(position, delta);
  }

  /** Lets go of its victim in Hell and flies back up to its tile. */
  private playReturn(progress: number, delta: number): void {
    const pose = this.visual.pose;
    const position = this.visual.figure.position;
    if (this.shownNode === null) {
      pose.opacity = 1 - progress;
      this.presence = pose.opacity;
      return;
    }
    const rest = this.restingPoint(this.shownNode);
    position.lerpVectors(this.actionStart, rest, easeInOutCubic(progress));
    position.y += Math.sin(progress * Math.PI) * RETURN_ARC_HEIGHT;
    this.turnTowards(progress < 0.8 ? rest : null, delta, 8);
    pose.grip = 1 - clamp01(progress * 3);
    pose.lean = Math.sin(progress * Math.PI) * 0.3;
    pose.mouth = 0.3 * (1 - progress);
    pose.flutter = 3;
    this.trail(position, delta);
  }

  /** Point `amount` of the way from `from` to `to`, round Hell like the carousel rides. */
  private pointOnRing(
    from: THREE.Vector3,
    to: THREE.Vector3,
    amount: number,
    out = new THREE.Vector3(),
  ): THREE.Vector3 {
    const center = this.hellCenter;
    const fromAngle = Math.atan2(from.z - center.z, from.x - center.x);
    const toAngle = Math.atan2(to.z - center.z, to.x - center.x);
    const turn = Math.atan2(Math.sin(toAngle - fromAngle), Math.cos(toAngle - fromAngle));
    const angle = fromAngle + turn * amount;
    const radius = THREE.MathUtils.lerp(
      Math.hypot(from.x - center.x, from.z - center.z),
      Math.hypot(to.x - center.x, to.z - center.z),
      amount,
    );
    return out.set(
      center.x + Math.cos(angle) * radius,
      THREE.MathUtils.lerp(from.y, to.y, amount),
      center.z + Math.sin(angle) * radius,
    );
  }

  /** Turns to face `point`, or back towards the table (+Z) when there is none. */
  private turnTowards(point: THREE.Vector3 | null, delta: number, rate: number): void {
    let target = 0;
    if (point) {
      const direction = point.clone().sub(this.visual.figure.position);
      if (direction.x * direction.x + direction.z * direction.z > 0.0004) target = Math.atan2(direction.x, direction.z);
    }
    const turn = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
    this.yaw += turn * Math.min(1, delta * rate);
  }

  private trail(position: THREE.Vector3, delta: number): void {
    this.trailClock += delta;
    if (this.trailClock < TRAIL_INTERVAL_SECONDS) return;
    this.trailClock = 0;
    this.effects.spawnGhostWisp(position.clone().setY(position.y + 0.5));
  }

  private sackPosition(): THREE.Vector3 {
    return this.visual.figure.position.clone().add(new THREE.Vector3(0, 0.9, 0));
  }
}
