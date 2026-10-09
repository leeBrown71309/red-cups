import * as THREE from "three";
import type { BoardEdge, BoardNode, MapId, NodeId, PlayerMovement, PowerEvent } from "../game/types";
import { HELL_NODE_ID, START_NODE_ID } from "../game/types";
import { onFeedback, type FeedbackEvent } from "../feedback/event-bus";
import type { Fog } from "../ui/fog";
import type { MapThemeId } from "../game/maps/map-types";
import { getSceneTheme, type SceneTheme } from "../theme/map-themes";
import { SCENE_COLORS } from "../theme/palette";
import { BoardLayout } from "./board-layout";
import { BulletBillActor, type BulletCarry, type BulletView } from "./bullet-bill-actor";
import { CameraRig, type CameraMode } from "./camera-rig";
import { EffectsLayer, SISTER_MIST_COLORS } from "./effects-layer";
import { GhostActor, type GhostView } from "./ghost-actor";
import { createSurroundings } from "./models/surroundings-model";
import { createHellPit, createShopStall, createStartFlag, createTunnelPortal } from "./models/landmarks-model";
import { createCarouselHell, createGhostTrainPortal, type CarouselHell } from "./models/night-fair-landmarks-model";
import { NIGHT_FAIR_TRAY, createNightFairScenery } from "./models/night-fair-scenery-model";
import { createIceCrevasse } from "./models/polar-landmarks-model";
import { POLAR_TRAY, createPolarScenery } from "./models/polar-scenery-model";
import {
  createBarrierProp,
  createHellPortal,
  createMudPuddle,
  createRedCup,
  type AnimatedProp,
  type HellPortalProp,
} from "./models/props-model";
import { createMarkProp, type MarkProp } from "./models/mark-model";
import { createTileArrow } from "./models/tile-arrow-model";
import { createTunnelProp, type TunnelProp } from "./models/tunnel-model";
import { TOY_BOX_TRAY, createPond, createScenery, createTray } from "./models/scenery-model";
import { START_TILE_RADIUS, TILE_HEIGHT, TILE_RADIUS, createTileVisual, type TileVisual } from "./models/tile-model";
import { GHOSTLY_OPACITY, PawnController, type PawnInput, type PawnPhaseInfo } from "./pawn-controller";
import { RoadNetwork } from "./road-network";
import { SisterController, type SisterView } from "./sister-actor";
import { SceneKit, clamp01, easeInOutCubic, easeOutBack, prefersReducedMotion } from "./scene-kit";
import {
  HELL_DROP_MS,
  MAGE_CRUMBLE_MS,
  MARK_SUCK_MS,
  MIME_BEAM_MS,
  MIME_MASK_DELAY_MS,
  PORTAL_SWALLOW_MS,
  SISTER_CARRY_DELAY_MS,
  SISTER_CARRY_MS,
  SISTER_TRANSIT_MS,
  SNOWBALL_FLIGHT_MS,
  TOMATO_FLIGHT_MS,
  TOMATO_VOLLEY_GAP_MS,
} from "../theme/timing";

const DOOM_SKY = new THREE.Color("#ff5a3a");
const DOOM_GROUND = new THREE.Color("#3a0a14");
const DOOM_SUN = new THREE.Color("#ff5a38");
const DOOM_FILL = new THREE.Color("#ff6a3c");
const DOOM_FOG = "#4a0b17";

interface DoomMood {
  hemisphere: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  rest: {
    sky: THREE.Color;
    ground: THREE.Color;
    sun: THREE.Color;
    fill: THREE.Color;
    ambient: number;
    sunIntensity: number;
    fillIntensity: number;
  };
}

export interface BoardView {
  mode: CameraMode;
  /** Luna Park: which way the carousel turns right now. */
  carouselReversed: boolean;
  /** Banquise: the blizzard's temporary ice tile. */
  iceTileNodeId: NodeId | null;
  /** Doomsday: le diable's spell is on the table, every tile turns red. */
  doomed: boolean;
  pawns: PawnInput[];
  /** Mi-vu, Mi-vue: the viewer is invisible, and sees no mud, no Portail, no Red Cup, no Bullet Bill, no other sister. */
  hidesProps: boolean;
  /** Taupe: the tunnels on the board (the ones just closed are still here until the pawn has crossed). */
  moleTunnels: TunnelView[];
  /** Mage noir: the pentagrams on the board (the one just spent is still here until the mage has landed on it). */
  blackMarks: MarkView[];
  /** Sœur Fantôme: the little ghost of every player who holds the card. */
  sisters: SisterView[];
  /** The last deed of a Cups Power, so the scene knows one is about to be played and holds what it moves in place. */
  powerEvent: PowerEvent | null;
  /** The sister's swap carries Bullet Bill from one tile to another. */
  bulletCarry: BulletCarry | null;
  redCupNodeId: NodeId | null;
  mudNodeIds: NodeId[];
  /** Le diable's Portails onto Hell. */
  portalNodeIds: NodeId[];
  /** The roads the Barrières close, as pairs of tiles. */
  barrierEdges: [NodeId, NodeId][];
  /** While a Barrière is being set down: every road the player may tap. */
  pickableRoads: [NodeId, NodeId][];
  bulletBill: BulletView | null;
  /** Sequence of Bullet Bill's last charge, so the scene knows one is about to be replayed. */
  bulletFlightSeq: number | null;
  /** Luna Park: the ghost of the carousel; null on the other maps and outside a game. */
  ghost: GhostView | null;
  /** Sequence of the ghost's last deed, so the scene holds it in place until the deed is replayed. */
  ghostEventSeq: number | null;
  /** Destination → path from `pathOrigin`, for every legal choice. */
  legalPaths: Map<NodeId, NodeId[]>;
  pathOrigin: NodeId | null;
  markerColor: string;
  previewNodeId: NodeId | null;
  lastMovement: PlayerMovement | null;
  followActivePlayer: boolean;
  activePlayerId: string | null;
}

export interface TunnelView {
  id: string;
  a: NodeId;
  b: NodeId;
}

export interface MarkView {
  ownerId: string;
  nodeId: NodeId;
  /** The owner's colour. */
  color: string;
}

export interface BoardWorldCallbacks {
  /** What the fog hides from the viewer of this device, read when a feedback event arrives. */
  readFog: () => Fog;
  onTileSelect: (nodeId: NodeId, pointerType: string) => void;
  /** A road was tapped while a Barrière is being set down. */
  onRoadSelect: (road: [NodeId, NodeId]) => void;
  /** Luna Park: the ghost was clicked, to look at its loot. */
  onGhostSelect: () => void;
}

/** Awning colour of the shop booths; the toy box keeps the shop blue. */
const STALL_AWNINGS: Partial<Record<MapThemeId, string>> = {
  "night-fair": "#ff4fa3",
  polar: "#35c6f4",
};

const TAP_DISTANCE_PX = 9;
const BLIZZARD_FOG_SECONDS = 2.6;
const TAP_DURATION_MS = 650;
/** Where mud sits on a tile, from its centre. */
const MUD_OFFSET = new THREE.Vector3(0.36, 0, 0.3);
/** Where a Portail opens on a tile, opposite the mud. */
const PORTAL_OFFSET = new THREE.Vector3(-0.32, 0, -0.3);
/** How big a pentagram is on an ordinary tile and on the start, which is wider. */
const MARK_RADIUS = 0.88;
const START_MARK_RADIUS = 1.15;
/** A tunnel that waits for its dig to be played, and a power event that waits for its turn, give up after this. */
const DORMANT_TUNNEL_SECONDS = 4;
const PENDING_POWER_SECONDS = 8;
/** How high what the sister carries is thrown over the board. */
const CARRY_ARC_HEIGHT = 1.8;
/** Sparkles of a pawn that fades from sight or pops back. */
const INVISIBILITY_SPARKLES = ["#ffffff", "#bfeaff", "#e8d9ff"];

/** A tunnel prop and what the world knows of it. */
interface TunnelEntry {
  prop: TunnelProp;
  a: NodeId;
  b: NodeId;
  /** Still on the board: not wanted any more means it caves in as soon as it may. */
  wanted: boolean;
  /** Seconds the prop has waited for its dig to be played, null once it has begun. */
  dormantSeconds: number | null;
}

