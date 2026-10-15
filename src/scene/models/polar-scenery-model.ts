import * as THREE from "three";
import type { NodeId } from "../../game/types";
import type { BoardLayout } from "../board-layout";
import { BANQUISE_LAKE } from "../map-layouts";
import { addOutline, createRandom, createRoundedRectShape, jitterGeometry, type SceneKit } from "../scene-kit";
import type { AnimatedProp } from "./props-model";
import type { TrayColors } from "./scenery-model";

/** Snow inside a pale wooden tray: the same board-game box, in the far north. */
export const POLAR_TRAY: TrayColors = {
  ground: "#eef5fc",
  rim: "#c9d9ec",
  base: "#8ea9c9",
};

const PINE_SPOTS: { x: number; z: number; scale: number }[] = [
  { x: -11, z: -7.4, scale: 1.1 },
  { x: -6.8, z: -7.6, scale: 1 },
  { x: -3.2, z: -7.8, scale: 0.9 },
  { x: 3.4, z: -7.7, scale: 1.05 },
  { x: 6.9, z: -7.5, scale: 0.95 },
  { x: 11, z: -7.3, scale: 1.1 },
  { x: -11.2, z: -2.6, scale: 1 },
  { x: 11.2, z: -2.8, scale: 0.95 },
  { x: -11.3, z: 3.4, scale: 0.9 },
  { x: 11.3, z: 3.2, scale: 0.9 },
  { x: -6.8, z: -3.4, scale: 0.8 },
  { x: 6.8, z: -3.3, scale: 0.8 },
];

/**
 * Everything around the tiles at Banquise: a frozen lake under the ice row,
 * snowy pines framing the back and sides, snowmen, an igloo, waddling
 * penguins and falling snow. Tall props stay behind or beside the board.
 */
/** The scenery, and the penguins that throw snowballs once a Red Cup was taken. */
export interface PolarScenery extends AnimatedProp {
  penguins: THREE.Object3D[];
}

export function createPolarScenery(kit: SceneKit, layout: BoardLayout): PolarScenery {
  if (layout.openWorld) return createOpenPolarScenery(kit, layout);
  const group = new THREE.Group();
  const animated: AnimatedProp[] = [];
  const random = createRandom(4_711);
  const penguins: THREE.Object3D[] = [];

  group.add(createFrozenLake(kit));

  for (const spot of PINE_SPOTS) {
    if (!layout.isAreaFree(spot.x, spot.z, 0)) continue;
    const pine = createSnowyPine(kit, Math.round(spot.x * 13 + spot.z * 7));
    pine.position.set(spot.x, 0, spot.z);
    pine.scale.setScalar(spot.scale);
    pine.rotation.y = random() * Math.PI * 2;
    group.add(pine);
  }

  const snowmanSpots = [
    { x: -6.9, z: 3.5 },
    { x: 7, z: 3.6 },
  ];
  snowmanSpots.forEach((spot, index) => {
    if (!layout.isAreaFree(spot.x, spot.z, 0)) return;
    const snowman = createSnowman(kit);
    snowman.position.set(spot.x, 0, spot.z);
    snowman.rotation.y = index === 0 ? 0.4 : -0.4;
    group.add(snowman);
  });

  const igloo = createIgloo(kit);
  igloo.position.set(-4.4, 0, -7.6);
  igloo.rotation.y = 0.3;
  group.add(igloo);

  const penguinPaths = [
    { from: new THREE.Vector3(-7.6, 0, -3.4), to: new THREE.Vector3(-5.4, 0, -4.1) },
    { from: new THREE.Vector3(5.6, 0, -4.2), to: new THREE.Vector3(7.4, 0, -3.6) },
    { from: new THREE.Vector3(-2.6, 0, 3.8), to: new THREE.Vector3(-1.8, 0, 4.4) },
  ];
  penguinPaths.forEach((path, index) => {
    if (!layout.isAreaFree(path.from.x, path.from.z, -0.4) || !layout.isAreaFree(path.to.x, path.to.z, -0.4)) return;
    const penguin = createPenguin(kit, path.from, path.to, index * 1.7);
    group.add(penguin.group);
    animated.push(penguin);
    penguins.push(penguin.group);
  });

  const snowfall = createSnowfall(layout);
  group.add(snowfall.group);
  animated.push(snowfall);

  group.add(createSnowDrifts(kit, layout));

  return {
    group,
    penguins,
    update: (elapsed, delta) => {
      for (const prop of animated) prop.update(elapsed, delta);
    },
  };
}

