import * as THREE from "three";
import type { BoardNode, NodeId } from "../../game/types";
import { SCENE_COLORS, TILE_COLORS } from "../../theme/palette";
import { addOutline, jitterGeometry, type SceneKit } from "../scene-kit";
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
  /** Archipel: the tide drowned this causeway tile: it sinks under the sea, leaving ripples, or rises again. */
  setSunk: (active: boolean) => void;
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
  const { sinkTile, updateWaterProps } = createWaterProps(node, kit, radius, lift, group);
  let sunkTarget = 0;
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
    setSunk: (active) => {
      sunkTarget = active ? 1 : 0;
    },
    update: (elapsed, delta) => {
      updateWaterProps(elapsed, delta, sunkTarget, sinkTile);
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
  const hasGlyph = node.kind !== "neutral" && node.kind !== "causeway" && node.kind !== "pass";
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
  if (node.kind === "shop" || node.kind === "oasis") drawBag(context, size / 2, glyphY);
  if (node.kind === "well") drawDroplet(context, size / 2, glyphY);
  if (node.kind === "start") drawStar(context, size / 2, glyphY + 4, 22);
  if (node.kind === "quay") drawAnchor(context, size / 2, glyphY);
  if (node.kind === "whirlpool") drawSpiral(context, size / 2, glyphY);
}

/** A drop of water: a well gives to whoever pays. */
function drawDroplet(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.save();
  const trace = () => {
    context.beginPath();
    context.moveTo(x, y - 20);
    context.bezierCurveTo(x + 18, y + 2, x + 16, y + 20, x, y + 20);
    context.bezierCurveTo(x - 16, y + 20, x - 18, y + 2, x, y - 20);
    context.closePath();
  };
  context.lineJoin = "round";
  context.lineWidth = 8;
  context.strokeStyle = "rgba(58, 37, 48, 0.55)";
  trace();
  context.stroke();
  context.fillStyle = "rgba(255, 255, 255, 0.95)";
  trace();
  context.fill();
  context.restore();
}

/** A little anchor: a quay is where the ferry ties up. */
function drawAnchor(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.save();
  context.lineCap = "round";
  context.lineWidth = 8;
  context.strokeStyle = "rgba(58, 37, 48, 0.55)";
  const trace = () => {
    context.beginPath();
    context.arc(x, y - 17, 6, 0, Math.PI * 2);
    context.moveTo(x, y - 11);
    context.lineTo(x, y + 16);
    context.moveTo(x - 11, y - 3);
    context.lineTo(x + 11, y - 3);
    context.moveTo(x - 17, y + 6);
    context.quadraticCurveTo(x - 14, y + 19, x, y + 19);
    context.quadraticCurveTo(x + 14, y + 19, x + 17, y + 6);
  };
  trace();
  context.stroke();
  context.lineWidth = 4;
  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  trace();
  context.stroke();
  context.restore();
}

