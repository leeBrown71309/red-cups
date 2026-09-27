import * as THREE from "three";
import type { BoardLayout } from "../board-layout";
import { addOutline, createRandom, jitterGeometry, type SceneKit } from "../scene-kit";
import type { AnimatedProp } from "./props-model";
import type { TrayColors } from "./scenery-model";

/** Painted-wood tray around dark cobbles: the night fair keeps the board-game box, at night. */
export const NIGHT_FAIR_TRAY: TrayColors = {
  ground: "#2b3063",
  rim: "#4b2a6b",
  base: "#2d2250",
};

const BULB_COLORS = ["#ffd166", "#ff4fa3", "#3fe0ff", "#ffffff"];
const BALLOON_COLORS = ["#ff4fa3", "#3fe0ff", "#ffd166", "#7dffb2", "#c86bff"];

interface GarlandSpan {
  from: THREE.Vector3;
  to: THREE.Vector3;
}

/**
 * Everything around the tiles at Luna Park: garlands of bulbs on poles along
 * the back and the sides, a Ferris wheel and a big top behind the board, lamp
 * posts, balloons and confetti. Tall props only stand behind or beside the
 * board so they never hide a tile from the camera.
 */
export function createNightFairScenery(kit: SceneKit, layout: BoardLayout): AnimatedProp {
  const group = new THREE.Group();
  const animated: AnimatedProp[] = [];
  const back = -layout.halfDepth + 0.55;
  const side = layout.halfWidth - 0.5;

  const wheel = createFerrisWheel(kit);
  wheel.group.position.set(-4.9, 0, back - 0.1);
  group.add(wheel.group);
  animated.push(wheel);

  const bigTop = createBigTop(kit);
  bigTop.position.set(5.2, 0, back + 0.35);
  group.add(bigTop);

  const garlandPoles = [
    new THREE.Vector3(-side, 0, back),
    new THREE.Vector3(-8.1, 0, back),
    new THREE.Vector3(-1.6, 0, back),
    new THREE.Vector3(2.4, 0, back),
    new THREE.Vector3(8.1, 0, back),
    new THREE.Vector3(side, 0, back),
    new THREE.Vector3(-side, 0, -2.6),
    new THREE.Vector3(side, 0, -2.6),
    new THREE.Vector3(-side, 0, 2.8),
    new THREE.Vector3(side, 0, 2.8),
  ];
  const spans: GarlandSpan[] = [
    ...garlandPoles.slice(0, 6).flatMap((pole, index, row) => (index > 0 ? [{ from: row[index - 1], to: pole }] : [])),
    { from: garlandPoles[0], to: garlandPoles[6] },
    { from: garlandPoles[6], to: garlandPoles[8] },
    { from: garlandPoles[5], to: garlandPoles[7] },
    { from: garlandPoles[7], to: garlandPoles[9] },
  ];
  for (const pole of garlandPoles) group.add(createPole(kit, pole));
  const garlands = createGarlands(kit, spans);
  group.add(garlands.group);
  animated.push(garlands);

  const lampSpots = [
    new THREE.Vector3(-side + 0.2, 0, 6.6),
    new THREE.Vector3(side - 0.2, 0, -6.1),
    new THREE.Vector3(-4.9, 0, layout.halfDepth - 0.7),
    new THREE.Vector3(4.9, 0, layout.halfDepth - 0.7),
  ];
  lampSpots.forEach((spot, index) => {
    if (!layout.isAreaFree(spot.x, spot.z, -0.4)) return;
    // Only two lamps cast real light: point lights are costly on phones.
    group.add(createLampPost(kit, spot, index < 2));
  });

  const balloonSpots = [
    new THREE.Vector3(-6.5, 0, 3.4),
    new THREE.Vector3(6.6, 0, -3.1),
    new THREE.Vector3(-6.3, 0, -3.3),
    new THREE.Vector3(6.4, 0, 3.6),
  ];
  balloonSpots.forEach((spot, index) => {
    if (!layout.isAreaFree(spot.x, spot.z, 0)) return;
    const balloons = createBalloons(kit, 60 + index);
    balloons.group.position.copy(spot);
    group.add(balloons.group);
    animated.push(balloons);
  });

  group.add(createConfetti(kit, layout));

  return {
    group,
    update: (elapsed, delta) => {
      for (const prop of animated) prop.update(elapsed, delta);
    },
  };
}