/** The four penguins of the open Banquise, each walking in the space between four tiles (their numbers). */
const PENGUIN_ZONES: NodeId[][] = [
  [6, 3, 8, 13],
  [8, 7, 10, 9],
  [1, 3, 4, 0],
  [7, 2, 0, 4],
];

type Lake = { x: number; z: number; halfWidth: number; halfDepth: number };

/**
 * Banquise without its tray: the lake is an irregular pool between two banks, and what stands round it (snowmen, an
 * igloo, penguins, drifts, a few pines near the tiles) is placed wherever the roads and the tiles leave room. The
 * farther snowfield is dressed by `open-world-model.ts`.
 */
function createOpenPolarScenery(kit: SceneKit, layout: BoardLayout): PolarScenery {
  const group = new THREE.Group();
  const animated: AnimatedProp[] = [];
  const penguins: THREE.Object3D[] = [];
  const random = createRandom(4_711);
  const lake: Lake = layout.config.lake ?? BANQUISE_LAKE;
  group.add(createFrozenLake(kit, lake, true));

  const insideLake = (x: number, z: number, margin: number) =>
    Math.hypot((x - lake.x) / (lake.halfWidth + margin), (z - lake.z) / (lake.halfDepth + margin)) < 1;
  /** A spot off the tiles, the roads and the lake, in the ring round the board; `behind` keeps it off the near side. */
  const freeSpot = (
    margin: number,
    behind: boolean,
    minRadius = 0,
    accept: (x: number, z: number) => boolean = () => true,
  ): THREE.Vector3 | null => {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const x = (random() * 2 - 1) * (layout.halfWidth + 1);
      const z = (random() * 2 - 1) * (layout.halfDepth + 1);
      if (Math.hypot(x / (layout.halfWidth + 1), z / (layout.halfDepth + 1)) > 1 || Math.hypot(x, z) < minRadius)
        continue;
      if (behind && z > 1) continue;
      if (!accept(x, z)) continue;
      if (!layout.isClearOfBoard(x, z, margin) || insideLake(x, z, 0.8)) continue;
      return new THREE.Vector3(x, 0, z);
    }
    return null;
  };

  for (let index = 0; index < 14; index += 1) {
    const spot = freeSpot(1.8, true, 6);
    if (!spot) continue;
    const pine = createSnowyPine(kit, Math.round(spot.x * 13 + spot.z * 7));
    pine.position.copy(spot);
    pine.scale.setScalar(0.85 + random() * 0.35);
    pine.rotation.y = random() * Math.PI * 2;
    group.add(pine);
    layout.reserve(spot.x, spot.z, 1.3);
  }

  [0.4, -0.4].forEach((turn) => {
    const spot = freeSpot(1, false, 5);
    if (!spot) return;
    const snowman = createSnowman(kit);
    snowman.position.copy(spot);
    snowman.rotation.y = turn;
    group.add(snowman);
    layout.reserve(spot.x, spot.z, 1.1);
  });

  const iglooSpot = freeSpot(2.4, true, 9);
  if (iglooSpot) {
    const igloo = createIgloo(kit);
    igloo.position.copy(iglooSpot);
    igloo.rotation.y = 0.3;
    group.add(igloo);
    layout.reserve(iglooSpot.x, iglooSpot.z, 2.4);
  }

  // One penguin in each of four zones, each the space between four tiles: it waddles back and forth in the clear.
  PENGUIN_ZONES.forEach((tileIds, index) => {
    const corners = tileIds.flatMap((id) => {
      const node = layout.getNode(id);
      return node ? [new THREE.Vector3(node.x, 0, node.z)] : [];
    });
    if (corners.length < 3) return;
    const centre = corners.reduce((sum, corner) => sum.add(corner), new THREE.Vector3()).divideScalar(corners.length);
    // In the order round the centre, so mixing the corners always lands inside the zone.
    corners.sort((a, b) => Math.atan2(a.z - centre.z, a.x - centre.x) - Math.atan2(b.z - centre.z, b.x - centre.x));
    const inside = () => {
      const weights = corners.map(() => 0.4 + random());
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      return corners.reduce(
        (point, corner, cornerIndex) => point.addScaledVector(corner, weights[cornerIndex] / total),
        new THREE.Vector3(),
      );
    };
    for (let attempt = 0; attempt < 500; attempt += 1) {
      // Room is asked for first, and given up bit by bit if the zone is tight.
      const margin = attempt < 160 ? 1.3 : attempt < 340 ? 0.9 : 0.6;
      const from = inside();
      const to = inside();
      const walk = from.distanceTo(to);
      if (walk < 1.2 || walk > 3.6) continue;
      if (!layout.isClearOfBoard(from.x, from.z, margin) || !layout.isClearOfBoard(to.x, to.z, margin)) continue;
      layout.reserve(from.x, from.z, 1);
      layout.reserve(to.x, to.z, 1);
      const penguin = createPenguin(kit, from, to, index * 1.7);
      group.add(penguin.group);
      animated.push(penguin);
      penguins.push(penguin.group);
      return;
    }
  });

  const snowfall = createSnowfall(layout);
  group.add(snowfall.group);
  animated.push(snowfall);

  const drift = new THREE.InstancedMesh(
    kit.geometry("snow-drift", () =>
      jitterGeometry(new THREE.SphereGeometry(0.5, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0.08, 6),
    ),
    kit.flat("#ffffff"),
    60,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  let drifts = 0;
  for (let index = 0; index < drift.count; index += 1) {
    const spot = freeSpot(0.5, false);
    if (!spot) continue;
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI);
    const size = 0.6 + random() * 0.9;
    matrix.compose(spot, quaternion, new THREE.Vector3(size, size * 0.45, size));
    drift.setMatrixAt(drifts, matrix);
    drifts += 1;
  }
  drift.count = drifts;
  drift.instanceMatrix.needsUpdate = true;
  drift.receiveShadow = true;
  group.add(drift);

  return {
    group,
    penguins,
    update: (elapsed, delta) => {
      for (const prop of animated) prop.update(elapsed, delta);
    },
  };
}

