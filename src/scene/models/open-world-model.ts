import * as THREE from "three";
import type { MapThemeId } from "../../game/maps/map-types";
import { SCENE_COLORS } from "../../theme/palette";
import { HELL_NODE_ID, START_NODE_ID } from "../../game/types";
import type { BoardLayout } from "../board-layout";
import { createRandom, jitterGeometry, type SceneKit } from "../scene-kit";
import type { AnimatedProp } from "./props-model";
import { createTuftGeometry } from "./scenery-model";

/**
 * The three first maps without their tray: the ground the board stands on goes on past the old edge, in the colours of
 * the map, rolls into gentle rises further out and fades into the haze; plants, rocks and props thin out into the
 * landscape instead of stopping at a rim. Only the ring beyond the old tray is dressed here: what stood inside it (the
 * trees, the lake, the stalls...) is the map's own scenery and stays as it was.
 */

interface OpenTheme {
  /** Ground colour near the board, and the patches it is mottled with. */
  base: string;
  patches: string[];
  /** Colour the far ground and the props are tinted to, like the haze of the horizon. */
  haze: string;
  /** Height of the rises beyond the board, in world units. */
  rise: number;
}

const THEMES: Partial<Record<MapThemeId, OpenTheme>> = {
  "toy-box": { base: "#9ad77e", patches: ["#8ccf72", "#a9e08a", "#b6e695"], haze: "#d6efc4", rise: 1.5 },
  "night-fair": { base: "#2b3063", patches: ["#262a58", "#343a72", "#3a3077"], haze: "#4a4fa0", rise: 0.5 },
  polar: { base: "#eef5fc", patches: ["#e1edf8", "#f8fbff", "#d6e8f7"], haze: "#dbeaf8", rise: 1.1 },
};

/** How far past the old tray the ground is solid, then fades out (in the board's own half sizes). */
const SOLID_REACH = 26;
const FADE_FROM = 0.9;
const FADE_TO = 1.5;
const CELL = 1.15;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43_758.5453;
  return value - Math.floor(value);
}

function valueNoise(x: number, y: number): number {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const u = smoothstep(0, 1, x - cellX);
  const v = smoothstep(0, 1, y - cellY);
  const top = hash(cellX, cellY) * (1 - u) + hash(cellX + 1, cellY) * u;
  const bottom = hash(cellX, cellY + 1) * (1 - u) + hash(cellX + 1, cellY + 1) * u;
  return top * (1 - v) + bottom * v;
}

/** Smooth noise in 0..1, a few octaves. */
function fbm(x: number, y: number): number {
  return valueNoise(x, y) * 0.55 + valueNoise(x * 2.1, y * 2.1) * 0.3 + valueNoise(x * 4.3, y * 4.3) * 0.15;
}

interface Footprint {
  halfWidth: number;
  halfDepth: number;
}

/** Height of the ground at (x, z): flat under the board, then low rises, kept down on the side the camera looks from. */
function createHeightAt(foot: Footprint, rise: number): (x: number, z: number) => number {
  return (x, z) => {
    // Distance past an ellipse round the old tray, so the rises have no corners.
    const out = Math.max(0, Math.hypot(x / (foot.halfWidth + 2), z / (foot.halfDepth + 2)) - 1) * (foot.halfDepth + 2);
    const front = z > 0 ? 0.35 : 1;
    return rise * front * smoothstep(1.5, 10, out) * (0.2 + 0.8 * fbm(x * 0.07 + 11, z * 0.07 - 5));
  };
}

