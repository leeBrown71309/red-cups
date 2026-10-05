import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MapThemeId } from "../../game/maps/map-types";
import { SCENE_COLORS } from "../../theme/palette";
import { RIM_THICKNESS, type BoardLayout } from "../board-layout";
import { createRandom, jitterGeometry, type SceneKit } from "../scene-kit";
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
    const gap = this.between(minGap, maxGap);
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
    const spot = world.spot(1.4, 2.2);
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

  // Butterflies flutter in loops above the flowers beside the tray.
  const butterflies = createButterflies(world, 7);
  group.add(butterflies.group);
  tickers.push(butterflies.update);

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

function createButterflies(world: Placer, count: number): AnimatedProp {
  const group = new THREE.Group();
  const wing = new THREE.BufferGeometry();
  wing.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.32, 0.18, 0.1, 0.3, -0.14, -0.05], 3));
  wing.computeVertexNormals();
  const flyers = Array.from({ length: count }, (_, index) => {
    const spot = world.spot(0.8, 4.5, false);
    const material = new THREE.MeshBasicMaterial({
      color: SCENE_COLORS.flowers[index % SCENE_COLORS.flowers.length],
      side: THREE.DoubleSide,
    });
    const body = new THREE.Group();
    const left = new THREE.Mesh(wing, material);
    const right = new THREE.Mesh(wing, material);
    right.scale.x = -1;
    body.add(left, right);
    group.add(body);
    return {
      body,
      left,
      right,
      cx: spot.x,
      cz: spot.z,
      radius: world.between(1.2, 2.8),
      phase: world.rand() * 6,
      speed: world.between(0.35, 0.7),
    };
  });
  return {
    group,
    update: (elapsed) => {
      for (const flyer of flyers) {
        const angle = elapsed * flyer.speed + flyer.phase;
        flyer.body.position.set(
          flyer.cx + Math.cos(angle) * flyer.radius,
          GROUND_Y + 2.4 + Math.sin(angle * 2.3) * 0.5,
          flyer.cz + Math.sin(angle * 1.4) * flyer.radius,
        );
        flyer.body.rotation.y = -angle;
        const flap = Math.sin(elapsed * 14 + flyer.phase) * 0.9;
        flyer.left.rotation.z = flap;
        flyer.right.rotation.z = -flap;
      }
    },
  };
}

// --------------------------------------------------------------- night fair

function buildNightFair(kit: SceneKit, world: Placer): Surroundings {
  const group = new THREE.Group();
  const tickers: ((elapsed: number, delta: number) => void)[] = [];

  group.add(
    createHills(kit, world, {
      count: 10,
      colors: ["#2b2f63", "#252a5a", "#32376e"],
      minGap: 16,
      maxGap: 28,
      minSize: 2.6,
      maxSize: 4.6,
    }),
  );

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

  // The big wheel, lit all round, turning slowly behind the tray.
  const wheel = createFerrisWheel(kit);
  wheel.group.position.set(world.outerWidth * 0.55, GROUND_Y, -world.outerDepth - 15);
  group.add(wheel.group);
  tickers.push(wheel.update);

  // Striped tents beside and behind.
  const tentColors = ["#ff6fb8", "#7dffb2", "#ffd166", "#8fd3ff", "#b8a6ff"];
  for (let index = 0; index < 6; index += 1) {
    const spot = world.spot(5, 13);
    const tent = createBigTop(kit, tentColors[index % tentColors.length], world.tint("#ffffff", spot.gap, 30, 0.55));
    tent.position.set(spot.x, GROUND_Y, spot.z);
    tent.rotation.y = world.rand() * Math.PI;
    tent.scale.setScalar(world.between(0.9, 1.5));
    group.add(tent);
  }

  // Poles hung with strings of bulbs, glowing in three groups that twinkle in turn.
  const strings = createLightStrings(kit, world);
  group.add(strings.group);
  tickers.push(strings.update);

  // Balloons and lanterns rise slowly and begin again.
  const balloons = createRisingBalloons(world, 14);
  group.add(balloons.group);
  tickers.push(balloons.update);

  const fireflies = createFireflies(world, 36);
  group.add(fireflies.group);
  tickers.push(fireflies.update);

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

function createFerrisWheel(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const radius = 7;
  const hubHeight = radius + 1.4;
  const rimMaterial = new THREE.MeshBasicMaterial({ color: "#ff9fd1", toneMapped: false });
  const frameMaterial = kit.flat("#6a6fb8");

  const wheel = new THREE.Group();
  wheel.position.y = hubHeight;
  const rim = new THREE.Mesh(
    kit.geometry("wheel-rim", () => new THREE.TorusGeometry(radius, 0.14, 5, 36)),
    rimMaterial,
  );
  const inner = new THREE.Mesh(
    kit.geometry("wheel-inner", () => new THREE.TorusGeometry(radius * 0.55, 0.1, 5, 28)),
    new THREE.MeshBasicMaterial({ color: "#7dffb2", toneMapped: false }),
  );
  wheel.add(rim, inner);
  const spoke = kit.geometry("wheel-spoke", () => new THREE.BoxGeometry(0.08, radius * 2, 0.08));
  for (let index = 0; index < 4; index += 1) {
    const arm = new THREE.Mesh(spoke, frameMaterial);
    arm.rotation.z = (index * Math.PI) / 4;
    wheel.add(arm);
  }
  const cabins: THREE.Group[] = [];
  const cabinColors = ["#ff6fb8", "#ffd166", "#7dffb2", "#8fd3ff"];
  const cabinGeometry = kit.geometry("wheel-cabin", () => new THREE.BoxGeometry(0.9, 0.7, 0.7));
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const hanger = new THREE.Group();
    hanger.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    const cabin = new THREE.Mesh(
      cabinGeometry,
      new THREE.MeshBasicMaterial({ color: cabinColors[index % 4], toneMapped: false }),
    );
    cabin.position.y = -0.55;
    hanger.add(cabin);
    wheel.add(hanger);
    cabins.push(hanger);
  }
  group.add(wheel);

  // The A-frame it turns on.
  const leg = kit.geometry("wheel-leg", () => new THREE.BoxGeometry(0.28, hubHeight + 0.4, 0.28));
  for (const side of [-1, 1]) {
    const part = new THREE.Mesh(leg, frameMaterial);
    part.position.set(side * 2.2, hubHeight / 2, 0);
    part.rotation.z = -side * 0.27;
    group.add(part);
  }
  return {
    group,
    update: (elapsed) => {
      wheel.rotation.z = -elapsed * 0.12;
      // Cabins keep hanging straight down as the wheel turns.
      for (const cabin of cabins) cabin.rotation.z = elapsed * 0.12;
    },
  };
}

