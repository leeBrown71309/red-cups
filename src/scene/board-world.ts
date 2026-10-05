import * as THREE from "three";
import type { BoardEdge, BoardNode, MapId, NodeId, PlayerMovement } from "../game/types";
import { HELL_NODE_ID, START_NODE_ID } from "../game/types";
import { onFeedback, type FeedbackEvent } from "../feedback/event-bus";
import type { MapThemeId } from "../game/maps/map-types";
import { getSceneTheme, type SceneTheme } from "../theme/map-themes";
import { SCENE_COLORS } from "../theme/palette";
import { BoardLayout } from "./board-layout";
import { BulletBillActor, type BulletView } from "./bullet-bill-actor";
import { CameraRig, type CameraMode } from "./camera-rig";
import { EffectsLayer } from "./effects-layer";
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
} from "./models/props-model";
import { createTileArrow } from "./models/tile-arrow-model";
import { TOY_BOX_TRAY, createPond, createScenery, createTray } from "./models/scenery-model";
import { START_TILE_RADIUS, TILE_HEIGHT, TILE_RADIUS, createTileVisual, type TileVisual } from "./models/tile-model";
import { PawnController, type PawnInput } from "./pawn-controller";
import { RoadNetwork } from "./road-network";
import { SceneKit, easeOutBack } from "./scene-kit";
import { SNOWBALL_FLIGHT_MS, TOMATO_FLIGHT_MS, TOMATO_VOLLEY_GAP_MS } from "../theme/timing";