/** The ground: one big mottled mesh, flat under the board, rising beyond it, transparent at its far edge. */
function createOpenFloor(foot: Footprint, theme: OpenTheme, heightAt: (x: number, z: number) => number): THREE.Mesh {
  const reachX = foot.halfWidth + SOLID_REACH;
  const reachZ = foot.halfDepth + SOLID_REACH;
  const width = reachX * 2 * FADE_TO;
  const depth = reachZ * 2 * FADE_TO;
  const geometry = new THREE.PlaneGeometry(width, depth, Math.round(width / CELL), Math.round(depth / CELL));
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 4);
  const base = new THREE.Color(theme.base);
  const patches = theme.patches.map((color) => new THREE.Color(color));
  const haze = new THREE.Color(theme.haze);
  const color = new THREE.Color();
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    position.setY(index, heightAt(x, z) - 0.01);

    const mottling = fbm(x * 0.16, z * 0.16);
    const patch =
      patches[Math.min(patches.length - 1, Math.floor(valueNoise(x * 0.11 + 40, z * 0.11) * patches.length))];
    color.copy(base).lerp(patch, smoothstep(0.35, 0.7, mottling) * 0.85);
    color.multiplyScalar(0.96 + hash(x * 3.1, z * 2.3) * 0.08);
    const distance = Math.hypot(x / reachX, z / reachZ);
    color.lerp(haze, smoothstep(0.35, FADE_TO, distance) * 0.55);
    colors.set([color.r, color.g, color.b, 1 - smoothstep(FADE_FROM, FADE_TO, distance)], index * 4);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  geometry.computeVertexNormals();

  const floor = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: true }),
  );
  floor.receiveShadow = true;
  floor.renderOrder = -1;
  floor.raycast = () => undefined;
  return floor;
}

// ------------------------------------------------------------------------------------------------------ scattering

interface Piece {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  rotation?: number;
  color: THREE.Color;
}

/** One instanced mesh for a kind of prop: a position, a size, a turn and a colour per piece. */
function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, pieces: Piece[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, pieces.length));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  pieces.forEach((piece, index) => {
    quaternion.setFromAxisAngle(up, piece.rotation ?? 0);
    matrix.compose(piece.position, quaternion, piece.scale);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, piece.color);
  });
  mesh.count = pieces.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.raycast = () => undefined;
  return mesh;
}

function tintable(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true });
}

interface Spot {
  x: number;
  y: number;
  z: number;
  /** Distance past the old tray's edge. */
  out: number;
}

/** Picks spots in the ring beyond the old tray, and tints colours towards the haze with the distance. */
class Ring {
  private readonly random = createRandom(31_415);
  private readonly haze: THREE.Color;

  constructor(
    private readonly foot: Footprint,
    readonly heightAt: (x: number, z: number) => number,
    haze: string,
  ) {
    this.haze = new THREE.Color(haze);
  }

  rand(): number {
    return this.random();
  }

  between(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  /**
   * A spot between `minOut` and `maxOut` units beyond the old tray's edge. Tall things (`tall`) keep off the front of the
   * board, where they would hide tiles from the camera; `clump` makes them gather in groves.
   */
  spot(minOut: number, maxOut: number, options: { tall?: boolean; clump?: number } = {}): Spot | null {
    const { halfWidth, halfDepth } = this.foot;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const x = (this.random() * 2 - 1) * (halfWidth + maxOut);
      const z = (this.random() * 2 - 1) * (halfDepth + maxOut);
      const out = Math.max(Math.abs(x) - halfWidth, Math.abs(z) - halfDepth);
      if (out < minOut || out > maxOut) continue;
      if (options.tall && z > halfDepth * 0.3 && Math.abs(x) < halfWidth + 4) continue;
      if (options.clump !== undefined && fbm(x * 0.11 + 7, z * 0.11) < options.clump) continue;
      return { x, y: this.heightAt(x, z), z, out };
    }
    return null;
  }

  tint(color: string, out: number, far = 34, strength = 0.55): THREE.Color {
    return new THREE.Color(color).lerp(this.haze, Math.min(1, out / far) * strength);
  }
}

function fill<T>(count: number, make: () => T | null): T[] {
  const items: T[] = [];
  for (let index = 0; index < count; index += 1) {
    const item = make();
    if (item) items.push(item);
  }
  return items;
}

