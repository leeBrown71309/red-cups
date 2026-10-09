import * as THREE from "three";
import type { NodeId } from "../../game/types";
import type { BoardLayout } from "../board-layout";
import { addOutline, createRandom, jitterGeometry, type SceneKit } from "../scene-kit";
import type { AnimatedProp } from "./props-model";
import type { TrayColors } from "./scenery-model";

/** The sea inside a sandy wooden tray: the lagoon of the Archipel des Marées. */
export const LAGOON_TRAY: TrayColors = {
  ground: "#2a9fbd",
  rim: "#efdcb0",
  base: "#b88c5a",
};

/** Where the sea's surface and the sand of the islands lie, above the tray's floor. */
export const WATER_Y = 0.07;
export const LAND_Y = 0.15;
const ISLAND_MARGIN = 1.9;

interface IslandShape {
  index: number;
  x: number;
  z: number;
  radius: number;
}

const SAND = "#f4e1a4";
const SAND_WET = "#e3c98c";
const GRASS = "#8fd36e";

/** The islands as the scene draws them: a disc round the centre of each loop of tiles. */
export function getIslandShapes(layout: BoardLayout): IslandShape[] {
  const tidal = layout.map.tidal;
  if (!tidal) return [];
  return tidal.islands.map((tiles, index) => {
    const points = tiles.map((nodeId) => layout.getNodePosition(nodeId));
    const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const z = points.reduce((sum, point) => sum + point.z, 0) / points.length;
    const reach = Math.max(...points.map((point) => Math.hypot(point.x - x, point.z - z)));
    return { index, x, z, radius: reach + ISLAND_MARGIN };
  });
}

/** Where a causeway lies, for its buoys and its shoal: the middle of its two tiles and the way it runs. */
function getCausewayAxes(layout: BoardLayout): { center: THREE.Vector3; direction: THREE.Vector3; opensAt: string }[] {
  return (layout.map.tidal?.causeways ?? []).map((causeway) => {
    const first = layout.getNodePosition(causeway.nodes[0]);
    const second = layout.getNodePosition(causeway.nodes[1]);
    return {
      center: first.clone().lerp(second, 0.5),
      direction: second.clone().sub(first).setY(0).normalize(),
      opensAt: causeway.opensAt,
    };
  });
}

/**
 * Everything around the tiles of the Archipel: the sea that shimmers and foams along the shores, five sand islands
 * each with its own landmark (the port and its crane, the pearl clam, the lighthouse, the wreck, the coral reef),
 * palm trees, buoys that mark the causeways even when the tide drowns them, and gulls circling over it all.
 */
