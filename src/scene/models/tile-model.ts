import * as THREE from "three";
import type { BoardNode, NodeId } from "../../game/types";
import { SCENE_COLORS, TILE_COLORS } from "../../theme/palette";
import { addOutline, type SceneKit } from "../scene-kit";
import { DISPLAY_FONT } from "../text-sprites";

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
  pickMesh: THREE.Mesh;
  setHighlight: (highlight: TileHighlight) => void;
  update: (elapsed: number, delta: number) => void;
  repaintDecal: () => void;
}

const SEGMENTS = 10;

export function createTileVisual(node: BoardNode, kit: SceneKit): TileVisual {
  const radius = node.kind === "start" ? START_TILE_RADIUS : TILE_RADIUS;
  const colors = TILE_COLORS[node.kind];
  const group = new THREE.Group();
  group.position.set(node.x, 0, node.z);

  const lift = new THREE.Group();
  group.add(lift);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.97, radius * 1.04, TILE_HEIGHT * 0.72, SEGMENTS),
    kit.flat(colors.side),
  );
  base.position.y = TILE_HEIGHT * 0.36;
  base.castShadow = true;
  base.receiveShadow = true;
  lift.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.9, radius * 0.97, TILE_HEIGHT * 0.28, SEGMENTS),
    kit.flat(colors.top),
  );
  top.position.y = TILE_HEIGHT * 0.86;
  top.receiveShadow = true;
  lift.add(top);
  addOutline(base, kit, 1.035);

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
    pickMesh,
    repaintDecal,
    setHighlight: (next) => {
      highlight = next;
      marker.visible = next.legal;
      markerMaterial.color.set(next.markerColor);
    },
    update: (elapsed, delta) => {
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