function vec(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

// -------------------------------------------------------------------------------------------------- the meadow

/**
 * What the game occupies, as one question: how far is (x, z) from a tile, a road, a stall or a rock the roads go round?
 * Scenery follows the real outline of the board with it, not the corners of the old tray.
 */
function createClearance(layout: BoardLayout): (x: number, z: number) => number {
  const tiles = layout.board.nodes.map((node) => ({
    x: node.x,
    z: node.z,
    radius: node.id === HELL_NODE_ID ? layout.config.hellClearance : node.id === START_NODE_ID ? 1.9 : 1.2,
  }));
  const stalls = Object.entries(layout.config.shopStalls).flatMap(([nodeId, placement]) => {
    const node = layout.getNode(Number(nodeId));
    return node ? [{ x: node.x + placement.x, z: node.z + placement.z, radius: 1 }] : [];
  });
  const rocks = layout.getRoadRocks().map((rock) => ({ x: rock.x, z: rock.z, radius: 0.5 * rock.scale }));
  // What the map's own scenery has already taken (snowmen, an igloo, poles, tents): the dressing keeps off it.
  const taken = layout.getReserved().map((spot) => ({ x: spot.x, z: spot.z, radius: spot.radius }));
  const roads = layout.getRoadSegments().map((segment) => layout.getRoadPoints(segment));
  const pond = layout.config.pond;
  const round = [
    ...tiles,
    ...stalls,
    ...rocks,
    ...taken,
    ...(pond ? [{ x: pond.x, z: pond.z, radius: pond.radius + 0.4 }] : []),
  ];

  const lake = layout.openWorld ? layout.config.lake : undefined;
  return (x, z) => {
    let nearest = Infinity;
    if (lake) {
      const inside = Math.hypot((x - lake.x) / lake.halfWidth, (z - lake.z) / lake.halfDepth) - 1;
      nearest = inside * Math.min(lake.halfWidth, lake.halfDepth) - 0.4;
    }
    for (const item of round) nearest = Math.min(nearest, Math.hypot(item.x - x, item.z - z) - item.radius);
    for (const points of roads) {
      for (let index = 1; index < points.length; index += 1) {
        const a = points[index - 1];
        const b = points[index];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
        nearest = Math.min(nearest, Math.hypot(a.x + dx * t - x, a.z + dz * t - z) - 0.5);
      }
    }
    return nearest;
  };
}

interface FieldOptions {
  /** Keep at least this far from anything of the game. */
  minClear: number;
  /** How far from the middle of the world the scenery may reach, in half sizes of the old tray beyond it. */
  reach?: number;
  /** Tall things stay off the near side of the board, where the camera would see them in front of the tiles. */
  tall?: boolean;
  /** Gathers things into groves: noise below this is refused. */
  clump?: number;
  /** Thins them out close to the board: the chance of a spot grows from 0 at `minClear` to 1 at this clearance. */
  thickenTo?: number;
}

/** Picks spots for scenery by the real outline of the board: far enough from tiles and roads, in a ragged ellipse. */
function createPicker(layout: BoardLayout, ring: Ring): (options: FieldOptions) => Spot | null {
  const clearance = createClearance(layout);
  const foot = { halfWidth: layout.halfWidth, halfDepth: layout.halfDepth };
  return (options) => {
    const reach = options.reach ?? 26;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const x = (ring.rand() * 2 - 1) * (foot.halfWidth + reach);
      const z = (ring.rand() * 2 - 1) * (foot.halfDepth + reach);
      // An ellipse with a ragged edge: no corners.
      const envelope = Math.hypot(x / (foot.halfWidth + reach), z / (foot.halfDepth + reach));
      if (envelope > 0.78 + 0.22 * fbm(x * 0.09 + 3, z * 0.09 + 9)) continue;
      const clear = clearance(x, z);
      if (clear < options.minClear) continue;
      if (options.tall && z > foot.halfDepth * 0.3 && clear < 5) continue;
      if (options.clump !== undefined && fbm(x * 0.11 + 7, z * 0.11) < options.clump) continue;
      if (options.thickenTo !== undefined && ring.rand() > smoothstep(options.minClear, options.thickenTo, clear))
        continue;
      return { x, y: ring.heightAt(x, z), z, out: Math.max(0, clear) + Math.max(0, envelope - 0.5) * 20 };
    }
    return null;
  };
}

/**
 * Toy box, without its tray: one meadow that goes on past where the tray ended, in every direction. What grows where
 * follows the real outline of the board (the distance to the tiles and the roads), not a rectangle: groves of trees
 * thicken away from the tiles and thin out near them, bushes and boulders sit in the gaps, long grass and flowers
 * carpet the rest, and the rocks the roads wind round are there.
 */