interface MarkEntry {
  prop: MarkProp;
  nodeId: NodeId;
  wanted: boolean;
}

/** Something the sister carries, flying over the board in an arc until the board has set it down on the new tile. */
interface FlyingProp {
  prop: AnimatedProp;
  kind: "mud" | "portal" | "cup";
  from: THREE.Vector3;
  to: THREE.Vector3;
  destNode: NodeId;
  elapsed: number;
  delay: number;
  duration: number;
  trail: number;
  landed: boolean;
}

/**
 * Owns the Three.js scene of one map. React feeds it a serialisable
 * `BoardView`; the world never reads or writes the game store directly.
 * Showing another map means building another world.
 */
export class BoardWorld {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly kit = new SceneKit();
  private readonly layout: BoardLayout;
  private readonly theme: SceneTheme;
  private readonly rig: CameraRig;
  private carouselHell: CarouselHell | null = null;
  /** Banquise: seconds of blizzard fog left, thickening then clearing. */
  private blizzardFog = 0;
  private readonly tiles = new Map<NodeId, TileVisual>();
  private readonly roads: RoadNetwork;
  private readonly pawns: PawnController;
  private readonly sisters: SisterController;
  private readonly effects = new EffectsLayer();
  private readonly animated: AnimatedProp[] = [];
  private readonly redCup: AnimatedProp;
  private readonly bullet: BulletBillActor;
  /** Only on maps a ghost haunts. */
  private readonly ghost: GhostActor | null = null;
  private readonly mudPuddles = new Map<NodeId, AnimatedProp>();
  private readonly portals = new Map<NodeId, HellPortalProp>();
  /** Portails mid-swallow: out of the sync so they finish their animation in peace. */
  private readonly swallowingPortals: { nodeId: NodeId; prop: HellPortalProp; remaining: number }[] = [];
  /** The portal that opens on the Hell side when a pawn drops through. */
  private readonly hellPortals: { prop: HellPortalProp; remaining: number }[] = [];
  /** The Barrières on their roads, by road. */
  private readonly barrierProps = new Map<string, AnimatedProp>();
  /** The tap targets on the roads while a Barrière is being set down. */
  private roadHandles: { key: string; group: THREE.Group; handles: THREE.Mesh[] } | null = null;
  /** The arrows of the arrow tiles, which ride on their tile. */
  private readonly tileArrows: AnimatedProp[] = [];
  /** Banquise: the penguins of the scenery, who throw the snowballs. */
  private penguins: THREE.Object3D[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly timer = new THREE.Timer();
  private readonly unsubscribeFeedback: () => void;
  private view: BoardView | null = null;
  private hoveredNodeId: NodeId | null = null;
  private pointerStart: { x: number; y: number; time: number; id: number } | null = null;
  private cupNodeId: NodeId | null = null;
  private cupPopProgress = 1;
  private paused = false;
  /** Doomsday: 0 = the map's own light, 1 = the blood-red dusk; it eases from one to the other. */
  private doomLevel = 0;
  private doomTarget = 0;
  private mood: DoomMood | null = null;
  private disposed = false;
  /** Taupe: the tunnels on the board, by their id. */
  private readonly tunnels = new Map<string, TunnelEntry>();
  /** Mage noir: the pentagrams on the board, by owner. */
  private readonly marks = new Map<string, MarkEntry>();
  /** The last power event played, and the one the board knows of that is yet to be played. */
  private playedPowerSeq = 0;
  private pendingPower: PowerEvent | null = null;
  private pendingPowerSeconds = 0;
  /** Mage noir: the teleport being played, which the mage's choreography refers to as it goes. */
  private teleport: Extract<PowerEvent, { kind: "mark-teleport" }> | null = null;
  private flameSeq = 0;
  /** Sœur Fantôme: what her swap carries, in flight. */
  private readonly flyingProps: FlyingProp[] = [];
  /** The real Red Cup waits out of sight while its twin flies over the board. */
  private redCupFlight: FlyingProp | null = null;
  private readonly timers = new Set<number>();

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: BoardWorldCallbacks,
    mapId: MapId,
  ) {
    this.layout = new BoardLayout(mapId);
    this.theme = getSceneTheme(this.layout.map.themeId);
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.5 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.classList.add("board-canvas");
    container.appendChild(this.renderer.domElement);

    this.rig = new CameraRig(this.renderer.domElement, this.layout.cameraBounds);
    this.addLights(coarsePointer ? 1_024 : 2_048);
    this.buildBoard();

    this.roads = new RoadNetwork(this.kit, this.layout, this.theme.roads);
    this.scene.add(this.roads.group);

    this.pawns = new PawnController(this.kit, this.layout, {
      onGhostSlap: (pawnId) => this.ghost?.fling(pawnId) ?? null,
      onPhase: (info) => this.handlePawnPhase(info),
    });
    this.scene.add(this.pawns.group);

    this.sisters = new SisterController(this.kit, this.effects, this.layout);
    this.scene.add(this.sisters.group);

    this.redCup = createRedCup(this.kit);
    this.redCup.group.visible = false;
    this.scene.add(this.redCup.group);

    this.bullet = new BulletBillActor(this.kit, this.effects, this.layout);
    this.scene.add(this.bullet.group);

    if (this.layout.map.haunted) {
      this.ghost = new GhostActor(this.kit, this.effects, this.layout, this.pawns, (strength, durationMs) =>
        this.rig.shakeFor(strength, durationMs),
      );
      this.scene.add(this.ghost.group);
    }

    this.scene.add(this.effects.group);

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerleave", this.handlePointerLeave);
    canvas.addEventListener("contextmenu", preventDefault);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.unsubscribeFeedback = onFeedback(this.handleFeedback);
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  update(view: BoardView): void {
    const firstView = this.view === null;
    this.view = view;
    if (firstView) {
      this.pawns.acknowledgeMovement(view.lastMovement);
      this.sisters.acknowledgeMovement(view.lastMovement);
      // A restored game has no Cups Power deed left to replay.
      this.playedPowerSeq = view.powerEvent?.seq ?? 0;
    }
    this.followPowerEvent(view.powerEvent);

    this.rig.setMode(view.mode);
    this.doomTarget = view.doomed ? 1 : 0;
    this.roads.setCarouselReversed(view.carouselReversed);
    for (const [nodeId, tile] of this.tiles) {
      tile.setIce(this.layout.getNode(nodeId)?.ice === true || nodeId === view.iceTileNodeId);
      tile.setDoomed(view.doomed);
    }
    this.carouselHell?.setReversed(view.carouselReversed);
    this.pawns.sync(view.pawns, view.lastMovement, this.pendingPower);
    this.sisters.sync(view.sisters, view.lastMovement, this.pendingPower);
    this.refreshHighlights();

    if (view.redCupNodeId !== this.cupNodeId) {
      this.cupNodeId = view.redCupNodeId;
      this.redCup.group.visible = view.redCupNodeId !== null && this.redCupFlight === null;
      if (view.redCupNodeId !== null) {
        this.redCup.group.position.copy(this.layout.getNodePosition(view.redCupNodeId)).setY(TILE_HEIGHT);
        this.cupPopProgress = firstView ? 1 : 0;
      }
    }

    this.syncMud(view.mudNodeIds);
    this.syncPortals(view.portalNodeIds);
    this.syncBarriers(view.barrierEdges);
    this.syncRoadHandles(view.pickableRoads);
    this.syncTunnels(view.moleTunnels, firstView, view.lastMovement);
    this.syncMarks(view.blackMarks, firstView);
    this.bullet.setHidden(view.hidesProps);
    this.bullet.sync(view.bulletBill, view.bulletFlightSeq, view.bulletCarry);
    this.ghost?.sync(view.ghost, view.ghostEventSeq);
    this.landFlyingProps(view);
    this.refreshCoveredTiles(view);
  }

  recenter(): void {
    this.rig.recenter();
  }

  zoomBy(factor: number): void {
    this.rig.zoomBy(factor);
  }

  focusOnNode(nodeId: NodeId): void {
    this.rig.focusOn(this.layout.getNodePosition(nodeId));
  }

  /**
   * A page that fully covers the board (the setup, the draft, the online lobby) has no use for it: stopping
   * the render loop frees the GPU for the page's own animations. The frame delta is clamped, so resuming is safe.
   */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    this.renderer.setAnimationLoop(paused ? null : this.renderFrame);
  }

