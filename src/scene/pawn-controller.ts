import * as THREE from "three";
import { findEdge } from "../game/board";
import type { NodeId, PlayerColor, PlayerMovement, PowerEvent } from "../game/types";
import { HELL_NODE_ID, START_NODE_ID } from "../game/types";
import { emitFeedback, type FeedbackEvent } from "../feedback/event-bus";
import { getPlayerLook } from "../theme/player-looks";
import {
  BUMP_MS,
  FERRY_RIDE_MS,
  FREEZE_MS,
  GHOST_CARRY_MS,
  GHOST_SLAP_IMPACT_MS,
  GHOST_SLAP_MS,
  GLIDE_MS,
  HELL_DROP_MS,
  INVISIBILITY_FADE_MS,
  INVISIBILITY_POP_MS,
  MARK_BURN_MS,
  MARK_EMERGE_MS,
  MARK_SUCK_MS,
  MARK_TRANSIT_MS,
  MUD_SLIP_MS,
  HOP_MS,
  PORTAL_SWALLOW_MS,
  SHATTER_MS,
  SISTER_CONDENSE_MS,
  SISTER_DISSOLVE_MS,
  SISTER_TRANSIT_MS,
  SURFACE_MS,
  TUNNEL_DIVE_MS,
  TUNNEL_EXTRA_MS,
  TUNNEL_POP_MS,
  WHIRL_MS,
  WOBBLE_MS,
} from "../theme/timing";
import type { BoardLayout } from "./board-layout";
import { createPawnVisual, type PawnVisual } from "./models/pawn-model";
import { TILE_HEIGHT } from "./models/tile-model";
import { easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, phase, type SceneKit } from "./scene-kit";

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
  /** Mi-vu, Mi-vue: the fog hides this pawn from the viewer: it is not drawn at all, and takes no place on its tile. */
  hidden?: boolean;
  /** Mi-vu, Mi-vue: the viewer's own pawn, invisible to the others, is drawn see-through for them alone. */
  ghostly?: boolean;
}

/** The quays a ferry crossing joins. */
export interface FerryInfo {
  from: NodeId;
  to: NodeId;
}

/** The tunnel a dive or a pop belongs to. */
export interface TunnelInfo {
  id: string;
  /** The dive digs the tunnel: it did not exist before. */
  dug: boolean;
  from: NodeId;
  to: NodeId;
}

type PawnAction =
  | { type: "hop"; to: THREE.Vector3; duration: number }
  | { type: "slide"; to: THREE.Vector3; duration: number }
  | { type: "glide"; to: THREE.Vector3; duration: number }
  | { type: "wobble"; duration: number }
  /** Banquise: runs at a Barrière, knocks against it and rebounds to where it stood. */
  | { type: "bump"; to: THREE.Vector3; from: NodeId; toward: NodeId; duration: number }
  | { type: "freeze"; duration: number }
  | { type: "shatter"; duration: number }
  | { type: "vanish"; duration: number }
  /** Shows up at `at`, or on the tile the pawn is meant to stand on when there is none. */
  | { type: "appear"; at?: THREE.Vector3; duration: number }
  | { type: "tumble"; duration: number }
  /** Luna Park: cowers, then reels from the ghost's slap; `source` is where the hand comes from. */
  | { type: "slapped"; duration: number; source?: THREE.Vector3 }
  /** Luna Park: dangling from the ghost's claws, flown high over the carousel down into Hell. */
  | { type: "carried"; to: THREE.Vector3; duration: number }
  /** Portail: the tile's portal widens, and the pawn whirls down into it. */
  | { type: "portalSwallow"; nodeId: NodeId; duration: number }
  /** Portail: the pawn drops from above through the Hell-side portal onto the Hell floor. */
  | { type: "hellDrop"; to: THREE.Vector3; duration: number }
  /** Chance aveugle: feet lost in the mud, a skid and a spin, thrown back to the tile it came from. */
  | { type: "mudSlip"; to: THREE.Vector3; duration: number }
  /** Taupe: digs into the ground like a drill, in a spray of soil. */
  | { type: "dive"; duration: number; tunnel: TunnelInfo; deepBurst?: boolean }
  /** Taupe: bursts out of the ground at the other end of the tunnel, and lands. */
  | { type: "pop"; to: THREE.Vector3; duration: number; tunnel: TunnelInfo }
  /** Mage noir: drawn into the vortex, spinning and stretching thin. */
  | { type: "suck"; duration: number }
  /** Mage noir: steps out of the burst of light on the pentagram: on `at`, or on the tile the pawn is meant to stand on. */
  | { type: "emerge"; duration: number; at?: THREE.Vector3 }
  /** Mage noir: caught in the hellfire, scorched and swallowed. */
  | { type: "burn"; duration: number }
  /**
   * Archipel: boards the ferry, rides on its deck as it sails, and steps off at `to`. The boat sails between the
   * first and last sixths of the action; `deckAtLanding` is where the deck was when the pawn stepped off.
   */
  | { type: "sail"; to: THREE.Vector3; duration: number; ferry: FerryInfo; deckAtLanding?: THREE.Vector3 }
  /** Archipel: spun down a whirlpool, thinner and faster. */
  | { type: "whirl"; duration: number }
  /** Archipel: comes up out of the sea, on `at`, at the quay another island's whirlpool threw it to. */
  | { type: "surface"; duration: number; at?: THREE.Vector3 }
  /** Sœur Fantôme: dissolves into mist where it stands. */
  | { type: "dissolve"; duration: number }
  /** Sœur Fantôme: condenses out of mist on the tile the pawn is meant to stand on. */
  | { type: "condense"; duration: number }
  /** Mime: a squash, a jump with a full turn, a landing. */
  | { type: "mimic"; duration: number }
  /** Mage noir: out of chances, scorched, crumbles to ash, then leaves the table. */
  | { type: "crumble"; duration: number }
  /** Stays where it is (and out of sight, when `invisible`) while something else plays. */
  | { type: "wait"; duration: number; invisible?: boolean };