function createBigTop(kit: SceneKit, color: string, accent: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  const wall = new THREE.Mesh(
    kit.geometry("bigtop-wall", () => new THREE.CylinderGeometry(1.6, 1.7, 1.4, 10)),
    kit.flat("#f2e6ff"),
  );
  wall.position.y = 0.7;
  const roofGeometry = kit.geometry("bigtop-roof", () => {
    const cone = new THREE.ConeGeometry(2, 1.9, 10).toNonIndexed();
    const colors: number[] = [];
    const tint = new THREE.Color();
    for (let face = 0; face < cone.attributes.position.count / 3; face += 1) {
      tint.set(face % 2 === 0 ? "#ffffff" : "#ff5a8c");
      for (let vertex = 0; vertex < 3; vertex += 1) colors.push(tint.r, tint.g, tint.b);
    }
    cone.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return cone;
  });
  const roof = new THREE.Mesh(
    roofGeometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: accent }),
  );
  roof.position.y = 2.3;
  const flag = new THREE.Mesh(
    kit.geometry("bigtop-flag", () => new THREE.ConeGeometry(0.18, 0.5, 3)),
    kit.flat(color),
  );
  flag.position.y = 3.5;
  flag.rotation.z = -Math.PI / 2;
  group.add(wall, roof, flag);
  return group;
}

function createLightStrings(kit: SceneKit, world: Placer): AnimatedProp {
  const group = new THREE.Group();
  const post = kit.geometry("string-post", () => new THREE.CylinderGeometry(0.07, 0.09, 3.2, 5));
  const bulb = kit.geometry("string-bulb", () => new THREE.IcosahedronGeometry(0.13, 0));
  const poles: THREE.Vector3[] = [];
  const count = 8;
  for (let index = 0; index < count; index += 1) {
    // Evenly along the back and the two sides, close to the rim.
    const t = index / (count - 1);
    const x = (t * 2 - 1) * (world.outerWidth + 1.8);
    const z = -world.outerDepth - 1.6 - Math.abs(t - 0.5) * 1.0;
    poles.push(new THREE.Vector3(x, GROUND_Y, z));
  }
  const meshes = poles.map((pole) => {
    const mesh = new THREE.Mesh(post, kit.flat("#5a5f9c"));
    mesh.position.set(pole.x, GROUND_Y + 1.6, pole.z);
    group.add(mesh);
    return mesh;
  });
  void meshes;

  const materials = ["#ffd166", "#ff9fd1", "#7dffb2"].map(
    (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false }),
  );
  const buckets: THREE.Vector3[][] = [[], [], []];
  for (let index = 0; index < poles.length - 1; index += 1) {
    const from = poles[index];
    const to = poles[index + 1];
    for (let step = 1; step < 8; step += 1) {
      const t = step / 8;
      const sag = Math.sin(t * Math.PI) * 0.7;
      buckets[(index + step) % 3].push(
        new THREE.Vector3(
          THREE.MathUtils.lerp(from.x, to.x, t),
          GROUND_Y + 3.1 - sag,
          THREE.MathUtils.lerp(from.z, to.z, t),
        ),
      );
    }
  }
  buckets.forEach((positions, index) => {
    group.add(
      instance(
        bulb,
        materials[index],
        positions.map((position) => ({ position, scale: scale(1) })),
      ),
    );
  });
  return {
    group,
    update: (elapsed) => {
      materials.forEach((material, index) => {
        const glow = 0.55 + 0.45 * Math.sin(elapsed * 2.2 + index * 2.1);
        material.color.setScalar(1).multiplyScalar(0.55 + glow * 0.45);
      });
    },
  };
}