  dispose(): void {
    this.disposed = true;
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    this.renderer.setAnimationLoop(null);
    this.unsubscribeFeedback();
    for (const entry of this.tunnels.values()) entry.prop.dispose();
    for (const entry of this.marks.values()) entry.prop.dispose();
    this.pawns.dispose();
    this.sisters.dispose();
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.handlePointerDown);
    canvas.removeEventListener("pointerup", this.handlePointerUp);
    canvas.removeEventListener("pointermove", this.handlePointerMove);
    canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    canvas.removeEventListener("contextmenu", preventDefault);
    this.rig.dispose();
    this.effects.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite) {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
          material.dispose();
        }
      }
    });
    this.kit.dispose();
    this.renderer.dispose();
    canvas.remove();
  }

  /** Sunlight over the toy box, moonlight over the night fair; both keep soft shadows. */
  private addLights(shadowMapSize: number): void {
    const lights = this.theme.lights;
    const hemisphere = new THREE.HemisphereLight(lights.sky, lights.ground, lights.ambient);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(lights.sun, lights.sunIntensity);
    sun.position.set(...lights.sunPosition);
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    const { halfWidth, halfDepth } = this.layout.cameraBounds;
    sun.shadow.camera.left = -halfWidth - 3.6;
    sun.shadow.camera.right = halfWidth + 3.6;
    sun.shadow.camera.top = halfDepth + 4.4;
    sun.shadow.camera.bottom = -halfDepth - 4.4;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.radius = 4;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(lights.fill, lights.fillIntensity);
    fill.position.set(12, 8, -8);
    this.scene.add(fill);
    this.mood = {
      hemisphere,
      sun,
      fill,
      rest: {
        sky: new THREE.Color(lights.sky),
        ground: new THREE.Color(lights.ground),
        sun: new THREE.Color(lights.sun),
        fill: new THREE.Color(lights.fill),
        ambient: lights.ambient,
        sunIntensity: lights.sunIntensity,
        fillIntensity: lights.fillIntensity,
      },
    };

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.ShadowMaterial({ color: lights.shadow, opacity: lights.shadowOpacity }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.66;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /** Tray, decorations and Hell follow the map's art direction. */
  private buildSurroundings(): void {
    const { layout } = this;
    this.addAnimated(createSurroundings(this.kit, layout, layout.map.themeId));
    switch (layout.map.themeId) {
      case "night-fair":
        this.scene.add(createTray(this.kit, layout, NIGHT_FAIR_TRAY));
        this.addAnimated(createNightFairScenery(this.kit, layout));
        return;
      case "polar":
        this.scene.add(createTray(this.kit, layout, POLAR_TRAY));
        {
          const scenery = createPolarScenery(this.kit, layout);
          this.addAnimated(scenery);
          this.penguins = scenery.penguins;
        }
        return;
      default:
        this.scene.add(createTray(this.kit, layout, TOY_BOX_TRAY));
        this.scene.add(createScenery(this.kit, layout));
        if (layout.config.pond) this.addAnimated(createPond(this.kit, layout.config.pond));
    }
  }

  private createHell(): AnimatedProp {
    switch (this.layout.map.themeId) {
      case "night-fair": {
        const carousel = createCarouselHell(this.kit);
        this.carouselHell = carousel;
        return carousel;
      }
      case "polar":
        return createIceCrevasse(this.kit);
      default:
        return createHellPit(this.kit);
    }
  }

  private buildBoard(): void {
    const { layout } = this;
    this.buildSurroundings();

    for (const node of layout.board.nodes) {
      // Hell is never a walkable destination, so it gets a landmark instead of a tile.
      if (node.id === HELL_NODE_ID) {
        const hell = this.createHell();
        hell.group.position.set(node.x, 0, node.z);
        this.addAnimated(hell);
        continue;
      }

      const tile = createTileVisual(node, this.kit, { neon: this.theme.neonTiles });
      this.tiles.set(node.id, tile);
      this.scene.add(tile.group);
      this.addTileArrows(node, tile);

      const stallPlacement = layout.config.shopStalls[node.id];
      if (node.kind === "shop" && stallPlacement) {
        const stall = createShopStall(this.kit, STALL_AWNINGS[layout.map.themeId]);
        stall.position.set(node.x + stallPlacement.x, 0, node.z + stallPlacement.z);
        stall.rotation.y = stallPlacement.rotation;
        this.scene.add(stall);
      }
    }

    const start = layout.getNode(START_NODE_ID);
    if (start) {
      const flag = createStartFlag(this.kit);
      const offset = layout.config.startFlagOffset;
      flag.group.position.set(start.x + offset.x, TILE_HEIGHT, start.z + offset.z);
      this.addAnimated(flag);
    }

    for (const edge of layout.board.edges) {
      if (edge.kind === "tunnel") this.addTunnelEnds(edge);
    }
  }

  /**
   * Every forced exit of a tile sticks out of its rim as an arrow, pointing at
   * the road it must be left by. Short roads get shorter arrows, so an arrow
   * never touches the next tile.
   */
  private addTileArrows(node: BoardNode, tile: TileVisual): void {
    for (const edge of this.layout.board.edges) {
      if (!edge.arrow || edge.from !== node.id) continue;
      const target = this.layout.getNode(edge.to);
      if (!target) continue;
      const offset = new THREE.Vector3(target.x - node.x, 0, target.z - node.z);
      const targetRadius = target.kind === "start" ? START_TILE_RADIUS : TILE_RADIUS;
      const gap = offset.length() - tile.radius - targetRadius;
      const reach = THREE.MathUtils.clamp(gap * 0.55, 0.4, 0.85);
      const arrow = createTileArrow(this.kit, {
        node,
        radius: tile.radius,
        direction: offset.normalize(),
        reach,
        neon: this.theme.neonTiles,
      });
      tile.surface.add(arrow.group);
      this.tileArrows.push(arrow);
    }
  }

  private addTunnelEnds(edge: BoardEdge): void {
    const tunnel = this.layout.getTunnelLayout(edge);
    const { from: fromNodeId, to: toNodeId } = edge;

    if (this.layout.map.tunnelStyle === "portals") {
      const ends: [THREE.Vector3, NodeId, string][] = [
        [tunnel.entrance, fromNodeId, `Train fantôme → ${toNodeId}`],
        [tunnel.exit, toNodeId, `Depuis ${fromNodeId}`],
      ];
      for (const [position, nodeId, sign] of ends) {
        const portal = createGhostTrainPortal(this.kit, sign);
        const toTile = this.layout.getNodePosition(nodeId).sub(position);
        portal.group.position.copy(position);
        portal.group.rotation.y = Math.atan2(toTile.x, toTile.z);
        this.addAnimated(portal);
      }
      return;
    }

    const entranceFacing = tunnel.entrance.x < 0 ? 1 : -1;
    const entrance = createTunnelPortal(this.kit, entranceFacing, `Tunnel → ${toNodeId}`);
    entrance.group.position.copy(tunnel.entrance);
    this.addAnimated(entrance);
    const exit = createTunnelPortal(this.kit, entranceFacing === 1 ? -1 : 1, `Depuis ${fromNodeId}`);
    exit.group.position.copy(tunnel.exit);
    this.addAnimated(exit);
  }

  private addAnimated(prop: AnimatedProp): void {
    this.animated.push(prop);
    this.scene.add(prop.group);
  }

  /** A Barrière lies across the middle of its road, the bar across the way. */
  private syncBarriers(edges: [NodeId, NodeId][]): void {
    const wanted = new Map(edges.map((edge) => [edge.join("-"), edge]));
    for (const [key, prop] of this.barrierProps) {
      if (wanted.has(key)) continue;
      prop.group.removeFromParent();
      this.barrierProps.delete(key);
    }
    for (const [key, edge] of wanted) {
      if (this.barrierProps.has(key)) continue;
      const from = this.layout.getNodePosition(edge[0]);
      const to = this.layout.getNodePosition(edge[1]);
      const prop = createBarrierProp(this.kit);
      prop.group.position
        .copy(from)
        .lerp(to, 0.5)
        .setY(TILE_HEIGHT * 0.5);
      prop.group.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      this.scene.add(prop.group);
      this.barrierProps.set(key, prop);
    }
  }

  /** Glowing discs on every road a Barrière may close: tapping one sets it down there. */
  private syncRoadHandles(roads: [NodeId, NodeId][]): void {
    const key = roads.map((road) => road.join("-")).join(",");
    if ((this.roadHandles?.key ?? "") === key) return;
    if (this.roadHandles) {
      this.roadHandles.group.removeFromParent();
      this.roadHandles = null;
    }
    if (roads.length === 0) return;
    const group = new THREE.Group();
    const geometry = this.kit.geometry("road-handle", () => new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20));
    const material = this.kit.flat("#ff5a4d", { emissive: "#ff2d1f", emissiveIntensity: 0.75 });
    const handles = roads.map((road) => {
      const from = this.layout.getNodePosition(road[0]);
      const to = this.layout.getNodePosition(road[1]);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position
        .copy(from)
        .lerp(to, 0.5)
        .setY(TILE_HEIGHT + 0.12);
      mesh.userData.road = road;
      group.add(mesh);
      return mesh;
    });
    this.scene.add(group);
    this.roadHandles = { key, group, handles };
  }

  private pulseRoadHandles(elapsed: number): void {
    if (!this.roadHandles) return;
    const pulse = 1 + Math.sin(elapsed * 5) * 0.12;
    for (const handle of this.roadHandles.handles) handle.scale.set(pulse, 1, pulse);
  }

  private pickRoad(event: PointerEvent): [NodeId, NodeId] | null {
    if (!this.roadHandles) return null;
    this.aimRaycaster(event);
    const hit = this.raycaster.intersectObjects(this.roadHandles.handles, false)[0];
    const road = hit?.object.userData.road;
    return Array.isArray(road) ? (road as [NodeId, NodeId]) : null;
  }

  /** Le diable's Portails sit on the tile's top, in its back-left quarter, clear of the mud. */
  private syncPortals(nodeIds: NodeId[]): void {
    const wanted = new Set(nodeIds);
    for (const [nodeId, portal] of this.portals) {
      if (wanted.has(nodeId)) continue;
      // A swallowed Portail finishes its own animation; the sync lets it go.
      if (this.swallowingPortals.some((entry) => entry.nodeId === nodeId)) continue;
      portal.group.removeFromParent();
      this.portals.delete(nodeId);
    }
    for (const nodeId of wanted) {
      const tile = this.tiles.get(nodeId);
      if (this.portals.has(nodeId) || this.swallowingPortals.some((entry) => entry.nodeId === nodeId) || !tile)
        continue;
      const portal = createHellPortal(this.kit);
      portal.group.position.set(PORTAL_OFFSET.x, tile.topY, PORTAL_OFFSET.z);
      tile.surface.add(portal.group);
      this.portals.set(nodeId, portal);
    }
  }

  /**
   * Mud sits on the tile's top, in its front-right quarter: in view of the
   * camera, clear of the number badge (front-left) and of a lone pawn (centre).
   */
  private syncMud(nodeIds: NodeId[]): void {
    const wanted = new Set(nodeIds);
    for (const [nodeId, puddle] of this.mudPuddles) {
      if (wanted.has(nodeId)) continue;
      puddle.group.removeFromParent();
      this.mudPuddles.delete(nodeId);
    }
    for (const nodeId of wanted) {
      const tile = this.tiles.get(nodeId);
      if (this.mudPuddles.has(nodeId) || !tile) continue;
      const puddle = createMudPuddle(this.kit);
      puddle.group.position.set(MUD_OFFSET.x, tile.topY, MUD_OFFSET.z);
      tile.surface.add(puddle.group);
      this.mudPuddles.set(nodeId, puddle);
    }
  }

  /**
   * Tiles whose painted number is hidden by pawns, mud or the floating Red Cup show it on a badge.
   * Bullet Bill hovers behind the number, so it never hides it.
   */
  private refreshCoveredTiles(view: BoardView): void {
    // The fog hides a pawn: its tile must not show a badge to tell that somebody stands there.
    const covered = new Set<NodeId>([
      ...view.pawns.filter((pawn) => pawn.hidden !== true).map((pawn) => pawn.position),
      ...view.mudNodeIds,
      ...view.moleTunnels.flatMap((tunnel) => [tunnel.a, tunnel.b]),
      ...view.blackMarks.map((mark) => mark.nodeId),
    ]);
    if (view.redCupNodeId !== null) covered.add(view.redCupNodeId);
    for (const [nodeId, tile] of this.tiles) tile.setCovered(covered.has(nodeId));
  }

  private refreshHighlights(): void {
    const view = this.view;
    if (!view) return;
    const focusNode = this.hoveredNodeId ?? view.previewNodeId;
    const previewPath = focusNode !== null ? (view.legalPaths.get(focusNode) ?? null) : null;
    const previewNodes = new Set(previewPath ?? []);

    for (const [nodeId, tile] of this.tiles) {
      tile.setHighlight({
        legal: view.legalPaths.has(nodeId),
        hovered: focusNode === nodeId && view.legalPaths.has(nodeId),
        onPreviewPath: previewNodes.has(nodeId),
        markerColor: view.markerColor,
      });
    }
    this.roads.highlightPath(view.pathOrigin, previewPath);
  }

  private readonly renderFrame = (timestamp: number) => {
    this.timer.update(timestamp);
    const delta = Math.min(0.05, this.timer.getDelta());
    const elapsed = this.timer.getElapsed();

    this.rig.update(delta);
    this.updateBlizzardFog(delta);
    this.updateDoomMood(delta, elapsed);
    this.roads.update(elapsed);
    this.pawns.update(elapsed, delta);
    this.sisters.update(elapsed, delta);
    this.effects.update(delta);
    this.updatePendingPower(delta);
    this.updateTunnels(elapsed, delta);
    this.updateMarks(elapsed, delta);
    this.updateFlyingProps(elapsed, delta);
    for (const prop of this.animated) prop.update(elapsed, delta);
    for (const puddle of this.mudPuddles.values()) puddle.update(elapsed, delta);
    for (const portal of this.portals.values()) portal.update(elapsed, delta);
    for (let index = this.swallowingPortals.length - 1; index >= 0; index -= 1) {
      const entry = this.swallowingPortals[index];
      entry.remaining -= delta;
      entry.prop.update(elapsed, delta);
      if (entry.remaining <= 0) {
        entry.prop.group.removeFromParent();
        this.swallowingPortals.splice(index, 1);
      }
    }
    for (let index = this.hellPortals.length - 1; index >= 0; index -= 1) {
      const entry = this.hellPortals[index];
      entry.remaining -= delta;
      entry.prop.update(elapsed, delta);
      if (entry.remaining <= 0) {
        entry.prop.group.removeFromParent();
        this.hellPortals.splice(index, 1);
      }
    }
    for (const barrier of this.barrierProps.values()) barrier.update(elapsed, delta);
    this.pulseRoadHandles(elapsed);
    for (const arrow of this.tileArrows) arrow.update(elapsed, delta);
    for (const tile of this.tiles.values()) tile.update(elapsed, delta);

    if (this.redCup.group.visible) {
      this.redCup.update(elapsed, delta);
      this.cupPopProgress = Math.min(1, this.cupPopProgress + delta * 1.6);
      this.redCup.group.scale.setScalar(Math.max(0.001, easeOutBack(this.cupPopProgress)));
    }

    this.bullet.update(elapsed, delta);
    this.ghost?.update(elapsed, delta);

    this.renderer.render(this.scene, this.rig.camera);
  };

  /**
   * Doomsday changes the whole mood, not just the tiles: the sun and the sky turn blood red, the far decor
   * sinks into a crimson haze and the light throbs like a slow heartbeat. It eases in and out.
   */
  private updateDoomMood(delta: number, elapsed: number): void {
    const mood = this.mood;
    if (!mood || (this.doomLevel === this.doomTarget && this.doomTarget === 0)) return;
    this.doomLevel += (this.doomTarget - this.doomLevel) * Math.min(1, delta * 1.6);
    if (Math.abs(this.doomTarget - this.doomLevel) < 0.004) this.doomLevel = this.doomTarget;
    const level = this.doomLevel;
    const beat = 1 + Math.sin(elapsed * 2.2) * 0.07 * level;
    const { rest } = mood;
    mood.hemisphere.color.copy(rest.sky).lerp(DOOM_SKY, level);
    mood.hemisphere.groundColor.copy(rest.ground).lerp(DOOM_GROUND, level);
    mood.hemisphere.intensity = rest.ambient * (1 - level * 0.5) * beat;
    mood.sun.color.copy(rest.sun).lerp(DOOM_SUN, level);
    mood.sun.intensity = rest.sunIntensity * (1 - level * 0.3) * beat;
    mood.fill.color.copy(rest.fill).lerp(DOOM_FILL, level);
    // The blizzard owns the fog while it lasts; otherwise a crimson haze rises with the dusk.
    if (this.blizzardFog > 0) return;
    if (level === 0) {
      this.scene.fog = null;
    } else if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = level * 0.017;
    } else {
      this.scene.fog = new THREE.FogExp2(DOOM_FOG, level * 0.017);
    }
  }

  /** The blizzard's white-out: fog thickens over the board, then lifts as the gust passes. */
  private updateBlizzardFog(delta: number): void {
    if (this.blizzardFog <= 0) return;
    this.blizzardFog = Math.max(0, this.blizzardFog - delta);
    const progress = 1 - this.blizzardFog / BLIZZARD_FOG_SECONDS;
    const density = Math.sin(progress * Math.PI) * 0.045;
    if (this.blizzardFog === 0) {
      this.scene.fog = null;
      return;
    }
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = density;
    else this.scene.fog = new THREE.FogExp2("#eaf4ff", density);
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.rig.resize(width, height);
  }

  private aimRaycaster(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
  }

  /** The ghost floats above its tile, so when the pointer is on it, it wins over the tiles. */
  private pickGhost(event: PointerEvent): boolean {
    if (!this.ghost) return false;
    this.aimRaycaster(event);
    return this.ghost.hitDistance(this.raycaster) !== null;
  }

  private pickNode(event: PointerEvent): NodeId | null {
    this.aimRaycaster(event);
    const pickMeshes = [...this.tiles.values()].map((tile) => tile.pickMesh);
    const hit = this.raycaster.intersectObjects(pickMeshes, false)[0];
    const nodeId = hit?.object.userData.nodeId;
    return typeof nodeId === "number" ? nodeId : null;
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    this.pointerStart = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    const start = this.pointerStart;
    this.pointerStart = null;
    if (!start || start.id !== event.pointerId || event.button > 0) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > TAP_DISTANCE_PX || performance.now() - start.time > TAP_DURATION_MS) return;

    const road = this.pickRoad(event);
    if (road) {
      this.callbacks.onRoadSelect(road);
      return;
    }
    if (this.pickGhost(event)) {
      this.callbacks.onGhostSelect();
      return;
    }
    const nodeId = this.pickNode(event);
    if (nodeId !== null && this.view?.legalPaths.has(nodeId)) {
      this.callbacks.onTileSelect(nodeId, event.pointerType);
    }
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.buttons !== 0) return;
    const onRoad = this.pickRoad(event) !== null;
    const onGhost = !onRoad && this.pickGhost(event);
    const nodeId = onGhost || onRoad ? null : this.pickNode(event);
    const hovered = nodeId !== null && this.view?.legalPaths.has(nodeId) ? nodeId : null;
    this.renderer.domElement.style.cursor = onRoad || onGhost || hovered !== null ? "pointer" : "";
    if (hovered === this.hoveredNodeId) return;
    this.hoveredNodeId = hovered;
    this.refreshHighlights();
  };

  private readonly handlePointerLeave = () => {
    if (this.hoveredNodeId === null) return;
    this.hoveredNodeId = null;
    this.refreshHighlights();
  };

  /** Banquise: the penguin standing closest to `target`, or the far edge of the tray without one. */
  private findNearestPenguin(target: THREE.Vector3): THREE.Vector3 {
    let nearest: THREE.Vector3 | null = null;
    for (const penguin of this.penguins) {
      const position = penguin.getWorldPosition(new THREE.Vector3());
      if (!nearest || position.distanceTo(target) < nearest.distanceTo(target)) nearest = position;
    }
    return nearest ?? new THREE.Vector3(target.x, 0, -this.layout.halfDepth - 1);
  }

  /** Whether the fog hides this player's pawn, and so what they do, from the viewer of this device. */
  private isUnseen(fog: Fog, playerId: string | null): boolean {
    return playerId !== null && fog.hiddenIds.has(playerId);
  }

  private readonly handleFeedback = (event: FeedbackEvent) => {
    // Mi-vu, Mi-vue: what concerns a pawn or a tile the fog hides stays out of the viewer's sight.
    const fog = this.callbacks.readFog();
    const actorUnseen = this.isUnseen(fog, this.view?.activePlayerId ?? null);
    switch (event.type) {
      case "currency": {
        const position = this.pawns.getPawnPosition(event.playerId);
        if (!position || this.isUnseen(fog, event.playerId)) return;
        // The price paid in the shop would give away what was bought, to the table and online alike.
        if (event.purchase) return;
        const text = `${event.delta > 0 ? "+" : "−"}${Math.abs(event.delta)}`;
        this.effects.spawnFloatingText(position, text, event.delta > 0 ? "#7ee07a" : "#ff6b5e");
        return;
      }
      case "barrier-bump": {
        if (actorUnseen) return;
        const from = this.layout.getNodePosition(event.from);
        const to = this.layout.getNodePosition(event.toward);
        this.effects.spawnPoof(
          from
            .clone()
            .lerp(to, 0.5)
            .setY(TILE_HEIGHT + 0.5),
          "#ffd166",
        );
        return;
      }
      case "cup-collected":
        if (this.isUnseen(fog, event.playerId)) return;
        this.effects.spawnConfetti(this.layout.getNodePosition(event.nodeId).setY(TILE_HEIGHT));
        return;
      case "hell-entered":
      case "hell-escaped":
      case "teleport": {
        const { playerId } = event;
        if (this.isUnseen(fog, playerId)) return;
        // A power event owns the move of the pawns in its choreography (the event comes right after this one).
        window.requestAnimationFrame(() => {
          if (this.disposed || this.pawns.isChoreographed(playerId)) return;
          const position = this.pawns.getPawnPosition(playerId);
          if (position) this.effects.spawnPoof(position, event.type === "hell-entered" ? "#c9a2ff" : "#ffffff");
        });
        return;
      }
      case "portal-swallowed": {
        const portal = this.portals.get(event.nodeId);
        if (!portal || actorUnseen) return;
        this.portals.delete(event.nodeId);
        portal.swallow(PORTAL_SWALLOW_MS / 1000);
        this.swallowingPortals.push({ nodeId: event.nodeId, prop: portal, remaining: PORTAL_SWALLOW_MS / 1000 });
        return;
      }
      case "hell-portal-open": {
        if (actorUnseen || fog.viewerHidden) return;
        // A Portail spits its victim out: the swirl opens above the Hell floor and fades once they land.
        const hellPortal = createHellPortal(this.kit);
        hellPortal.group.position
          .copy(this.layout.getNodePosition(HELL_NODE_ID))
          .setY(this.layout.config.hellFloorY + 0.02);
        this.scene.add(hellPortal.group);
        this.hellPortals.push({ prop: hellPortal, remaining: (HELL_DROP_MS + 400) / 1000 });
        this.effects.spawnGhostMist(hellPortal.group.position.clone().setY(this.layout.config.hellFloorY + 0.4), 14);
        return;
      }
      case "mud-placed":
      case "mud-triggered":
        if (actorUnseen || fog.viewerHidden) return;
        this.effects.spawnPoof(
          this.layout.getNodePosition(event.nodeId).add(MUD_OFFSET).setY(TILE_HEIGHT),
          SCENE_COLORS.mud,
        );
        return;
      case "bullet-flight": {
        // The charge is replayed whether it is seen or not: the actor keeps its place on the board in step.
        this.bullet.launch(event.flight);
        const landing = event.flight.path[event.flight.path.length - 1] ?? event.flight.from;
        if (this.view?.mode === "play" && this.view.followActivePlayer && !fog.viewerHidden) {
          this.rig.focusOn(this.layout.getNodePosition(landing), 0.78);
        }
        return;
      }
      case "bullet-hit": {
        if (!fog.viewerHidden) {
          this.effects.spawnExplosion(this.layout.getNodePosition(event.nodeId).setY(TILE_HEIGHT));
          this.rig.shakeFor(0.45, 650);
        }
        this.pawns.knockOut(event.playerId);
        return;
      }
      case "blizzard": {
        this.effects.spawnBlizzard(this.layout.halfWidth, this.layout.halfDepth);
        this.blizzardFog = BLIZZARD_FOG_SECONDS;
        if (event.from !== null)
          this.effects.spawnIceBurst(this.layout.getNodePosition(event.from).setY(TILE_HEIGHT), 10);
        if (event.to !== null) this.effects.spawnIceBurst(this.layout.getNodePosition(event.to).setY(TILE_HEIGHT), 18);
        return;
      }
      case "ice-fall": {
        if (this.isUnseen(fog, event.playerId)) return;
        const halfway = this.layout.getNodePosition(event.from).lerp(this.layout.getNodePosition(event.to), 0.5);
        this.effects.spawnIceFall(halfway.setY(0.05), event.hit);
        return;
      }
      case "ice-shatter": {
        if (this.isUnseen(fog, event.playerId)) return;
        const position = this.pawns.getPawnPosition(event.playerId);
        if (position) this.effects.spawnIceBurst(position, 16);
        return;
      }
      case "carousel-flipped": {
        const hell = this.layout.getNodePosition(HELL_NODE_ID).setY(TILE_HEIGHT + 2.4);
        this.effects.spawnConfetti(hell);
        return;
      }
      case "ghost-appeared":
        this.ghost?.appeared(event.nodeId);
        return;
      case "ghost-moved":
        this.ghost?.moved(event.path);
        return;
      case "ghost-teleported":
        this.ghost?.teleported(event.to);
        return;
      case "ghost-attack":
        if (!this.isUnseen(fog, event.playerId)) this.ghost?.attacked(event.playerId);
        return;
      case "ghost-vanished":
        this.ghost?.vanished();
        return;
      case "ghost-flung":
        this.ghost?.flung();
        return;
      case "ghost-stole":
        if (!this.isUnseen(fog, event.playerId)) this.ghost?.stole(event.playerId);
        return;
      case "snowball-thrown": {
        const target = this.pawns.getPawnPosition(event.targetId);
        if (!target || this.isUnseen(fog, event.targetId)) return;
        const penguin = this.findNearestPenguin(target);
        // A miss lands a step beside the target, on the side facing the penguin.
        const aim = event.hit ? target : target.clone().add(new THREE.Vector3(0.9, 0, 0.5));
        this.effects.spawnSnowballThrow(penguin, aim, SNOWBALL_FLIGHT_MS / 1000, () => {
          if (event.frozen) this.pawns.freezeSolid(event.targetId);
          if (event.hit) this.effects.spawnFloatingText(target, event.frozen ? "Gelé !" : "❄", "#bfeaff");
        });
        return;
      }
      case "tomato-thrown": {
        const from = this.pawns.getPawnPosition(event.throwerId);
        const to = this.pawns.getPawnPosition(event.targetId);
        if (!from || !to) return;
        if (this.isUnseen(fog, event.throwerId) || this.isUnseen(fog, event.targetId)) return;
        // Rapid fire: each Tomate of the volley leaves a moment after the last, on a slightly different arc.
        for (let index = 0; index < event.count; index += 1) {
          const last = index === event.count - 1;
          const aim = to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5));
          window.setTimeout(() => {
            this.effects.spawnTomatoThrow(from, aim, TOMATO_FLIGHT_MS / 1000, () => {
              if (!last || !event.stunned) return;
              this.pawns.knockOut(event.targetId);
              this.effects.spawnFloatingText(to, "K.O. !", "#ffd166");
            });
          }, index * TOMATO_VOLLEY_GAP_MS);
        }
        return;
      }
      case "player-left": {
        const position = this.pawns.getPawnPosition(event.playerId);
        // A mage who crumbles to ash needs no poof; a pawn the fog hides needs none either.
        if (!position || this.pawns.isChoreographed(event.playerId) || this.isUnseen(fog, event.playerId)) return;
        this.effects.spawnPoof(position, "#ffffff");
        return;
      }
      case "turn-start": {
        const view = this.view;
        if (!view || view.mode !== "play" || !view.followActivePlayer) return;
        // The camera does not follow a player the fog hides: it would give them away.
        if (this.isUnseen(fog, event.playerId)) return;
        const pawn = view.pawns.find((candidate) => candidate.id === event.playerId);
        if (pawn) this.rig.focusOn(this.layout.getNodePosition(pawn.position), 0.78);
        return;
      }
      case "power":
        this.playPower(event.event, fog);
        return;
      case "invisibility":
        this.playInvisibility(event.playerId, fog);
        return;
      default:
        return;
    }
  };

  /**
   * Patch 0.2.3: a Cups Power's deed is played, once the walk before it is over. The pawns and the sister it moves
   * were held in place by the board until now (or are told that the move that follows is its own).
   */
  private playPower(event: PowerEvent, fog: Fog): void {
    if (event.seq <= this.playedPowerSeq) return;
    this.playedPowerSeq = event.seq;
    if (this.pendingPower?.seq === event.seq) this.pendingPower = null;
    this.pawns.playPower(event);

    const seen = (playerId: string) => !this.isUnseen(fog, playerId);
    switch (event.kind) {
      case "tunnel-dig":
        // The dive has dug it; a tunnel whose dive was missed (a late join) is dug now.
        this.tunnels.get(event.tunnelId)?.prop.dig();
        return;
      case "tunnel-cross": {
        const entry = this.tunnels.get(event.tunnelId);
        if (entry && event.closed) this.collapseTunnel(entry);
        return;
      }
      case "mark-place": {
        this.marks.get(`${event.playerId}:${event.nodeId}`)?.prop.draw();
        if (seen(event.playerId)) {
          const at = this.layout.getNodePosition(event.nodeId).setY(TILE_HEIGHT);
          this.effects.spawnShockRing(at, "#c44bff", 2, 0.7, 0.55);
          this.effects.spawnSparkles(at, ["#ff7a9a", "#d38bff"], 10, 0.7, 1);
        }
        return;
      }
      case "mark-teleport": {
        this.teleport = event;
        const view = this.view;
        if (view && view.mode === "play" && view.followActivePlayer && seen(event.playerId)) {
          this.rig.focusOn(this.layout.getNodePosition(event.to), 0.78);
        }
        return;
      }
      case "sister-swap":
        this.playSisterSwap(event, fog);
        return;
      case "mime-copy":
        if (seen(event.playerId) && seen(event.targetId)) this.playMimeCopy(event);
        return;
    }
  }

  /** Mime: a beam of light from the pawn that is copied to the copier, then a mask and a glint over the copier. */
  private playMimeCopy(event: Extract<PowerEvent, { kind: "mime-copy" }>): void {
    const copier = this.pawns.getPawnPosition(event.playerId);
    const target = this.pawns.getPawnPosition(event.targetId);
    if (!copier || !target) return;
    const chest = (point: THREE.Vector3) => point.clone().setY(point.y + 0.8);
    this.effects.spawnSparkles(target, ["#fff2b8", "#ffffff"], 8, 0.4, 0.7);
    this.effects.spawnBeam(chest(target), chest(copier), MIME_BEAM_MS / 1000);
    this.later(MIME_MASK_DELAY_MS, () => {
      const at = this.pawns.getPawnPosition(event.playerId) ?? copier;
      this.effects.spawnMask(at, 0.9);
      if (!prefersReducedMotion()) this.effects.spawnFlash(chest(at), "#ffffff", 0.7, 0.3);
      this.effects.spawnSparkleRing(at, "#fff2b8", 1.1);
      this.effects.spawnGlint(at, 0.5);
    });
  }

  /** Sœur Fantôme: mist crosses the board each way, and what the sister carried flies over in an arc. */
  private playSisterSwap(event: Extract<PowerEvent, { kind: "sister-swap" }>, fog: Fog): void {
    this.sisters.playSwap(event);
    if (this.isUnseen(fog, event.playerId)) return;
    const playerSpot = this.layout.getNodePosition(event.playerFrom).setY(TILE_HEIGHT);
    const sisterSpot = this.layout.getNodePosition(event.sisterFrom).setY(TILE_HEIGHT);
    const view = this.view;
    const streamSeconds = (SISTER_TRANSIT_MS / 1000) * 1.7;
    this.effects.spawnMistStream(playerSpot, sisterSpot, SISTER_MIST_COLORS, streamSeconds, 0.27);
    this.effects.spawnMistStream(sisterSpot, playerSpot, SISTER_MIST_COLORS, streamSeconds, 0.27);
    if (view && view.mode === "play" && view.followActivePlayer) {
      this.rig.focusOn(playerSpot.clone().lerp(sisterSpot, 0.5), 0.7);
    }

    if (event.carried.bulletBill) {
      const carry = { seq: event.seq, from: event.sisterFrom, to: event.playerFrom };
      this.later(SISTER_CARRY_DELAY_MS, () => this.bullet.carry(carry, SISTER_CARRY_MS));
    }
    if (!view || view.hidesProps) return;
    if (event.carried.mud > 0) {
      const puddle = this.mudPuddles.get(event.sisterFrom);
      if (puddle) {
        puddle.group.visible = false;
        this.launchFlight("mud", createMudPuddle(this.kit), event.sisterFrom, event.playerFrom);
      }
    }
    if (event.carried.portals > 0) {
      const portal = this.portals.get(event.sisterFrom);
      if (portal) {
        portal.group.visible = false;
        this.launchFlight("portal", createHellPortal(this.kit), event.sisterFrom, event.playerFrom);
      }
    }
    if (event.carried.redCup && this.cupNodeId === event.sisterFrom && this.redCup.group.visible) {
      this.redCup.group.visible = false;
      this.redCupFlight = this.launchFlight("cup", createRedCup(this.kit), event.sisterFrom, event.playerFrom);
    }
  }

  /** Mi-vu, Mi-vue: a player leaves the sight of the table, or shows again. Only a viewer who can see it sees it. */
  private playInvisibility(playerId: string, fog: Fog): void {
    if (fog.viewerHidden && fog.viewerId !== playerId) return;
    const opacity = fog.hiddenIds.has(playerId) ? 0 : fog.ghostlyId === playerId ? GHOSTLY_OPACITY : 1;
    this.pawns.playInvisibility(playerId, opacity);
  }

  /** The moments of a pawn's choreography the rest of the scene joins in: the soil, the vortex, the flame, the ash. */
  private handlePawnPhase(info: PawnPhaseInfo): void {
    const { position, hidden } = info;
    const ground = position.clone();
    switch (info.phase) {
      case "dive": {
        const entry = info.tunnel ? this.tunnels.get(info.tunnel.id) : undefined;
        if (entry) {
          entry.dormantSeconds = null;
          if (info.tunnel?.dug) entry.prop.dig();
          else entry.prop.cross(info.tunnel?.from === entry.a);
        }
        if (hidden) return;
        this.effects.spawnDirtBurst(ground, 18);
        this.rig.shakeFor(0.1, 240);
        return;
      }
      case "dig-deep":
        if (!hidden) this.effects.spawnDirtBurst(ground.setY(position.y + 0.05), 10);
        return;
      case "pop": {
        // The pawn starts below the ground: the soil flies from the tile's top.
        const mouth = ground.setY(TILE_HEIGHT);
        if (hidden) return;
        this.effects.spawnDirtBurst(mouth, 22);
        this.effects.spawnShockRing(mouth, "#d3bc9c", 1.8, 0.45);
        this.rig.shakeFor(0.16, 280);
        return;
      }
      case "suck":
        if (hidden) return;
        this.effects.spawnVortex(ground, MARK_SUCK_MS / 1000 + 0.25);
        this.rig.shakeFor(0.1, 320);
        return;
      case "emerge": {
        const teleport = this.teleport;
        if (teleport && teleport.playerId === info.playerId) {
          // The pentagram flares as the mage lands, and is spent (a mark that sent somebody to Hell stays).
          const entry = this.marks.get(`${teleport.playerId}:${teleport.to}`);
          entry?.prop.flash();
          if (!teleport.kept) entry?.prop.burnOut(0.45);
        }
        if (hidden) return;
        this.effects.spawnEmergeBurst(ground);
        this.rig.shakeFor(0.22, 380);
        return;
      }
      case "burn": {
        const teleport = this.teleport;
        if (hidden || !teleport || this.flameSeq === teleport.seq) return;
        this.flameSeq = teleport.seq;
        this.effects.spawnFlameColumn(this.layout.getNodePosition(teleport.to).setY(TILE_HEIGHT), 0.9);
        this.rig.shakeFor(0.3, 520);
        return;
      }
      case "crumble":
        if (hidden) return;
        this.effects.spawnAshCrumble(ground, MAGE_CRUMBLE_MS / 1000 + 0.4);
        this.rig.shakeFor(0.18, 420);
        return;
      case "dissolve":
        if (!hidden) this.effects.spawnGhostMist(ground, 10, SISTER_MIST_COLORS, true);
        return;
      case "condense":
        if (hidden) return;
        this.effects.spawnGhostMist(ground, 10, SISTER_MIST_COLORS, true);
        this.effects.spawnSparkleRing(ground, "#cfe9ff", 0.9, 12);
        return;
      case "fade-out":
        if (hidden) return;
        this.effects.spawnSparkles(ground, INVISIBILITY_SPARKLES, 14, 0.5, 0.9);
        this.effects.spawnShockRing(ground, "#bfeaff", 1.2, 0.5);
        return;
      case "pop-in":
        if (hidden) return;
        if (!prefersReducedMotion()) {
          this.effects.spawnFlash(ground.clone().setY(ground.y + 0.6), "#ffffff", 0.8, 0.3);
        }
        this.effects.spawnSparkleRing(ground, "#ffffff", 1, 12);
        this.effects.spawnSparkles(ground, INVISIBILITY_SPARKLES, 8, 0.5, 0.7);
        return;
    }
  }

  private updatePendingPower(delta: number): void {
    if (!this.pendingPower) return;
    this.pendingPowerSeconds += delta;
    if (this.pendingPowerSeconds < PENDING_POWER_SECONDS) return;
    this.playedPowerSeq = this.pendingPower.seq;
    this.pendingPower = null;
  }

  private later(delayMs: number, action: () => void): void {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      if (!this.disposed) action();
    }, delayMs);
    this.timers.add(timer);
  }

  /** The power event the board knows of waits for its turn only so long: a deed that never comes is let go. */
  private followPowerEvent(power: PowerEvent | null): void {
    if (power === null) {
      this.playedPowerSeq = 0;
      this.pendingPower = null;
      return;
    }
    if (power.seq <= this.playedPowerSeq || this.pendingPower?.seq === power.seq) return;
    this.pendingPower = power;
    this.pendingPowerSeconds = 0;
  }

  /** Where the ground is under a point of the board: the top of a tile, or the ground between the tiles. */
  private readonly getSurfaceHeight = (x: number, z: number): number => {
    for (const node of this.layout.board.nodes) {
      if (node.id === HELL_NODE_ID) continue;
      const radius = (node.kind === "start" ? START_TILE_RADIUS : TILE_RADIUS) * 0.95;
      if (Math.hypot(node.x - x, node.z - z) < radius) return TILE_HEIGHT;
    }
    return 0;
  };

  /** Whether Hell's pit (the carousel, the crevasse) stands on this spot: a tunnel runs under it. */
  private readonly isUnderLandmark = (x: number, z: number): boolean => {
    const hell = this.layout.getNode(HELL_NODE_ID);
    return hell !== undefined && Math.hypot(hell.x - x, hell.z - z) < this.layout.config.hellClearance;
  };

  /**
   * Taupe: a tunnel is a prop between two tiles. Dug by a pawn's dive (it waits for the dive to begin), crossed by
   * another, caved in once it is closed. It is not part of the roads, which are drawn once.
   */
  private syncTunnels(tunnels: TunnelView[], firstView: boolean, movement: PlayerMovement | null): void {
    const wanted = new Set(tunnels.map((tunnel) => tunnel.id));
    for (const [id, entry] of this.tunnels) {
      entry.wanted = wanted.has(id);
      // Gone from the board without the crossing's event to say so: it caves in now.
      if (!entry.wanted && entry.prop.isOpen()) this.collapseTunnel(entry);
    }
    for (const tunnel of tunnels) {
      if (this.tunnels.has(tunnel.id)) continue;
      const prop = createTunnelProp(this.kit, {
        a: this.layout.getNodePosition(tunnel.a),
        b: this.layout.getNodePosition(tunnel.b),
        surfaceY: this.getSurfaceHeight,
        isBlocked: this.isUnderLandmark,
      });
      this.scene.add(prop.group);
      const entry: TunnelEntry = { prop, a: tunnel.a, b: tunnel.b, wanted: true, dormantSeconds: null };
      this.tunnels.set(tunnel.id, entry);
      if (firstView) prop.reveal();
      else if (movement?.tunnel?.id === tunnel.id && movement.tunnel.dug) entry.dormantSeconds = 0;
      else prop.dig();
    }
  }

  private collapseTunnel(entry: TunnelEntry): void {
    if (!entry.prop.isOpen()) return;
    entry.prop.collapse();
    const a = this.layout.getNodePosition(entry.a).setY(TILE_HEIGHT);
    const b = this.layout.getNodePosition(entry.b).setY(TILE_HEIGHT);
    this.effects.spawnDust(a, 7, 1.1);
    this.effects.spawnDust(b, 7, 1.1);
    this.effects.spawnDust(a.clone().lerp(b, 0.5).setY(0.1), 5, 1.2);
    this.rig.shakeFor(0.1, 320);
  }

  private updateTunnels(elapsed: number, delta: number): void {
    for (const [id, entry] of this.tunnels) {
      if (entry.dormantSeconds !== null) {
        entry.dormantSeconds += delta;
        if (entry.dormantSeconds > DORMANT_TUNNEL_SECONDS) {
          entry.dormantSeconds = null;
          entry.prop.dig();
        }
      }
      entry.prop.update(elapsed, delta);
      // Gone from the board, and either caved in or never dug: nothing left to show.
      if (!entry.wanted && (entry.prop.isGone() || (!entry.prop.isOpen() && entry.dormantSeconds !== null))) {
        entry.prop.group.removeFromParent();
        entry.prop.dispose();
        this.tunnels.delete(id);
      }
    }
  }

  /** Mage noir: a pentagram is laid flat on its tile, drawn stroke by stroke, and burns out when it is spent. */
  private syncMarks(marks: MarkView[], firstView: boolean): void {
    const wanted = new Map(marks.map((mark) => [`${mark.ownerId}:${mark.nodeId}`, mark]));
    for (const [key, entry] of this.marks) {
      entry.wanted = wanted.has(key);
      if (!entry.wanted && !entry.prop.isDying()) entry.prop.burnOut();
    }
    for (const [key, mark] of wanted) {
      if (this.marks.has(key)) continue;
      const tile = this.tiles.get(mark.nodeId);
      if (!tile) continue;
      const prop = createMarkProp(this.kit, {
        ownerColor: mark.color,
        radius: tile.radius > TILE_RADIUS ? START_MARK_RADIUS : MARK_RADIUS,
      });
      prop.group.position.y += tile.topY;
      tile.surface.add(prop.group);
      this.marks.set(key, { prop, nodeId: mark.nodeId, wanted: true });
      if (firstView) prop.reveal();
      else prop.draw();
    }
  }

  private updateMarks(elapsed: number, delta: number): void {
    for (const [key, entry] of this.marks) {
      entry.prop.update(elapsed, delta);
      if (!entry.wanted && entry.prop.isGone()) {
        entry.prop.group.removeFromParent();
        entry.prop.dispose();
        this.marks.delete(key);
      }
    }
  }

  /** Something the sister carries leaves its tile in an arc, and stays in the air over the new one until it is set down. */
  private launchFlight(kind: FlyingProp["kind"], prop: AnimatedProp, fromNode: NodeId, toNode: NodeId): FlyingProp {
    const offset = kind === "mud" ? MUD_OFFSET : kind === "portal" ? PORTAL_OFFSET : new THREE.Vector3();
    const from = this.layout.getNodePosition(fromNode).add(offset).setY(TILE_HEIGHT);
    const to = this.layout.getNodePosition(toNode).add(offset).setY(TILE_HEIGHT);
    prop.group.position.copy(from);
    this.scene.add(prop.group);
    const flight: FlyingProp = {
      prop,
      kind,
      from,
      to,
      destNode: toNode,
      elapsed: 0,
      delay: SISTER_CARRY_DELAY_MS / 1000,
      duration: SISTER_CARRY_MS / 1000,
      trail: 0,
      landed: false,
    };
    this.flyingProps.push(flight);
    return flight;
  }

  private updateFlyingProps(elapsed: number, delta: number): void {
    for (let index = this.flyingProps.length - 1; index >= 0; index -= 1) {
      const flight = this.flyingProps[index];
      flight.elapsed += delta;
      const progress = clamp01((flight.elapsed - flight.delay) / flight.duration);
      const { group } = flight.prop;
      group.position.lerpVectors(flight.from, flight.to, easeInOutCubic(progress));
      group.position.y += Math.sin(progress * Math.PI) * CARRY_ARC_HEIGHT;
      if (flight.kind !== "cup") group.rotation.y = progress * Math.PI * 4;
      flight.prop.update(elapsed, delta);

      flight.trail += delta;
      if (progress > 0 && progress < 1 && flight.trail > 0.1) {
        flight.trail = 0;
        this.effects.spawnGhostMist(group.position.clone().setY(group.position.y + 0.2), 1, SISTER_MIST_COLORS, true);
      }
      if (progress >= 1 && !flight.landed) {
        flight.landed = true;
        this.effects.spawnPoof(flight.to.clone(), "#cfe9ff");
        this.effects.spawnSparkleRing(flight.to.clone(), "#cfe9ff", 0.9, 10);
      }
      if (flight.elapsed > 12) this.removeFlight(index);
    }
  }

  /** Sets down what the sister carried, once the board has put the real thing on its new tile. */
  private landFlyingProps(view: BoardView): void {
    for (let index = this.flyingProps.length - 1; index >= 0; index -= 1) {
      const flight = this.flyingProps[index];
      if (!flight.landed) continue;
      const arrived =
        flight.kind === "mud"
          ? this.mudPuddles.has(flight.destNode)
          : flight.kind === "portal"
            ? this.portals.has(flight.destNode)
            : view.redCupNodeId === flight.destNode;
      if (arrived || view.hidesProps) this.removeFlight(index);
    }
  }

  private removeFlight(index: number): void {
    const [flight] = this.flyingProps.splice(index, 1);
    flight.prop.group.removeFromParent();
    // The Red Cup's twin owns its geometry, materials and beam texture; the puddle and the Portail only borrow the kit's.
    if (flight.kind === "cup") disposeObject(flight.prop.group);
    if (flight === this.redCupFlight) {
      this.redCupFlight = null;
      this.redCup.group.visible = this.cupNodeId !== null;
    }
  }
}

/** Frees what a prop made for itself once it has left the scene. */
function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    }
  });
}

function preventDefault(event: Event): void {
  event.preventDefault();
}
