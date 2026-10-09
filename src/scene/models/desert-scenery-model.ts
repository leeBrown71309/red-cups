import * as THREE from "three";
import type { BoardLayout } from "../board-layout";
import { addOutline, createRandom, jitterGeometry, type SceneKit } from "../scene-kit";
import type { AnimatedProp } from "./props-model";

const SAND = "#efce8f";
const SAND_DARK = "#d9a86a";
const SAND_PALE = "#f7e2b2";

/**
 * Everything around the tiles of the Désert des Mirages: sand that goes on to the horizon, long low dunes (a whole
 * massif of them in the middle, round the Quicksand), cacti, rocks and bones, palms and a pool at every oasis, a
 * ruin of sandstone pillars, wind-blown grit, and vultures wheeling high above. Nothing stands on a road.
 */
export function createDesertScenery(kit: SceneKit, layout: BoardLayout): AnimatedProp {
  const group = new THREE.Group();
  const animated: AnimatedProp[] = [];
  const random = createRandom(7_070);

  const floor = createSandFloor(layout);
  group.add(floor.group);
  animated.push(floor);

  group.add(createDunes(kit, layout, random));
  scatterProps(kit, layout, group, random);

  for (const oasisId of layout.map.desert?.oases ?? []) {
    const oasis = createOasisDecor(kit, layout, oasisId, random);
    if (oasis) group.add(oasis);
  }

  const ruins = createRuins(kit);
  ruins.position.set(layout.halfWidth * 0.78, 0, -layout.halfDepth * 0.7);
  ruins.rotation.y = -0.5;
  group.add(ruins);

  const grit = createWindGrit(layout);
  group.add(grit.group);
  animated.push(grit);

  const vultures = createVultures(kit);
  group.add(vultures.group);
  animated.push(vultures);

  return {
    group,
    update: (elapsed, delta) => {
      for (const prop of animated) prop.update(elapsed, delta);
    },
  };
}

// ----------------------------------------------------------------------------------------------- the sand

