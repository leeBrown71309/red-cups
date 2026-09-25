import * as THREE from "three";
import { BOARD_EDGES, BOARD_NODES, getBoardNode } from "../game/board";
import type { NodeId, PlayerMovement } from "../game/types";
import { HELL_NODE_ID, START_NODE_ID } from "../game/types";
import { onFeedback, type FeedbackEvent } from "../feedback/event-bus";
import { SCENE_COLORS } from "../theme/palette";
import { SHOP_STALL_PLACEMENTS, START_FLAG_OFFSET, getNodePosition, getTunnelLayout } from "./board-layout";
import { CameraRig, type CameraMode } from "./camera-rig";
import { EffectsLayer } from "./effects-layer";
import { createHellPit, createShopStall, createStartFlag, createTunnelPortal } from "./models/landmarks-model";
import { createBulletBill, createMudPuddle, createRedCup, type AnimatedProp } from "./models/props-model";
import { createPond, createScenery, createTray } from "./models/scenery-model";
import { TILE_HEIGHT, createTileVisual, type TileVisual } from "./models/tile-model";
import { PawnController, type PawnInput } from "./pawn-controller";
import { RoadNetwork } from "./road-network";
import { SceneKit, easeOutBack } from "./scene-kit";

export interface BoardView {
  mode: CameraMode;
  pawns: PawnInput[];
  redCupNodeId: NodeId | null;
  mudNodeIds: NodeId[];
  bulletBillNodeId: NodeId | null;
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
}

const TAP_DISTANCE_PX = 9;
const TAP_DURATION_MS = 650;

/**
 * Owns the Three.js scene. React feeds it a serialisable `BoardView`; the
 * world never reads or writes the game store directly.
 */
