import * as THREE from "three";
import type { BoardNode, NodeId } from "../../game/types";
import { SCENE_COLORS, TILE_COLORS } from "../../theme/palette";
import { addOutline, type SceneKit } from "../scene-kit";
import { DISPLAY_FONT, createLabelSprite } from "../text-sprites";

export const TILE_RADIUS = 1.1;
export const START_TILE_RADIUS = 1.45;
export const TILE_HEIGHT = 0.34;

export interface TileHighlight {
  legal: boolean;
  hovered: boolean;
  onPreviewPath: boolean;
  markerColor: string;
}

export interface TileVisual {
  nodeId: NodeId;
  group: THREE.Group;
  radius: number;
  topY: number;
  /** Rises with the tile when it is highlighted: props laid on the tile go here, at `topY`. */
  surface: THREE.Group;
  pickMesh: THREE.Mesh;
  setHighlight: (highlight: TileHighlight) => void;
  /** Pawns or props hide the painted number: a badge on the tile's edge keeps it readable. */
  setCovered: (covered: boolean) => void;
  /** Banquise: shows or melts the ice (glassy cap, frosty rim and spikes) on this tile. */
  setIce: (active: boolean) => void;
  /** Doomsday: the tile turns blood red while every tile spins the wheel of misfortune. */
  setDoomed: (active: boolean) => void;
  update: (elapsed: number, delta: number) => void;
  repaintDecal: () => void;
}

const SEGMENTS = 10;

export interface TileStyle {
  /** Night maps: a glowing edge and a lit top so the tile colour reads in the dark. */
  neon?: boolean;
}

/** Doomsday palette: every tile (the Hell tile excepted) turns the same blood red, with an ember glow on top. */
const DOOM_TOP = new THREE.Color("#ec3a30");
const DOOM_SIDE = new THREE.Color("#7a1520");
const DOOM_GLOW = new THREE.Color("#ff2a12");