export interface BoardView {
  mode: CameraMode;
  /** Luna Park: which way the carousel turns right now. */
  carouselReversed: boolean;
  /** Banquise: the blizzard's temporary ice tile. */
  iceTileNodeId: NodeId | null;
  pawns: PawnInput[];
  redCupNodeId: NodeId | null;
  mudNodeIds: NodeId[];
  /** Le diable's Portails onto Hell. */
  portalNodeIds: NodeId[];
  /** The road a Barrière closes, as its two tiles. */
  barrierEdge: [NodeId, NodeId] | null;
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

export interface BoardWorldCallbacks {
  onTileSelect: (nodeId: NodeId, pointerType: string) => void;
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
  private readonly effects = new EffectsLayer();
  private readonly animated: AnimatedProp[] = [];
  private readonly redCup: AnimatedProp;
  private readonly bullet: BulletBillActor;
  /** Only on maps a ghost haunts. */
  private readonly ghost: GhostActor | null = null;
  private readonly mudPuddles = new Map<NodeId, AnimatedProp>();
  private readonly portals = new Map<NodeId, AnimatedProp>();
  /** The Barrière on its road, with the road it stands on. */
  private barrierProp: { key: string; prop: AnimatedProp } | null = null;
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

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: BoardWorldCallbacks,
    mapId: MapId,
  ) {
    this.layout = new BoardLayout(mapId);
    this.theme = getSceneTheme(this.layout.map.themeId);
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.75 : 2));
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
    });
    this.scene.add(this.pawns.group);

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
    if (firstView) this.pawns.acknowledgeMovement(view.lastMovement);

    this.rig.setMode(view.mode);
    this.roads.setCarouselReversed(view.carouselReversed);
    for (const [nodeId, tile] of this.tiles) {
      tile.setIce(this.layout.getNode(nodeId)?.ice === true || nodeId === view.iceTileNodeId);
    }
    this.carouselHell?.setReversed(view.carouselReversed);
    this.pawns.sync(view.pawns, view.lastMovement);
    this.refreshHighlights();

    if (view.redCupNodeId !== this.cupNodeId) {
      this.cupNodeId = view.redCupNodeId;
      this.redCup.group.visible = view.redCupNodeId !== null;
      if (view.redCupNodeId !== null) {
        this.redCup.group.position.copy(this.layout.getNodePosition(view.redCupNodeId)).setY(TILE_HEIGHT);
        this.cupPopProgress = firstView ? 1 : 0;
      }
    }

    this.syncMud(view.mudNodeIds);
    this.syncPortals(view.portalNodeIds);
    this.syncBarrier(view.barrierEdge);
    this.bullet.sync(view.bulletBill, view.bulletFlightSeq);
    this.ghost?.sync(view.ghost, view.ghostEventSeq);
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

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.unsubscribeFeedback();
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
    this.scene.add(new THREE.HemisphereLight(lights.sky, lights.ground, lights.ambient));

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

  /** The Barrière lies across the middle of its road, the bar across the way. */
  private syncBarrier(edge: [NodeId, NodeId] | null): void {
    const key = edge ? edge.join("-") : "";
    if (this.barrierProp && this.barrierProp.key === key) return;
    if (this.barrierProp) {
      this.barrierProp.prop.group.removeFromParent();
      this.barrierProp = null;
    }
    if (!edge) return;
    const from = this.layout.getNodePosition(edge[0]);
    const to = this.layout.getNodePosition(edge[1]);
    const prop = createBarrierProp(this.kit);
    prop.group.position
      .copy(from)
      .lerp(to, 0.5)
      .setY(TILE_HEIGHT * 0.5);
    prop.group.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    this.scene.add(prop.group);
    this.barrierProp = { key, prop };
  }

  /** Le diable's Portails sit on the tile's top, in its back-left quarter, clear of the mud. */
  private syncPortals(nodeIds: NodeId[]): void {
    const wanted = new Set(nodeIds);
    for (const [nodeId, portal] of this.portals) {
      if (wanted.has(nodeId)) continue;
      portal.group.removeFromParent();
      this.portals.delete(nodeId);
    }
    for (const nodeId of wanted) {
      const tile = this.tiles.get(nodeId);
      if (this.portals.has(nodeId) || !tile) continue;
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
    const covered = new Set<NodeId>([...view.pawns.map((pawn) => pawn.position), ...view.mudNodeIds]);
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
    this.roads.update(elapsed);
    this.pawns.update(elapsed, delta);
    this.effects.update(delta);
    for (const prop of this.animated) prop.update(elapsed, delta);
    for (const puddle of this.mudPuddles.values()) puddle.update(elapsed, delta);
    for (const portal of this.portals.values()) portal.update(elapsed, delta);
    this.barrierProp?.prop.update(elapsed, delta);
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
    const onGhost = this.pickGhost(event);
    const nodeId = onGhost ? null : this.pickNode(event);
    const hovered = nodeId !== null && this.view?.legalPaths.has(nodeId) ? nodeId : null;
    this.renderer.domElement.style.cursor = onGhost || hovered !== null ? "pointer" : "";
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

  private readonly handleFeedback = (event: FeedbackEvent) => {
    switch (event.type) {
      case "currency": {
        const position = this.pawns.getPawnPosition(event.playerId);
        if (!position) return;
        const text = `${event.delta > 0 ? "+" : "−"}${Math.abs(event.delta)}`;
        this.effects.spawnFloatingText(position, text, event.delta > 0 ? "#7ee07a" : "#ff6b5e");
        return;
      }
      case "cup-collected":
        this.effects.spawnConfetti(this.layout.getNodePosition(event.nodeId).setY(TILE_HEIGHT));
        return;
      case "hell-entered":
      case "hell-escaped":
      case "teleport": {
        const position = this.pawns.getPawnPosition(event.playerId);
        if (position) this.effects.spawnPoof(position, event.type === "hell-entered" ? "#c9a2ff" : "#ffffff");
        return;
      }
      case "mud-placed":
      case "mud-triggered":
        this.effects.spawnPoof(
          this.layout.getNodePosition(event.nodeId).add(MUD_OFFSET).setY(TILE_HEIGHT),
          SCENE_COLORS.mud,
        );
        return;
      case "bullet-flight": {
        this.bullet.launch(event.flight);
        const landing = event.flight.path[event.flight.path.length - 1] ?? event.flight.from;
        if (this.view?.mode === "play" && this.view.followActivePlayer) {
          this.rig.focusOn(this.layout.getNodePosition(landing), 0.78);
        }
        return;
      }
      case "bullet-hit": {
        this.effects.spawnExplosion(this.layout.getNodePosition(event.nodeId).setY(TILE_HEIGHT));
        this.rig.shakeFor(0.45, 650);
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
        const halfway = this.layout.getNodePosition(event.from).lerp(this.layout.getNodePosition(event.to), 0.5);
        this.effects.spawnIceFall(halfway.setY(0.05), event.hit);
        return;
      }
      case "ice-shatter": {
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
        this.ghost?.attacked(event.playerId);
        return;
      case "ghost-vanished":
        this.ghost?.vanished();
        return;
      case "ghost-flung":
        this.ghost?.flung();
        return;
      case "ghost-stole":
        this.ghost?.stole(event.playerId);
        return;
      case "snowball-thrown": {
        const target = this.pawns.getPawnPosition(event.targetId);
        if (!target) return;
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
        if (position) this.effects.spawnPoof(position, "#ffffff");
        return;
      }
      case "turn-start": {
        const view = this.view;
        if (!view || view.mode !== "play" || !view.followActivePlayer) return;
        const pawn = view.pawns.find((candidate) => candidate.id === event.playerId);
        if (pawn) this.rig.focusOn(this.layout.getNodePosition(pawn.position), 0.78);
        return;
      }
      default:
        return;
    }
  };
}

function preventDefault(event: Event): void {
  event.preventDefault();
}