/** Pale, glossy ice under the lake row, with a few cracks and a snowy shore. */
function createFrozenLake(kit: SceneKit, area: Lake = BANQUISE_LAKE, organic = false): THREE.Group {
  const lake = new THREE.Group();
  lake.position.set(area.x, 0, area.z);
  const width = area.halfWidth * 2;
  const depth = area.halfDepth * 2;
  // Boxed: a rounded rectangle. Open: a pool with an uneven shore.
  const outline = (grow: number) =>
    organic
      ? createPoolShape(width + grow, depth + grow)
      : createRoundedRectShape(width + grow, depth + grow, grow > 0 ? 1.6 : 1.3);

  const shore = new THREE.Mesh(new THREE.ShapeGeometry(outline(0.7), organic ? 24 : 6), kit.flat("#ffffff"));
  shore.rotation.x = -Math.PI / 2;
  shore.position.y = 0.012;
  shore.receiveShadow = true;
  lake.add(shore);

  const ice = new THREE.Mesh(
    new THREE.ShapeGeometry(outline(0), organic ? 24 : 6),
    new THREE.MeshStandardMaterial({ color: "#a9dcf5", roughness: 0.12, metalness: 0.15, flatShading: true }),
  );
  ice.rotation.x = -Math.PI / 2;
  ice.position.y = 0.02;
  ice.receiveShadow = true;
  lake.add(ice);

  const random = createRandom(88);
  const crackMaterial = new THREE.LineBasicMaterial({ color: "#6fb4dc" });
  for (let crack = 0; crack < 7; crack += 1) {
    const points: THREE.Vector3[] = [];
    let x = (random() - 0.5) * width * 0.85;
    let z = (random() - 0.5) * depth * 0.7;
    for (let step = 0; step < 4; step += 1) {
      points.push(new THREE.Vector3(x, 0.026, z));
      x += (random() - 0.5) * 1.6;
      z += (random() - 0.5) * 0.9;
    }
    lake.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), crackMaterial));
  }

  // Glints on the ice, like light catching a polished surface.
  for (let glint = 0; glint < 5; glint += 1) {
    const shine = new THREE.Mesh(
      kit.geometry("ice-glint", () => new THREE.PlaneGeometry(0.9, 0.12)),
      kit.unlit("#ffffff", 0.6),
    );
    shine.rotation.set(-Math.PI / 2, 0, 0.5);
    shine.position.set((random() - 0.5) * width * 0.8, 0.028, (random() - 0.5) * depth * 0.6);
    lake.add(shine);
  }
  return lake;
}