function createPole(kit: SceneKit, at: THREE.Vector3): THREE.Group {
  const pole = new THREE.Group();
  pole.position.copy(at);
  const shaft = new THREE.Mesh(
    kit.geometry("garland-pole", () => new THREE.CylinderGeometry(0.06, 0.08, 2.6, 5)),
    kit.flat("#6b4a8f"),
  );
  shaft.position.y = 1.3;
  shaft.castShadow = true;
  addOutline(shaft, kit, 1.2);
  pole.add(shaft);
  const cap = new THREE.Mesh(
    kit.geometry("garland-cap", () => new THREE.IcosahedronGeometry(0.12, 0)),
    kit.flat("#ffd166"),
  );
  cap.position.y = 2.66;
  pole.add(cap);
  return pole;
}

/** Bulbs hang in a sag between poles; a few blink at a time, like old fairground lights. */
function createGarlands(kit: SceneKit, spans: GarlandSpan[]): AnimatedProp {
  const group = new THREE.Group();
  const points: THREE.Vector3[] = [];
  const wireMaterial = new THREE.LineBasicMaterial({ color: "#1b1f3b" });

  for (const span of spans) {
    const length = span.from.distanceTo(span.to);
    const count = Math.max(4, Math.round(length / 0.55));
    const wire: THREE.Vector3[] = [];
    for (let index = 0; index <= count; index += 1) {
      const progress = index / count;
      const point = span.from.clone().lerp(span.to, progress);
      point.y = 2.55 - Math.sin(progress * Math.PI) * Math.min(0.8, length * 0.09);
      wire.push(point);
      if (index > 0 && index < count) points.push(point);
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), wireMaterial));
  }

  const bulbs = new THREE.InstancedMesh(
    kit.geometry("fair-bulb", () => new THREE.IcosahedronGeometry(0.07, 0)),
    new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    points.length,
  );
  const matrix = new THREE.Matrix4();
  const baseColors = points.map((_, index) => new THREE.Color(BULB_COLORS[index % BULB_COLORS.length]));
  const dim = new THREE.Color("#3a3f73");
  points.forEach((point, index) => {
    matrix.makeTranslation(point.x, point.y - 0.08, point.z);
    bulbs.setMatrixAt(index, matrix);
    bulbs.setColorAt(index, baseColors[index]);
  });
  group.add(bulbs);

  let lastTwinkle = 0;
  const color = new THREE.Color();
  return {
    group,
    update: (elapsed) => {
      if (elapsed - lastTwinkle < 0.12) return;
      lastTwinkle = elapsed;
      baseColors.forEach((base, index) => {
        const off = Math.sin(elapsed * 1.7 + index * 2.3) > 0.93;
        bulbs.setColorAt(index, off ? color.copy(base).lerp(dim, 0.75) : base);
      });
      if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
    },
  };
}

function createLampPost(kit: SceneKit, at: THREE.Vector3, castsLight: boolean): THREE.Group {
  const lamp = new THREE.Group();
  lamp.position.copy(at);
  const shaft = new THREE.Mesh(
    kit.geometry("lamp-shaft", () => new THREE.CylinderGeometry(0.07, 0.1, 2.1, 6)),
    kit.flat("#1b1f3b"),
  );
  shaft.position.y = 1.05;
  shaft.castShadow = true;
  addOutline(shaft, kit, 1.2);
  lamp.add(shaft);
  const globe = new THREE.Mesh(
    kit.geometry("lamp-globe", () => new THREE.IcosahedronGeometry(0.24, 1)),
    kit.unlit("#ffe3a1"),
  );
  globe.position.y = 2.25;
  lamp.add(globe);
  if (castsLight) {
    const light = new THREE.PointLight("#ffcf7a", 9, 9, 1.8);
    light.position.y = 2.2;
    lamp.add(light);
  }
  return lamp;
}

