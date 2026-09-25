import * as THREE from "three";
import { SCENE_COLORS } from "../../theme/palette";
import { GRASS_DEPTH, GRASS_WIDTH, POND_CENTER, RIM_HEIGHT, RIM_THICKNESS, isAreaFree } from "../board-layout";
import {
  addOutline,
  appendRoundedRect,
  createRandom,
  createRoundedRectShape,
  jitterGeometry,
  type SceneKit,
} from "../scene-kit";
import type { AnimatedProp } from "./props-model";

/**
 * The board sits in a cream toy-box tray, echoing a physical board game.
 * Grass is at y = 0; the rim rises above it and the base sinks below.
 */
export function createTray(kit: SceneKit): THREE.Group {
  const tray = new THREE.Group();

  const grassShape = createRoundedRectShape(GRASS_WIDTH + 0.4, GRASS_DEPTH + 0.4, 2.2);
  const grass = new THREE.Mesh(
    new THREE.ExtrudeGeometry(grassShape, { depth: 0.6, bevelEnabled: false, curveSegments: 5 }),
    kit.flat(SCENE_COLORS.grass),
  );
  grass.rotation.x = Math.PI / 2;
  grass.receiveShadow = true;
  tray.add(grass);

  const outerWidth = GRASS_WIDTH + RIM_THICKNESS * 2;
  const outerDepth = GRASS_DEPTH + RIM_THICKNESS * 2;
  const rimShape = createRoundedRectShape(outerWidth, outerDepth, 2.9);
  const rimHole = new THREE.Path();
  appendRoundedRect(rimHole, GRASS_WIDTH, GRASS_DEPTH, 2.1);
  rimShape.holes.push(rimHole);
  const rim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rimShape, {
      depth: RIM_HEIGHT + 0.7,
      bevelEnabled: true,
      bevelThickness: 0.16,
      bevelSize: 0.16,
      bevelSegments: 2,
      curveSegments: 6,
    }),
    kit.flat(SCENE_COLORS.trayRim),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = -0.7;
  rim.castShadow = true;
  rim.receiveShadow = true;
  tray.add(rim);

  const base = new THREE.Mesh(
    new THREE.ExtrudeGeometry(createRoundedRectShape(outerWidth + 0.5, outerDepth + 0.5, 3.1), {
      depth: 0.7,
      bevelEnabled: true,
      bevelThickness: 0.18,
      bevelSize: 0.18,
      bevelSegments: 2,
      curveSegments: 6,
    }),
    kit.flat(SCENE_COLORS.trayBase),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -1.45;
  base.castShadow = true;
  base.receiveShadow = true;
  tray.add(base);

  return tray;
}

export function createPond(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  group.position.set(POND_CENTER.x, 0, POND_CENTER.z);

  const bank = new THREE.Mesh(
    jitterGeometry(new THREE.CylinderGeometry(POND_CENTER.radius + 0.25, POND_CENTER.radius + 0.35, 0.12, 11), 0.08, 5),
    kit.flat("#e8dcc4"),
  );
  bank.position.y = 0.04;
  bank.receiveShadow = true;
  group.add(bank);

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(POND_CENTER.radius, POND_CENTER.radius, 0.1, 11),
    new THREE.MeshStandardMaterial({ color: "#7fd0f0", roughness: 0.25, flatShading: true }),
  );
  water.position.y = 0.08;
  group.add(water);

  const pads: THREE.Mesh[] = [];
  [
    [-0.5, 0.2],
    [0.6, -0.4],
    [0.2, 0.7],
  ].forEach(([x, z], index) => {
    const pad = new THREE.Mesh(
      kit.geometry("lily-pad", () => new THREE.CylinderGeometry(0.28, 0.28, 0.03, 7, 1, false, 0, Math.PI * 1.7)),
      kit.flat(SCENE_COLORS.leaves[index % 2]),
    );
    pad.position.set(x, 0.15, z);
    pad.rotation.y = index * 2;
    pads.push(pad);
    group.add(pad);
  });

  const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), kit.flat("#ff9fb2"));
  flower.position.set(-0.5, 0.22, 0.2);
  group.add(flower);

  return {
    group,
    update: (elapsed) => {
      pads.forEach((pad, index) => {
        pad.position.y = 0.15 + Math.sin(elapsed * 1.5 + index) * 0.015;
        pad.rotation.y = index * 2 + Math.sin(elapsed * 0.4 + index) * 0.15;
      });
    },
  };
}