/** An uneven oval: the shore of a lake that nobody drew with a ruler. */
function createPoolShape(width: number, depth: number): THREE.Shape {
  const shape = new THREE.Shape();
  const steps = 48;
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    const wobble =
      1 + 0.07 * Math.sin(angle * 3 + 1.1) + 0.045 * Math.sin(angle * 5 + 2.3) + 0.03 * Math.sin(angle * 8);
    const x = (Math.cos(angle) * width * wobble) / 2;
    const y = (Math.sin(angle) * depth * wobble) / 2;
    if (step === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

function createSnowyPine(kit: SceneKit, seed: number): THREE.Group {
  const pine = new THREE.Group();
  const random = createRandom(seed);
  const trunk = new THREE.Mesh(
    kit.geometry("pine-trunk-snow", () => new THREE.CylinderGeometry(0.12, 0.18, 0.8, 5)),
    kit.flat("#8a6246"),
  );
  trunk.position.y = 0.4;
  trunk.castShadow = true;
  pine.add(trunk);

  [0, 1, 2].forEach((layer) => {
    const radius = 0.95 - layer * 0.22;
    const cone = new THREE.Mesh(
      kit.geometry(`snow-pine-${layer}`, () => new THREE.ConeGeometry(radius, 0.95, 7)),
      kit.flat(layer % 2 === 0 ? "#2f6b5a" : "#3a7d68"),
    );
    cone.position.y = 1 + layer * 0.52;
    cone.rotation.y = random() * Math.PI;
    cone.castShadow = true;
    addOutline(cone, kit, 1.05);
    pine.add(cone);

    // A cap of snow on each layer of branches.
    const cap = new THREE.Mesh(
      kit.geometry(`snow-cap-${layer}`, () => new THREE.ConeGeometry(radius * 0.72, 0.42, 7)),
      kit.flat("#ffffff"),
    );
    cap.position.y = 1.3 + layer * 0.52;
    cap.rotation.y = cone.rotation.y;
    pine.add(cap);
  });
  return pine;
}

function createSnowman(kit: SceneKit): THREE.Group {
  const snowman = new THREE.Group();
  const snow = kit.flat("#ffffff");
  [
    [0.55, 0.5],
    [0.4, 1.25],
    [0.3, 1.8],
  ].forEach(([radius, height]) => {
    const ball = new THREE.Mesh(
      kit.geometry(`snowman-${radius}`, () => jitterGeometry(new THREE.IcosahedronGeometry(radius, 1), 0.04, 3)),
      snow,
    );
    ball.position.y = height;
    ball.castShadow = true;
    addOutline(ball, kit, 1.04);
    snowman.add(ball);
  });

  const nose = new THREE.Mesh(
    kit.geometry("snowman-nose", () => new THREE.ConeGeometry(0.06, 0.32, 5)),
    kit.flat("#ff8f3f"),
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.82, 0.42);
  snowman.add(nose);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      kit.geometry("snowman-eye", () => new THREE.IcosahedronGeometry(0.04, 0)),
      kit.flat("#1f2d45"),
    );
    eye.position.set(side * 0.1, 1.9, 0.27);
    snowman.add(eye);
  }

  const hat = new THREE.Mesh(
    kit.geometry("snowman-hat", () => new THREE.CylinderGeometry(0.22, 0.24, 0.34, 8)),
    kit.flat("#e8453c"),
  );
  hat.position.y = 2.18;
  hat.castShadow = true;
  snowman.add(hat);
  const scarf = new THREE.Mesh(
    kit.geometry("snowman-scarf", () => new THREE.TorusGeometry(0.33, 0.07, 5, 12)),
    kit.flat("#35c6f4"),
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.55;
  snowman.add(scarf);
  return snowman;
}

function createIgloo(kit: SceneKit): THREE.Group {
  const igloo = new THREE.Group();
  const dome = new THREE.Mesh(
    kit.geometry("igloo-dome", () => new THREE.SphereGeometry(1.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)),
    kit.flat("#f4f9ff"),
  );
  dome.castShadow = true;
  dome.receiveShadow = true;
  addOutline(dome, kit, 1.03);
  igloo.add(dome);

  const porch = new THREE.Mesh(
    kit.geometry("igloo-porch", () => new THREE.CylinderGeometry(0.42, 0.42, 0.7, 8, 1, false, 0, Math.PI)),
    kit.flat("#e3eef9"),
  );
  porch.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  porch.position.set(0, 0.1, 1.1);
  igloo.add(porch);

  const door = new THREE.Mesh(
    kit.geometry("igloo-door", () => new THREE.CircleGeometry(0.3, 10, 0, Math.PI)),
    kit.unlit("#34507a"),
  );
  door.position.set(0, 0.05, 1.46);
  igloo.add(door);
  return igloo;
}

/** A penguin walking back and forth between two points, rocking from foot to foot. */
function createPenguin(kit: SceneKit, from: THREE.Vector3, to: THREE.Vector3, phase: number): AnimatedProp {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const back = new THREE.Mesh(
    kit.geometry("penguin-body", () => new THREE.SphereGeometry(0.28, 8, 6)),
    kit.flat("#1f2d45"),
  );
  back.scale.set(1, 1.35, 0.95);
  back.position.y = 0.4;
  back.castShadow = true;
  addOutline(back, kit, 1.06);
  body.add(back);

  const belly = new THREE.Mesh(
    kit.geometry("penguin-belly", () => new THREE.SphereGeometry(0.22, 8, 6)),
    kit.flat("#ffffff"),
  );
  belly.scale.set(1, 1.3, 0.7);
  belly.position.set(0, 0.38, 0.1);
  body.add(belly);

  const beak = new THREE.Mesh(
    kit.geometry("penguin-beak", () => new THREE.ConeGeometry(0.06, 0.16, 4)),
    kit.flat("#ffb020"),
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.62, 0.27);
  body.add(beak);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      kit.geometry("penguin-eye", () => new THREE.IcosahedronGeometry(0.035, 0)),
      kit.unlit("#ffffff"),
    );
    eye.position.set(side * 0.09, 0.7, 0.22);
    body.add(eye);
    const foot = new THREE.Mesh(
      kit.geometry("penguin-foot", () => new THREE.BoxGeometry(0.12, 0.04, 0.16)),
      kit.flat("#ffb020"),
    );
    foot.position.set(side * 0.1, 0.02, 0.06);
    group.add(foot);
  }

  const span = to.clone().sub(from);
  return {
    group,
    update: (elapsed) => {
      // Ping-pong along the path, pausing a little at each end.
      const cycle = (Math.sin(elapsed * 0.35 + phase) + 1) / 2;
      group.position.copy(from).addScaledVector(span, cycle);
      const heading = Math.cos(elapsed * 0.35 + phase) >= 0 ? 1 : -1;
      group.rotation.y = Math.atan2(span.x * heading, span.z * heading);
      body.rotation.z = Math.sin(elapsed * 7 + phase) * 0.12;
    },
  };
}