export class BoardWorld {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly kit = new SceneKit();
  private readonly rig: CameraRig;
  private readonly tiles = new Map<NodeId, TileVisual>();
  private readonly roads: RoadNetwork;
  private readonly pawns: PawnController;
  private readonly effects = new EffectsLayer();
  private readonly animated: AnimatedProp[] = [];
  private readonly redCup: AnimatedProp;
  private readonly bulletBill: AnimatedProp;
  private readonly mudPuddles = new Map<NodeId, AnimatedProp>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly timer = new THREE.Timer();
  private readonly unsubscribeFeedback: () => void;
  private readonly bulletTarget = new THREE.Vector3();
  private view: BoardView | null = null;
  private hoveredNodeId: NodeId | null = null;
  private pointerStart: { x: number; y: number; time: number; id: number } | null = null;
  private cupNodeId: NodeId | null = null;
  private cupPopProgress = 1;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: BoardWorldCallbacks,
  ) {
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.75 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.classList.add("board-canvas");
    container.appendChild(this.renderer.domElement);

    this.rig = new CameraRig(this.renderer.domElement);
    this.addLights(coarsePointer ? 1_024 : 2_048);
    this.buildBoard();

    this.roads = new RoadNetwork(this.kit);
    this.scene.add(this.roads.group);

    this.pawns = new PawnController(this.kit);
    this.scene.add(this.pawns.group);

    this.redCup = createRedCup(this.kit);
    this.redCup.group.visible = false;
    this.scene.add(this.redCup.group);

    this.bulletBill = createBulletBill(this.kit);
    this.bulletBill.group.visible = false;
    this.scene.add(this.bulletBill.group);

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
    this.pawns.sync(view.pawns, view.lastMovement);
    this.refreshHighlights();

    if (view.redCupNodeId !== this.cupNodeId) {
      this.cupNodeId = view.redCupNodeId;
      this.redCup.group.visible = view.redCupNodeId !== null;
      if (view.redCupNodeId !== null) {
        this.redCup.group.position.copy(getNodePosition(view.redCupNodeId)).setY(TILE_HEIGHT);
        this.cupPopProgress = firstView ? 1 : 0;
      }
    }

    this.syncMud(view.mudNodeIds);

    this.bulletBill.group.visible = view.bulletBillNodeId !== null;
    if (view.bulletBillNodeId !== null) {
      const target = getNodePosition(view.bulletBillNodeId).add(new THREE.Vector3(0.7, 0, -0.5));
      if (!this.bulletTarget.equals(target) && this.bulletTarget.lengthSq() === 0) {
        this.bulletBill.group.position.copy(target);
      }
      this.bulletTarget.copy(target);
    } else {
      this.bulletTarget.set(0, 0, 0);
    }
  }

  recenter(): void {
    this.rig.recenter();
  }

  zoomBy(factor: number): void {
    this.rig.zoomBy(factor);
  }

  focusOnNode(nodeId: NodeId): void {
    this.rig.focusOn(getNodePosition(nodeId));
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

  private addLights(shadowMapSize: number): void {
    this.scene.add(new THREE.HemisphereLight("#fff6e8", "#b98d6a", 1.45));

    const sun = new THREE.DirectionalLight("#fff0d8", 2.5);
    sun.position.set(-10, 22, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    sun.shadow.camera.left = -17;
    sun.shadow.camera.right = 17;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.radius = 4;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight("#dbe8ff", 0.55);
    fill.position.set(12, 8, -8);
    this.scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.ShadowMaterial({ color: "#7a4a3a", opacity: 0.2 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.66;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private buildBoard(): void {
    this.scene.add(createTray(this.kit));
    this.scene.add(createScenery(this.kit));
    this.addAnimated(createPond(this.kit));

    for (const node of BOARD_NODES) {
      // Hell is never a walkable destination, so it gets a crater instead of a tile.
      if (node.id === HELL_NODE_ID) {
        const hell = createHellPit(this.kit);
        hell.group.position.set(node.x, 0, node.z);
        this.addAnimated(hell);
        continue;
      }

      const tile = createTileVisual(node, this.kit);
      this.tiles.set(node.id, tile);
      this.scene.add(tile.group);

      const stallPlacement = SHOP_STALL_PLACEMENTS[node.id];
      if (node.kind === "shop" && stallPlacement) {
        const stall = createShopStall(this.kit);
        stall.position.set(node.x + stallPlacement.x, 0, node.z + stallPlacement.z);
        stall.rotation.y = stallPlacement.rotation;
        this.scene.add(stall);
      }
    }

    const start = getBoardNode(START_NODE_ID);
    if (start) {
      const flag = createStartFlag(this.kit);
      flag.group.position.set(start.x + START_FLAG_OFFSET.x, TILE_HEIGHT, start.z + START_FLAG_OFFSET.z);
      this.addAnimated(flag);
    }

    for (const edge of BOARD_EDGES) {
      if (edge.kind !== "tunnel") continue;
      const tunnel = getTunnelLayout(edge);
      const entranceFacing = tunnel.entrance.x < 0 ? 1 : -1;
      const entrance = createTunnelPortal(this.kit, entranceFacing, `Tunnel → ${edge.to}`);
      entrance.group.position.copy(tunnel.entrance);
      this.addAnimated(entrance);
      const exit = createTunnelPortal(this.kit, entranceFacing === 1 ? -1 : 1, `Depuis ${edge.from}`);
      exit.group.position.copy(tunnel.exit);
      this.addAnimated(exit);
    }
  }

  private addAnimated(prop: AnimatedProp): void {
    this.animated.push(prop);
    this.scene.add(prop.group);
  }

  private syncMud(nodeIds: NodeId[]): void {
    const wanted = new Set(nodeIds);
    for (const [nodeId, puddle] of this.mudPuddles) {
      if (wanted.has(nodeId)) continue;
      this.scene.remove(puddle.group);
      this.mudPuddles.delete(nodeId);
    }
    for (const nodeId of wanted) {
      if (this.mudPuddles.has(nodeId)) continue;
      const puddle = createMudPuddle(this.kit);
      puddle.group.position.copy(getNodePosition(nodeId)).add(new THREE.Vector3(-0.45, -0.02, 0.4));
      this.scene.add(puddle.group);
      this.mudPuddles.set(nodeId, puddle);
    }
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
    this.roads.update(elapsed);
    this.pawns.update(elapsed, delta);
    this.effects.update(delta);
    for (const prop of this.animated) prop.update(elapsed, delta);
    for (const puddle of this.mudPuddles.values()) puddle.update(elapsed, delta);
    for (const tile of this.tiles.values()) tile.update(elapsed, delta);

    if (this.redCup.group.visible) {
      this.redCup.update(elapsed, delta);
      this.cupPopProgress = Math.min(1, this.cupPopProgress + delta * 1.6);
      this.redCup.group.scale.setScalar(Math.max(0.001, easeOutBack(this.cupPopProgress)));
    }

    if (this.bulletBill.group.visible) {
      const position = this.bulletBill.group.position;
      const toTarget = this.bulletTarget.clone().sub(position);
      if (toTarget.lengthSq() > 0.0004) {
        this.bulletBill.group.rotation.y = Math.atan2(toTarget.x, toTarget.z);
        position.lerp(this.bulletTarget, 1 - Math.exp(-delta * 3.5));
      }
      this.bulletBill.update(elapsed, delta);
    }

    this.renderer.render(this.scene, this.rig.camera);
  };

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.rig.resize(width, height);
  }

  private pickNode(event: PointerEvent): NodeId | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
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

    const nodeId = this.pickNode(event);
    if (nodeId !== null && this.view?.legalPaths.has(nodeId)) {
      this.callbacks.onTileSelect(nodeId, event.pointerType);
    }
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.buttons !== 0) return;
    const nodeId = this.pickNode(event);
    const hovered = nodeId !== null && this.view?.legalPaths.has(nodeId) ? nodeId : null;
    this.renderer.domElement.style.cursor = hovered !== null ? "pointer" : "";
    if (hovered === this.hoveredNodeId) return;
    this.hoveredNodeId = hovered;
    this.refreshHighlights();
  };

  private readonly handlePointerLeave = () => {
    if (this.hoveredNodeId === null) return;
    this.hoveredNodeId = null;
    this.refreshHighlights();
  };

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
        this.effects.spawnConfetti(getNodePosition(event.nodeId).setY(TILE_HEIGHT));
        return;
      case "hell-entered":
      case "hell-escaped":
      case "teleport": {
        const position = this.pawns.getPawnPosition(event.playerId);
        if (position) this.effects.spawnPoof(position, event.type === "hell-entered" ? "#c9a2ff" : "#ffffff");
        return;
      }
      case "mud-triggered":
        this.effects.spawnPoof(getNodePosition(event.nodeId).setY(TILE_HEIGHT), SCENE_COLORS.mud);
        return;
      case "bullet-hit": {
        const position = this.pawns.getPawnPosition(event.playerId);
        if (position) this.effects.spawnPoof(position, "#3b3440");
        return;
      }
      case "turn-start": {
        const view = this.view;
        if (!view || view.mode !== "play" || !view.followActivePlayer) return;
        const pawn = view.pawns.find((candidate) => candidate.id === event.playerId);
        if (pawn) this.rig.focusOn(getNodePosition(pawn.position), 0.78);
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