function dressMeadow(kit: SceneKit, layout: BoardLayout, ring: Ring, group: THREE.Group): void {
  const pick = createPicker(layout, ring);

  const trunk = kit.geometry("open-trunk", () => new THREE.CylinderGeometry(0.12, 0.18, 1, 5));
  const crown = kit.geometry("open-crown", () => jitterGeometry(new THREE.IcosahedronGeometry(1, 0), 0.18, 31));
  const cone = kit.geometry("open-pine", () => new THREE.ConeGeometry(0.9, 2.2, 6));
  const trunks: Piece[] = [];
  const crowns: Piece[] = [];
  const pines: Piece[] = [];
  fill(150, () => pick({ minClear: 2, tall: true, clump: 0.47, thickenTo: 8 })).forEach((spot, index) => {
    const size = ring.between(0.95, 1.8) * (spot.out < 4 ? 0.85 : 1);
    const isPine = index % 3 === 0;
    const leaf = ring.tint(SCENE_COLORS.leaves[index % SCENE_COLORS.leaves.length], spot.out);
    trunks.push({
      position: vec(spot.x, spot.y + 0.5 * size, spot.z),
      scale: vec(size, size * 1.1, size),
      color: ring.tint(SCENE_COLORS.trunk, spot.out),
    });
    (isPine ? pines : crowns).push({
      position: vec(spot.x, spot.y + (isPine ? 1.7 : 1.5) * size, spot.z),
      scale: isPine ? vec(size, size, size) : vec(size * 0.95, size * 0.85, size * 0.95),
      rotation: ring.rand() * 3,
      color: leaf,
    });
  });
  group.add(instanced(trunk, tintable(), trunks), instanced(crown, tintable(), crowns));
  group.add(instanced(cone, tintable(), pines));

  const bush = kit.geometry("open-bush", () => jitterGeometry(new THREE.IcosahedronGeometry(0.6, 0), 0.12, 17));
  group.add(
    instanced(
      bush,
      tintable(),
      fill(90, () => {
        const spot = pick({ minClear: 1, clump: 0.38, thickenTo: 4 });
        if (!spot) return null;
        const size = ring.between(0.6, 1.2);
        return {
          position: vec(spot.x, spot.y + 0.3 * size, spot.z),
          scale: vec(size, size * 0.75, size),
          rotation: ring.rand() * 3,
          color: ring.tint(SCENE_COLORS.leaves[Math.floor(ring.rand() * 4)], spot.out),
        };
      }),
    ),
  );

  // Boulders: scattered ones, and the ones the roads wind round, a little bigger.
  const rock = kit.geometry("open-rock", () => jitterGeometry(new THREE.DodecahedronGeometry(0.5, 0), 0.15, 5));
  const boulders: Piece[] = fill(36, () => {
    const spot = pick({ minClear: 1.1, thickenTo: 3 });
    if (!spot) return null;
    const size = ring.between(0.5, 1.5);
    return {
      position: vec(spot.x, spot.y + 0.1 * size, spot.z),
      scale: vec(size * 1.1, size * 0.6, size),
      rotation: ring.rand() * 3,
      color: ring.tint(SCENE_COLORS.rock[Math.floor(ring.rand() * 3)], spot.out),
    };
  });
  for (const roadRock of layout.getRoadRocks()) {
    boulders.push({
      position: vec(roadRock.x, 0.2 * roadRock.scale, roadRock.z),
      scale: vec(roadRock.scale * 1.15, roadRock.scale * 0.8, roadRock.scale),
      rotation: ring.rand() * 3,
      color: new THREE.Color(SCENE_COLORS.rock[Math.floor(ring.rand() * 3)]),
    });
  }
  group.add(instanced(rock, tintable(), boulders));

  group.add(
    instanced(
      createTuftGeometry(),
      tintable(),
      fill(1_100, () => {
        const spot = pick({ minClear: 0.15 });
        if (!spot) return null;
        const size = ring.between(0.8, 1.7);
        return {
          position: vec(spot.x, spot.y, spot.z),
          scale: vec(size, size, size),
          rotation: ring.rand() * 6,
          color: ring.tint(SCENE_COLORS.grassDeep, spot.out, 40, 0.4),
        };
      }),
    ),
  );

  const flower = kit.geometry("open-flower", () => new THREE.IcosahedronGeometry(0.1, 0));
  group.add(
    instanced(
      flower,
      tintable(),
      fill(420, () => {
        const spot = pick({ minClear: 0.3, clump: 0.42 });
        if (!spot) return null;
        return {
          position: vec(spot.x, spot.y + 0.1, spot.z),
          scale: vec(1, 1, 1).multiplyScalar(ring.between(0.8, 1.5)),
          color: ring.tint(SCENE_COLORS.flowers[Math.floor(ring.rand() * SCENE_COLORS.flowers.length)], spot.out),
        };
      }),
    ),
  );
}

// ------------------------------------------------------------------------------------------------- the snowfield