/** Ferris wheel standing behind the board; its cabins stay level while it turns. */
function createFerrisWheel(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const frame = kit.flat("#8d95e8");
  const hubHeight = 2.9;
  const radius = 2.1;

  for (const leg of [-1, 1]) {
    for (const depth of [-0.32, 0.32]) {
      const beam = new THREE.Mesh(
        kit.geometry("wheel-leg", () => new THREE.CylinderGeometry(0.06, 0.08, 3.2, 5)),
        frame,
      );
      beam.position.set(leg * 0.75, 1.45, depth);
      beam.rotation.z = leg * 0.27;
      beam.castShadow = true;
      group.add(beam);
    }
  }

  const wheel = new THREE.Group();
  wheel.position.y = hubHeight;
  group.add(wheel);

  const rim = new THREE.Mesh(
    kit.geometry("wheel-rim", () => new THREE.TorusGeometry(radius, 0.06, 4, 28)),
    kit.flat("#c9d6ff"),
  );
  wheel.add(rim);
  const spokeCount = 8;
  for (let index = 0; index < spokeCount; index += 1) {
    const spoke = new THREE.Mesh(
      kit.geometry("wheel-spoke", () => new THREE.CylinderGeometry(0.025, 0.025, radius * 2, 4)),
      frame,
    );
    spoke.rotation.z = (index / spokeCount) * Math.PI;
    wheel.add(spoke);
  }
  const bulbs = new THREE.Group();
  for (let index = 0; index < 24; index += 1) {
    const angle = (index / 24) * Math.PI * 2;
    const bulb = new THREE.Mesh(
      kit.geometry("fair-bulb", () => new THREE.IcosahedronGeometry(0.07, 0)),
      kit.unlit(BULB_COLORS[index % 3]),
    );
    bulb.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.08);
    bulbs.add(bulb);
  }
  wheel.add(bulbs);

  const cabins: THREE.Mesh[] = [];
  for (let index = 0; index < spokeCount; index += 1) {
    const cabin = new THREE.Mesh(
      kit.geometry("wheel-cabin", () => new THREE.BoxGeometry(0.42, 0.34, 0.42)),
      kit.flat(BALLOON_COLORS[index % BALLOON_COLORS.length]),
    );
    cabin.castShadow = true;
    addOutline(cabin, kit, 1.08);
    group.add(cabin);
    cabins.push(cabin);
  }

  return {
    group,
    update: (elapsed) => {
      const turn = elapsed * 0.18;
      wheel.rotation.z = turn;
      cabins.forEach((cabin, index) => {
        const angle = turn + (index / spokeCount) * Math.PI * 2;
        cabin.position.set(Math.cos(angle) * radius, hubHeight + Math.sin(angle) * radius - 0.22, 0);
      });
    },
  };
}