/** Flakes drifting down over the whole tray, recycled once they reach the snow. */
function createSnowfall(layout: BoardLayout): AnimatedProp {
  const count = 260;
  const random = createRandom(2_026);
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const width = layout.halfWidth * 2 + 2;
  const depth = layout.halfDepth * 2 + 2;
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (random() - 0.5) * width;
    positions[index * 3 + 1] = random() * 9;
    positions[index * 3 + 2] = (random() - 0.5) * depth;
    speeds[index] = 0.5 + random() * 0.6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const flakes = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: "#ffffff", size: 0.12, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  const group = new THREE.Group();
  group.add(flakes);

  return {
    group,
    update: (elapsed, delta) => {
      for (let index = 0; index < count; index += 1) {
        positions[index * 3 + 1] -= speeds[index] * delta;
        positions[index * 3] += Math.sin(elapsed * 0.8 + index) * delta * 0.15;
        if (positions[index * 3 + 1] < 0) positions[index * 3 + 1] = 9;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

/** Soft mounds of snow scattered in the free spots, off the tiles and roads. */
function createSnowDrifts(kit: SceneKit, layout: BoardLayout): THREE.InstancedMesh {
  const random = createRandom(515);
  const drifts = new THREE.InstancedMesh(
    kit.geometry("snow-drift", () =>
      jitterGeometry(new THREE.SphereGeometry(0.5, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0.08, 6),
    ),
    kit.flat("#ffffff"),
    40,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  let count = 0;
  for (let attempt = 0; attempt < 1_200 && count < drifts.count; attempt += 1) {
    const x = (random() * 2 - 1) * (layout.halfWidth - 0.8);
    const z = (random() * 2 - 1) * (layout.halfDepth - 0.8);
    if (!layout.isAreaFree(x, z, -0.2)) continue;
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI);
    const size = 0.6 + random() * 0.9;
    matrix.compose(new THREE.Vector3(x, 0, z), quaternion, new THREE.Vector3(size, size * 0.45, size));
    drifts.setMatrixAt(count, matrix);
    count += 1;
  }
  drifts.count = count;
  drifts.instanceMatrix.needsUpdate = true;
  drifts.receiveShadow = true;
  return drifts;
}