/** Sand with slow ripples that fades into the haze of the horizon instead of ending on an edge. */
function createSandFloor(layout: BoardLayout): AnimatedProp {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = (modelMatrix * vec4(position, 1.0)).xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vPos;
      void main() {
        vec3 base = vec3(0.937, 0.808, 0.561);
        vec3 shade = vec3(0.851, 0.659, 0.416);
        vec3 pale = vec3(0.969, 0.886, 0.698);
        // Long wind ripples across the dunes, and a fine grain on top.
        float ripple = sin(vPos.x * 0.42 + sin(vPos.y * 0.21) * 2.2) * 0.5 + 0.5;
        float fine = sin(vPos.x * 2.1 + vPos.y * 1.3 + sin(vPos.y * 0.9) * 2.0) * 0.5 + 0.5;
        vec3 color = mix(base, shade, smoothstep(0.55, 1.0, ripple) * 0.55);
        color = mix(color, pale, smoothstep(0.75, 1.0, fine) * 0.35);
        float glint = smoothstep(0.985, 1.0, sin(vPos.x * 3.7 + vPos.y * 2.9 + uTime * 0.6));
        color += vec3(0.08) * glint;
        float reach = length(vPos);
        gl_FragColor = vec4(color, 1.0 - smoothstep(48.0, 84.0, reach));
      }
    `,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(layout.config.groundWidth + 120, layout.config.groundDepth + 120),
    material,
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0;
  plane.receiveShadow = true;
  plane.raycast = () => undefined;
  const group = new THREE.Group();
  group.add(plane);
  return { group, update: (elapsed) => (material.uniforms.uTime.value = elapsed) };
}

/** Soft dunes: flattened lumps of sand, between the loops, round the Quicksand and out beyond the outer loop. */
function createDunes(kit: SceneKit, layout: BoardLayout, random: () => number): THREE.Group {
  const group = new THREE.Group();
  const geometry = kit.geometry("desert-dune", () => {
    const sphere = new THREE.IcosahedronGeometry(1, 2);
    return jitterGeometry(sphere, 0.08, 91);
  });
  const colors = [SAND, SAND_DARK, SAND_PALE];
  let placed = 0;
  for (let attempt = 0; attempt < 900 && placed < 30; attempt += 1) {
    const angle = random() * Math.PI * 2;
    // Rings of dunes: the massif in the middle, the stretch between the loops, the dunes beyond the caravan's road.
    const band = random();
    const radiusScale =
      band < 0.3 ? 0.1 + random() * 0.18 : band < 0.55 ? 0.42 + random() * 0.14 : 1.12 + random() * 0.55;
    const x = Math.cos(angle) * layout.halfWidth * 0.66 * radiusScale;
    const z = Math.sin(angle) * layout.halfDepth * 0.66 * radiusScale;
    const size = (band < 0.3 ? 1.5 : band < 0.55 ? 1.7 : 3.6) * (0.75 + random() * 0.6);
    // The whole footprint of the dune must lie off the roads and tiles, or it would hide them from the camera.
    if (!layout.isAreaFree(x, z, size * 1.6)) continue;
    const dune = new THREE.Mesh(geometry, kit.flat(colors[placed % colors.length]));
    dune.scale.set(size * (1.2 + random() * 0.5), size * (0.16 + random() * 0.1), size * (0.9 + random() * 0.4));
    dune.position.set(x, 0, z);
    dune.rotation.y = random() * Math.PI;
    dune.receiveShadow = true;
    dune.castShadow = true;
    group.add(dune);
    placed += 1;
  }
  return group;
}

// --------------------------------------------------------------------------------------------- the props

function scatterProps(kit: SceneKit, layout: BoardLayout, group: THREE.Group, random: () => number): void {
  let cacti = 0;
  let rocks = 0;
  let bones = 0;
  for (let attempt = 0; attempt < 600 && (cacti < 14 || rocks < 12 || bones < 4); attempt += 1) {
    const x = (random() * 2 - 1) * layout.halfWidth * 0.95;
    const z = (random() * 2 - 1) * layout.halfDepth * 0.95;
    if (!layout.isAreaFree(x, z, 0.2)) continue;
    const pick = random();
    if (pick < 0.45 && cacti < 14) {
      const cactus = createCactus(kit, cacti);
      cactus.position.set(x, 0, z);
      cactus.rotation.y = random() * Math.PI * 2;
      cactus.scale.setScalar(0.8 + random() * 0.7);
      group.add(cactus);
      cacti += 1;
    } else if (pick < 0.9 && rocks < 12) {
      const rock = new THREE.Mesh(
        kit.geometry(`desert-rock-${rocks % 3}`, () =>
          jitterGeometry(new THREE.DodecahedronGeometry(1, 0), 0.25, 17 + (rocks % 3)),
        ),
        kit.flat(["#c7a07a", "#b88f68", "#d4b08a"][rocks % 3]),
      );
      const size = 0.5 + random() * 0.9;
      rock.scale.set(size * 1.3, size * 0.8, size);
      rock.position.set(x, size * 0.3, z);
      rock.rotation.y = random() * 3;
      rock.castShadow = true;
      group.add(rock);
      rocks += 1;
    } else if (bones < 4) {
      const skull = createSkull(kit);
      skull.position.set(x, 0, z);
      skull.rotation.y = random() * Math.PI * 2;
      group.add(skull);
      bones += 1;
    }
  }
}

function createCactus(kit: SceneKit, seed: number): THREE.Group {
  const cactus = new THREE.Group();
  const green = ["#5fae6a", "#6fbd78", "#4f9d5f"][seed % 3];
  const trunk = new THREE.Mesh(
    kit.geometry("cactus-trunk", () => new THREE.CylinderGeometry(0.2, 0.24, 1.9, 7)),
    kit.flat(green),
  );
  trunk.position.y = 0.95;
  trunk.castShadow = true;
  addOutline(trunk, kit, 1.06);
  const top = new THREE.Mesh(
    kit.geometry("cactus-top", () => new THREE.SphereGeometry(0.2, 7, 5)),
    kit.flat(green),
  );
  top.position.y = 1.9;
  cactus.add(trunk, top);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(
      kit.geometry("cactus-arm", () => new THREE.CylinderGeometry(0.13, 0.15, 0.75, 6)),
      kit.flat(green),
    );
    arm.position.set(side * 0.42, 1.2 + (side > 0 ? 0.2 : 0), 0);
    arm.rotation.z = side * 0.0;
    const elbow = new THREE.Mesh(
      kit.geometry("cactus-elbow", () => new THREE.CylinderGeometry(0.13, 0.13, 0.4, 6)),
      kit.flat(green),
    );
    elbow.rotation.z = Math.PI / 2;
    elbow.position.set(side * 0.22, 0.95 + (side > 0 ? 0.2 : 0), 0);
    cactus.add(arm, elbow);
  }
  const flower = new THREE.Mesh(
    kit.geometry("cactus-flower", () => new THREE.SphereGeometry(0.07, 5, 4)),
    kit.flat("#ff7aa8"),
  );
  flower.position.set(0, 2.04, 0);
  cactus.add(flower);
  return cactus;
}

function createSkull(kit: SceneKit): THREE.Group {
  const skull = new THREE.Group();
  const cranium = new THREE.Mesh(
    kit.geometry("skull-cranium", () => new THREE.SphereGeometry(0.34, 8, 6)),
    kit.flat("#f1ead8"),
  );
  cranium.position.y = 0.3;
  cranium.scale.set(1, 0.85, 1.15);
  const horn = (side: number) => {
    const piece = new THREE.Mesh(
      kit.geometry("skull-horn", () => new THREE.ConeGeometry(0.1, 0.75, 5)),
      kit.flat("#e2d8bd"),
    );
    piece.position.set(side * 0.38, 0.55, 0);
    piece.rotation.z = -side * 1.0;
    return piece;
  };
  for (const eye of [-1, 1]) {
    const socket = new THREE.Mesh(
      kit.geometry("skull-eye", () => new THREE.SphereGeometry(0.07, 5, 4)),
      kit.flat("#3a2530"),
    );
    socket.position.set(eye * 0.14, 0.34, 0.32);
    skull.add(socket);
  }
  skull.add(cranium, horn(-1), horn(1));
  return skull;
}

/** A pool of clear water and two palms behind each oasis, on the side away from the dunes. */
function createOasisDecor(
  kit: SceneKit,
  layout: BoardLayout,
  oasisId: number,
  random: () => number,
): THREE.Group | null {
  const node = layout.getNode(oasisId);
  if (!node) return null;
  const away = Math.atan2(node.z, node.x);
  const group = new THREE.Group();
  // A pool beside the oasis, along the road's outside edge.
  const sideways = away + Math.PI / 2;
  const pool = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.3, 0.1, 14),
    new THREE.MeshStandardMaterial({ color: "#58d3d8", roughness: 0.2, flatShading: true }),
  );
  pool.scale.z = 0.7;
  pool.position.set(
    node.x + Math.cos(away) * 3.4 + Math.cos(sideways) * 0.6,
    0.05,
    node.z + Math.sin(away) * 3.4 + Math.sin(sideways) * 0.6,
  );
  pool.rotation.y = -away;
  group.add(pool);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 5, 16), kit.flat("#c9b07c"));
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 0.7, 1);
  rim.position.copy(pool.position).setY(0.09);
  rim.rotation.z = -away;
  group.add(rim);
  for (let index = 0; index < 3; index += 1) {
    const palm = createDesertPalm(kit, index + oasisId);
    const angle = away + (index - 1) * 0.55;
    palm.position.set(
      node.x + Math.cos(angle) * (4.4 + random() * 1.2),
      0,
      node.z + Math.sin(angle) * (4.4 + random() * 1.2),
    );
    palm.scale.setScalar(1.05 + random() * 0.4);
    palm.rotation.y = random() * 6;
    group.add(palm);
  }
  return group;
}

function createDesertPalm(kit: SceneKit, seed: number): THREE.Group {
  const palm = new THREE.Group();
  const random = createRandom(seed + 31);
  const lean = (random() - 0.5) * 0.6;
  let x = 0;
  let y = 0;
  for (let index = 0; index < 5; index += 1) {
    const tilt = lean * (0.4 + index * 0.2);
    const length = 0.55;
    const trunk = new THREE.Mesh(
      kit.geometry(
        `dpalm-trunk-${index}`,
        () => new THREE.CylinderGeometry(0.11 - index * 0.012, 0.15 - index * 0.015, length, 6),
      ),
      kit.flat(index % 2 === 0 ? "#b98b5e" : "#a8784f"),
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
  for (let index = 0; index < 7; index += 1) {
    const frond = new THREE.Mesh(
      kit.geometry("dpalm-frond", () => {
        const geometry = new THREE.ConeGeometry(0.22, 1.7, 4);
        geometry.translate(0, 0.85, 0);
        geometry.scale(1, 1, 0.28);
        return geometry;
      }),
      kit.flat(index % 2 === 0 ? "#4fb86a" : "#6bd07f"),
    );
    const holder = new THREE.Group();
    holder.rotation.y = (index / 7) * Math.PI * 2;
    frond.rotation.z = -1.25 - (index % 3) * 0.1;
    frond.castShadow = true;
    holder.add(frond);
    crown.add(holder);
  }
  palm.add(crown);
  return palm;
}

/** Three broken sandstone pillars and a lintel, far at the back of the dunes. */
function createRuins(kit: SceneKit): THREE.Group {
  const ruins = new THREE.Group();
  const stone = kit.flat("#d6b98a");
  const pillars: [number, number, number][] = [
    [-2.2, 3.2, 0],
    [0, 2.2, 0.4],
    [2.4, 3.8, -0.2],
  ];
  for (const [x, height, z] of pillars) {
    const pillar = new THREE.Mesh(
      kit.geometry(`ruin-pillar-${height}`, () => new THREE.CylinderGeometry(0.55, 0.7, height, 7)),
      stone,
    );
    pillar.position.set(x, height / 2, z);
    pillar.castShadow = true;
    addOutline(pillar, kit, 1.04);
    ruins.add(pillar);
  }
  const lintel = new THREE.Mesh(
    kit.geometry("ruin-lintel", () => new THREE.BoxGeometry(3.4, 0.5, 1.1)),
    stone,
  );
  lintel.position.set(-1.1, 3.45, 0.1);
  lintel.rotation.z = 0.08;
  lintel.castShadow = true;
  ruins.add(lintel);
  const fallen = new THREE.Mesh(
    kit.geometry("ruin-fallen", () => new THREE.CylinderGeometry(0.5, 0.6, 2.4, 7)),
    stone,
  );
  fallen.rotation.z = Math.PI / 2;
  fallen.position.set(3.6, 0.5, 1.6);
  ruins.add(fallen);
  return ruins;
}

// ------------------------------------------------------------------------------------- grit and vultures

/** Grit the wind carries along the ground, from one side of the world to the other. */
function createWindGrit(layout: BoardLayout): AnimatedProp {
  const count = 160;
  const positions = new Float32Array(count * 3);
  const seeds = Array.from({ length: count }, (_, index) => ({
    x: ((index * 37) % 100) / 100,
    z: ((index * 53) % 100) / 100,
    y: 0.2 + ((index * 17) % 10) / 6,
    speed: 0.5 + ((index * 7) % 10) / 10,
  }));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: "#f3d9a2", size: 0.14, transparent: true, opacity: 0.7, depthWrite: false }),
  );
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  const width = layout.config.groundWidth * 0.95;
  const depth = layout.config.groundDepth * 0.95;
  return {
    group,
    update: (elapsed) => {
      seeds.forEach((seed, index) => {
        const travel = (seed.x + (elapsed * seed.speed) / 18) % 1;
        positions[index * 3] = (travel - 0.5) * width;
        positions[index * 3 + 1] = seed.y + Math.sin(elapsed * 1.3 + index) * 0.25;
        positions[index * 3 + 2] = (seed.z - 0.5) * depth + Math.sin(travel * 9 + index) * 0.8;
      });
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

/** Vultures circling high above the dunes. */
function createVultures(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const birds: {
    holder: THREE.Group;
    wings: THREE.Mesh[];
    radius: number;
    speed: number;
    phase: number;
    height: number;
  }[] = [];
  for (let index = 0; index < 4; index += 1) {
    const holder = new THREE.Group();
    const body = new THREE.Mesh(
      kit.geometry("vulture-body", () => {
        const geometry = new THREE.ConeGeometry(0.14, 0.6, 5);
        geometry.rotateX(Math.PI / 2);
        return geometry;
      }),
      kit.flat("#4a3a34"),
    );
    const wings = [-1, 1].map((side) => {
      const wing = new THREE.Mesh(
        kit.geometry("vulture-wing", () => {
          const geometry = new THREE.BoxGeometry(1.0, 0.03, 0.34);
          geometry.translate(0.5, 0, 0);
          return geometry;
        }),
        kit.flat("#5a4840"),
      );
      wing.scale.x = side;
      holder.add(wing);
      return wing;
    });
    holder.add(body);
    group.add(holder);
    birds.push({
      holder,
      wings,
      radius: 14 + index * 4.5,
      speed: 0.07 + index * 0.01,
      phase: index * 1.7,
      height: 9 + (index % 2) * 2,
    });
  }
  return {
    group,
    update: (elapsed) => {
      for (const bird of birds) {
        const angle = elapsed * bird.speed + bird.phase;
        bird.holder.position.set(
          Math.cos(angle) * bird.radius * 1.2,
          bird.height + Math.sin(angle * 2) * 0.5,
          Math.sin(angle) * bird.radius * 0.85,
        );
        bird.holder.rotation.y = -angle + Math.PI / 2;
        const flap = Math.sin(elapsed * 3.2 + bird.phase) * 0.25;
        bird.wings[0].rotation.z = -flap;
        bird.wings[1].rotation.z = flap;
      }
    },
  };
}