export function createTileVisual(node: BoardNode, kit: SceneKit, style: TileStyle = {}): TileVisual {
  const radius = node.kind === "start" ? START_TILE_RADIUS : TILE_RADIUS;
  const colors = TILE_COLORS[node.kind];
  const group = new THREE.Group();
  group.position.set(node.x, 0, node.z);

  const lift = new THREE.Group();
  group.add(lift);

  // Doomsday recolours the tile itself, so each tile owns its materials (the kit's are shared by colour).
  const baseMaterial = kit.flat(colors.side).clone();
  const topMaterial = (
    style.neon ? kit.flat(colors.top, { emissive: colors.top, emissiveIntensity: 0.35 }) : kit.flat(colors.top)
  ).clone();
  const restTop = new THREE.Color(colors.top);
  const restSide = new THREE.Color(colors.side);
  const restEmissive = topMaterial.emissive.clone();
  const restEmissiveIntensity = topMaterial.emissiveIntensity;
  const canBeDoomed = node.kind !== "hell";
  let doomTarget = 0;
  let doomMix = 0;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.97, radius * 1.04, TILE_HEIGHT * 0.72, SEGMENTS),
    baseMaterial,
  );
  base.position.y = TILE_HEIGHT * 0.36;
  base.castShadow = true;
  base.receiveShadow = true;
  lift.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.9, radius * 0.97, TILE_HEIGHT * 0.28, SEGMENTS),
    topMaterial,
  );
  top.position.y = TILE_HEIGHT * 0.86;
  top.receiveShadow = true;
  lift.add(top);
  addOutline(base, kit, 1.035);

  // Banquise: ice laid on the tile, permanently or by the blizzard; it grows and melts away.
  const ice = createIceCover(kit, radius);
  ice.scale.setScalar(node.ice ? 1 : 0.001);
  ice.visible = node.ice === true;
  lift.add(ice);
  let iceTarget = node.ice ? 1 : 0;

  if (style.neon) {
    const glowEdge = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.04, 0.055, 4, SEGMENTS * 3),
      kit.unlit(colors.top),
    );
    glowEdge.rotation.x = Math.PI / 2;
    glowEdge.position.y = TILE_HEIGHT * 0.72;
    lift.add(glowEdge);
  }

  const decalCanvas = document.createElement("canvas");
  decalCanvas.width = 256;
  decalCanvas.height = 256;
  const decalTexture = new THREE.CanvasTexture(decalCanvas);
  decalTexture.colorSpace = THREE.SRGBColorSpace;
  decalTexture.anisotropy = 8;
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 1.7, radius * 1.7),
    new THREE.MeshBasicMaterial({ map: decalTexture, transparent: true, depthWrite: false }),
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = TILE_HEIGHT + 0.012;
  lift.add(decal);

  const repaintDecal = () => {
    paintTileDecal(decalCanvas, node);
    decalTexture.needsUpdate = true;
  };
  repaintDecal();

  // Front-left edge: the ring of pawns leaves the diagonals free, and no shop stall stands there.
  const badge = createLabelSprite(String(node.id), {
    background: colors.top,
    color: "#ffffff",
    stroke: SCENE_COLORS.ink,
    fontSize: 64,
    worldHeight: 0.66,
  });
  const badgeMaterial = badge.material as THREE.SpriteMaterial;
  badgeMaterial.depthTest = false;
  badgeMaterial.opacity = 0;
  badge.renderOrder = 6;
  badge.visible = false;
  badge.position.set(-radius * 0.74, TILE_HEIGHT + 0.36, radius * 0.72);
  lift.add(badge);
  let covered = false;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 1.08, radius * 1.3, 24),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  group.add(ring);

  const marker = createDestinationMarker(kit);
  marker.visible = false;
  group.add(marker);

  const pickMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, 1.9, 12),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pickMesh.position.y = 0.9;
  pickMesh.userData.nodeId = node.id;
  group.add(pickMesh);

  let highlight: TileHighlight = { legal: false, hovered: false, onPreviewPath: false, markerColor: "#ffffff" };
  const markerMaterial = marker.userData.fill as THREE.MeshStandardMaterial;

  return {
    nodeId: node.id,
    group,
    radius,
    topY: TILE_HEIGHT,
    surface: lift,
    pickMesh,
    repaintDecal,
    setHighlight: (next) => {
      highlight = next;
      marker.visible = next.legal;
      markerMaterial.color.set(next.markerColor);
    },
    setCovered: (next) => {
      covered = next;
    },
    setIce: (active) => {
      iceTarget = active ? 1 : 0;
      if (active) ice.visible = true;
    },
    setDoomed: (active) => {
      doomTarget = active && canBeDoomed ? 1 : 0;
    },
    update: (elapsed, delta) => {
      if (ice.visible) {
        const scale = ice.scale.x + (iceTarget - ice.scale.x) * Math.min(1, delta * 4);
        ice.scale.setScalar(Math.max(0.001, scale));
        if (iceTarget === 0 && scale < 0.02) ice.visible = false;
      }
      if (canBeDoomed && (doomMix !== doomTarget || doomMix > 0)) {
        doomMix += (doomTarget - doomMix) * Math.min(1, delta * 2.5);
        if (Math.abs(doomTarget - doomMix) < 0.005) doomMix = doomTarget;
        const throb = 0.5 + Math.sin(elapsed * 2.2 + node.id * 0.7) * 0.5;
        topMaterial.color.copy(restTop).lerp(DOOM_TOP, doomMix);
        baseMaterial.color.copy(restSide).lerp(DOOM_SIDE, doomMix);
        topMaterial.emissive.copy(restEmissive).lerp(DOOM_GLOW, doomMix);
        topMaterial.emissiveIntensity = restEmissiveIntensity + doomMix * (0.22 + throb * 0.24);
      }
      const badgeOpacity = covered ? 1 : 0;
      badgeMaterial.opacity += (badgeOpacity - badgeMaterial.opacity) * Math.min(1, delta * 8);
      badge.visible = badgeMaterial.opacity > 0.02;
      const liftTarget = highlight.hovered ? 0.16 : highlight.legal ? 0.05 : 0;
      lift.position.y += (liftTarget - lift.position.y) * Math.min(1, delta * 12);

      const ringMaterial = ring.material as THREE.MeshBasicMaterial;
      const pulse = 0.5 + Math.sin(elapsed * 4 + node.id) * 0.5;
      const ringOpacity = highlight.hovered
        ? 0.95
        : highlight.legal
          ? 0.45 + pulse * 0.4
          : highlight.onPreviewPath
            ? 0.5
            : 0;
      ringMaterial.opacity += (ringOpacity - ringMaterial.opacity) * Math.min(1, delta * 10);
      ring.scale.setScalar(1 + (highlight.legal ? pulse * 0.06 : 0));

      if (marker.visible) {
        marker.position.y = TILE_HEIGHT + 1.55 + Math.sin(elapsed * 3.4 + node.id) * 0.14 + lift.position.y;
        marker.rotation.y = elapsed * 1.6;
        marker.scale.setScalar(highlight.hovered ? 1.25 : 1);
      }
    },
  };
}