function createRisingBalloons(world: Placer, count: number): AnimatedProp {
  const geometry = new THREE.SphereGeometry(0.55, 8, 6);
  const material = new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.raycast = () => undefined;
  const colors = ["#ff6fb8", "#ffd166", "#7dffb2", "#8fd3ff", "#b8a6ff"];
  const balloons = Array.from({ length: count }, (_, index) => {
    const spot = world.spot(1.5, 12, false);
    mesh.setColorAt(index, new THREE.Color(colors[index % colors.length]));
    return { x: spot.x, z: spot.z, offset: world.rand() * 18, speed: world.between(0.35, 0.7), sway: world.rand() * 6 };
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  const matrix = new THREE.Matrix4();
  const top = 20;
  const group = new THREE.Group();
  group.add(mesh);
  return {
    group,
    update: (elapsed) => {
      balloons.forEach((balloon, index) => {
        const height = (balloon.offset + elapsed * balloon.speed) % top;
        matrix.compose(
          new THREE.Vector3(balloon.x + Math.sin(elapsed * 0.5 + balloon.sway) * 0.5, GROUND_Y + 1 + height, balloon.z),
          new THREE.Quaternion(),
          new THREE.Vector3(1, 1.25, 1),
        );
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
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

  // Ice spires and blocks lying on the snow beside the tray.
  const spire = kit.geometry("ice-spire", () => jitterGeometry(new THREE.ConeGeometry(0.35, 1.8, 5), 0.08, 21));
  const spires: Parameters<typeof instance>[2] = [];
  for (let index = 0; index < 34; index += 1) {
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

  const gulls = createGulls(world, 5);
  group.add(gulls.group);
  tickers.push(gulls.update);

  return { group, tick: (elapsed, delta) => tickers.forEach((tick) => tick(elapsed, delta)) };
}

/** Curtains of light high in the north sky, waving in the vertex shader: no CPU cost per frame. */
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

/** Gulls gliding in wide circles high above the far shore. */
function createGulls(world: Placer, count: number): AnimatedProp {
  const group = new THREE.Group();
  const wing = new THREE.BufferGeometry();
  wing.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.7, 0.12, -0.12, 0.7, 0.04, 0.16], 3));
  wing.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ color: "#f8fbff", side: THREE.DoubleSide });
  const birds = Array.from({ length: count }, () => {
    const body = new THREE.Group();
    const left = new THREE.Mesh(wing, material);
    const right = new THREE.Mesh(wing, material);
    right.scale.x = -1;
    body.add(left, right);
    group.add(body);
    return {
      body,
      left,
      right,
      cx: world.between(-world.outerWidth, world.outerWidth),
      cz: -world.between(world.outerDepth + 2, world.outerDepth + 14),
      radius: world.between(5, 11),
      height: world.between(9, 15),
      phase: world.rand() * 6,
      speed: world.between(0.12, 0.22),
    };
  });
  return {
    group,
    update: (elapsed) => {
      for (const bird of birds) {
        const angle = elapsed * bird.speed + bird.phase;
        bird.body.position.set(
          bird.cx + Math.cos(angle) * bird.radius,
          bird.height + Math.sin(angle * 2) * 0.4,
          bird.cz + Math.sin(angle) * bird.radius * 0.5,
        );
        bird.body.rotation.y = -angle + Math.PI / 2;
        const flap = Math.sin(elapsed * 3 + bird.phase) * 0.35;
        bird.left.rotation.z = flap;
        bird.right.rotation.z = -flap;
      }
    },
  };
}