type TreeKind = "round" | "pine" | "bush";

const TREE_SPOTS: { x: number; z: number; kind: TreeKind; scale: number }[] = [
  { x: -10.5, z: -6.5, kind: "pine", scale: 1.1 },
  { x: -5.9, z: -6.7, kind: "round", scale: 1.05 },
  { x: -2.1, z: -6.6, kind: "round", scale: 0.95 },
  { x: -1.2, z: -6.9, kind: "bush", scale: 1 },
  { x: 2.2, z: -6.6, kind: "pine", scale: 1.15 },
  { x: 10.4, z: -6.5, kind: "round", scale: 1.1 },
  { x: 10.6, z: -2.4, kind: "pine", scale: 1.05 },
  { x: -10.6, z: -2.5, kind: "round", scale: 1 },
  { x: -10.7, z: 2.2, kind: "pine", scale: 0.95 },
  { x: 10.6, z: 2.3, kind: "round", scale: 0.9 },
  { x: -4.6, z: -2.3, kind: "bush", scale: 1.1 },
  { x: -3.1, z: -1.8, kind: "bush", scale: 0.8 },
  { x: 2.4, z: -3.2, kind: "bush", scale: 0.9 },
  { x: 6.6, z: 2.6, kind: "bush", scale: 0.9 },
  { x: 2.3, z: 2.4, kind: "bush", scale: 0.8 },
  { x: -10.4, z: 6.5, kind: "bush", scale: 1 },
  { x: -4.3, z: 6.6, kind: "bush", scale: 0.9 },
  { x: 6.2, z: 6.6, kind: "bush", scale: 0.95 },
  { x: 10.3, z: 6.6, kind: "bush", scale: 0.9 },
];

function createTree(kit: SceneKit, kind: TreeKind, seed: number): THREE.Group {
  const tree = new THREE.Group();
  const random = createRandom(seed);
  const leafColor = SCENE_COLORS.leaves[Math.floor(random() * SCENE_COLORS.leaves.length)];

  if (kind !== "bush") {
    const trunk = new THREE.Mesh(
      kit.geometry("tree-trunk", () => new THREE.CylinderGeometry(0.12, 0.18, 0.9, 5)),
      kit.flat(SCENE_COLORS.trunk),
    );
    trunk.position.y = 0.45;
    trunk.castShadow = true;
    tree.add(trunk);
  }

  if (kind === "pine") {
    [0, 1, 2].forEach((layer) => {
      const cone = new THREE.Mesh(
        kit.geometry(`pine-${layer}`, () => new THREE.ConeGeometry(0.85 - layer * 0.2, 0.9, 6)),
        kit.flat(leafColor),
      );
      cone.position.y = 1.0 + layer * 0.5;
      cone.rotation.y = random() * Math.PI;
      cone.castShadow = true;
      addOutline(cone, kit, 1.05);
      tree.add(cone);
    });
    return tree;
  }

  const blobGeometry = kit.geometry(`tree-blob-${seed % 3}`, () =>
    jitterGeometry(new THREE.IcosahedronGeometry(0.6, 0), 0.12, seed),
  );
  const blobs =
    kind === "bush"
      ? [[0, 0.35, 0, 0.75]]
      : [
          [0, 1.35, 0, 1],
          [0.35, 1.05, 0.2, 0.7],
          [-0.3, 1.1, -0.1, 0.75],
        ];
  for (const [x, y, z, scale] of blobs) {
    const blob = new THREE.Mesh(blobGeometry, kit.flat(leafColor));
    blob.position.set(x, y, z);
    blob.scale.setScalar(scale);
    blob.rotation.set(random() * 3, random() * 3, 0);
    blob.castShadow = true;
    addOutline(blob, kit, 1.05);
    tree.add(blob);
  }

  if (kind === "round" && random() > 0.4) {
    const fruit = new THREE.Mesh(
      kit.geometry("tree-fruit", () => new THREE.IcosahedronGeometry(0.1, 0)),
      kit.flat("#ff7a6b"),
    );
    fruit.position.set(0.45, 1.25, 0.45);
    tree.add(fruit);
  }

  return tree;
}