/** A spiral: whoever arrives on a whirlpool is drawn away. */
function drawSpiral(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.save();
  context.lineCap = "round";
  const trace = () => {
    context.beginPath();
    for (let step = 0; step <= 40; step += 1) {
      const angle = step * 0.34;
      const reach = 2 + step * 0.52;
      const px = x + Math.cos(angle) * reach;
      const py = y + Math.sin(angle) * reach * 0.8;
      if (step === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
  };
  context.lineWidth = 8;
  context.strokeStyle = "rgba(58, 37, 48, 0.55)";
  trace();
  context.stroke();
  context.lineWidth = 4;
  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  trace();
  context.stroke();
  context.restore();
}

/**
 * Archipel des Marées: what the water adds to a tile. A quay gets mooring posts with a lantern, a whirlpool three
 * white arcs that turn, a causeway the means to sink below the sea (and ripples to show where it lies).
 * `sinkTile` is what the tile's `update` hands back to the helper each frame.
 */
function createWaterProps(
  node: BoardNode,
  kit: SceneKit,
  radius: number,
  lift: THREE.Group,
  group: THREE.Group,
): {
  sinkTile: { value: number };
  updateWaterProps: (elapsed: number, delta: number, sunkTarget: number, sinkTile: { value: number }) => void;
} {
  const sinkTile = { value: 0 };
  const idle = { sinkTile, updateWaterProps: () => undefined };

  if (node.kind === "quay") {
    const lanterns: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        kit.geometry("quay-post", () => new THREE.CylinderGeometry(0.1, 0.13, 0.62, 6)),
        kit.flat("#6b4a2f"),
      );
      post.position.set(side * radius * 0.78, TILE_HEIGHT + 0.31, -radius * 0.5);
      post.castShadow = true;
      addOutline(post, kit, 1.1);
      const lantern = new THREE.Mesh(
        kit.geometry("quay-lantern", () => new THREE.SphereGeometry(0.11, 8, 6)),
        new THREE.MeshStandardMaterial({ color: "#ffe9a8", emissive: "#ffb347", emissiveIntensity: 0.9 }),
      );
      lantern.position.set(post.position.x, TILE_HEIGHT + 0.7, post.position.z);
      lanterns.push(lantern);
      lift.add(post, lantern);
    }
    const rope = new THREE.Mesh(
      kit.geometry("quay-rope", () => new THREE.CylinderGeometry(0.025, 0.025, radius * 1.56, 5)),
      kit.flat("#e8d4a8"),
    );
    rope.rotation.z = Math.PI / 2;
    rope.position.set(0, TILE_HEIGHT + 0.42, -radius * 0.5);
    lift.add(rope);
    return {
      sinkTile,
      updateWaterProps: (elapsed) => {
        lanterns.forEach((lantern, index) => {
          (lantern.material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.75 + Math.sin(elapsed * 2.6 + index * 1.9) * 0.3;
        });
      },
    };
  }

  if (node.kind === "whirlpool") {
    const arcs: THREE.Mesh[] = [];
    const radii: [number, number][] = [
      [0.62, 0.7],
      [0.76, 0.85],
      [0.88, 0.95],
    ];
    radii.forEach(([inner, outer], index) => {
      const arc = new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 20, 1, index, Math.PI * (1.15 - index * 0.12)),
        new THREE.MeshBasicMaterial({
          color: "#ffffff",
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      arc.rotation.x = -Math.PI / 2;
      arc.position.y = TILE_HEIGHT + 0.02 + index * 0.002;
      arc.renderOrder = 2;
      arc.raycast = () => undefined;
      arcs.push(arc);
      lift.add(arc);
    });
    return {
      sinkTile,
      updateWaterProps: (elapsed) => {
        arcs.forEach((arc, index) => {
          arc.rotation.z = elapsed * (1.9 - index * 0.45) * (index % 2 === 0 ? 1 : -1);
        });
      },
    };
  }

  if (node.kind === "well") {
    // A well of stone behind the number: a round curb, two posts, a beam and a bucket that swings.
    const curb = new THREE.Mesh(
      kit.geometry("well-curb", () => new THREE.CylinderGeometry(0.4, 0.44, 0.34, 10)),
      kit.flat("#c9b79b"),
    );
    curb.position.set(0, TILE_HEIGHT + 0.17, -radius * 0.55);
    curb.castShadow = true;
    addOutline(curb, kit, 1.06);
    const water = new THREE.Mesh(
      kit.geometry("well-water", () => new THREE.CylinderGeometry(0.3, 0.3, 0.04, 10)),
      new THREE.MeshStandardMaterial({
        color: "#3aa9dc",
        roughness: 0.15,
        emissive: "#1d6fa5",
        emissiveIntensity: 0.3,
      }),
    );
    water.position.set(0, TILE_HEIGHT + 0.33, -radius * 0.55);
    lift.add(curb, water);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        kit.geometry("well-post", () => new THREE.BoxGeometry(0.09, 0.85, 0.09)),
        kit.flat("#6b4a2f"),
      );
      post.position.set(side * 0.38, TILE_HEIGHT + 0.55, -radius * 0.55);
      lift.add(post);
    }
    const beam = new THREE.Mesh(
      kit.geometry("well-beam", () => new THREE.BoxGeometry(0.95, 0.08, 0.1)),
      kit.flat("#6b4a2f"),
    );
    beam.position.set(0, TILE_HEIGHT + 0.98, -radius * 0.55);
    lift.add(beam);
    const bucket = new THREE.Group();
    bucket.position.set(0, TILE_HEIGHT + 0.95, -radius * 0.55);
    const rope = new THREE.Mesh(
      kit.geometry("well-rope", () => new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4)),
      kit.flat("#e8d4a8"),
    );
    rope.position.y = -0.2;
    const pail = new THREE.Mesh(
      kit.geometry("well-pail", () => new THREE.CylinderGeometry(0.1, 0.08, 0.14, 7)),
      kit.flat("#8a5a3c"),
    );
    pail.position.y = -0.46;
    bucket.add(rope, pail);
    lift.add(bucket);
    return {
      sinkTile,
      updateWaterProps: (elapsed) => {
        bucket.rotation.x = Math.sin(elapsed * 1.3) * 0.12;
        water.scale.setScalar(1 + Math.sin(elapsed * 2.4) * 0.03);
      },
    };
  }

  if (node.kind === "oasis") {
    // A teal glow ring round the tile and a clay jug: a refuge, hardly reachable by any item.
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.96, radius * 1.16, 24),
      new THREE.MeshBasicMaterial({
        color: "#7ff0d0",
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = TILE_HEIGHT * 0.3;
    lift.add(halo);
    const jug = new THREE.Mesh(
      kit.geometry(
        "oasis-jug",
        () =>
          new THREE.LatheGeometry(
            [
              [0, 0],
              [0.16, 0],
              [0.22, 0.14],
              [0.14, 0.34],
              [0.08, 0.42],
              [0.11, 0.48],
            ].map(([r, h]) => new THREE.Vector2(r, h)),
            9,
          ),
      ),
      kit.flat("#c4764a"),
    );
    jug.position.set(radius * 0.62, TILE_HEIGHT, -radius * 0.45);
    jug.castShadow = true;
    lift.add(jug);
    return {
      sinkTile,
      updateWaterProps: (elapsed) => {
        (halo.material as THREE.MeshBasicMaterial).opacity = 0.32 + Math.sin(elapsed * 2.2 + node.id) * 0.14;
      },
    };
  }

  if (node.kind === "pass") {
    // A gate of two sandstone pillars; when a sandstorm shuts the pass, a dune rises over it and dust swirls.
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(
        kit.geometry("pass-pillar", () => new THREE.CylinderGeometry(0.14, 0.18, 1.0, 6)),
        kit.flat("#d6b98a"),
      );
      pillar.position.set(side * radius * 0.7, TILE_HEIGHT + 0.5, -radius * 0.1);
      pillar.castShadow = true;
      lift.add(pillar);
    }
    const lintel = new THREE.Mesh(
      kit.geometry("pass-lintel", () => new THREE.BoxGeometry(radius * 1.7, 0.14, 0.22)),
      kit.flat("#c9a878"),
    );
    lintel.position.set(0, TILE_HEIGHT + 1.05, -radius * 0.1);
    lift.add(lintel);
    const mound = new THREE.Mesh(
      kit.geometry("pass-mound", () => jitterGeometry(new THREE.IcosahedronGeometry(1, 2), 0.1, 77)),
      kit.flat("#e8c98a"),
    );
    mound.scale.setScalar(0.001);
    mound.position.set(0, TILE_HEIGHT * 0.3, 0);
    mound.castShadow = true;
    lift.add(mound);
    const dust = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.5, 18),
      new THREE.MeshBasicMaterial({
        color: "#f3d9a2",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    dust.rotation.x = -Math.PI / 2;
    dust.position.y = TILE_HEIGHT + 0.5;
    lift.add(dust);
    return {
      sinkTile,
      updateWaterProps: (elapsed, delta, sunkTarget, tile) => {
        tile.value += (sunkTarget - tile.value) * Math.min(1, delta * 2.2);
        if (Math.abs(sunkTarget - tile.value) < 0.002) tile.value = sunkTarget;
        const size = tile.value * 1.7;
        mound.scale.set(Math.max(0.001, size * 1.1), Math.max(0.001, size * 0.6), Math.max(0.001, size));
        const stir = tile.value > 0.05 ? tile.value : 0;
        dust.rotation.z = elapsed * 1.4;
        dust.scale.setScalar(1 + Math.sin(elapsed * 2.2) * 0.12);
        (dust.material as THREE.MeshBasicMaterial).opacity = stir * 0.45;
      },
    };
  }

  if (node.kind === "causeway") {
    // Where a drowned causeway lies, a shoal of paler water and two rings that spread and fade.
    const shoal = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 1.12, 20),
      new THREE.MeshBasicMaterial({ color: "#a8f1ee", transparent: true, opacity: 0, depthWrite: false }),
    );
    shoal.rotation.x = -Math.PI / 2;
    shoal.renderOrder = 3;
    shoal.raycast = () => undefined;
    const rings = [0, 1].map(() => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.68, 24),
        new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 4;
      ring.raycast = () => undefined;
      return ring;
    });
    const water = new THREE.Group();
    water.add(shoal, ...rings);
    group.add(water);
    return {
      sinkTile,
      updateWaterProps: (elapsed, delta, sunkTarget, tile) => {
        tile.value += (sunkTarget - tile.value) * Math.min(1, delta * 2.4);
        if (Math.abs(sunkTarget - tile.value) < 0.002) tile.value = sunkTarget;
        // The tile sinks straight down; the ripples stay on the surface, so they ride back up against the sink.
        const depth = tile.value * 0.95;
        group.position.y = -depth;
        // With no floor to hide it, a drowned tile flattens and vanishes under the water.
        lift.scale.y = 1 - tile.value * 0.8;
        lift.visible = tile.value < 0.97;
        water.position.y = 0.09 + depth;
        const shown = Math.max(0, (tile.value - 0.35) / 0.65);
        (shoal.material as THREE.MeshBasicMaterial).opacity = shown * 0.5;
        rings.forEach((ring, index) => {
          const cycle = (elapsed * 0.6 + index * 0.5) % 1;
          ring.scale.setScalar(0.8 + cycle * 1.1);
          (ring.material as THREE.MeshBasicMaterial).opacity = shown * (1 - cycle) * 0.65;
        });
      },
    };
  }

  return idle;
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