/** A moment of a pawn's choreography that the rest of the scene joins in: the soil, the vortex, the flame. */
export type PawnPhase =
  | "dive"
  | "dig-deep"
  | "pop"
  | "suck"
  | "emerge"
  | "burn"
  | "dissolve"
  | "condense"
  | "crumble"
  | "fade-out"
  | "pop-in"
  | "sail"
  | "whirl"
  | "surface";

export interface PawnPhaseInfo {
  phase: PawnPhase;
  playerId: string;
  /** Where the pawn is as the phase begins. */
  position: THREE.Vector3;
  /** For a dive and a pop. */
  tunnel?: TunnelInfo;
  /** For a ferry crossing. */
  ferry?: FerryInfo;
  /** The fog hides this pawn from the viewer: whatever it does stays out of sight and out of hearing. */
  hidden: boolean;
}

/** Lets the scene's other actors join in a pawn's animation. */
export interface PawnHooks {
  /** A pawn is about to be slapped and carried off by the ghost; returns where the ghost slaps from. */
  onGhostSlap?: (pawnId: string) => THREE.Vector3 | null;
  /** A pawn's choreography reaches a moment the effects, the tunnel and the sounds follow. */
  onPhase?: (info: PawnPhaseInfo) => void;
  /** Archipel: where the ferry's deck is right now, and the way the boat heads; null when it is not afloat. */
  getFerryDeck?: () => { position: THREE.Vector3; heading: THREE.Vector3 } | null;
}

const TUMBLE_MS = 820;
/** How high the ghost flies its victim over the carousel. */
const CARRY_ARC_HEIGHT = 2.4;
/** How far above the Hell floor the portal spits a falling pawn out. */
const HELL_DROP_HEIGHT = 2.2;
/** How far the slap knocks the pawn back. */
const SLAP_KNOCKBACK = 0.3;
/** How deep a pawn digs, and how far under the ground it pops from. */
const DIG_DEPTH = 0.55;
/** How opaque the viewer's own pawn is when the fog makes it see-through. */
export const GHOSTLY_OPACITY = 0.35;
/** A move whose power event never comes (it was lost, or the table left) must not freeze the pawn for good. */
const HELD_TIMEOUT_SECONDS = 6;
/** A move explained by a power event that was played first stays valid this long. */
const EXPLAINED_SECONDS = 1.5;

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
  /** Scale of the whole pawn, which eases towards `baseScale` (a little more when it is the active one). */
  rootScale: number;
  /** Banquise: the ice block around a frozen pawn, grown by "freeze", burst by "shatter". */
  iceBlock: THREE.Mesh;
  /** L'Ange-Gardien's protégé: a golden ring floating over the head. */
  halo: THREE.Mesh;
  /** Where the pawn is meant to stand on its tile, with the others of the tile around it. */
  slot: THREE.Vector3;
  /** Mi-vu, Mi-vue: how opaque the fog lets it be (0 hidden, a little for the viewer's own), and how much it is now. */
  fogTarget: number;
  fogAlpha: number;
  /** What the view said last, so that a change in it (not the view itself) moves `fogTarget`. */
  viewHidden: boolean;
  viewGhostly: boolean;
  /** How long since it popped back into sight, for the little overshoot. */
  popAge: number;
  /** Opacity and scorching asked by the running action, set anew every frame. */
  actionFade: number;
  char: number;
  /** Seconds this pawn has waited for a power event to play, null if it is not waiting. */
  held: number | null;
  /** A power event moved it: the move is the event's, not a repositioning of its own. */
  explained: number;
  /** A power event has it in its choreography, which the other events about it (a poof, a sound) must leave alone. */
  choreographed: boolean;
  /** Out of the game, kept on the board until its last deed is played. */
  dying: boolean;
}

const LANDING_MS = 150;
/** Where the protégé's halo floats, over the pawn's head. */
const HALO_HEIGHT = 1.08;