function createRock(kit: SceneKit, seed: number): THREE.Mesh {
  const random = createRandom(seed);
  const rock = new THREE.Mesh(
    kit.geometry(`rock-${seed % 3}`, () => jitterGeometry(new THREE.DodecahedronGeometry(0.4, 0), 0.15, seed)),
    kit.flat(SCENE_COLORS.rock[seed % SCENE_COLORS.rock.length]),
  );
  rock.scale.set(0.7 + random() * 0.6, 0.45 + random() * 0.4, 0.7 + random() * 0.6);
  rock.position.y = 0.12;
  rock.rotation.y = random() * Math.PI;
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

/**
 * Scatters trees, rocks, grass tufts and flowers in free areas. Grass and
 * flowers are instanced because there are hundreds of them.
 */
export function createScenery(kit: SceneKit): THREE.Group {
  const scenery = new THREE.Group();
  const random = createRandom(2024);
  const halfWidth = GRASS_WIDTH / 2 - 0.8;
  const halfDepth = GRASS_DEPTH / 2 - 0.8;
  const pick = () => ({ x: (random() * 2 - 1) * halfWidth, z: (random() * 2 - 1) * halfDepth });

  // Hand-placed so tall trees frame the board from the back and sides, and only
  // low bushes sit in front of tiles where they could hide the action.
  for (const spot of TREE_SPOTS) {
    if (!isAreaFree(spot.x, spot.z, 0)) continue;
    const tree = createTree(kit, spot.kind, Math.round(1_000 + spot.x * 31 + spot.z * 17));
    tree.position.set(spot.x, 0, spot.z);
    tree.scale.setScalar(spot.scale);
    tree.rotation.y = random() * Math.PI * 2;
    scenery.add(tree);
  }

  let placedRocks = 0;
  for (let attempt = 0; attempt < 400 && placedRocks < 12; attempt += 1) {
    const { x, z } = pick();
    if (!isAreaFree(x, z, 0)) continue;
    const rock = createRock(kit, 300 + placedRocks);
    rock.position.x = x;
    rock.position.z = z;
    scenery.add(rock);
    placedRocks += 1;
  }

  const tuftGeometry = createTuftGeometry();
  const tufts = new THREE.InstancedMesh(tuftGeometry, kit.flat(SCENE_COLORS.grassDeep), 260);
  const flowerGeometry = new THREE.IcosahedronGeometry(0.09, 0);
  const flowers = new THREE.InstancedMesh(flowerGeometry, kit.flat("#ffffff"), 90);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  let tuftCount = 0;
  let flowerCount = 0;
  for (let attempt = 0; attempt < 3_000; attempt += 1) {
    const { x, z } = pick();
    if (!isAreaFree(x, z, -0.45)) continue;

    if (tuftCount < tufts.count) {
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2);
      scale.setScalar(0.7 + random() * 0.7);
      matrix.compose(new THREE.Vector3(x, 0, z), quaternion, scale);
      tufts.setMatrixAt(tuftCount, matrix);
      tuftCount += 1;
    } else if (flowerCount < flowers.count) {
      scale.setScalar(0.8 + random() * 0.6);
      matrix.compose(new THREE.Vector3(x, 0.08, z), quaternion.identity(), scale);
      flowers.setMatrixAt(flowerCount, matrix);
      flowers.setColorAt(flowerCount, color.set(SCENE_COLORS.flowers[flowerCount % SCENE_COLORS.flowers.length]));
      flowerCount += 1;
    } else {
      break;
    }
  }

  tufts.count = tuftCount;
  flowers.count = flowerCount;
  tufts.instanceMatrix.needsUpdate = true;
  flowers.instanceMatrix.needsUpdate = true;
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
  tufts.receiveShadow = true;
  scenery.add(tufts, flowers);

  return scenery;
}

function createTuftGeometry(): THREE.BufferGeometry {
  const blades = [
    { x: 0, z: 0, tilt: 0, height: 0.34 },
    { x: 0.08, z: 0.03, tilt: 0.35, height: 0.26 },
    { x: -0.07, z: -0.02, tilt: -0.3, height: 0.28 },
  ];
  const positions: number[] = [];
  for (const blade of blades) {
    const cone = new THREE.ConeGeometry(0.045, blade.height, 3).toNonIndexed();
    cone.rotateZ(blade.tilt);
    cone.translate(blade.x, blade.height / 2, blade.z);
    positions.push(...(cone.attributes.position.array as Float32Array));
    cone.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