/**
 * Banquise, without its tray: a snowfield round the lake, with snowy pines in groves, drifts, ice boulders and patches
 * of bare blue ice, all placed by the real outline of the board and the lake, not by a rectangle.
 */
function dressSnowfield(kit: SceneKit, layout: BoardLayout, ring: Ring, group: THREE.Group): void {
  const pick = createPicker(layout, ring);
  const green = kit.geometry("open-snow-pine", () => new THREE.ConeGeometry(0.9, 2.4, 7));
  const cap = kit.geometry("open-snow-cap", () => new THREE.ConeGeometry(0.7, 1.5, 7));
  const greens: Piece[] = [];
  const caps: Piece[] = [];
  for (const spot of fill(150, () => pick({ minClear: 2, tall: true, clump: 0.46, thickenTo: 8 }))) {
    const size = ring.between(0.95, 1.9) * (spot.out < 4 ? 0.85 : 1);
    const turn = ring.rand() * 3;
    greens.push({
      position: vec(spot.x, spot.y + 1.2 * size, spot.z),
      scale: vec(size, size, size),
      rotation: turn,
      color: ring.tint("#3f8a78", spot.out),
    });
    caps.push({
      position: vec(spot.x, spot.y + 1.75 * size, spot.z),
      scale: vec(size, size, size),
      rotation: turn,
      color: ring.tint("#ffffff", spot.out, 40, 0.3),
    });
  }
  group.add(instanced(green, tintable(), greens), instanced(cap, tintable(), caps));

  const drift = kit.geometry("open-drift", () =>
    jitterGeometry(new THREE.SphereGeometry(0.5, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0.08, 9),
  );
  group.add(
    instanced(
      drift,
      tintable(),
      fill(150, () => {
        const spot = pick({ minClear: 0.5 });
        if (!spot) return null;
        const size = ring.between(0.8, 2.4);
        return {
          position: vec(spot.x, spot.y - 0.02, spot.z),
          scale: vec(size, size * 0.45, size),
          rotation: ring.rand() * 3,
          color: ring.tint("#ffffff", spot.out, 40, 0.3),
        };
      }),
    ),
  );

  const boulder = kit.geometry("open-ice-boulder", () =>
    jitterGeometry(new THREE.DodecahedronGeometry(0.5, 0), 0.16, 12),
  );
  group.add(
    instanced(
      boulder,
      tintable(),
      fill(40, () => {
        const spot = pick({ minClear: 1, thickenTo: 3 });
        if (!spot) return null;
        const size = ring.between(0.6, 1.7);
        return {
          position: vec(spot.x, spot.y + 0.12 * size, spot.z),
          scale: vec(size, size * 0.7, size),
          rotation: ring.rand() * 3,
          color: ring.tint(ring.rand() < 0.5 ? "#bfdcf2" : "#d4e7f6", spot.out),
        };
      }),
    ),
  );

  // Bare ice showing through the snow: flat pale-blue discs, a hair above the ground.
  const sheet = kit.geometry("open-ice-sheet", () => new THREE.CylinderGeometry(1, 1, 0.03, 9));
  group.add(
    instanced(
      sheet,
      tintable(),
      fill(18, () => {
        const spot = pick({ minClear: 1.6, clump: 0.4 });
        if (!spot) return null;
        const size = ring.between(1.2, 3);
        return {
          position: vec(spot.x, spot.y + 0.02, spot.z),
          scale: vec(size * 1.3, 1, size),
          rotation: ring.rand() * 3,
          color: ring.tint("#bfe0f5", spot.out),
        };
      }),
    ),
  );
}

// -------------------------------------------------------------------------------------------------- the fairground

const TENT_COLORS = ["#ff4fa3", "#3fe0ff", "#ffd166", "#c86bff"];

/** Luna Park: the fairground spills out in the dark: lamps, striped tents, crates, stacked boxes and glowing bulbs. */
function dressFairground(kit: SceneKit, ring: Ring, group: THREE.Group): AnimatedProp {
  const lampSpots = fill(18, () => ring.spot(1.4, 14));
  const shaft = kit.geometry("open-lamp-shaft", () => new THREE.CylinderGeometry(0.07, 0.1, 2.1, 6));
  group.add(
    instanced(
      shaft,
      tintable(),
      lampSpots.map((spot) => ({
        position: vec(spot.x, spot.y + 1.05, spot.z),
        scale: vec(1, 1, 1),
        color: new THREE.Color("#1b1f3b"),
      })),
    ),
  );
  const globe = kit.geometry("open-lamp-globe", () => new THREE.IcosahedronGeometry(0.24, 1));
  group.add(
    instanced(
      globe,
      new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
      lampSpots.map((spot) => ({
        position: vec(spot.x, spot.y + 2.25, spot.z),
        scale: vec(1, 1, 1),
        color: new THREE.Color("#ffe3a1"),
      })),
    ),
  );

  // Striped tents: a cone roof on a short drum.
  const roof = kit.geometry("open-tent-roof", () => new THREE.ConeGeometry(1.5, 1.5, 8));
  const drum = kit.geometry("open-tent-drum", () => new THREE.CylinderGeometry(1.2, 1.2, 0.9, 8));
  const roofs: Piece[] = [];
  const drums: Piece[] = [];
  fill(11, () => ring.spot(2.5, 20, { tall: true })).forEach((spot, index) => {
    const size = ring.between(0.9, 1.5);
    const color = TENT_COLORS[index % TENT_COLORS.length];
    drums.push({
      position: vec(spot.x, spot.y + 0.45 * size, spot.z),
      scale: vec(size, size, size),
      color: ring.tint("#f5e8ff", spot.out, 40, 0.45),
    });
    roofs.push({
      position: vec(spot.x, spot.y + (0.9 + 0.75) * size, spot.z),
      scale: vec(size, size, size),
      rotation: ring.rand() * 3,
      color: ring.tint(color, spot.out, 40, 0.45),
    });
  });
  group.add(instanced(drum, tintable(), drums), instanced(roof, tintable(), roofs));

  const crate = kit.geometry("open-crate", () => new THREE.BoxGeometry(0.8, 0.8, 0.8));
  group.add(
    instanced(
      crate,
      tintable(),
      fill(26, () => {
        const spot = ring.spot(0.8, 16);
        if (!spot) return null;
        const size = ring.between(0.6, 1.2);
        return {
          position: vec(spot.x, spot.y + 0.4 * size, spot.z),
          scale: vec(size, size, size),
          rotation: ring.rand() * 3,
          color: ring.tint(["#4b2a6b", "#6a3a8f", "#2d2250"][Math.floor(ring.rand() * 3)], spot.out),
        };
      }),
    ),
  );

  // Glowing bulbs scattered on the ground, like strings that fell: they twinkle.
  const bulbSpots = fill(60, () => ring.spot(0.4, 18));
  const bulb = kit.geometry("open-bulb", () => new THREE.IcosahedronGeometry(0.1, 0));
  const bulbs = instanced(
    bulb,
    new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
    bulbSpots.map((spot, index) => ({
      position: vec(spot.x, spot.y + 0.12, spot.z),
      scale: vec(1, 1, 1),
      color: new THREE.Color(["#ffd166", "#ff4fa3", "#3fe0ff", "#ffffff"][index % 4]),
    })),
  );
  group.add(bulbs);
  return {
    group: new THREE.Group(),
    update: (elapsed) => {
      const pulse = 0.75 + Math.sin(elapsed * 2.4) * 0.25;
      (bulbs.material as THREE.MeshBasicMaterial).color.setScalar(pulse);
    },
  };
}

// ------------------------------------------------------------------------------------------------------- entry

/**
 * The ground and the dressing of a first-generation map without its tray. Returns null for a theme that has none
 * (the large maps bring their own).
 */
export function createOpenWorld(kit: SceneKit, layout: BoardLayout, themeId: MapThemeId): AnimatedProp | null {
  const theme = THEMES[themeId];
  if (!theme) return null;
  const foot: Footprint = { halfWidth: layout.halfWidth, halfDepth: layout.halfDepth };
  const heightAt = createHeightAt(foot, theme.rise);
  const group = new THREE.Group();
  group.add(createOpenFloor(foot, theme, heightAt));

  const ring = new Ring(foot, heightAt, theme.haze);
  let extra: AnimatedProp | null = null;
  if (themeId === "polar") dressSnowfield(kit, layout, ring, group);
  else if (themeId === "night-fair") extra = dressFairground(kit, ring, group);
  else dressMeadow(kit, layout, ring, group);

  return { group, update: (elapsed, delta) => extra?.update(elapsed, delta) };
}
