import { useEffect, useRef } from "react";
import * as THREE from "three";
import { BOARD_EDGES, BOARD_NODES } from "../game/board";
import type { GameState, NodeId, Player } from "../game/types";

interface BoardSceneProps {
  game: GameState;
  legalDestinations: NodeId[];
  onNodeClick: (nodeId: NodeId) => void;
}

interface BoardVisuals {
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  scene: THREE.Scene;
  nodeMeshes: Map<NodeId, THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>>;
  nodeRings: Map<NodeId, THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>>;
  playerGroups: Map<string, THREE.Group>;
  cupGroup: THREE.Group;
  mudGroup: THREE.Group;
  bulletBillGroup: THREE.Group;
  resizeObserver: ResizeObserver;
  frameTime: number;
}

const NODE_COLORS: Record<string, number> = {
  start: 0xe8bf61,
  shop: 0x55a8dc,
  red: 0xe65e52,
  green: 0x78ad79,
  neutral: 0x7c8886,
  hell: 0x9c63bf,
};

function createLabelSprite(text: string, color: string, small = false): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Sprite();

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.font = `700 ${small ? 48 : 72}px Inter, Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(small ? 0.48 : 0.64, small ? 0.24 : 0.32, 1);
  return sprite;
}

function makeNodeMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.52,
    metalness: 0.08,
    emissive: color,
    emissiveIntensity: 0.08,
  });
}

function createCup(): THREE.Group {
  const group = new THREE.Group();
  const cupMaterial = new THREE.MeshStandardMaterial({
    color: 0xd94235,
    roughness: 0.26,
    metalness: 0.06,
  });
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2e4ca,
    roughness: 0.3,
  });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.36, 32), cupMaterial);
  cup.position.y = 0.53;
  group.add(cup);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.025, 8, 32), rimMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.72;
  group.add(rim);

  const straw = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8),
    new THREE.MeshStandardMaterial({ color: 0xf4c767, roughness: 0.38 }),
  );
  straw.position.set(0.07, 0.87, -0.03);
  straw.rotation.z = -0.14;
  group.add(straw);
  return group;
}

function createPlayerToken(color: string): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.34,
    metalness: 0.12,
    emissive: color,
    emissiveIntensity: 0.12,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.13, 24), material);
  base.position.y = 0.34;
  group.add(base);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.34, 20), material);
  body.position.y = 0.56;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), material);
  head.position.y = 0.81;
  group.add(head);
  return group;
}

function createMudMarker(): THREE.Group {
  const group = new THREE.Group();
  const puddle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.33, 0.08, 28),
    new THREE.MeshStandardMaterial({ color: 0x87553d, roughness: 0.84 }),
  );
  puddle.position.y = 0.22;
  group.add(puddle);
  return group;
}

function createBulletBill(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 0.34, 5, 12),
    new THREE.MeshStandardMaterial({ color: 0xc74735, roughness: 0.32, metalness: 0.08 }),
  );
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.48;
  group.add(body);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.25, 16),
    new THREE.MeshStandardMaterial({ color: 0xf3c05e, roughness: 0.35 }),
  );
  tip.rotation.z = -Math.PI / 2;
  tip.position.set(0.3, 0.48, 0);
  group.add(tip);
  return group;
}

function disposeObjectResources(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      object.geometry.dispose();
    }

    if (
      !(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite)
    ) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material instanceof THREE.Material) {
        const map = (material as THREE.Material & { map?: THREE.Texture | null }).map;
        map?.dispose();
        material.dispose();
      }
    });
  });
}

function disposeScene(scene: THREE.Scene): void {
  disposeObjectResources(scene);
}

function placePlayers(playerGroups: Map<string, THREE.Group>, players: Player[]): void {
  const playersByNode = new Map<NodeId, Player[]>();
  for (const player of players) {
    const nodePlayers = playersByNode.get(player.position) ?? [];
    nodePlayers.push(player);
    playersByNode.set(player.position, nodePlayers);
  }

  for (const [nodeId, nodePlayers] of playersByNode) {
    const node = BOARD_NODES.find((candidate) => candidate.id === nodeId);
    if (!node) continue;

    nodePlayers.forEach((player, index) => {
      const token = playerGroups.get(player.id);
      if (!token) return;
      const angle = (Math.PI * 2 * index) / Math.max(nodePlayers.length, 1) - Math.PI / 2;
      const radius = nodePlayers.length > 1 ? 0.4 : 0;
      token.position.set(node.x + Math.cos(angle) * radius, 0, node.z + Math.sin(angle) * radius);
    });
  }
}

export default function BoardScene({
  game,
  legalDestinations,
  onNodeClick,
}: BoardSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const visualsRef = useRef<BoardVisuals | null>(null);
  const legalDestinationsRef = useRef(legalDestinations);
  const onNodeClickRef = useRef(onNodeClick);

  useEffect(() => {
    legalDestinationsRef.current = legalDestinations;
    onNodeClickRef.current = onNodeClick;
  }, [legalDestinations, onNodeClick]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let visuals: BoardVisuals | null = null;
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#121a18");
      scene.fog = new THREE.Fog("#121a18", 21, 46);

      const camera = new THREE.OrthographicCamera(-10, 10, 7.3, -7.3, 0.1, 80);
      camera.position.set(0, 16, 11);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.setClearColor("#121a18");
      mount.replaceChildren(renderer.domElement);

      const ambient = new THREE.AmbientLight(0xe3edd9, 2.1);
      scene.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xffe3ae, 3.2);
      keyLight.position.set(-5, 12, 6);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      scene.add(keyLight);

      const board = new THREE.Mesh(
        new THREE.BoxGeometry(17.2, 0.34, 12.7),
        new THREE.MeshStandardMaterial({ color: 0x1a2924, roughness: 0.82 }),
      );
      board.position.y = -0.2;
      board.receiveShadow = true;
      board.castShadow = true;
      scene.add(board);

      const inset = new THREE.Mesh(
        new THREE.PlaneGeometry(16.4, 11.9),
        new THREE.MeshStandardMaterial({
          color: 0x253b32,
          roughness: 0.96,
          metalness: 0.02,
        }),
      );
      inset.rotation.x = -Math.PI / 2;
      inset.position.y = -0.015;
      inset.receiveShadow = true;
      scene.add(inset);

      const pathMaterial = new THREE.MeshStandardMaterial({
        color: 0xe3a954,
        emissive: 0x885526,
        emissiveIntensity: 0.22,
        roughness: 0.45,
      });
      for (const edge of BOARD_EDGES) {
        const from = BOARD_NODES.find((node) => node.id === edge.from);
        const to = BOARD_NODES.find((node) => node.id === edge.to);
        if (!from || !to) continue;

        const start = new THREE.Vector3(from.x, 0.11, from.z);
        const end = new THREE.Vector3(to.x, 0.11, to.z);
        const curve = new THREE.CatmullRomCurve3([start, end]);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 8, false), pathMaterial);
        tube.receiveShadow = true;
        scene.add(tube);

        if (edge.oneWay) {
          const direction = end.clone().sub(start).normalize();
          const arrow = new THREE.Mesh(
            new THREE.ConeGeometry(0.14, 0.28, 12),
            new THREE.MeshStandardMaterial({ color: 0xf3cc83, roughness: 0.42 }),
          );
          arrow.position.copy(start).lerp(end, 0.62);
          arrow.position.y = 0.19;
          arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
          scene.add(arrow);
        }
      }

      const nodeMeshes = new Map<NodeId, THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>>();
      const nodeRings = new Map<NodeId, THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>>();

      for (const node of BOARD_NODES) {
        const color = NODE_COLORS[node.kind];
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(node.kind === "hell" ? 0.66 : 0.57, 0.62, 0.25, 36),
          makeNodeMaterial(color),
        );
        base.position.set(node.x, 0.08, node.z);
        base.userData.nodeId = node.id;
        base.castShadow = true;
        base.receiveShadow = true;
        scene.add(base);
        nodeMeshes.set(node.id, base);

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(node.kind === "hell" ? 0.72 : 0.62, 0.035, 8, 36),
          new THREE.MeshBasicMaterial({ color: 0xf5d7a1, transparent: true, opacity: 0.26 }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(node.x, 0.22, node.z);
        scene.add(ring);
        nodeRings.set(node.id, ring);

        const label = createLabelSprite(
          node.id === 11 ? "HELL" : `${node.id}`,
          "#f7f0e2",
          node.id === 11,
        );
        label.position.set(node.x, 0.54, node.z);
        scene.add(label);

        if (node.kind === "shop") {
          const shopMarker = createLabelSprite("SHOP", "#d9f0f8", true);
          shopMarker.position.set(node.x, 0.93, node.z);
          scene.add(shopMarker);
        }

        if (node.kind === "start") {
          const startMarker = createLabelSprite("START", "#fff0c9", true);
          startMarker.position.set(node.x, 0.93, node.z);
          scene.add(startMarker);
        }
      }

      const playerGroups = new Map<string, THREE.Group>();
      for (const color of [
        "#f16a53",
        "#f5c451",
        "#56a8ee",
        "#7cc785",
        "#c27de4",
        "#f08aba",
        "#79d4cb",
        "#ed8d48",
      ]) {
        const playerGroup = createPlayerToken(color);
        playerGroup.visible = false;
        scene.add(playerGroup);
        playerGroups.set(color, playerGroup);
      }

      const cupGroup = createCup();
      cupGroup.visible = false;
      scene.add(cupGroup);

      const mudGroup = new THREE.Group();
      scene.add(mudGroup);

      const bulletBillGroup = createBulletBill();
      bulletBillGroup.visible = false;
      scene.add(bulletBillGroup);

      visuals = {
        renderer,
        camera,
        scene,
        nodeMeshes,
        nodeRings,
        playerGroups,
        cupGroup,
        mudGroup,
        bulletBillGroup,
        resizeObserver: new ResizeObserver(() => resizeScene(renderer, camera, mount)),
        frameTime: 0,
      };
      visuals.resizeObserver.observe(mount);
      resizeScene(renderer, camera, mount);
      visualsRef.current = visuals;

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const onPointerMove = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects([...nodeMeshes.values()]);
        renderer.domElement.style.cursor =
          hits[0] && legalDestinationsRef.current.includes(hits[0].object.userData.nodeId)
            ? "pointer"
            : "default";
      };
      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects([...nodeMeshes.values()]);
        const nodeId = hits[0]?.object.userData.nodeId as NodeId | undefined;
        if (nodeId !== undefined && legalDestinationsRef.current.includes(nodeId)) {
          onNodeClickRef.current(nodeId);
        }
      };

      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerdown", onPointerDown);

      const onFrame = (time: number) => {
        if (!visuals) return;
        const elapsed = time / 1_000;
        visuals.frameTime = elapsed;
        visuals.cupGroup.position.y = Math.sin(elapsed * 2.2) * 0.045;
        visuals.cupGroup.rotation.y = elapsed * 0.55;
        visuals.renderer.render(visuals.scene, visuals.camera);
      };
      renderer.setAnimationLoop(onFrame);

      return () => {
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        visuals?.resizeObserver.disconnect();
        renderer.setAnimationLoop(null);
        disposeScene(scene);
        renderer.dispose();
        renderer.domElement.remove();
        visualsRef.current = null;
      };
    } catch (error) {
      console.error("Three.js board initialization failed.", error);
      mount.dataset.error = "true";
    }
  }, []);

  useEffect(() => {
    const visuals = visualsRef.current;
    if (!visuals) return;

    for (const node of BOARD_NODES) {
      const mesh = visuals.nodeMeshes.get(node.id);
      const ring = visuals.nodeRings.get(node.id);
      if (!mesh || !ring) continue;
      const isLegal = legalDestinations.includes(node.id);
      const isActive = game.players[game.activePlayerIndex]?.position === node.id;
      mesh.material.emissiveIntensity = isLegal ? 0.48 : isActive ? 0.27 : 0.08;
      ring.material.opacity = isLegal ? 0.88 : isActive ? 0.62 : 0.22;
      ring.material.color.set(isLegal ? 0xf6d589 : isActive ? 0xf6e2b7 : 0xf5d7a1);
    }

    for (const token of visuals.playerGroups.values()) token.visible = false;
    const playerColorGroups = new Map<string, THREE.Group>();
    for (const player of game.players) {
      const token = visuals.playerGroups.get(player.color);
      if (!token) continue;
      token.visible = true;
      playerColorGroups.set(player.id, token);
    }
    placePlayers(playerColorGroups, game.players);

    const cupNode = BOARD_NODES.find((node) => node.id === game.redCupNodeId);
    visuals.cupGroup.visible = cupNode !== undefined;
    if (cupNode) {
      visuals.cupGroup.position.set(cupNode.x + 0.28, 0.08, cupNode.z - 0.24);
    }

    for (const child of [...visuals.mudGroup.children]) {
      visuals.mudGroup.remove(child);
      disposeObjectResources(child);
    }
    for (const trap of game.mudTraps) {
      const node = BOARD_NODES.find((candidate) => candidate.id === trap.nodeId);
      if (!node) continue;
      const marker = createMudMarker();
      marker.position.set(node.x - 0.28, 0, node.z + 0.24);
      visuals.mudGroup.add(marker);
    }

    visuals.bulletBillGroup.visible = game.bulletBill?.status === "active";
    if (game.bulletBill?.status === "active") {
      const node = BOARD_NODES.find((candidate) => candidate.id === game.bulletBill?.position);
      if (node) visuals.bulletBillGroup.position.set(node.x + 0.28, 0, node.z + 0.22);
    }
  }, [game, legalDestinations]);

  return (
    <div className="board-scene" ref={mountRef} aria-label="Plateau de jeu Red Cups">
      <div className="board-scene__legend" aria-hidden="true">
        <span><i className="legend-dot legend-dot--shop" /> Boutique</span>
        <span><i className="legend-dot legend-dot--cup" /> Red Cup</span>
        <span><i className="legend-dot legend-dot--hell" /> Enfer</span>
      </div>
      <div className="board-scene__fallback">
        Le rendu 3D ne peut pas être initialisé dans ce navigateur.
      </div>
    </div>
  );
}

function resizeScene(
  renderer: THREE.WebGLRenderer,
  camera: THREE.OrthographicCamera,
  mount: HTMLDivElement,
): void {
  const width = mount.clientWidth;
  const height = mount.clientHeight;
  if (width === 0 || height === 0) return;

  const aspect = width / height;
  const halfHeight = Math.max(6.25, 7.2 / aspect);
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