/** Actions that turn the body round: the idle yaw must leave them alone. */
const SPINNING_ACTIONS: PawnAction["type"][] = [
  "vanish",
  "appear",
  "wobble",
  "carried",
  "mudSlip",
  "dive",
  "pop",
  "suck",
  "emerge",
  "burn",
  "dissolve",
  "condense",
  "mimic",
  "crumble",
  "whirl",
  "surface",
];

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

  /** `pendingPower` is the power event the board knows of and has not played yet: it holds the pawns it moves. */
  sync(inputs: PawnInput[], movement: PlayerMovement | null, pendingPower: PowerEvent | null = null): void {
    const inputIds = new Set(inputs.map((input) => input.id));
    for (const [id, pawn] of this.pawns) {
      if (inputIds.has(id)) continue;
      if (pawn.dying) {
        pawn.dying = true;
        pawn.choreographed = true;
        pawn.held ??= 0;
        continue;
      }
      this.removePawn(id);
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
        pawn.slot.copy(slot.position);
        this.queueWalk(pawn, movement, slot.position);
      } else if (pawn.logicalNode !== input.position) {
        pawn.slot.copy(slot.position);
        if (this.isMovedByPower(pendingPower, input.id)) {
          // The move belongs to a power event that is yet to be played: the pawn stays where it is until then.
          pawn.held = 0;
          pawn.choreographed = true;
        } else if (pawn.explained > 0) {
          pawn.explained = 0;
        } else {
          pawn.actions.push(
            { type: "vanish", duration: 240 },
            { type: "appear", at: slot.position.clone(), duration: 320 },
          );
        }
      } else if (
        pawn.actions.length === 0 &&
        pawn.held === null &&
        pawn.visual.root.position.distanceTo(slot.position) > 0.02
      ) {
        pawn.slot.copy(slot.position);
        pawn.actions.push({ type: "slide", to: slot.position.clone(), duration: 260 });
      }
      pawn.slot.copy(slot.position);

      // Out of the ice (moved by a Corde or a swap, or thawed after a lost turn): the block bursts.
      const iceQueued = pawn.actions.some((action) => action.type === "freeze" || action.type === "shatter");
      const iceHeld = input.frozenTo !== undefined || input.snowFrozen === true;
      if (!iceHeld && !iceQueued && pawn.iceBlock.scale.x > 0.5) {
        pawn.actions.push({ type: "shatter", duration: SHATTER_MS });
      }

      // Mi-vu, Mi-vue: what the fog says moves the pawn's opacity when it changes. An event may have moved it first.
      const hidden = input.hidden === true;
      const ghostly = input.ghostly === true;
      if (hidden !== pawn.viewHidden || ghostly !== pawn.viewGhostly) {
        pawn.viewHidden = hidden;
        pawn.viewGhostly = ghostly;
        pawn.fogTarget = hidden ? 0 : ghostly ? GHOSTLY_OPACITY : 1;
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

  /**
   * The deed of a Cups Power is played: the pawns it concerns do their choreography. Run whether the board's update
   * reached the pawns first (they were held in place) or after (the move that follows is then told to be explained).
   */
  playPower(event: PowerEvent): void {
    switch (event.kind) {
      case "mark-teleport": {
        const mage = this.pawns.get(event.playerId);
        if (mage) {
          const steps: PawnAction[] = [
            { type: "suck", duration: MARK_SUCK_MS },
            { type: "wait", duration: MARK_TRANSIT_MS, invisible: true },
            // The mud under the mark drops the mage into Hell, but they land on the pentagram first.
            {
              type: "emerge",
              duration: MARK_EMERGE_MS,
              ...(event.mudHell ? { at: this.getStandingPoint(event.to) } : {}),
            },
          ];
          // The mud under the mark swallows the mage themself: they land, then the fire takes them.
          if (event.mudHell) {
            steps.push(
              { type: "wait", duration: 80 },
              { type: "burn", duration: MARK_BURN_MS },
              { type: "appear", duration: 320 },
            );
          }
          this.choreograph(mage, steps);
        }
        for (const victimId of event.victimIds) {
          const victim = this.pawns.get(victimId);
          if (!victim) continue;
          // The fire rises as the mage lands; the victims are caught in it, then drop out of a portal in Hell.
          this.choreograph(victim, [
            { type: "wait", duration: MARK_SUCK_MS + MARK_TRANSIT_MS },
            { type: "burn", duration: MARK_BURN_MS },
            { type: "appear", duration: 320 },
          ]);
        }
        return;
      }
      case "sister-swap": {
        const owner = this.pawns.get(event.playerId);
        if (!owner) return;
        this.choreograph(owner, [
          { type: "dissolve", duration: SISTER_DISSOLVE_MS },
          { type: "wait", duration: SISTER_TRANSIT_MS, invisible: true },
          { type: "condense", duration: SISTER_CONDENSE_MS },
        ]);
        return;
      }
      case "mime-copy": {
        const copier = this.pawns.get(event.playerId);
        if (copier && copier.actions.length === 0) copier.actions.push({ type: "mimic", duration: 620 });
        return;
      }
      default:
        return;
    }
  }

  /**
   * Mi-vu, Mi-vue: a pawn comes into sight or leaves it. The fog may already say so (the view is a little behind the
   * events), but this is the moment the table sees it: a fade with sparkles, or a pop with a flash.
   */
  playInvisibility(id: string, opacity: number): void {
    const pawn = this.pawns.get(id);
    if (!pawn || Math.abs(pawn.fogTarget - opacity) < 0.01) return;
    const appearing = opacity > pawn.fogTarget;
    pawn.fogTarget = opacity;
    if (appearing) pawn.popAge = 0;
    this.hooks.onPhase?.({
      phase: appearing ? "pop-in" : "fade-out",
      playerId: id,
      position: pawn.visual.root.position.clone(),
      hidden: false,
    });
  }

  getPawnPosition(id: string): THREE.Vector3 | null {
    const pawn = this.pawns.get(id);
    return pawn ? pawn.visual.root.position.clone() : null;
  }

  /** Whether the table still has this pawn on the board (a mage out of chances stays until their ash has fallen). */
  has(id: string): boolean {
    return this.pawns.has(id);
  }

  /** Whether the fog hides the pawn from the viewer. */
  isHidden(id: string): boolean {
    const pawn = this.pawns.get(id);
    return pawn !== undefined && pawn.fogTarget === 0;
  }

  /** Whether a power event has the pawn in its choreography, and the poofs and sounds of the move must leave it be. */
  isChoreographed(id: string): boolean {
    return this.pawns.get(id)?.choreographed === true;
  }

  /** The pawn standing closest to `point`, if one is within `maxDistance`; the fog's hidden pawns are not seen. */
  getNearestPawnPosition(point: THREE.Vector3, maxDistance: number): THREE.Vector3 | null {
    let nearest: THREE.Vector3 | null = null;
    let nearestDistance = maxDistance;
    for (const pawn of this.pawns.values()) {
      if (pawn.fogTarget === 0) continue;
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
    const leaving: string[] = [];
    for (const pawn of this.pawns.values()) {
      if (pawn.held !== null) {
        pawn.held += deltaSeconds;
        if (pawn.held > HELD_TIMEOUT_SECONDS) {
          pawn.held = null;
          pawn.choreographed = false;
          if (pawn.dying) leaving.push(pawn.id);
          else pawn.actions.push({ type: "vanish", duration: 240 }, { type: "appear", duration: 320 });
        }
      }
      if (pawn.explained > 0) pawn.explained = Math.max(0, pawn.explained - deltaSeconds);
      if (this.advance(pawn, deltaMs)) leaving.push(pawn.id);
      this.animateIdle(pawn, elapsed, deltaSeconds);
      this.applyLook(pawn, deltaSeconds);
    }
    for (const id of leaving) this.removePawn(id);
  }

  dispose(): void {
    for (const pawn of this.pawns.values()) pawn.visual.dispose();
    this.pawns.clear();
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

    const hidden = input.hidden === true;
    const ghostly = input.ghostly === true;
    const fogTarget = hidden ? 0 : ghostly ? GHOSTLY_OPACITY : 1;
    visual.root.visible = !hidden;
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
      rootScale: 1,
      iceBlock,
      halo,
      slot: position.clone(),
      fogTarget,
      fogAlpha: fogTarget,
      viewHidden: hidden,
      viewGhostly: ghostly,
      popAge: INVISIBILITY_POP_MS,
      actionFade: 1,
      char: 0,
      held: null,
      explained: 0,
      choreographed: false,
      dying: false,
    };
  }

  private removePawn(id: string): void {
    const pawn = this.pawns.get(id);
    if (!pawn) return;
    this.group.remove(pawn.visual.root);
    pawn.visual.dispose();
    this.pawns.delete(id);
  }

  /** Whether a power event not yet played is what moved this pawn: the mage and their victims, the sister's owner. */
  private isMovedByPower(power: PowerEvent | null, pawnId: string): boolean {
    if (!power) return false;
    if (power.kind === "mark-teleport") return power.playerId === pawnId || power.victimIds.includes(pawnId);
    if (power.kind === "sister-swap") return power.playerId === pawnId;
    return false;
  }

  /** Queues a power event's steps for a pawn, which stops waiting for the event and takes the move as the event's. */
  private choreograph(pawn: Pawn, steps: PawnAction[]): void {
    pawn.held = null;
    pawn.explained = EXPLAINED_SECONDS;
    pawn.choreographed = true;
    pawn.actions.push(...steps);
  }

  private phaseInfo(pawn: Pawn, phaseName: PawnPhase, tunnel?: TunnelInfo): PawnPhaseInfo {
    return {
      phase: phaseName,
      playerId: pawn.id,
      position: pawn.visual.root.position.clone(),
      ...(tunnel ? { tunnel } : {}),
      hidden: pawn.fogTarget === 0,
    };
  }

  /** What the sounds of a pawn hear: nothing, for a pawn the fog hides. */
  private emitHeard(pawn: Pawn, event: FeedbackEvent): void {
    if (pawn.fogTarget > 0) emitFeedback(event);
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

    const fallsIntoPortal = movement.portalNodeId !== undefined && !movement.interruptedTo;
    const slipsInMud = movement.slippedInMud === true && !movement.interruptedTo && !fallsIntoPortal;

    if (movement.thawed) {
      pawn.actions.push({ type: "shatter", duration: SHATTER_MS });
      if (fallsIntoPortal && movement.portalNodeId !== undefined) {
        pawn.actions.push(
          { type: "glide", to: this.getStandingPoint(movement.portalNodeId), duration: GLIDE_MS },
          { type: "portalSwallow", nodeId: movement.portalNodeId, duration: PORTAL_SWALLOW_MS },
          { type: "hellDrop", to: finalSlot, duration: HELL_DROP_MS },
        );
      } else {
        pawn.actions.push({ type: "glide", to: finalSlot, duration: GLIDE_MS });
      }
      return;
    }

    // A slide that ran into a Barrière stood on `path[index]`: it bumps there, then slides on another way.
    const pushBumps = (index: number) => {
      for (const bump of movement.bumps ?? []) {
        if (bump.index !== index) continue;
        const standing = this.layout.getNodePosition(path[index] ?? from);
        const aimed = standing.clone().lerp(this.layout.getNodePosition(bump.toward), 0.5);
        pawn.actions.push({
          type: "bump",
          to: aimed.setY(standing.y),
          from: path[index] ?? from,
          toward: bump.toward,
          duration: BUMP_MS,
        });
      }
    };

    let previous = from;
    if (movement.ferry && path.length > 0) {
      // Archipel: the walk is a crossing: aboard, over the water, ashore.
      pawn.actions.push({
        type: "sail",
        to: finalSlot,
        duration: FERRY_RIDE_MS,
        ferry: { from, to: path[path.length - 1] },
      });
    } else if (movement.tunnel && path.length > 0) {
      // Taupe: no road, no hop: the pawn digs down where it stands and bursts out of the ground at the other end.
      const arrival = path[path.length - 1];
      const tunnel: TunnelInfo = { id: movement.tunnel.id, dug: movement.tunnel.dug, from, to: arrival };
      // With a Portail or mud at the end, the pawn must be seen standing there first.
      const lands = fallsIntoPortal || slipsInMud ? this.getStandingPoint(arrival) : finalSlot;
      pawn.actions.push(
        { type: "dive", duration: TUNNEL_DIVE_MS, tunnel },
        { type: "pop", to: lands, duration: TUNNEL_POP_MS, tunnel },
      );
    } else {
      path.forEach((nodeId, index) => {
        // With a Portail at the end, the pawn stands on the tile first: it must be seen walking there.
        // Same for the mud: the pawn must be seen setting foot on it before it slips.
        const isLast =
          index === path.length - 1 && !interrupted && !fallsIntoPortal && !slipsInMud && movement.water === undefined;
        const target = isLast ? finalSlot : this.getStandingPoint(nodeId);
        const edge = findEdge(this.layout.board, previous, nodeId);

        if (index >= slideStart) {
          pawn.actions.push({ type: "wobble", duration: WOBBLE_MS }, { type: "glide", to: target, duration: GLIDE_MS });
          previous = nodeId;
          pushBumps(index);
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
        pushBumps(index);
      });
    }

    if (interrupted) {
      pawn.actions.push(
        { type: "wobble", duration: WOBBLE_MS },
        { type: "glide", to: finalSlot, duration: GLIDE_MS / 2 },
        { type: "freeze", duration: FREEZE_MS },
      );
    }

    if (fallsIntoPortal && movement.portalNodeId !== undefined) {
      pawn.actions.push(
        { type: "portalSwallow", nodeId: movement.portalNodeId, duration: PORTAL_SWALLOW_MS },
        { type: "hellDrop", to: finalSlot, duration: HELL_DROP_MS },
      );
    }

    if (slipsInMud) pawn.actions.push({ type: "mudSlip", to: finalSlot, duration: MUD_SLIP_MS });

    // Archipel: a whirlpool drew the pawn down and threw it up at another quay; a taken quay pushed it back.
    if (movement.water === "whirlpool") {
      pawn.actions.push(
        { type: "whirl", duration: WHIRL_MS },
        { type: "surface", duration: SURFACE_MS, at: finalSlot.clone() },
      );
    }
    if (movement.water === "bumped") pawn.actions.push({ type: "mudSlip", to: finalSlot, duration: MUD_SLIP_MS });
  }

  /** Plays the running action one step further; true when the pawn is done for and leaves the table. */
  private advance(pawn: Pawn, deltaMs: number): boolean {
    const root = pawn.visual.root;
    const body = pawn.visual.body;
    const action = pawn.actions[0];
    pawn.actionFade = 1;
    pawn.char = 0;

    if (!action) {
      if (pawn.landingTimer > 0) {
        pawn.landingTimer = Math.max(0, pawn.landingTimer - deltaMs);
        const squash = Math.sin((pawn.landingTimer / LANDING_MS) * Math.PI) * 0.2;
        body.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      }
      // A power event's choreography is over: the moves that follow are the pawn's own again.
      if (pawn.choreographed && pawn.held === null && !pawn.dying) pawn.choreographed = false;
      return false;
    }

    if (pawn.actionElapsed === 0) this.beginAction(pawn, action);
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
      case "bump": {
        // A lunge at the bar, a knock that squashes the pawn flat against it, then a bounce back.
        const lunge = Math.min(1, progress / 0.4);
        const rebound = progress < 0.4 ? 0 : (progress - 0.4) / 0.6;
        const reach = progress < 0.4 ? easeInOutCubic(lunge) * 0.85 : 0.85 * (1 - easeOutBack(Math.min(1, rebound)));
        root.position.lerpVectors(pawn.actionStart, action.to, Math.max(0, reach));
        root.position.y += progress >= 0.4 ? Math.sin(rebound * Math.PI) * 0.7 : 0;
        const knock = progress >= 0.4 && progress < 0.6 ? Math.sin(((progress - 0.4) / 0.2) * Math.PI) : 0;
        body.scale.set(1 + knock * 0.25, 1 - knock * 0.3, 1 + knock * 0.25);
        body.rotation.z = Math.sin(progress * Math.PI * 5) * 0.3 * (1 - progress);
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
      case "portalSwallow": {
        // Whirled down the widening swirl: spin, shrink, sink.
        root.position.y = pawn.actionStart.y - progress * progress * 0.6;
        body.scale.setScalar(Math.max(0.001, 1 - progress));
        body.rotation.y = progress * Math.PI * 6;
        break;
      }
      case "mudSlip": {
        // The feet stick for a beat (a shiver), then the pawn skids off backwards, spinning, and lands in a squash.
        const stuck = 0.3;
        const throwProgress = Math.max(0, (progress - stuck) / (1 - stuck));
        const eased = easeInOutCubic(throwProgress);
        root.position.lerpVectors(pawn.actionStart, action.to, eased);
        root.position.y += Math.sin(throwProgress * Math.PI) * 0.6;
        if (progress < stuck) {
          body.rotation.z = Math.sin(progress * 60) * 0.18;
          body.scale.set(1.08, 0.9, 1.08);
        } else {
          body.rotation.y = easeInOutCubic(throwProgress) * Math.PI * 4;
          body.rotation.z = Math.sin(throwProgress * Math.PI) * -0.5;
          const squash = throwProgress > 0.85 ? Math.sin(((throwProgress - 0.85) / 0.15) * Math.PI) * 0.22 : 0;
          body.scale.set(1 + squash, 1 - squash, 1 + squash);
        }
        break;
      }
      case "hellDrop": {
        // Dropped through the Hell-side portal: it falls fast and straight, then squashes on landing.
        const drop = progress * progress;
        root.position.set(action.to.x, pawn.actionStart.y + (action.to.y - pawn.actionStart.y) * drop, action.to.z);
        body.scale.setScalar(Math.min(1, 0.3 + progress * 0.8));
        body.rotation.y = (1 - progress) * Math.PI * 3;
        break;
      }
      case "dive": {
        // A wind-up squash, then a drill: spinning faster and faster, the pawn sinks into the soil and is gone.
        const windUp = Math.sin(phase(progress, 0, 0.22) * Math.PI);
        const sink = easeInCubic(phase(progress, 0.2, 1));
        const size = Math.max(0.001, 1 - sink);
        root.position.y = pawn.actionStart.y - sink * DIG_DEPTH;
        body.scale.set(size * (1 + windUp * 0.16), size * (1 - windUp * 0.24), size * (1 + windUp * 0.16));
        body.rotation.y = easeInCubic(phase(progress, 0.1, 1)) * Math.PI * 7;
        body.rotation.z = Math.sin(progress * 70) * 0.1 * (1 - sink);
        if (progress > 0.4 && !action.deepBurst) {
          action.deepBurst = true;
          this.hooks.onPhase?.(this.phaseInfo(pawn, "dig-deep", action.tunnel));
        }
        break;
      }
      case "pop": {
        // Out of the ground like a cork: a stretch on the way up, a turn in the air, a squash on landing.
        const emerge = easeOutCubic(phase(progress, 0, 0.3));
        const arc = Math.sin(phase(progress, 0.12, 1) * Math.PI) * 1;
        root.position.set(action.to.x, action.to.y - DIG_DEPTH * (1 - emerge) + arc, action.to.z);
        const size = Math.max(0.001, easeOutBack(phase(progress, 0, 0.4)));
        const stretch = 1 + Math.sin(phase(progress, 0.1, 0.65) * Math.PI) * 0.26;
        const squash = progress > 0.86 ? Math.sin(phase(progress, 0.86, 1) * Math.PI) * 0.2 : 0;
        body.scale.set(
          (size / Math.sqrt(stretch)) * (1 + squash * 0.6),
          size * stretch * (1 - squash),
          (size / Math.sqrt(stretch)) * (1 + squash * 0.6),
        );
        body.rotation.y = (1 - easeOutCubic(progress)) * Math.PI * 3;
        break;
      }
      case "suck": {
        // Drawn into the vortex: spinning faster and faster, stretched thin as it shrinks away.
        const pull = easeInCubic(progress);
        const size = Math.max(0.001, 1 - pull);
        root.position.y = pawn.actionStart.y + Math.sin(progress * Math.PI * 0.5) * 0.35;
        body.scale.set(size * (1 + progress * 0.1), size * (1 + pull * 0.9), size * (1 + progress * 0.1));
        body.rotation.y = pull * Math.PI * 10;
        body.rotation.z = Math.sin(progress * 40) * 0.12 * (1 - pull);
        break;
      }
      case "emerge": {
        // Out of the flash: stretched thin and tall, it settles into its shape with a little overshoot.
        const growth = phase(progress, 0, 0.55);
        const size = Math.max(0.001, easeOutBack(growth));
        const stretch = 1 + (1 - growth) * 0.7;
        const squash = progress > 0.85 ? Math.sin(phase(progress, 0.85, 1) * Math.PI) * 0.18 : 0;
        root.position.y = (action.at ?? pawn.slot).y + Math.sin(phase(progress, 0.1, 0.6) * Math.PI) * 0.35;
        body.scale.set(
          (size / Math.sqrt(stretch)) * (1 + squash * 0.6),
          size * stretch * (1 - squash),
          (size / Math.sqrt(stretch)) * (1 + squash * 0.6),
        );
        body.rotation.y = (1 - easeOutCubic(progress)) * Math.PI * 4;
        break;
      }
      case "sail": {
        // Aboard in the first sixth, on deck while the boat sails, ashore in the last sixth.
        const boarding = phase(progress, 0, 0.14);
        const landing = phase(progress, 0.86, 1);
        const deck = this.hooks.getFerryDeck?.() ?? null;
        if (!deck) {
          root.position.lerpVectors(pawn.actionStart, action.to, easeInOutCubic(progress));
          root.position.y += Math.sin(progress * Math.PI) * 0.5;
          break;
        }
        if (landing === 0) {
          root.position.lerpVectors(pawn.actionStart, deck.position, easeInOutCubic(boarding));
          root.position.y += Math.sin(boarding * Math.PI) * 0.7;
        } else {
          action.deckAtLanding ??= deck.position.clone();
          root.position.lerpVectors(action.deckAtLanding, action.to, easeInOutCubic(landing));
          root.position.y += Math.sin(landing * Math.PI) * 0.7;
        }
        if (boarding >= 1 && landing === 0) root.position.copy(deck.position);
        const heading = landing > 0 ? action.to.clone().sub(action.deckAtLanding ?? deck.position) : deck.heading;
        if (heading.lengthSq() > 0.0004) pawn.targetYaw = Math.atan2(heading.x, heading.z);
        // A pawn on a boat sways with the waves.
        body.rotation.z = boarding >= 1 && landing === 0 ? Math.sin(progress * 28) * 0.07 : 0;
        break;
      }
      case "whirl": {
        // Spun down the whirlpool: faster and thinner, sinking into the water.
        const pull = easeInCubic(progress);
        const size = Math.max(0.001, 1 - pull);
        root.position.y = pawn.actionStart.y - pull * 0.35;
        body.scale.set(size * (1 + progress * 0.2), size * (1 + pull * 0.6), size * (1 + progress * 0.2));
        body.rotation.y = pull * Math.PI * 12;
        body.rotation.z = Math.sin(progress * 36) * 0.15 * (1 - pull);
        break;
      }
      case "surface": {
        // Up out of the water like a cork: a stretch, a turn, a squash on landing.
        const rise = easeOutCubic(phase(progress, 0, 0.5));
        const at = action.at ?? pawn.slot;
        const size = Math.max(0.001, easeOutBack(phase(progress, 0, 0.45)));
        const stretch = 1 + Math.sin(phase(progress, 0.1, 0.7) * Math.PI) * 0.3;
        const squash = progress > 0.82 ? Math.sin(phase(progress, 0.82, 1) * Math.PI) * 0.2 : 0;
        root.position.set(at.x, at.y - 0.45 * (1 - rise) + Math.sin(phase(progress, 0.2, 1) * Math.PI) * 0.5, at.z);
        body.scale.set(
          (size / Math.sqrt(stretch)) * (1 + squash * 0.6),
          size * stretch * (1 - squash),
          (size / Math.sqrt(stretch)) * (1 + squash * 0.6),
        );
        body.rotation.y = (1 - easeOutCubic(progress)) * Math.PI * 4;
        break;
      }
      case "burn": {
        // Caught in the column of fire: it shakes, scorches, rises on the heat and is swallowed.
        const gone = easeInCubic(phase(progress, 0.35, 1));
        const size = Math.max(0.001, 1 - gone);
        root.position.y = pawn.actionStart.y + easeInCubic(progress) * 0.5;
        body.scale.set(size * (1 + 0.2 * progress), size * (1 + 0.6 * progress), size * (1 + 0.2 * progress));
        body.rotation.z = Math.sin(progress * 60) * 0.25 * (1 - progress * 0.3);
        body.rotation.y = progress * Math.PI * 4;
        pawn.char = Math.min(1, progress * 1.6);
        pawn.actionFade = 1 - phase(progress, 0.6, 1);
        break;
      }
      case "dissolve": {
        // Into mist: it thins out, stretches up and turns slowly, and is gone.
        const out = easeOutCubic(progress);
        pawn.actionFade = 1 - out;
        root.position.y = pawn.actionStart.y + out * 0.3;
        body.scale.set(1 - 0.15 * out, 1 + 0.6 * out, 1 - 0.15 * out);
        body.rotation.y = out * Math.PI * 2;
        break;
      }
      case "condense": {
        // Out of mist: it thickens as it settles, from tall and thin to its own shape.
        const settle = Math.min(1, easeOutBack(progress));
        pawn.actionFade = Math.min(1, progress * 1.6);
        root.position.y = pawn.slot.y + (1 - easeOutCubic(progress)) * 0.3;
        body.scale.set(1 - 0.2 * (1 - settle), 1 + 0.6 * (1 - settle), 1 - 0.2 * (1 - settle));
        body.rotation.y = (1 - easeOutCubic(progress)) * Math.PI * 2;
        break;
      }
      case "mimic": {
        // Anticipation, a jump with a full turn, a landing: the Mime has just taken someone's trick.
        const crouch = Math.sin(phase(progress, 0, 0.2) * Math.PI);
        const jump = phase(progress, 0.2, 0.88);
        const land = progress > 0.88 ? Math.sin(phase(progress, 0.88, 1) * Math.PI) * 0.2 : 0;
        root.position.y = pawn.actionStart.y + Math.sin(jump * Math.PI) * 0.6;
        const stretch = 1 + Math.sin(jump * Math.PI) * 0.12;
        body.scale.set(
          (1 + crouch * 0.15 + land * 0.6) / Math.sqrt(stretch),
          (1 - crouch * 0.25 - land) * stretch,
          (1 + crouch * 0.15 + land * 0.6) / Math.sqrt(stretch),
        );
        body.rotation.y = easeInOutCubic(jump) * Math.PI * 2;
        break;
      }
      case "crumble": {
        // Scorched grey, it shakes, slumps into a heap and falls apart; the ash itself is the effects layer's.
        const slump = easeInCubic(phase(progress, 0.25, 0.95));
        pawn.char = easeOutCubic(phase(progress, 0, 0.4));
        pawn.actionFade = 1 - phase(progress, 0.78, 1);
        body.scale.set(1 + slump * 0.18, Math.max(0.04, 1 - slump * 0.96), 1 + slump * 0.18);
        body.rotation.z = Math.sin(progress * 50) * 0.12 * (1 - progress);
        pawn.visual.eyes.scale.y = 0.2;
        break;
      }
      case "wait":
        if (action.invisible) {
          pawn.actionFade = 0;
          body.scale.setScalar(0.001);
        }
        break;
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
        this.emitHeard(pawn, { type: "pawn-hop" });
      }
      if (action.type === "pop") {
        root.position.copy(action.to);
        body.scale.setScalar(1);
        pawn.landingTimer = LANDING_MS;
        this.emitHeard(pawn, { type: "pawn-hop" });
      }
      if (action.type === "sail") {
        root.position.copy(action.to);
        body.scale.setScalar(1);
        pawn.landingTimer = LANDING_MS;
        this.emitHeard(pawn, { type: "pawn-hop" });
      }
      if (action.type === "surface") {
        root.position.copy(action.at ?? pawn.slot);
        body.scale.setScalar(1);
        pawn.landingTimer = LANDING_MS;
      }
      if (action.type === "emerge" || action.type === "condense") {
        root.position.copy(action.type === "emerge" ? (action.at ?? pawn.slot) : pawn.slot);
        body.scale.setScalar(1);
        pawn.landingTimer = LANDING_MS;
      }
      if (action.type === "mimic") {
        body.scale.setScalar(1);
        pawn.landingTimer = LANDING_MS;
      }
      if (action.type === "dissolve" || action.type === "suck" || action.type === "burn" || action.type === "whirl") {
        body.scale.setScalar(0.001);
      }
      if (action.type === "hellDrop") {
        root.position.copy(action.to);
        body.scale.setScalar(1);
        pawn.landingTimer = LANDING_MS;
      }
      if (action.type === "portalSwallow") body.scale.setScalar(1);
      if (action.type === "mudSlip") {
        root.position.copy(action.to);
        body.scale.setScalar(1);
        pawn.landingTimer = LANDING_MS;
      }
      if (action.type === "appear") body.scale.setScalar(1);
      if (action.type === "bump") {
        root.position.copy(pawn.actionStart);
        body.scale.setScalar(1);
      }
      if (action.type === "freeze") pawn.iceBlock.scale.setScalar(1);
      if (action.type === "shatter") pawn.iceBlock.scale.setScalar(0.001);
      if (action.type === "dive") body.scale.setScalar(0.001);
      if (
        action.type === "wait" &&
        action.invisible &&
        pawn.actions[0]?.type !== "emerge" &&
        pawn.actions[0]?.type !== "condense"
      ) {
        body.scale.setScalar(1);
      }
      if (action.type === "crumble") return true;
      if (pawn.actions.length === 0) pawn.targetYaw = 0;
    }
    return false;
  }

  /** What happens the moment an action begins: where the pawn starts from, and what the scene does with it. */
  private beginAction(pawn: Pawn, action: PawnAction): void {
    const root = pawn.visual.root;
    const body = pawn.visual.body;
    if (action.type === "appear") root.position.copy(action.at ?? pawn.slot);
    if (action.type === "pop") root.position.set(action.to.x, action.to.y - DIG_DEPTH, action.to.z);
    if (action.type === "emerge" || action.type === "surface") root.position.copy(action.at ?? pawn.slot);
    if (action.type === "condense") root.position.copy(pawn.slot);
    if (action.type === "bump")
      this.emitHeard(pawn, { type: "barrier-bump", from: action.from, toward: action.toward });
    pawn.actionStart.copy(root.position);
    if (action.type === "vanish") this.emitHeard(pawn, { type: "pawn-tunnel" });
    if (action.type === "glide") this.emitHeard(pawn, { type: "pawn-slide" });
    if (action.type === "portalSwallow") this.emitHeard(pawn, { type: "portal-swallowed", nodeId: action.nodeId });
    if (action.type === "hellDrop") {
      this.emitHeard(pawn, { type: "hell-portal-open" });
      root.position.set(action.to.x, action.to.y + HELL_DROP_HEIGHT, action.to.z);
      body.scale.setScalar(0.3);
    }
    if (action.type === "bump") {
      const direction = action.to.clone().sub(root.position);
      if (direction.lengthSq() > 0.001) pawn.targetYaw = Math.atan2(direction.x, direction.z);
    }
    if (action.type === "shatter") this.emitHeard(pawn, { type: "ice-shatter", playerId: pawn.id });
    if (action.type === "slapped") {
      action.source = this.hooks.onGhostSlap?.(pawn.id) ?? undefined;
      if (action.source) pawn.targetYaw = yawTowards(root.position, action.source) ?? pawn.targetYaw;
    }

    const phaseName = PHASE_OF_ACTION[action.type];
    if (phaseName) {
      const info = this.phaseInfo(pawn, phaseName, "tunnel" in action ? action.tunnel : undefined);
      this.hooks.onPhase?.("ferry" in action ? { ...info, ferry: action.ferry } : info);
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
    const spinning = moving && SPINNING_ACTIONS.includes(pawn.actions[0].type);
    if (!spinning) body.rotation.y = pawn.yaw;

    const scaleTarget = pawn.baseScale * (pawn.active ? 1.12 : 1);
    pawn.rootScale += (scaleTarget - pawn.rootScale) * Math.min(1, deltaSeconds * 8);
    // Back in sight, a pawn pops: it overshoots its size a little as it settles.
    pawn.popAge = Math.min(INVISIBILITY_POP_MS, pawn.popAge + deltaSeconds * 1_000);
    const pop = pawn.popAge < INVISIBILITY_POP_MS ? 0.55 + 0.45 * easeOutBack(pawn.popAge / INVISIBILITY_POP_MS) : 1;
    root.scale.setScalar(pawn.rootScale * pop);

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

  /** The fog's opacity (a hidden pawn is not drawn at all) and the running action's, applied to the pawn's body. */
  private applyLook(pawn: Pawn, deltaSeconds: number): void {
    const step = (deltaSeconds * 1_000) / INVISIBILITY_FADE_MS;
    if (pawn.fogAlpha < pawn.fogTarget) pawn.fogAlpha = Math.min(pawn.fogTarget, pawn.fogAlpha + step);
    else if (pawn.fogAlpha > pawn.fogTarget) pawn.fogAlpha = Math.max(pawn.fogTarget, pawn.fogAlpha - step);
    pawn.visual.root.visible = pawn.fogAlpha > 0.01;
    pawn.visual.setOpacity(pawn.fogAlpha * pawn.actionFade, pawn.char);
  }

  private getStandingPoint(nodeId: NodeId): THREE.Vector3 {
    const point = this.layout.getNodePosition(nodeId);
    point.y = nodeId === HELL_NODE_ID ? this.layout.config.hellFloorY : TILE_HEIGHT;
    return point;
  }

  /**
   * Spreads players sharing a tile on a ring so nobody hides behind anyone. A pawn the fog hides takes no place
   * in the ring, or the others would stand apart for no visible reason.
   */
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
      if (input.hidden) {
        slots.set(input.id, { position: this.getStandingPoint(input.position), scale: 1 });
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

/** The actions the rest of the scene joins in, and the phase each one tells it. */
const PHASE_OF_ACTION: Partial<Record<PawnAction["type"], PawnPhase>> = {
  dive: "dive",
  pop: "pop",
  suck: "suck",
  emerge: "emerge",
  burn: "burn",
  dissolve: "dissolve",
  condense: "condense",
  crumble: "crumble",
  sail: "sail",
  whirl: "whirl",
  surface: "surface",
};

/** Yaw that turns a pawn at `from` to face `to`, or null when they stand on the same spot. */
function yawTowards(from: THREE.Vector3, to: THREE.Vector3): number | null {
  const direction = to.clone().sub(from);
  return direction.x * direction.x + direction.z * direction.z > 0.0004 ? Math.atan2(direction.x, direction.z) : null;
}