export function createLagoonScenery(kit: SceneKit, layout: BoardLayout): AnimatedProp {
  const group = new THREE.Group();
  const animated: AnimatedProp[] = [];
  const islands = getIslandShapes(layout);
  const axes = getCausewayAxes(layout);

  const sea = createSea(layout, islands, axes);
  group.add(sea.group);
  animated.push(sea);

  for (const island of islands) {
    group.add(createIslandGround(kit, island));
    const landmark = createLandmark(kit, island);
    if (landmark) {
      landmark.group.position.set(island.x, LAND_Y, island.z);
      group.add(landmark.group);
      animated.push(landmark);
    }
    scatterPalms(kit, layout, island, group);
  }

  axes.forEach((axis, index) => {
    for (const side of [-1, 1]) {
      const buoy = createBuoy(kit, axis.opensAt, index * 2 + (side + 1) / 2);
      const offset = new THREE.Vector3(-axis.direction.z, 0, axis.direction.x).multiplyScalar(side * 1.75);
      buoy.group.position.copy(axis.center).add(offset).setY(WATER_Y);
      group.add(buoy.group);
      animated.push(buoy);
    }
  });

  const gulls = createGulls(kit);
  group.add(gulls.group);
  animated.push(gulls);

  return {
    group,
    update: (elapsed, delta) => {
      for (const prop of animated) prop.update(elapsed, delta);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------- sea

/** The water: deep blue that turns turquoise over the shoals, caustic light dancing on it, foam along the shores. */
function createSea(
  layout: BoardLayout,
  islands: IslandShape[],
  axes: ReturnType<typeof getCausewayAxes>,
): AnimatedProp {
  const shoals = [
    ...islands.map((island) => new THREE.Vector3(island.x, island.z, island.radius)),
    ...axes.flatMap((axis) =>
      [-0.5, 0.5].map(
        (spread) =>
          new THREE.Vector3(
            axis.center.x + axis.direction.x * spread * 3.3,
            axis.center.z + axis.direction.z * spread * 3.3,
            1.05,
          ),
      ),
    ),
  ];
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uShoals: { value: shoals } },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = (modelMatrix * vec4(position, 1.0)).xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uShoals[${shoals.length}];
      varying vec2 vPos;
      void main() {
        float reach = length(vPos);
        float shallow = 0.0;
        float foam = 0.0;
        for (int i = 0; i < ${shoals.length}; i++) {
          vec3 s = uShoals[i];
          float d = length(vPos - s.xy) - s.z;
          shallow = max(shallow, 1.0 - smoothstep(0.0, 2.8, d));
          float swell = 0.16 * sin(uTime * 1.3 + s.x * 0.7 + s.y * 0.4);
          foam = max(foam, smoothstep(0.42, 0.0, abs(d - 0.18 - swell)) * (1.0 - smoothstep(-0.2, 0.3, -d)));
        }
        vec3 deep = vec3(0.05, 0.40, 0.58);
        vec3 mid = vec3(0.14, 0.70, 0.82);
        vec3 lagoon = vec3(0.56, 0.94, 0.90);
        vec3 color = mix(deep, mid, shallow * 0.85);
        color = mix(color, lagoon, pow(shallow, 3.0));
        float a = sin(vPos.x * 1.6 + uTime * 0.8 + sin(vPos.y * 1.2 + uTime * 0.6) * 1.7);
        float b = sin(vPos.y * 1.9 - uTime * 0.7 + sin(vPos.x * 1.0 + uTime * 0.5) * 1.5);
        float caustic = smoothstep(0.55, 1.0, a * b);
        color += vec3(0.10, 0.15, 0.15) * caustic;
        float wave = smoothstep(0.93, 1.0, sin(vPos.x * 0.55 + vPos.y * 0.35 + uTime * 0.9) * sin(vPos.y * 0.5 - uTime * 0.6));
        color += vec3(0.18) * wave;
        color = mix(color, vec3(1.0), foam * 0.7);
        // The sea fades into the haze of the horizon instead of ending on a rim.
        gl_FragColor = vec4(color, 0.92 * (1.0 - smoothstep(38.0, 66.0, reach)));
      }
    `,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(layout.config.groundWidth + 90, layout.config.groundDepth + 90),
    material,
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = WATER_Y;
  plane.renderOrder = 1;
  plane.raycast = () => undefined;
  const group = new THREE.Group();
  group.add(plane);
  return { group, update: (elapsed) => (material.uniforms.uTime.value = elapsed) };
}

// ------------------------------------------------------------------------------------------------------- islands

function createIslandGround(kit: SceneKit, island: IslandShape): THREE.Group {
  const group = new THREE.Group();
  group.position.set(island.x, 0, island.z);

  const shelf = new THREE.Mesh(
    kit.geometry(`island-shelf-${island.index}`, () =>
      jitterGeometry(
        new THREE.CylinderGeometry(island.radius + 0.5, island.radius + 0.9, 0.12, 22),
        0.16,
        island.index + 3,
      ),
    ),
    kit.flat(SAND_WET),
  );
  shelf.position.y = 0.03;
  shelf.receiveShadow = true;
  group.add(shelf);

  const sand = new THREE.Mesh(
    kit.geometry(`island-sand-${island.index}`, () =>
      jitterGeometry(
        new THREE.CylinderGeometry(island.radius, island.radius + 0.35, LAND_Y, 22),
        0.2,
        island.index + 11,
      ),
    ),
    kit.flat(SAND),
  );
  sand.position.y = LAND_Y / 2;
  sand.receiveShadow = true;
  group.add(sand);

  const grass = new THREE.Mesh(
    kit.geometry(`island-grass-${island.index}`, () =>
      jitterGeometry(
        new THREE.CylinderGeometry(island.radius * 0.5, island.radius * 0.56, 0.06, 16),
        0.1,
        island.index + 21,
      ),
    ),
    kit.flat(GRASS),
  );
  grass.position.y = LAND_Y + 0.02;
  grass.receiveShadow = true;
  group.add(grass);
  return group;
}

/** Palm trees on the outer rim of the island, where no road or tile is. */
function scatterPalms(kit: SceneKit, layout: BoardLayout, island: IslandShape, group: THREE.Group): void {
  const random = createRandom(900 + island.index * 31);
  let placed = 0;
  for (let attempt = 0; attempt < 40 && placed < 3; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const reach = island.radius * (0.74 + random() * 0.14);
    const x = island.x + Math.cos(angle) * reach;
    const z = island.z + Math.sin(angle) * reach;
    if (!layout.isAreaFree(x, z, -0.55)) continue;
    const palm = createPalm(kit, island.index * 17 + placed);
    palm.position.set(x, LAND_Y, z);
    palm.rotation.y = random() * Math.PI * 2;
    palm.scale.setScalar(0.85 + random() * 0.35);
    group.add(palm);
    placed += 1;
  }
}

export function createPalm(kit: SceneKit, seed: number): THREE.Group {
  const random = createRandom(seed + 5);
  const palm = new THREE.Group();
  const lean = (random() - 0.5) * 0.7;
  const segments = 5;
  let x = 0;
  let y = 0;
  for (let index = 0; index < segments; index += 1) {
    const tilt = lean * (0.4 + index * 0.18);
    const length = 0.5;
    const radiusBottom = 0.15 - index * 0.016;
    const trunk = new THREE.Mesh(
      kit.geometry(
        `palm-trunk-${index}`,
        () => new THREE.CylinderGeometry(0.12 - index * 0.014, radiusBottom, length, 6),
      ),
      kit.flat(index % 2 === 0 ? "#b88a5e" : "#a8784f"),
    );
    trunk.position.set(x + Math.sin(tilt) * length * 0.5, y + Math.cos(tilt) * length * 0.5, 0);
    trunk.rotation.z = -tilt;
    trunk.castShadow = true;
    palm.add(trunk);
    x += Math.sin(tilt) * length;
    y += Math.cos(tilt) * length;
  }
  const crown = new THREE.Group();
  crown.position.set(x, y, 0);
  const frondCount = 7;
  for (let index = 0; index < frondCount; index += 1) {
    const frond = new THREE.Mesh(
      kit.geometry("palm-frond", () => {
        const geometry = new THREE.ConeGeometry(0.2, 1.5, 4);
        geometry.translate(0, 0.75, 0);
        geometry.scale(1, 1, 0.3);
        return geometry;
      }),
      kit.flat(index % 2 === 0 ? "#4fb86a" : "#6bd07f"),
    );
    const around = (index / frondCount) * Math.PI * 2;
    frond.rotation.set(0, around, 0);
    const holder = new THREE.Group();
    holder.rotation.y = around;
    frond.rotation.y = 0;
    frond.rotation.z = -1.25 - (index % 3) * 0.12;
    holder.add(frond);
    frond.castShadow = true;
    crown.add(holder);
  }
  for (const offset of [-0.09, 0.09]) {
    const nut = new THREE.Mesh(
      kit.geometry("palm-nut", () => new THREE.SphereGeometry(0.1, 6, 5)),
      kit.flat("#6b4a2f"),
    );
    nut.position.set(offset, -0.1, offset * 0.5);
    crown.add(nut);
  }
  palm.add(crown);
  return palm;
}

// ----------------------------------------------------------------------------------------------------- landmarks

function createLandmark(kit: SceneKit, island: IslandShape): AnimatedProp | null {
  switch (island.index) {
    case 0:
      return createHarbor(kit);
    case 1:
      return createPearlClam(kit);
    case 2:
      return createLighthouse(kit);
    case 3:
      return createWreck(kit);
    case 4:
      return createReef(kit);
    default:
      return null;
  }
}

function box(kit: SceneKit, width: number, height: number, depth: number, color: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    kit.geometry(`box-${width}-${height}-${depth}`, () => new THREE.BoxGeometry(width, height, depth)),
    kit.flat(color),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** The Port: stacked crates, barrels, an anchor and a crane whose hook sways in the breeze. */
function createHarbor(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const crateA = box(kit, 0.62, 0.62, 0.62, "#c98e5a");
  crateA.position.set(-0.7, 0.31, 0.15);
  crateA.rotation.y = 0.25;
  const crateB = box(kit, 0.52, 0.52, 0.52, "#e0a96d");
  crateB.position.set(-0.55, 0.88, 0.1);
  crateB.rotation.y = -0.2;
  const crateC = box(kit, 0.5, 0.5, 0.5, "#b87a47");
  crateC.position.set(-0.05, 0.25, 0.55);
  crateC.rotation.y = 0.5;
  group.add(crateA, crateB, crateC);
  for (const [bx, bz] of [
    [0.45, 0.4],
    [0.78, 0.1],
  ]) {
    const barrel = new THREE.Mesh(
      kit.geometry("harbor-barrel", () => new THREE.CylinderGeometry(0.22, 0.26, 0.55, 8)),
      kit.flat("#a8693a"),
    );
    barrel.position.set(bx, 0.28, bz);
    barrel.castShadow = true;
    group.add(barrel);
    const band = new THREE.Mesh(
      kit.geometry("harbor-band", () => new THREE.TorusGeometry(0.245, 0.025, 4, 10)),
      kit.flat("#4a3a30"),
    );
    band.rotation.x = Math.PI / 2;
    band.position.set(bx, 0.28, bz);
    group.add(band);
  }

  const anchor = new THREE.Group();
  const shaft = box(kit, 0.1, 0.72, 0.1, "#5b6577");
  shaft.position.y = 0.36;
  const cross = box(kit, 0.46, 0.09, 0.09, "#5b6577");
  cross.position.y = 0.64;
  const ring = new THREE.Mesh(
    kit.geometry("anchor-ring", () => new THREE.TorusGeometry(0.1, 0.03, 5, 10)),
    kit.flat("#5b6577"),
  );
  ring.position.y = 0.82;
  const flukes = new THREE.Mesh(
    kit.geometry("anchor-flukes", () => new THREE.TorusGeometry(0.24, 0.045, 5, 10, Math.PI)),
    kit.flat("#5b6577"),
  );
  flukes.rotation.z = Math.PI;
  flukes.position.y = 0.2;
  anchor.add(shaft, cross, ring, flukes);
  anchor.position.set(0.1, 0, -0.75);
  anchor.rotation.set(0.12, 0.6, 0.2);
  group.add(anchor);

  const crane = new THREE.Group();
  crane.position.set(0.95, 0, -0.6);
  const mast = box(kit, 0.16, 2.3, 0.16, "#e04b3f");
  mast.position.y = 1.15;
  const boom = box(kit, 1.5, 0.12, 0.12, "#e04b3f");
  boom.position.set(-0.6, 2.25, 0);
  const brace = box(kit, 1.0, 0.07, 0.07, "#f3e2bf");
  brace.position.set(-0.3, 1.9, 0);
  brace.rotation.z = -0.7;
  const hook = new THREE.Group();
  hook.position.set(-1.25, 2.2, 0);
  const rope = box(kit, 0.025, 0.9, 0.025, "#4a3a30");
  rope.position.y = -0.45;
  const hookBody = new THREE.Mesh(
    kit.geometry("crane-hook", () => new THREE.TorusGeometry(0.09, 0.03, 5, 8, Math.PI * 1.4)),
    kit.flat("#5b6577"),
  );
  hookBody.position.y = -0.95;
  hook.add(rope, hookBody);
  crane.add(mast, boom, brace, hook);
  group.add(crane);

  return {
    group,
    update: (elapsed) => {
      hook.rotation.z = Math.sin(elapsed * 1.1) * 0.12;
      hook.rotation.x = Math.sin(elapsed * 0.8 + 1) * 0.06;
    },
  };
}

/** The Perles: a giant clam that slowly opens and closes around a glowing pearl. */
function createPearlClam(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const half = (flip: boolean) => {
    const shell = new THREE.Mesh(
      kit.geometry("clam-half", () => {
        const geometry = new THREE.SphereGeometry(0.95, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2);
        geometry.scale(1, 0.55, 0.85);
        return jitterGeometry(geometry, 0.05, 41);
      }),
      kit.flat(flip ? "#ffd2dc" : "#ffc2d1"),
    );
    shell.castShadow = true;
    addOutline(shell, kit, 1.04);
    return shell;
  };
  const bottom = half(false);
  bottom.rotation.x = Math.PI;
  bottom.position.y = 0.52;
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.55, -0.55);
  const top = half(true);
  top.position.set(0, 0, 0.55);
  hinge.add(top);
  group.add(bottom, hinge);

  const pearl = new THREE.Mesh(
    kit.geometry("clam-pearl", () => new THREE.SphereGeometry(0.28, 12, 9)),
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.18, emissive: "#bfe9ff", emissiveIntensity: 0.35 }),
  );
  pearl.position.set(0, 0.62, 0.05);
  group.add(pearl);
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.5, 20),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.64;
  group.add(halo);
  group.rotation.y = -0.5;

  return {
    group,
    update: (elapsed) => {
      const open = 0.5 + Math.sin(elapsed * 0.55) * 0.5;
      hinge.rotation.x = -0.15 - open * 0.7;
      const glow = 0.5 + Math.sin(elapsed * 2.1) * 0.5;
      (pearl.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + glow * 0.4 + open * 0.3;
      halo.scale.setScalar(1 + glow * 0.25);
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.18 + open * 0.3;
    },
  };
}

/** The Phare: a striped tower whose beam sweeps the whole lagoon. */
function createLighthouse(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const stripes = ["#ffffff", "#e8453c", "#ffffff", "#e8453c"];
  stripes.forEach((color, index) => {
    const segment = new THREE.Mesh(
      kit.geometry(`lighthouse-${index}`, () => {
        const bottom = 0.85 - index * 0.08;
        return new THREE.CylinderGeometry(bottom - 0.08, bottom, 0.8, 10);
      }),
      kit.flat(color),
    );
    segment.position.y = 0.4 + index * 0.8;
    segment.castShadow = true;
    addOutline(segment, kit, 1.04);
    group.add(segment);
  });
  const gallery = new THREE.Mesh(
    kit.geometry("lighthouse-gallery", () => new THREE.CylinderGeometry(0.78, 0.7, 0.14, 10)),
    kit.flat("#3a2530"),
  );
  gallery.position.y = 3.27;
  group.add(gallery);
  const lamp = new THREE.Mesh(
    kit.geometry("lighthouse-lamp", () => new THREE.CylinderGeometry(0.46, 0.46, 0.5, 10)),
    new THREE.MeshStandardMaterial({ color: "#fff3b0", emissive: "#ffd24a", emissiveIntensity: 1.1, roughness: 0.3 }),
  );
  lamp.position.y = 3.6;
  group.add(lamp);
  const roof = new THREE.Mesh(
    kit.geometry("lighthouse-roof", () => new THREE.ConeGeometry(0.62, 0.6, 10)),
    kit.flat("#e8453c"),
  );
  roof.position.y = 4.15;
  roof.castShadow = true;
  addOutline(roof, kit, 1.05);
  group.add(roof);
  const door = box(kit, 0.3, 0.5, 0.1, "#6b4a2f");
  door.position.set(0, 0.25, 0.8);
  group.add(door);

  const beams = new THREE.Group();
  beams.position.y = 3.6;
  const beamTexture = kit.texture("lighthouse-beam", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 16;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createLinearGradient(0, 0, 128, 0);
      gradient.addColorStop(0, "rgba(255, 244, 190, 0.85)");
      gradient.addColorStop(1, "rgba(255, 244, 190, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 16);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
  const beamMaterial = new THREE.MeshBasicMaterial({
    map: beamTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const direction of [0, Math.PI]) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.1), beamMaterial);
    beam.geometry.translate(4, 0, 0);
    beam.rotation.x = -Math.PI / 2;
    const holder = new THREE.Group();
    holder.rotation.y = direction;
    holder.add(beam);
    beams.add(holder);
    beam.raycast = () => undefined;
  }
  group.add(beams);

  return {
    group,
    update: (elapsed) => {
      beams.rotation.y = elapsed * 0.7;
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 + Math.sin(elapsed * 3) * 0.25;
    },
  };
}

/** Les Épaves: the ribs of a sunken ship, a broken mast with its torn sail, a chest of gold. */
function createWreck(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const keel = box(kit, 2.6, 0.16, 0.6, "#6b4a2f");
  keel.position.y = 0.18;
  keel.rotation.z = 0.08;
  group.add(keel);
  for (let index = 0; index < 6; index += 1) {
    const x = -1 + index * 0.4;
    for (const side of [-1, 1]) {
      const rib = box(kit, 0.1, 0.9 - Math.abs(x) * 0.18, 0.1, "#7b5a3a");
      rib.position.set(x, 0.55, side * 0.33);
      rib.rotation.x = side * -0.4;
      rib.rotation.z = 0.08;
      group.add(rib);
    }
  }
  const plank = box(kit, 1.1, 0.07, 0.34, "#8a6840");
  plank.position.set(-0.45, 0.45, 0.46);
  plank.rotation.set(0.1, 0.1, 0.5);
  group.add(plank);

  const mast = new THREE.Mesh(
    kit.geometry("wreck-mast", () => new THREE.CylinderGeometry(0.06, 0.09, 2.1, 6)),
    kit.flat("#6b4a2f"),
  );
  mast.position.set(0.25, 1.1, 0);
  mast.rotation.z = -0.25;
  mast.castShadow = true;
  group.add(mast);
  const sail = new THREE.Mesh(
    kit.geometry("wreck-sail", () => jitterGeometry(new THREE.PlaneGeometry(0.95, 1.0, 3, 3), 0.1, 51)),
    new THREE.MeshStandardMaterial({ color: "#efe2c4", side: THREE.DoubleSide, flatShading: true, roughness: 0.9 }),
  );
  sail.position.set(0.05, 1.35, 0.02);
  sail.rotation.set(0.05, 0.1, -0.25);
  group.add(sail);
  const flag = new THREE.Mesh(
    kit.geometry("wreck-flag", () => new THREE.PlaneGeometry(0.5, 0.3)),
    new THREE.MeshStandardMaterial({ color: "#2b2b3a", side: THREE.DoubleSide }),
  );
  flag.position.set(0.52, 2.0, 0);
  group.add(flag);

  const chest = box(kit, 0.62, 0.36, 0.4, "#8a5a3c");
  chest.position.set(-0.85, 0.18, -0.65);
  chest.rotation.y = 0.5;
  const lid = new THREE.Mesh(
    kit.geometry("chest-lid", () => new THREE.CylinderGeometry(0.2, 0.2, 0.62, 8, 1, false, 0, Math.PI)),
    kit.flat("#a8693a"),
  );
  lid.rotation.set(0, 0, Math.PI / 2);
  lid.position.set(-0.85, 0.4, -0.65);
  lid.rotation.y = 0.5;
  const gold = new THREE.Mesh(
    kit.geometry("chest-gold", () => new THREE.SphereGeometry(0.1, 6, 5)),
    new THREE.MeshStandardMaterial({ color: "#ffd24a", emissive: "#ffb000", emissiveIntensity: 0.5 }),
  );
  gold.position.set(-0.85, 0.5, -0.65);
  group.add(chest, lid, gold);

  return {
    group,
    update: (elapsed) => {
      flag.rotation.y = Math.sin(elapsed * 2.2) * 0.35;
      sail.rotation.y = 0.1 + Math.sin(elapsed * 1.4) * 0.07;
      gold.scale.setScalar(1 + Math.sin(elapsed * 3.4) * 0.18);
    },
  };
}

/** Corail: branching coral, sea fans, a starfish, and little fish that circle the reef. */
function createReef(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const random = createRandom(2026);
  const colors = ["#ff7a8a", "#ff9f5a", "#c987ff", "#ffd166", "#5fd4c9"];
  for (let cluster = 0; cluster < 5; cluster += 1) {
    const angle = (cluster / 5) * Math.PI * 2 + 0.4;
    const holder = new THREE.Group();
    holder.position.set(Math.cos(angle) * 0.9, 0, Math.sin(angle) * 0.9);
    const color = colors[cluster % colors.length];
    for (let branch = 0; branch < 4; branch += 1) {
      const height = 0.5 + random() * 0.55;
      const stem = new THREE.Mesh(
        kit.geometry(`coral-stem-${branch}`, () => new THREE.CylinderGeometry(0.05, 0.09, 1, 5)),
        kit.flat(color),
      );
      stem.scale.y = height;
      stem.position.set((random() - 0.5) * 0.4, height / 2, (random() - 0.5) * 0.4);
      stem.rotation.set((random() - 0.5) * 0.6, 0, (random() - 0.5) * 0.6);
      stem.castShadow = true;
      const tip = new THREE.Mesh(
        kit.geometry("coral-tip", () => new THREE.SphereGeometry(0.1, 6, 5)),
        kit.flat(color),
      );
      tip.position.set(stem.position.x + Math.sin(stem.rotation.z) * -height * 0.5, height + 0.02, stem.position.z);
      holder.add(stem, tip);
    }
    group.add(holder);
  }
  const fan = new THREE.Mesh(
    kit.geometry("sea-fan", () => new THREE.CircleGeometry(0.55, 9, 0, Math.PI)),
    new THREE.MeshStandardMaterial({ color: "#ff5fa3", side: THREE.DoubleSide, flatShading: true }),
  );
  fan.position.set(0.1, 0.02, 0.05);
  fan.rotation.set(0, 0.3, 0);
  group.add(fan);
  for (const [x, z, color] of [
    [-0.4, 0.5, "#ff8a4a"],
    [0.55, -0.45, "#ffb347"],
  ] as const) {
    const star = new THREE.Mesh(
      kit.geometry("starfish", () => new THREE.CylinderGeometry(0.3, 0.12, 0.06, 5)),
      kit.flat(color),
    );
    star.position.set(x, 0.04, z);
    star.rotation.y = random() * 3;
    group.add(star);
  }

  const fish: { mesh: THREE.Mesh; radius: number; speed: number; phase: number; height: number }[] = [];
  for (let index = 0; index < 5; index += 1) {
    const mesh = new THREE.Mesh(
      kit.geometry("reef-fish", () => {
        const geometry = new THREE.ConeGeometry(0.1, 0.34, 5);
        geometry.rotateZ(-Math.PI / 2);
        return geometry;
      }),
      kit.flat(colors[index % colors.length]),
    );
    group.add(mesh);
    fish.push({
      mesh,
      radius: 1.55 + (index % 3) * 0.28,
      speed: 0.55 + index * 0.07,
      phase: index * 1.3,
      height: 0.5 + (index % 2) * 0.25,
    });
  }
  return {
    group,
    update: (elapsed) => {
      for (const entry of fish) {
        const angle = elapsed * entry.speed + entry.phase;
        entry.mesh.position.set(
          Math.cos(angle) * entry.radius,
          entry.height + Math.sin(angle * 2) * 0.08,
          Math.sin(angle) * entry.radius,
        );
        entry.mesh.rotation.y = -angle;
      }
    },
  };
}

// --------------------------------------------------------------------------------------------- buoys and gulls

const BUOY_LIGHTS: Record<string, string> = { always: "#7ee07a", low: "#3fd6f0", high: "#ffb347" };

/** A striped buoy that bobs on the water beside a causeway: its light says when the causeway stands out of the sea. */
function createBuoy(kit: SceneKit, opensAt: string, seed: number): AnimatedProp {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    kit.geometry("buoy-body", () => new THREE.CylinderGeometry(0.2, 0.3, 0.5, 8)),
    kit.flat("#ffffff"),
  );
  body.position.y = 0.2;
  const stripe = new THREE.Mesh(
    kit.geometry("buoy-stripe", () => new THREE.CylinderGeometry(0.255, 0.285, 0.14, 8)),
    kit.flat("#e8453c"),
  );
  stripe.position.y = 0.26;
  const mast = new THREE.Mesh(
    kit.geometry("buoy-mast", () => new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5)),
    kit.flat("#3a2530"),
  );
  mast.position.y = 0.64;
  const color = BUOY_LIGHTS[opensAt] ?? "#ffffff";
  const light = new THREE.Mesh(
    kit.geometry("buoy-light", () => new THREE.SphereGeometry(0.1, 8, 6)),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 }),
  );
  light.position.y = 0.9;
  body.castShadow = true;
  group.add(body, stripe, mast, light);
  return {
    group,
    update: (elapsed) => {
      const sway = elapsed * 1.5 + seed * 1.7;
      group.position.y = WATER_Y + Math.sin(sway) * 0.05;
      group.rotation.z = Math.sin(sway * 0.8) * 0.1;
      group.rotation.x = Math.cos(sway * 0.7) * 0.08;
      (light.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + Math.sin(elapsed * 3 + seed) * 0.35;
    },
  };
}

/** Gulls that wheel over the lagoon on wide, slow circles. */
function createGulls(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const gulls: {
    holder: THREE.Group;
    wings: THREE.Mesh[];
    radius: number;
    speed: number;
    phase: number;
    height: number;
  }[] = [];
  for (let index = 0; index < 5; index += 1) {
    const holder = new THREE.Group();
    const body = new THREE.Mesh(
      kit.geometry("gull-body", () => {
        const geometry = new THREE.ConeGeometry(0.1, 0.42, 5);
        geometry.rotateX(Math.PI / 2);
        return geometry;
      }),
      kit.flat("#ffffff"),
    );
    const wings = [-1, 1].map((side) => {
      const wing = new THREE.Mesh(
        kit.geometry("gull-wing", () => {
          const geometry = new THREE.BoxGeometry(0.62, 0.02, 0.2);
          geometry.translate(0.31, 0, 0);
          return geometry;
        }),
        kit.flat(side < 0 ? "#dfe7ee" : "#ffffff"),
      );
      wing.scale.x = side;
      holder.add(wing);
      return wing;
    });
    holder.add(body);
    group.add(holder);
    gulls.push({
      holder,
      wings,
      radius: 15 + index * 3.2,
      speed: 0.08 + index * 0.012,
      phase: index * 1.9,
      height: 7 + (index % 3) * 1.4,
    });
  }
  return {
    group,
    update: (elapsed) => {
      for (const gull of gulls) {
        const angle = elapsed * gull.speed * (gull.radius % 2 > 1 ? 1 : -1) + gull.phase;
        gull.holder.position.set(
          Math.cos(angle) * gull.radius * 1.25,
          gull.height + Math.sin(angle * 3) * 0.4,
          Math.sin(angle) * gull.radius * 0.85,
        );
        gull.holder.rotation.y = -angle + (gull.radius % 2 > 1 ? 0 : Math.PI) + Math.PI / 2;
        const flap = Math.sin(elapsed * 6 + gull.phase) * 0.45;
        // The left wing is mirrored, so it lifts with the opposite angle.
        gull.wings[0].rotation.z = -flap;
        gull.wings[1].rotation.z = flap;
      }
    },
  };
}

/** Ids of the quays, for the ferry's berths. */
export function getQuayIds(layout: BoardLayout): NodeId[] {
  return layout.map.tidal?.ferryQuays ?? [];
}