/** Striped circus tent behind the top row. */
function createBigTop(kit: SceneKit): THREE.Group {
  const tent = new THREE.Group();
  const body = new THREE.Mesh(
    kit.geometry("big-top-body", () => new THREE.CylinderGeometry(1.25, 1.3, 1.1, 12)),
    kit.flat("#f4f1ff"),
  );
  body.position.y = 0.55;
  body.castShadow = true;
  addOutline(body, kit, 1.03);
  tent.add(body);

  const slices = 12;
  for (let slice = 0; slice < slices; slice += 1) {
    const wedge = new THREE.Mesh(
      kit.geometry(
        `big-top-roof-${slice}`,
        () => new THREE.ConeGeometry(1.45, 1.2, 2, 1, false, (slice / slices) * Math.PI * 2, (Math.PI * 2) / slices),
      ),
      kit.flat(slice % 2 === 0 ? "#ff4fa3" : "#f4f1ff"),
    );
    wedge.position.y = 1.7;
    wedge.castShadow = true;
    tent.add(wedge);
  }

  const flag = new THREE.Mesh(
    kit.geometry("big-top-flag", () => new THREE.ConeGeometry(0.16, 0.34, 3)),
    kit.flat("#ffd166"),
  );
  flag.rotation.z = -Math.PI / 2;
  flag.position.set(0.17, 2.5, 0);
  tent.add(flag);

  const doorway = new THREE.Mesh(
    kit.geometry("big-top-door", () => new THREE.PlaneGeometry(0.55, 0.8)),
    kit.unlit("#1b1f3b"),
  );
  doorway.position.set(0, 0.4, 1.31);
  tent.add(doorway);
  return tent;
}

function createBalloons(kit: SceneKit, seed: number): AnimatedProp {
  const group = new THREE.Group();
  const random = createRandom(seed);
  const balloons: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];

  const weight = new THREE.Mesh(
    kit.geometry("balloon-weight", () => new THREE.BoxGeometry(0.22, 0.14, 0.22)),
    kit.flat("#6b4a8f"),
  );
  weight.position.y = 0.07;
  group.add(weight);

  for (let index = 0; index < 3; index += 1) {
    const offset = new THREE.Vector3((random() - 0.5) * 0.5, 0, (random() - 0.5) * 0.5);
    const baseY = 1.25 + random() * 0.45;
    const balloon = new THREE.Mesh(
      kit.geometry("balloon", () => jitterGeometry(new THREE.SphereGeometry(0.22, 8, 6), 0.02, 4)),
      kit.flat(BALLOON_COLORS[(seed + index) % BALLOON_COLORS.length]),
    );
    balloon.scale.set(1, 1.18, 1);
    balloon.position.set(offset.x, baseY, offset.z);
    balloon.castShadow = true;
    group.add(balloon);

    const string = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.14, 0),
        new THREE.Vector3(offset.x, baseY, offset.z),
      ]),
      new THREE.LineBasicMaterial({ color: "#c9d6ff" }),
    );
    group.add(string);
    balloons.push({ mesh: balloon, baseY, phase: random() * Math.PI * 2 });
  }

  return {
    group,
    update: (elapsed) => {
      for (const balloon of balloons) {
        balloon.mesh.position.y = balloon.baseY + Math.sin(elapsed * 1.3 + balloon.phase) * 0.06;
      }
    },
  };
}

/** Confetti and popcorn on the cobbles, kept off the roads and the tiles. */
function createConfetti(kit: SceneKit, layout: BoardLayout): THREE.InstancedMesh {
  const random = createRandom(4242);
  const confetti = new THREE.InstancedMesh(
    kit.geometry("confetti", () => new THREE.PlaneGeometry(0.12, 0.08)),
    new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide }),
    140,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const color = new THREE.Color();
  let count = 0;
  for (let attempt = 0; attempt < 2_500 && count < confetti.count; attempt += 1) {
    const x = (random() * 2 - 1) * (layout.halfWidth - 0.8);
    const z = (random() * 2 - 1) * (layout.halfDepth - 0.8);
    if (!layout.isAreaFree(x, z, -0.55)) continue;
    quaternion.setFromEuler(euler.set(-Math.PI / 2, 0, random() * Math.PI));
    matrix.compose(new THREE.Vector3(x, 0.02, z), quaternion, new THREE.Vector3(1, 1, 1));
    confetti.setMatrixAt(count, matrix);
    confetti.setColorAt(count, color.set(BALLOON_COLORS[count % BALLOON_COLORS.length]).multiplyScalar(0.55));
    count += 1;
  }
  confetti.count = count;
  confetti.instanceMatrix.needsUpdate = true;
  if (confetti.instanceColor) confetti.instanceColor.needsUpdate = true;
  return confetti;
}