/** A glassy cap, a frosty rim and a ring of ice spikes, like the lips of the crevasse. */
function createIceCover(kit: SceneKit, radius: number): THREE.Group {
  const cover = new THREE.Group();
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.94, radius * 0.98, 0.06, SEGMENTS),
    new THREE.MeshStandardMaterial({
      color: "#dff6ff",
      transparent: true,
      opacity: 0.45,
      roughness: 0.08,
      metalness: 0.2,
      flatShading: true,
      depthWrite: false,
    }),
  );
  cap.position.y = TILE_HEIGHT + 0.005;
  cover.add(cap);

  const frost = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.05, 0.07, 4, SEGMENTS * 3), kit.unlit("#bfe9ff"));
  frost.rotation.x = Math.PI / 2;
  frost.position.y = TILE_HEIGHT * 0.72;
  cover.add(frost);

  const spikeMaterial = new THREE.MeshStandardMaterial({
    color: "#cfefff",
    roughness: 0.12,
    metalness: 0.15,
    flatShading: true,
  });
  const spikeCount = 9;
  for (let index = 0; index < spikeCount; index += 1) {
    const angle = (index / spikeCount) * Math.PI * 2 + 0.2;
    // Short at the front so the number stays readable from the camera.
    const height = Math.sin(angle) > 0.2 ? 0.28 : 0.45 + ((index * 7) % 3) * 0.1;
    const spike = new THREE.Mesh(
      kit.geometry("ice-spike", () => new THREE.ConeGeometry(0.14, 1, 4)),
      spikeMaterial,
    );
    spike.scale.set(1, height, 1);
    spike.position.set(Math.cos(angle) * radius * 1.18, height / 2, Math.sin(angle) * radius * 1.18);
    spike.rotation.set(Math.sin(angle) * 0.25, index, -Math.cos(angle) * 0.25);
    spike.castShadow = true;
    addOutline(spike, kit, 1.08);
    cover.add(spike);
  }
  return cover;
}

function createDestinationMarker(kit: SceneKit): THREE.Group {
  const marker = new THREE.Group();
  const fill = new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 0.6 });
  const arrow = new THREE.Mesh(
    kit.geometry("marker-cone", () => new THREE.ConeGeometry(0.34, 0.6, 4)),
    fill,
  );
  arrow.rotation.x = Math.PI;
  arrow.castShadow = true;
  addOutline(arrow, kit, 1.14);
  marker.add(arrow);
  marker.userData.fill = fill;
  return marker;
}

function paintTileDecal(canvas: HTMLCanvasElement, node: BoardNode): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const size = canvas.width;
  context.clearRect(0, 0, size, size);
  context.lineJoin = "round";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const label = node.kind === "hell" ? "" : String(node.id);
  const hasGlyph = node.kind !== "neutral";
  const numberY = hasGlyph ? size * 0.43 : size * 0.5;
  context.font = `700 ${node.kind === "start" ? 104 : 118}px ${DISPLAY_FONT}`;
  context.lineWidth = 22;
  context.strokeStyle = SCENE_COLORS.ink;
  context.strokeText(label, size / 2, numberY);
  context.fillStyle = "#ffffff";
  context.fillText(label, size / 2, numberY);

  const glyphY = size * 0.76;
  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  context.strokeStyle = "rgba(58, 37, 48, 0.55)";
  context.lineWidth = 7;
  if (node.kind === "green" || node.kind === "red") drawWheel(context, size / 2, glyphY + 2, 21);
  if (node.kind === "shop") drawBag(context, size / 2, glyphY);
  if (node.kind === "start") drawStar(context, size / 2, glyphY + 4, 22);
}

/** Tiny wheel glyph: stopping on a green or red tile spins a wheel. */
function drawWheel(context: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  context.fill();
  context.save();
  context.strokeStyle = "rgba(58, 37, 48, 0.55)";
  context.lineWidth = 4;
  for (let spoke = 0; spoke < 4; spoke += 1) {
    const angle = (spoke * Math.PI) / 4;
    context.beginPath();
    context.moveTo(x - Math.cos(angle) * radius, y - Math.sin(angle) * radius);
    context.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    context.stroke();
  }
  context.restore();
}

function drawBag(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.beginPath();
  context.roundRect(x - 22, y - 16, 44, 36, 8);
  context.stroke();
  context.fill();
  context.beginPath();
  context.arc(x, y - 16, 11, Math.PI, 0);
  context.lineWidth = 6;
  context.strokeStyle = "rgba(255, 255, 255, 0.92)";
  context.stroke();
}

function drawStar(context: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = (Math.PI / 5) * point - Math.PI / 2;
    const length = point % 2 === 0 ? radius : radius * 0.45;
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
  }
  context.closePath();
  context.stroke();
  context.fill();
}
