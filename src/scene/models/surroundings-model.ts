import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MapThemeId } from "../../game/maps/map-types";
import { SCENE_COLORS } from "../../theme/palette";
import { RIM_THICKNESS, type BoardLayout } from "../board-layout";
import { createRandom, jitterGeometry, type SceneKit } from "../scene-kit";
import {
  circleFlight,
  createBird,
  createDog,
  createFox,
  createPolarBear,
  createRabbit,
  createSeal,
  createSheep,
  Mover,
  type Poseable,
} from "./creatures-model";
import type { AnimatedProp } from "./props-model";

/**
 * The world around each tray (patch 0.1.5): a ground that fades into the
 * page background, then hills, trees, clouds, and a few things that move.
 * Everything is instanced or merged, unlit or flat, and casts no shadow: the
 * decor costs a handful of draw calls and the game stays smooth. Distant
 * pieces are tinted towards the haze colour of their map, which stands in for
 * a depth of field; on desktop a blurred frame (CSS) completes it.
 */

/** Ground of the table the tray stands on, just below its shadow plane. */
const GROUND_Y = -1.7;
const GROUND_RADIUS = 70;
/** Where the visitors walk, in units beyond the rim. */
const LANE_MIN = 2.4;
const LANE_MAX = 4.4;
const LANE_GAP = 3.4;

interface Surroundings {
  group: THREE.Group;
  /** Called every frame with the elapsed seconds. */
  tick: (elapsed: number, delta: number) => void;
}

interface Palette {
  ground: string;
  haze: string;
}

const PALETTES: Record<MapThemeId, Palette> = {
  "toy-box": { ground: "#b5e29a", haze: "#ffe3cc" },
  "night-fair": { ground: "#1d2147", haze: "#3b3f86" },
  polar: { ground: "#e9f2fb", haze: "#d7e8f7" },
};

export function createSurroundings(kit: SceneKit, layout: BoardLayout, themeId: MapThemeId): AnimatedProp {
  const palette = PALETTES[themeId] ?? PALETTES["toy-box"];
  const world = new Placer(layout, palette);
  const group = new THREE.Group();
  group.add(createGroundDisc(palette.ground));

  const parts: Surroundings[] = [];
  switch (themeId) {
    case "night-fair":
      parts.push(buildNightFair(kit, world));
      break;
    case "polar":
      parts.push(buildPolar(kit, world));
      break;
    default:
      parts.push(buildToyBox(kit, world));
  }
  for (const part of parts) group.add(part.group);

  return {
    group,
    update: (elapsed, delta) => {
      for (const part of parts) part.tick(elapsed, delta);
    },
  };
}

// ----------------------------------------------------------------- helpers

/** Picks spots around the tray, a given distance beyond its rim, and tints colours by that distance. */
class Placer {
  readonly outerWidth: number;
  readonly outerDepth: number;
  private readonly random = createRandom(90_210);

  constructor(
    readonly layout: BoardLayout,
    readonly palette: Palette,
  ) {
    this.outerWidth = layout.halfWidth + RIM_THICKNESS;
    this.outerDepth = layout.halfDepth + RIM_THICKNESS;
  }

  rand(): number {
    return this.random();
  }

  between(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  /**
   * A spot `gap` units beyond the rim. `frontSafe` keeps tall things off the
   * side facing the camera, where they would hide the tiles.
   */
  spot(minGap: number, maxGap: number, frontSafe = true): { x: number; z: number; gap: number } {
    const gap = this.keepOffLane(this.between(minGap, maxGap));
    const alongWidth = this.outerWidth * 2;
    const alongDepth = this.outerDepth * 2;
    const horizontal = this.random() < alongWidth / (alongWidth + alongDepth);
    if (horizontal) {
      const back = frontSafe ? true : this.random() < 0.5;
      return {
        x: (this.random() * 2 - 1) * (this.outerWidth + gap * 0.7),
        z: (back ? -1 : 1) * (this.outerDepth + gap),
        gap,
      };
    }
    const side = this.random() < 0.5 ? -1 : 1;
    const limit = frontSafe ? this.outerDepth * 0.6 : this.outerDepth;
    return { x: side * (this.outerWidth + gap), z: (this.random() * 2 - 1) * limit - (frontSafe ? 0.4 * gap : 0), gap };
  }

  /** The lane the visitors walk along stays free of trees and rocks: gaps inside it are pushed past its far edge. */
  private keepOffLane(gap: number): number {
    return gap > LANE_MIN && gap < LANE_MAX ? LANE_MAX + (gap - LANE_MIN) : gap;
  }

  /** A closed walking path round the tray, `gap` units beyond its rim, corners cut. `reversed` walks the other way. */
  loop(gap: number, reversed = false): THREE.Vector3[] {
    const width = this.outerWidth + gap;
    const depth = this.outerDepth + gap;
    const cut = 3;
    const points = [
      [-width + cut, -depth],
      [width - cut, -depth],
      [width, -depth + cut],
      [width, depth - cut],
      [width - cut, depth],
      [-width + cut, depth],
      [-width, depth - cut],
      [-width, -depth + cut],
    ].map(([x, z]) => new THREE.Vector3(x, GROUND_Y, z));
    return reversed ? points.reverse() : points;
  }

  /** `color` seen through `gap` units of air. */
  tint(color: string, gap: number, far = 26, strength = 0.7): THREE.Color {
    const mixed = new THREE.Color(color);
    mixed.lerp(new THREE.Color(this.palette.haze), Math.min(1, gap / far) * strength);
    return mixed;
  }
}

/** A big disc that fades to nothing at its edge, so the table melts into the page background. */
function createGroundDisc(color: string): THREE.Mesh {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.55, color);
    gradient.addColorStop(1, `${color}00`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_RADIUS, 40),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = GROUND_Y;
  disc.renderOrder = -2;
  disc.raycast = () => undefined;
  return disc;
}

/** One instanced mesh with a colour and a transform per piece. */
function instance(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  pieces: { position: THREE.Vector3; scale: THREE.Vector3; rotation?: number; color?: THREE.Color }[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, pieces.length));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  pieces.forEach((piece, index) => {
    quaternion.setFromAxisAngle(up, piece.rotation ?? 0);
    matrix.compose(piece.position, quaternion, piece.scale);
    mesh.setMatrixAt(index, matrix);
    if (piece.color) mesh.setColorAt(index, piece.color);
  });
  mesh.count = pieces.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.raycast = () => undefined;
  return mesh;
}

/** Plain white flat material whose colour comes from the instances. */
function tintable(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true });
}

function scale(x: number, y = x, z = x): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

/** A drifting cloud: a handful of merged blobs, shared by every cloud of the map. */
function createCloudGeometry(): THREE.BufferGeometry {
  const blobs = [
    [0, 0, 0, 1.5],
    [1.5, -0.15, 0.2, 1.1],
    [-1.5, -0.2, -0.1, 1.05],
    [0.5, 0.45, -0.3, 1.0],
  ];
  const parts = blobs.map(([x, y, z, radius]) => {
    const blob = new THREE.IcosahedronGeometry(radius, 1);
    blob.translate(x, y, z);
    return blob;
  });
  const merged = mergeGeometries(parts) ?? parts[0];
  for (const part of parts) part.dispose();
  merged.scale(1, 0.62, 0.8);
  return merged;
}

/** Clouds that slide across the sky and wrap around: one instanced mesh, matrices rewritten per frame. */
function createClouds(
  world: Placer,
  options: { count: number; color: string; opacity: number; minHeight: number; maxHeight: number },
): Surroundings {
  const geometry = createCloudGeometry();
  const material = new THREE.MeshBasicMaterial({
    color: options.color,
    transparent: true,
    opacity: options.opacity,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, options.count);
  mesh.frustumCulled = false;
  mesh.raycast = () => undefined;
  const range = 48;
  const clouds = Array.from({ length: options.count }, () => ({
    x: world.between(-range, range),
    y: world.between(options.minHeight, options.maxHeight),
    z: -world.between(world.outerDepth + 6, world.outerDepth + 34),
    size: world.between(1.4, 2.8),
    speed: world.between(0.12, 0.35),
  }));
  const matrix = new THREE.Matrix4();
  const group = new THREE.Group();
  group.add(mesh);
  return {
    group,
    tick: (elapsed) => {
      clouds.forEach((cloud, index) => {
        const x = ((cloud.x + elapsed * cloud.speed + range) % (range * 2)) - range;
        matrix.compose(new THREE.Vector3(x, cloud.y, cloud.z), new THREE.Quaternion(), scale(cloud.size));
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Round hills and snowy mounds on the horizon, far enough to read as a soft backdrop. */
function createHills(
  kit: SceneKit,
  world: Placer,
  options: { count: number; colors: string[]; minGap: number; maxGap: number; minSize: number; maxSize: number },
): THREE.InstancedMesh {
  const geometry = kit.geometry("hill", () => jitterGeometry(new THREE.IcosahedronGeometry(1, 1), 0.14, 77));
  const pieces = Array.from({ length: options.count }, (_, index) => {
    const spot = world.spot(options.minGap, options.maxGap);
    const size = world.between(options.minSize, options.maxSize);
    return {
      position: new THREE.Vector3(spot.x, GROUND_Y + size * 0.22, spot.z),
      scale: scale(size * 1.5, size * 0.55, size),
      rotation: world.rand() * Math.PI,
      color: world.tint(options.colors[index % options.colors.length], spot.gap),
    };
  });
  return instance(geometry, tintable(), pieces);
}

// ------------------------------------------------------------------ toy box

function buildToyBox(kit: SceneKit, world: Placer): Surroundings {
  const group = new THREE.Group();
  const tickers: ((elapsed: number, delta: number) => void)[] = [];

  group.add(
    createHills(kit, world, {
      count: 12,
      colors: ["#8ed17a", "#7cc46f", "#a3dc84"],
      minGap: 16,
      maxGap: 28,
      minSize: 2.6,
      maxSize: 4.6,
    }),
  );

  // Trees beyond the tray: round crowns and pines on a shared trunk.
  const crown = kit.geometry("far-crown", () => jitterGeometry(new THREE.IcosahedronGeometry(1, 0), 0.18, 31));
  const cone = kit.geometry("far-pine", () => new THREE.ConeGeometry(0.9, 2.2, 6));
  const trunk = kit.geometry("far-trunk", () => new THREE.CylinderGeometry(0.12, 0.17, 1, 5));
  const crowns: Parameters<typeof instance>[2] = [];
  const pines: Parameters<typeof instance>[2] = [];
  const trunks: Parameters<typeof instance>[2] = [];
  for (let index = 0; index < 46; index += 1) {
    const spot = world.spot(2.4, 15);
    const size = world.between(0.9, 1.7) * (spot.gap < 5 ? 0.8 : 1);
    const pine = index % 3 === 0;
    const leaf = world.tint(SCENE_COLORS.leaves[index % SCENE_COLORS.leaves.length], spot.gap);
    trunks.push({
      position: new THREE.Vector3(spot.x, GROUND_Y + 0.5 * size, spot.z),
      scale: scale(size, size * 1.1, size),
      color: world.tint(SCENE_COLORS.trunk, spot.gap),
    });
    (pine ? pines : crowns).push({
      position: new THREE.Vector3(spot.x, GROUND_Y + (pine ? 1.6 : 1.5) * size, spot.z),
      scale: pine ? scale(size) : scale(size * 0.95, size * 0.85, size * 0.95),
      rotation: world.rand() * 3,
      color: leaf,
    });
  }
  group.add(instance(trunk, tintable(), trunks));
  group.add(instance(crown, tintable(), crowns));
  group.add(instance(cone, tintable(), pines));

  // Lamp posts along the back and sides, their bulbs warm in the daylight too.
  const post = kit.geometry("lamp-post", () => new THREE.CylinderGeometry(0.06, 0.08, 2.4, 5));
  const bulb = kit.geometry("lamp-bulb", () => new THREE.IcosahedronGeometry(0.2, 0));
  const posts: Parameters<typeof instance>[2] = [];
  const bulbs: Parameters<typeof instance>[2] = [];
  for (let index = 0; index < 8; index += 1) {
    const spot = world.spot(1.0, 2.2);
    posts.push({
      position: new THREE.Vector3(spot.x, GROUND_Y + 1.2, spot.z),
      scale: scale(1),
      color: new THREE.Color("#8a6a52"),
    });
    bulbs.push({
      position: new THREE.Vector3(spot.x, GROUND_Y + 2.5, spot.z),
      scale: scale(1),
      color: new THREE.Color("#ffe29a"),
    });
  }
  group.add(instance(post, tintable(), posts));
  group.add(instance(bulb, new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), bulbs));

  // A windmill turning on a far hill.
  const windmill = createWindmill(kit);
  const windmillSpot = world.spot(11, 13);
  windmill.group.position.set(-Math.abs(windmillSpot.x) * 0.9, GROUND_Y, -Math.abs(windmillSpot.z));
  group.add(windmill.group);
  tickers.push(windmill.update);

  // A hot-air balloon bobbing in the distance.
  const balloon = createHotAirBalloon(kit);
  balloon.group.position.set(world.outerWidth + 9, 9, -world.outerDepth * 0.2);
  group.add(balloon.group);
  tickers.push(balloon.update);

  tickers.push(addLife(group, world, kit, "toy-box"));

  const clouds = createClouds(world, { count: 8, color: "#ffffff", opacity: 0.92, minHeight: 12, maxHeight: 20 });
  group.add(clouds.group);

  return { group, tick: (elapsed, delta) => [...tickers, clouds.tick].forEach((tick) => tick(elapsed, delta)) };
}

function createWindmill(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    kit.geometry("windmill-body", () => new THREE.CylinderGeometry(0.9, 1.4, 4.2, 7)),
    kit.flat("#f4e3c8"),
  );
  body.position.y = 2.1;
  const roof = new THREE.Mesh(
    kit.geometry("windmill-roof", () => new THREE.ConeGeometry(1.15, 1.3, 7)),
    kit.flat("#d9574a"),
  );
  roof.position.y = 4.8;
  const hub = new THREE.Group();
  hub.position.set(0, 3.9, 1.05);
  const blade = kit.geometry("windmill-blade", () => new THREE.BoxGeometry(0.5, 3.2, 0.08));
  for (let index = 0; index < 4; index += 1) {
    const arm = new THREE.Mesh(blade, kit.flat("#ffffff"));
    arm.position.y = 1.6;
    const holder = new THREE.Group();
    holder.rotation.z = (index * Math.PI) / 2;
    holder.add(arm);
    hub.add(holder);
  }
  group.add(body, roof, hub);
  group.scale.setScalar(1.4);
  return { group, update: (elapsed) => (hub.rotation.z = elapsed * 0.7) };
}

function createHotAirBalloon(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const envelope = new THREE.Mesh(
    kit.geometry("balloon-envelope", () => new THREE.SphereGeometry(1.5, 12, 9)),
    kit.flat("#ff6f61"),
  );
  envelope.scale.set(1, 1.2, 1);
  const stripe = new THREE.Mesh(
    kit.geometry("balloon-stripe", () => new THREE.TorusGeometry(1.42, 0.16, 5, 18)),
    kit.flat("#ffe29a"),
  );
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 0.1;
  const basket = new THREE.Mesh(
    kit.geometry("balloon-basket", () => new THREE.BoxGeometry(0.7, 0.5, 0.7)),
    kit.flat("#a8784f"),
  );
  basket.position.y = -2.3;
  group.add(envelope, stripe, basket);
  const home = new THREE.Vector3();
  let placed = false;
  return {
    group,
    update: (elapsed) => {
      // The caller sets the position once; the balloon then bobs around it.
      if (!placed) {
        home.copy(group.position);
        placed = true;
      }
      group.position.y = home.y + Math.sin(elapsed * 0.6) * 0.5;
      group.rotation.y = Math.sin(elapsed * 0.2) * 0.4;
    },
  };
}

// --------------------------------------------------------------- night fair

function buildNightFair(kit: SceneKit, world: Placer): Surroundings {
  const group = new THREE.Group();
  const tickers: ((elapsed: number, delta: number) => void)[] = [];

  // A dark treeline closes the horizon: the park, the wheel and the tents are already inside the tray.
  const crown = kit.geometry("night-crown", () => jitterGeometry(new THREE.IcosahedronGeometry(1, 0), 0.18, 41));
  const trunk = kit.geometry("night-trunk", () => new THREE.CylinderGeometry(0.12, 0.17, 1, 5));
  const crowns: Parameters<typeof instance>[2] = [];
  const trunks: Parameters<typeof instance>[2] = [];
  for (let index = 0; index < 44; index += 1) {
    const spot = world.spot(5, 24);
    const size = world.between(1.1, 2.2);
    trunks.push({
      position: new THREE.Vector3(spot.x, GROUND_Y + 0.6 * size, spot.z),
      scale: scale(size, size * 1.3, size),
      color: world.tint("#2a2540", spot.gap, 30, 0.5),
    });
    crowns.push({
      position: new THREE.Vector3(spot.x, GROUND_Y + 1.9 * size, spot.z),
      scale: scale(size * 1.05, size * 0.95, size * 1.05),
      rotation: world.rand() * 3,
      color: world.tint(index % 2 === 0 ? "#2f3d63" : "#34476f", spot.gap, 30, 0.55),
    });
  }
  group.add(instance(trunk, tintable(), trunks), instance(crown, tintable(), crowns));

  // A moon and a sky of twinkling stars, far behind the board.
  const moon = new THREE.Mesh(
    kit.geometry("moon", () => new THREE.SphereGeometry(3.2, 14, 10)),
    new THREE.MeshBasicMaterial({ color: "#fff3cf", toneMapped: false }),
  );
  moon.position.set(-world.outerWidth - 6, 24, -world.outerDepth - 34);
  const halo = new THREE.Mesh(
    kit.geometry("moon-halo", () => new THREE.CircleGeometry(7.5, 24)),
    new THREE.MeshBasicMaterial({
      color: "#8d95e8",
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  halo.position.copy(moon.position).setZ(moon.position.z - 0.5);
  group.add(halo, moon);

  const stars = createStars(world, 150);
  group.add(stars.group);
  tickers.push(stars.update);

  // Beyond the fair, other rides light the night: a roller coaster with its cars running, a drop tower.
  const coaster = createRollerCoaster(kit, world);
  group.add(coaster.group);
  tickers.push(coaster.update);

  const tower = createDropTower(kit);
  tower.group.position.set(world.outerWidth + 10, GROUND_Y, -world.outerDepth * 0.35);
  group.add(tower.group);
  tickers.push(tower.update);

  const lights = createSearchlights(world);
  group.add(lights.group);
  tickers.push(lights.update);

  const fireworks = createFireworks(world);
  group.add(fireworks.group);
  tickers.push(fireworks.update);

  const fireflies = createFireflies(world, 30);
  group.add(fireflies.group);
  tickers.push(fireflies.update);

  tickers.push(addLife(group, world, kit, "night-fair"));
  return { group, tick: (elapsed, delta) => tickers.forEach((tick) => tick(elapsed, delta)) };
}

function createStars(world: Placer, count: number): AnimatedProp {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const angle = world.rand() * Math.PI * 2;
    const radius = world.between(45, 65);
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = world.between(14, 40);
    positions[index * 3 + 2] = -Math.abs(Math.sin(angle)) * radius - 10;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: "#ffffff",
    size: 0.5,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.raycast = () => undefined;
  const group = new THREE.Group();
  group.add(points);
  return { group, update: (elapsed) => (material.opacity = 0.65 + Math.sin(elapsed * 1.7) * 0.25) };
}

function createFireflies(world: Placer, count: number): AnimatedProp {
  const positions = new Float32Array(count * 3);
  const seeds = Array.from({ length: count }, () => {
    const spot = world.spot(0.6, 9, false);
    return { x: spot.x, z: spot.z, y: world.between(0.6, 3.2), phase: world.rand() * 6 };
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: "#d4ff8a",
    size: 0.28,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.raycast = () => undefined;
  const group = new THREE.Group();
  group.add(points);
  return {
    group,
    update: (elapsed) => {
      seeds.forEach((seed, index) => {
        positions[index * 3] = seed.x + Math.cos(elapsed * 0.4 + seed.phase) * 0.9;
        positions[index * 3 + 1] = GROUND_Y + seed.y + Math.sin(elapsed * 0.9 + seed.phase) * 0.35;
        positions[index * 3 + 2] = seed.z + Math.sin(elapsed * 0.33 + seed.phase) * 0.9;
      });
      geometry.attributes.position.needsUpdate = true;
      material.opacity = 0.6 + Math.sin(elapsed * 3) * 0.3;
    },
  };
}

// -------------------------------------------------------------------- polar

function buildPolar(kit: SceneKit, world: Placer): Surroundings {
  const group = new THREE.Group();
  const tickers: ((elapsed: number, delta: number) => void)[] = [];

  group.add(
    createHills(kit, world, {
      count: 10,
      colors: ["#f4f9ff", "#e6f0fa", "#dbe9f7"],
      minGap: 12,
      maxGap: 26,
      minSize: 2.6,
      maxSize: 4.8,
    }),
  );

  // Far mountains: blue rock with a white cap.
  const mountain = kit.geometry("polar-mountain", () => jitterGeometry(new THREE.ConeGeometry(1, 1.6, 6), 0.1, 14));
  const cap = kit.geometry("polar-cap", () => jitterGeometry(new THREE.ConeGeometry(0.45, 0.55, 6), 0.06, 15));
  const mountains: Parameters<typeof instance>[2] = [];
  const caps: Parameters<typeof instance>[2] = [];
  for (let index = 0; index < 7; index += 1) {
    const spot = world.spot(17, 30);
    const size = world.between(4, 8);
    mountains.push({
      position: new THREE.Vector3(spot.x, GROUND_Y + size * 0.8, spot.z),
      scale: scale(size, size, size),
      rotation: world.rand() * 3,
      color: world.tint("#8ea9c9", spot.gap, 34, 0.55),
    });
    caps.push({
      position: new THREE.Vector3(spot.x, GROUND_Y + size * 1.42, spot.z),
      scale: scale(size, size, size),
      rotation: world.rand() * 3,
      color: world.tint("#ffffff", spot.gap, 34, 0.35),
    });
  }
  group.add(instance(mountain, tintable(), mountains), instance(cap, tintable(), caps));

  // Ice spires lying on the snow beside the tray.
  const spire = kit.geometry("ice-spire", () => jitterGeometry(new THREE.ConeGeometry(0.35, 1.8, 5), 0.08, 21));
  const spires: Parameters<typeof instance>[2] = [];
  for (let index = 0; index < 30; index += 1) {
    const spot = world.spot(1.8, 11);
    const size = world.between(0.7, 1.8);
    spires.push({
      position: new THREE.Vector3(spot.x, GROUND_Y + size * 0.9, spot.z),
      scale: scale(size, size * world.between(0.8, 1.5), size),
      rotation: world.rand() * 3,
      color: world.tint(index % 3 === 0 ? "#a6e3f7" : "#c8ecfa", spot.gap, 24, 0.6),
    });
  }
  group.add(instance(spire, tintable(), spires));

  // Snowy pines in the distance.
  const pineCone = kit.geometry("polar-far-pine", () => new THREE.ConeGeometry(0.85, 2.4, 6));
  const pineTrunk = kit.geometry("polar-far-trunk", () => new THREE.CylinderGeometry(0.1, 0.15, 0.7, 5));
  const pines: Parameters<typeof instance>[2] = [];
  const trunks: Parameters<typeof instance>[2] = [];
  for (let index = 0; index < 34; index += 1) {
    const spot = world.spot(3, 16);
    const size = world.between(0.9, 1.7) * (spot.gap < 5 ? 0.8 : 1);
    trunks.push({
      position: new THREE.Vector3(spot.x, GROUND_Y + 0.3 * size, spot.z),
      scale: scale(size),
      color: world.tint("#7a5a46", spot.gap),
    });
    pines.push({
      position: new THREE.Vector3(spot.x, GROUND_Y + 1.55 * size, spot.z),
      scale: scale(size),
      rotation: world.rand() * 3,
      color: world.tint(index % 2 === 0 ? "#5f8f86" : "#6fa097", spot.gap),
    });
  }
  group.add(instance(pineTrunk, tintable(), trunks), instance(pineCone, tintable(), pines));

  const aurora = createAurora(world);
  group.add(aurora.group);
  tickers.push(aurora.update);

  const snow = createFarSnow(world, 170);
  group.add(snow.group);
  tickers.push(snow.update);

  tickers.push(addLife(group, world, kit, "polar"));
  return { group, tick: (elapsed, delta) => tickers.forEach((tick) => tick(elapsed, delta)) };
}

function createAurora(world: Placer): AnimatedProp {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 0.18 + uTime * 0.5) * 2.4 * uv.y;
        p.y += sin(p.x * 0.3 + uTime * 0.8) * 0.6;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec3 low = vec3(0.35, 1.0, 0.7);
        vec3 high = vec3(0.7, 0.45, 1.0);
        float fade = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        float shimmer = 0.75 + 0.25 * sin(vUv.x * 28.0 + uTime * 1.3);
        float edge = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
        gl_FragColor = vec4(mix(low, high, vUv.y), fade * shimmer * edge * 0.42);
      }
    `,
  });
  const group = new THREE.Group();
  const ribbon = (width: number, height: number, x: number, y: number, z: number, rotation: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 36, 6), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    mesh.frustumCulled = false;
    mesh.raycast = () => undefined;
    group.add(mesh);
  };
  const z = -world.outerDepth - 30;
  ribbon(70, 11, -4, 21, z, 0.08);
  ribbon(52, 9, 14, 25, z - 6, -0.12);
  return { group, update: (elapsed) => (material.uniforms.uTime.value = elapsed) };
}

function createFarSnow(world: Placer, count: number): AnimatedProp {
  const area = { x: world.outerWidth + 16, z: world.outerDepth + 16, top: 18 };
  const positions = new Float32Array(count * 3);
  const seeds = Array.from({ length: count }, () => ({
    x: (world.rand() * 2 - 1) * area.x,
    z: (world.rand() * 2 - 1) * area.z,
    offset: world.rand() * area.top,
    speed: world.between(0.5, 1.1),
    sway: world.rand() * 6,
  }));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: "#ffffff",
    size: 0.2,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.raycast = () => undefined;
  const group = new THREE.Group();
  group.add(points);
  return {
    group,
    update: (elapsed) => {
      seeds.forEach((seed, index) => {
        const fall = (seed.offset - elapsed * seed.speed) % area.top;
        positions[index * 3] = seed.x + Math.sin(elapsed * 0.6 + seed.sway) * 0.6;
        positions[index * 3 + 1] = GROUND_Y + (fall < 0 ? fall + area.top : fall);
        positions[index * 3 + 2] = seed.z;
      });
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------------- life

type Ticker = (elapsed: number, delta: number) => void;

/** Animals and birds of a map. Returns the ticker that moves them all. */
function addLife(group: THREE.Group, world: Placer, kit: SceneKit, theme: MapThemeId): Ticker {
  const movers: Mover[] = [];
  const flights: ((elapsed: number) => void)[] = [];
  const idles: { creature: Poseable }[] = [];
  const add = (creature: Poseable) => {
    group.add(creature.group);
    return creature;
  };

  // A dog trots round the tray on its own.
  const dogCoat = theme === "polar" ? "#8a8f9a" : theme === "night-fair" ? "#6a5a7a" : "#c58a4e";
  movers.push(
    new Mover(add(createDog(kit, dogCoat)), world.loop(LANE_GAP, theme === "night-fair"), {
      speed: 0.75,
      closed: true,
      start: world.rand(),
    }),
  );

  if (theme === "toy-box") {
    // Sheep graze on the slopes: they walk a few steps, stop to eat, and walk back.
    for (let index = 0; index < 6; index += 1) {
      const spot = world.spot(6, 14);
      const path = [
        new THREE.Vector3(spot.x, GROUND_Y, spot.z),
        new THREE.Vector3(spot.x + 2 + world.rand() * 2, GROUND_Y, spot.z + (world.rand() - 0.5) * 2),
      ];
      movers.push(
        new Mover(add(createSheep(kit)), path, {
          speed: 0.35,
          closed: false,
          start: world.rand(),
          restSeconds: 4 + world.rand() * 4,
        }),
      );
    }
    // Rabbits hop along the edge of the field.
    for (let index = 0; index < 4; index += 1) {
      const spot = world.spot(5, 10);
      const path = [new THREE.Vector3(spot.x, GROUND_Y, spot.z), new THREE.Vector3(spot.x + 2.5, GROUND_Y, spot.z + 1)];
      movers.push(
        new Mover(add(createRabbit(kit)), path, { speed: 0.9, closed: false, start: world.rand(), restSeconds: 3 }),
      );
    }
    for (let index = 0; index < 6; index += 1) {
      const bird = add(createBird(kit, "songbird"));
      const spot = world.spot(1.5, 7, false);
      flights.push(
        circleFlight(bird, {
          center: new THREE.Vector3(spot.x, 0, spot.z),
          radius: world.between(1.6, 3.4),
          height: world.between(2.2, 4.4) + GROUND_Y,
          speed: world.between(0.5, 0.9),
          phase: world.rand() * 6,
          squash: 0.8,
        }),
      );
    }
    for (let index = 0; index < 3; index += 1) {
      const bird = add(createBird(kit, "gull"));
      flights.push(
        circleFlight(bird, {
          center: new THREE.Vector3(world.between(-8, 8), 0, -world.outerDepth - 8),
          radius: world.between(5, 9),
          height: world.between(10, 15),
          speed: world.between(0.12, 0.2),
          phase: world.rand() * 6,
        }),
      );
    }
  }

  if (theme === "night-fair") {
    // Bats flit over the fair, in tight, quick loops.
    for (let index = 0; index < 7; index += 1) {
      const bat = add(createBird(kit, "bat"));
      const spot = world.spot(2, 12, false);
      flights.push(
        circleFlight(bat, {
          center: new THREE.Vector3(spot.x, 0, spot.z),
          radius: world.between(2, 5),
          height: world.between(4, 9),
          speed: world.between(0.6, 1.1),
          phase: world.rand() * 6,
          squash: 0.8,
        }),
      );
    }
  }

  if (theme === "polar") {
    for (let index = 0; index < 3; index += 1) {
      const seal = add(createSeal(kit));
      const spot = world.spot(5, 12);
      seal.group.position.set(spot.x, GROUND_Y, spot.z);
      seal.group.rotation.y = world.rand() * Math.PI * 2;
      idles.push({ creature: seal });
    }
    for (let index = 0; index < 2; index += 1) {
      const spot = world.spot(6, 12);
      const path = [
        new THREE.Vector3(spot.x, GROUND_Y, spot.z),
        new THREE.Vector3(spot.x + 4, GROUND_Y, spot.z + (index === 0 ? 1.5 : -1.5)),
      ];
      movers.push(
        new Mover(add(createFox(kit)), path, { speed: 1.1, closed: false, start: world.rand(), restSeconds: 2.5 }),
      );
    }
    const bearSpot = world.spot(15, 19);
    movers.push(
      new Mover(
        add(createPolarBear(kit)),
        [
          new THREE.Vector3(bearSpot.x, GROUND_Y, bearSpot.z),
          new THREE.Vector3(bearSpot.x + 9, GROUND_Y, bearSpot.z + 2),
        ],
        { speed: 0.4, closed: false, start: 0.2, restSeconds: 5 },
      ),
    );
    for (let index = 0; index < 5; index += 1) {
      const bird = add(createBird(kit, "gull"));
      flights.push(
        circleFlight(bird, {
          center: new THREE.Vector3(world.between(-10, 10), 0, -world.outerDepth - world.between(2, 12)),
          radius: world.between(5, 10),
          height: world.between(8, 14),
          speed: world.between(0.12, 0.22),
          phase: world.rand() * 6,
        }),
      );
    }
  }

  return (elapsed, delta) => {
    for (const mover of movers) mover.update(elapsed, delta);
    for (const flight of flights) flight(elapsed);
    for (const idle of idles) idle.creature.pose(0, 0, elapsed);
  };
}

// ---------------------------------------------------------------- night rides

/** A roller coaster on the horizon: a lit rail on stilts, with cars that run along it. */
function createRollerCoaster(kit: SceneKit, world: Placer): AnimatedProp {
  const group = new THREE.Group();
  const baseX = -world.outerWidth * 0.55;
  const baseZ = -world.outerDepth - 17;
  const profile: [number, number][] = [
    [-12, 1],
    [-8, 8],
    [-4.5, 2.5],
    [-1.5, 6.5],
    [1.5, 1.5],
    [5, 5],
    [8.5, 2],
    [12, 3],
  ];
  const curve = new THREE.CatmullRomCurve3(
    profile.map(([x, y]) => new THREE.Vector3(baseX + x, GROUND_Y + y, baseZ + Math.sin(x * 0.4) * 1.2)),
  );
  const rail = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 140, 0.16, 5, false),
    new THREE.MeshBasicMaterial({ color: "#8d95e8", toneMapped: false }),
  );
  rail.raycast = () => undefined;
  group.add(rail);

  const stilt = kit.geometry("coaster-stilt", () => new THREE.CylinderGeometry(0.07, 0.09, 1, 5));
  const stilts: Parameters<typeof instance>[2] = [];
  for (let step = 0; step <= 28; step += 1) {
    const point = curve.getPointAt(step / 28);
    const height = point.y - GROUND_Y;
    stilts.push({
      position: new THREE.Vector3(point.x, GROUND_Y + height / 2, point.z),
      scale: scale(1, height, 1),
      color: new THREE.Color("#4a4f93"),
    });
  }
  group.add(instance(stilt, tintable(), stilts));

  const bulb = kit.geometry("coaster-bulb", () => new THREE.IcosahedronGeometry(0.12, 0));
  const bulbs: Parameters<typeof instance>[2] = [];
  for (let step = 0; step < 40; step += 1) {
    bulbs.push({ position: curve.getPointAt(step / 40).add(new THREE.Vector3(0, 0.3, 0)), scale: scale(1) });
  }
  group.add(instance(bulb, new THREE.MeshBasicMaterial({ color: "#ffd166", toneMapped: false }), bulbs));

  const cars: THREE.Mesh[] = [];
  const carGeometry = kit.geometry("coaster-car", () => new THREE.BoxGeometry(0.6, 0.4, 0.9));
  ["#ff6fb8", "#7dffb2", "#ffd166"].forEach((color) => {
    const car = new THREE.Mesh(carGeometry, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    car.raycast = () => undefined;
    group.add(car);
    cars.push(car);
  });
  const ahead = new THREE.Vector3();
  return {
    group,
    update: (elapsed) => {
      cars.forEach((car, index) => {
        const t = (((elapsed * 0.045 - index * 0.012) % 1) + 1) % 1;
        const point = curve.getPointAt(t);
        car.position.copy(point).add(new THREE.Vector3(0, 0.45, 0));
        car.lookAt(ahead.copy(curve.getPointAt(Math.min(1, t + 0.01))).add(new THREE.Vector3(0, 0.45, 0)));
      });
    },
  };
}

/** A drop tower: a mast with a lit ring that climbs, waits, and falls. */
function createDropTower(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const height = 12;
  const mast = new THREE.Mesh(
    kit.geometry("tower-mast", () => new THREE.CylinderGeometry(0.28, 0.4, height, 6)),
    kit.flat("#5a5f9c"),
  );
  mast.position.y = height / 2;
  const cap = new THREE.Mesh(
    kit.geometry("tower-cap", () => new THREE.ConeGeometry(0.7, 1.6, 6)),
    new THREE.MeshBasicMaterial({ color: "#ff6fb8", toneMapped: false }),
  );
  cap.position.y = height + 0.8;
  const ring = new THREE.Mesh(
    kit.geometry("tower-ring", () => new THREE.TorusGeometry(0.85, 0.22, 6, 14).rotateX(Math.PI / 2)),
    new THREE.MeshBasicMaterial({ color: "#7dffb2", toneMapped: false }),
  );
  group.add(mast, cap, ring);
  return {
    group,
    update: (elapsed) => {
      const cycle = (elapsed % 9) / 9;
      // Slow climb, a held breath, then the drop.
      const level = cycle < 0.6 ? cycle / 0.6 : cycle < 0.75 ? 1 : 1 - (cycle - 0.75) / 0.25;
      ring.position.y = 1.2 + (level < 1 && cycle > 0.75 ? level * level : level) * (height - 2.4);
    },
  };
}

/** Searchlight beams sweeping the sky from behind the fair. */
function createSearchlights(world: Placer): AnimatedProp {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: "#cfd8ff",
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const beams = [-1, 0.2, 1].map((side, index) => {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 28, 12, 1, true).translate(0, 14, 0), material);
    beam.position.set(side * (world.outerWidth * 0.6), GROUND_Y, -world.outerDepth - 12 - index * 2);
    beam.frustumCulled = false;
    beam.raycast = () => undefined;
    group.add(beam);
    return { beam, phase: index * 2.1 };
  });
  return {
    group,
    update: (elapsed) => {
      for (const { beam, phase } of beams) {
        beam.rotation.z = Math.sin(elapsed * 0.35 + phase) * 0.5;
        beam.rotation.x = -0.15 + Math.cos(elapsed * 0.27 + phase) * 0.18;
      }
    },
  };
}

/** Fireworks over the horizon: three shells, each bursting, spreading, falling and fading in turn. */
function createFireworks(world: Placer): AnimatedProp {
  const group = new THREE.Group();
  const sparks = 54;
  const period = 7;
  const colors = ["#ff6fb8", "#ffd166", "#7dffb2", "#8fd3ff", "#b8a6ff"];
  const shells = [0, 2.4, 4.7].map((offset, shellIndex) => {
    const positions = new Float32Array(sparks * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: colors[shellIndex],
      size: 0.55,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.raycast = () => undefined;
    group.add(points);
    const directions = Array.from({ length: sparks }, () => {
      const vector = new THREE.Vector3(world.rand() - 0.5, world.rand() - 0.5, world.rand() - 0.5);
      return vector.normalize().multiplyScalar(0.6 + world.rand() * 0.4);
    });
    return { offset, positions, geometry, material, directions, seen: -1, center: new THREE.Vector3(), shellIndex };
  });
  return {
    group,
    update: (elapsed) => {
      for (const shell of shells) {
        const clock = elapsed + shell.offset;
        const cycle = Math.floor(clock / period);
        const age = clock - cycle * period;
        if (cycle !== shell.seen) {
          // Each shell bursts somewhere new in the sky, in a new colour.
          shell.seen = cycle;
          shell.center.set(
            Math.sin(cycle * 12.9898 + shell.shellIndex * 4.1) * (world.outerWidth + 6),
            19 + ((Math.sin(cycle * 78.233 + shell.shellIndex) + 1) / 2) * 8,
            -world.outerDepth - 26 - shell.shellIndex * 3,
          );
          shell.material.color.set(colors[(cycle + shell.shellIndex) % colors.length]);
        }
        const life = 2.6;
        if (age > life) {
          shell.material.opacity = 0;
          continue;
        }
        const spread = 1 - (1 - age / life) ** 3;
        shell.directions.forEach((direction, index) => {
          shell.positions[index * 3] = shell.center.x + direction.x * spread * 7;
          shell.positions[index * 3 + 1] = shell.center.y + direction.y * spread * 7 - age * age * 0.5;
          shell.positions[index * 3 + 2] = shell.center.z + direction.z * spread * 7;
        });
        shell.geometry.attributes.position.needsUpdate = true;
        shell.material.opacity = Math.max(0, 1 - age / life);
      }
    },
  };
}
