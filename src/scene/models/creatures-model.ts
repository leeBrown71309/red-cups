import * as THREE from "three";
import { jitterGeometry, type SceneKit } from "../scene-kit";

/**
 * The living things around the trays (patch 0.1.5): visitors, farm and polar
 * animals, birds and bats. Everything is built from a few rounded low-poly
 * parts, never from flat sheets, and every creature is a poseable group: a
 * `Mover` walks it along a path and calls `pose` with the stride.
 */

export interface Poseable {
  group: THREE.Group;
  /** `stride` grows with the distance walked, `moving` is 0 when standing still, `elapsed` is the clock. */
  pose: (stride: number, moving: number, elapsed: number) => void;
}

/** A slab with its pivot at the top, so a limb swings from its shoulder or hip. */
function limb(kit: SceneKit, key: string, radius: number, length: number, color: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    kit.geometry(key, () => new THREE.CylinderGeometry(radius, radius * 0.85, length, 6).translate(0, -length / 2, 0)),
    kit.flat(color),
  );
  mesh.raycast = () => undefined;
  return mesh;
}

function ball(kit: SceneKit, key: string, radius: number, color: string, detail = 1): THREE.Mesh {
  const mesh = new THREE.Mesh(
    kit.geometry(key, () => new THREE.IcosahedronGeometry(radius, detail)),
    kit.flat(color),
  );
  mesh.raycast = () => undefined;
  return mesh;
}

// ------------------------------------------------------------------ animals

/** Four short legs hanging from the belly; `swing` rotates diagonal pairs in opposite directions. */
function addLegs(
  kit: SceneKit,
  body: THREE.Group,
  options: { color: string; radius: number; length: number; x: number; frontZ: number; backZ: number; y: number },
): THREE.Mesh[] {
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [
    [-options.x, options.frontZ],
    [options.x, options.frontZ],
    [-options.x, options.backZ],
    [options.x, options.backZ],
  ]) {
    const leg = limb(kit, `leg-${options.radius}-${options.length}`, options.radius, options.length, options.color);
    leg.position.set(x, options.y, z);
    body.add(leg);
    legs.push(leg);
  }
  return legs;
}

function swingLegs(legs: THREE.Mesh[], stride: number, moving: number, speed = 5): void {
  const swing = Math.sin(stride * speed) * 0.6 * moving;
  legs[0].rotation.x = swing;
  legs[3].rotation.x = swing;
  legs[1].rotation.x = -swing;
  legs[2].rotation.x = -swing;
}

/** A woolly sheep: a cloud of wool, a dark face, and a head that bows to graze when it stops. */
export function createSheep(kit: SceneKit): Poseable {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const wool = new THREE.Mesh(
    kit.geometry("sheep-wool", () => jitterGeometry(new THREE.IcosahedronGeometry(0.5, 1), 0.12, 61)),
    kit.flat("#fbf6ee"),
  );
  wool.scale.set(0.9, 0.8, 1.2);
  wool.position.y = 0.72;
  body.add(wool);
  const head = new THREE.Group();
  head.position.set(0, 0.88, 0.55);
  const face = ball(kit, "sheep-face", 0.2, "#4a3a3a");
  face.scale.set(0.9, 1, 1.15);
  const ears = [-0.2, 0.2].map((x) => {
    const ear = ball(kit, "sheep-ear", 0.08, "#4a3a3a", 0);
    ear.scale.set(1.4, 0.6, 0.8);
    ear.position.set(x, 0.05, -0.04);
    return ear;
  });
  head.add(face, ...ears);
  body.add(head);
  const legs = addLegs(kit, body, {
    color: "#4a3a3a",
    radius: 0.05,
    length: 0.4,
    x: 0.2,
    frontZ: 0.35,
    backZ: -0.35,
    y: 0.42,
  });
  group.scale.setScalar(0.95);
  return {
    group,
    pose: (stride, moving, elapsed) => {
      swingLegs(legs, stride, moving);
      // Standing still, it grazes: the head bows and rises slowly.
      head.rotation.x = moving > 0.1 ? 0 : 0.55 + Math.sin(elapsed * 1.3) * 0.18;
      head.position.y = moving > 0.1 ? 0.88 : 0.74;
      body.position.y = Math.abs(Math.sin(stride * 5)) * 0.02 * moving;
    },
  };
}

/** A dog with a wagging tail: it trots beside its owners. */
export function createDog(kit: SceneKit, coat = "#c58a4e", spots = "#fff4e2"): Poseable {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const torso = ball(kit, `dog-torso-${coat}`, 0.3, coat);
  torso.scale.set(0.8, 0.75, 1.5);
  torso.position.y = 0.55;
  const chest = ball(kit, `dog-chest-${spots}`, 0.2, spots);
  chest.position.set(0, 0.5, 0.25);
  const head = ball(kit, `dog-head-${coat}`, 0.2, coat);
  head.position.set(0, 0.78, 0.55);
  const snout = ball(kit, `dog-snout-${spots}`, 0.11, spots, 0);
  snout.scale.set(1, 0.8, 1.3);
  snout.position.set(0, 0.72, 0.72);
  const nose = ball(kit, "dog-nose", 0.04, "#3a2530", 0);
  nose.position.set(0, 0.74, 0.84);
  const ears = [-0.14, 0.14].map((x) => {
    const ear = ball(kit, `dog-ear-${coat}`, 0.09, "#8a5a2c", 0);
    ear.scale.set(0.6, 1.2, 0.8);
    ear.position.set(x, 0.9, 0.5);
    return ear;
  });
  const tail = limb(kit, "dog-tail", 0.04, 0.35, coat);
  tail.position.set(0, 0.7, -0.42);
  tail.rotation.x = -2.2;
  body.add(torso, chest, head, snout, nose, ...ears, tail);
  const legs = addLegs(kit, body, {
    color: coat,
    radius: 0.06,
    length: 0.4,
    x: 0.14,
    frontZ: 0.3,
    backZ: -0.3,
    y: 0.42,
  });
  return {
    group,
    pose: (stride, moving, elapsed) => {
      swingLegs(legs, stride, moving, 7);
      tail.rotation.z = Math.sin(elapsed * 14) * 0.5;
      body.position.y = Math.abs(Math.sin(stride * 7)) * 0.04 * moving;
    },
  };
}

/** A rabbit that sits up and hops. */
export function createRabbit(kit: SceneKit): Poseable {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const torso = ball(kit, "rabbit-torso", 0.22, "#d9cbbd");
  torso.scale.set(0.9, 0.9, 1.3);
  torso.position.y = 0.26;
  const head = ball(kit, "rabbit-head", 0.14, "#d9cbbd");
  head.position.set(0, 0.42, 0.22);
  const ears = [-0.06, 0.06].map((x) => {
    const ear = ball(kit, "rabbit-ear", 0.06, "#e8dccf", 0);
    ear.scale.set(0.6, 2.4, 0.5);
    ear.position.set(x, 0.62, 0.18);
    return ear;
  });
  const tail = ball(kit, "rabbit-tail", 0.07, "#ffffff", 0);
  tail.position.set(0, 0.28, -0.3);
  body.add(torso, head, ...ears, tail);
  return {
    group,
    pose: (stride, moving) => {
      const hop = Math.abs(Math.sin(stride * 3));
      body.position.y = hop * 0.28 * moving;
      body.rotation.x = -Math.sin(stride * 3) * 0.3 * moving;
    },
  };
}

/** An arctic fox, white with a dark nose and a full tail. */
export function createFox(kit: SceneKit): Poseable {
  const dog = createDog(kit, "#f4f1ea", "#ffffff");
  dog.group.scale.setScalar(0.85);
  return dog;
}

/** A seal lying on the snow: it rears its head and shuffles now and then. */
export function createSeal(kit: SceneKit): Poseable {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const trunk = new THREE.Mesh(
    kit.geometry("seal-trunk", () => new THREE.SphereGeometry(0.45, 10, 8)),
    kit.flat("#8a9bb0"),
  );
  trunk.scale.set(0.8, 0.7, 2);
  trunk.position.y = 0.32;
  const belly = new THREE.Mesh(
    kit.geometry("seal-belly", () => new THREE.SphereGeometry(0.4, 8, 6)),
    kit.flat("#d8e2ee"),
  );
  belly.scale.set(0.75, 0.55, 1.8);
  belly.position.set(0, 0.24, 0.05);
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.82);
  const skull = ball(kit, "seal-head", 0.24, "#8a9bb0");
  const snout = ball(kit, "seal-snout", 0.12, "#d8e2ee", 0);
  snout.scale.set(1.2, 0.8, 1);
  snout.position.set(0, -0.04, 0.2);
  const nose = ball(kit, "seal-nose", 0.04, "#3a2530", 0);
  nose.position.set(0, 0, 0.3);
  const eyes = [-0.1, 0.1].map((x) => {
    const eye = ball(kit, "seal-eye", 0.035, "#1c1217", 0);
    eye.position.set(x, 0.07, 0.19);
    return eye;
  });
  head.add(skull, snout, nose, ...eyes);
  const flippers = [-1, 1].map((side) => {
    const flipper = ball(kit, "seal-flipper", 0.14, "#74869c", 0);
    flipper.scale.set(0.3, 0.12, 1.2);
    flipper.position.set(side * 0.34, 0.2, 0.4);
    return flipper;
  });
  const tail = ball(kit, "seal-tail", 0.12, "#74869c", 0);
  tail.scale.set(1.8, 0.3, 0.8);
  tail.position.set(0, 0.22, -0.88);
  body.add(trunk, belly, head, ...flippers, tail);
  return {
    group,
    pose: (_stride, _moving, elapsed) => {
      // Breathes, and every few seconds lifts its head to look around.
      body.scale.y = 1 + Math.sin(elapsed * 1.8) * 0.02;
      const look = Math.max(0, Math.sin(elapsed * 0.45));
      head.rotation.x = -look * 0.5;
      head.rotation.y = Math.sin(elapsed * 0.7) * 0.5 * look;
      head.position.y = 0.5 + look * 0.12;
    },
  };
}

/** A polar bear, slow and round, taking a walk far from the tray. */
export function createPolarBear(kit: SceneKit): Poseable {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const torso = ball(kit, "bear-torso", 0.6, "#fdfdfb");
  torso.scale.set(0.9, 0.85, 1.5);
  torso.position.y = 0.95;
  const head = new THREE.Group();
  head.position.set(0, 1.1, 1.0);
  const skull = ball(kit, "bear-head", 0.34, "#fdfdfb");
  const snout = ball(kit, "bear-snout", 0.18, "#f1ede4", 0);
  snout.scale.set(1, 0.8, 1.2);
  snout.position.set(0, -0.08, 0.3);
  const nose = ball(kit, "bear-nose", 0.06, "#2a1c22", 0);
  nose.position.set(0, -0.02, 0.5);
  const ears = [-0.22, 0.22].map((x) => {
    const ear = ball(kit, "bear-ear", 0.09, "#f1ede4", 0);
    ear.position.set(x, 0.3, -0.05);
    return ear;
  });
  const eyes = [-0.13, 0.13].map((x) => {
    const eye = ball(kit, "bear-eye", 0.04, "#1c1217", 0);
    eye.position.set(x, 0.1, 0.29);
    return eye;
  });
  head.add(skull, snout, nose, ...ears, ...eyes);
  body.add(torso, head);
  const legs = addLegs(kit, body, {
    color: "#f1ede4",
    radius: 0.16,
    length: 0.7,
    x: 0.32,
    frontZ: 0.6,
    backZ: -0.6,
    y: 0.78,
  });
  return {
    group,
    pose: (stride, moving) => {
      swingLegs(legs, stride, moving, 3);
      body.position.y = Math.abs(Math.sin(stride * 3)) * 0.04 * moving;
      head.rotation.y = Math.sin(stride * 1.5) * 0.2 * moving;
    },
  };
}

// -------------------------------------------------------------------- birds

type BirdKind = "gull" | "songbird" | "bat";

const BIRD_LOOKS: Record<BirdKind, { body: string; wing: string; tip: string; beak: string; size: number }> = {
  gull: { body: "#f8fbff", wing: "#e3ebf3", tip: "#4a5a6a", beak: "#ffb347", size: 1.1 },
  songbird: { body: "#ffb347", wing: "#7a5a3c", tip: "#5a3d28", beak: "#3a2530", size: 0.55 },
  bat: { body: "#2c2438", wing: "#3b3050", tip: "#241c30", beak: "#2c2438", size: 0.85 },
};

/** A wing as a thick, rounded feather, not a flat sheet. Built along +x from the shoulder. */
function createWingGeometry(kind: BirdKind): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  if (kind === "bat") {
    // Scalloped membrane between the fingers.
    shape.moveTo(0, 0.05);
    shape.quadraticCurveTo(0.35, 0.34, 0.95, 0.22);
    shape.quadraticCurveTo(0.72, 0.1, 0.8, -0.05);
    shape.quadraticCurveTo(0.55, 0.02, 0.5, -0.2);
    shape.quadraticCurveTo(0.28, -0.04, 0.12, -0.22);
    shape.quadraticCurveTo(0.06, -0.1, 0, 0.05);
  } else {
    shape.moveTo(0, 0.1);
    shape.bezierCurveTo(0.2, 0.26, 0.62, 0.3, 1, 0.08);
    shape.bezierCurveTo(0.86, 0.02, 0.9, -0.06, 0.66, -0.1);
    shape.bezierCurveTo(0.42, -0.16, 0.18, -0.2, 0, -0.14);
    shape.closePath();
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 6,
  });
  // Lay the wing flat: its outline in the x-z plane, its thickness upwards.
  geometry.rotateX(Math.PI / 2);
  // Centre the thickness on the wing plane so it flaps about its middle.
  geometry.translate(0, 0.02, 0);
  return geometry;
}

/** A bird with a body, a head, a beak, a tail and two jointed wings that beat. */
export function createBird(kit: SceneKit, kind: BirdKind): Poseable {
  const look = BIRD_LOOKS[kind];
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const torso = new THREE.Mesh(
    kit.geometry(`bird-torso-${kind}`, () => new THREE.SphereGeometry(0.22, 9, 7)),
    kit.flat(look.body),
  );
  torso.scale.set(0.8, 0.75, 1.5);
  const head = new THREE.Mesh(
    kit.geometry(`bird-head-${kind}`, () => new THREE.SphereGeometry(0.13, 8, 6)),
    kit.flat(look.body),
  );
  head.position.set(0, 0.1, 0.34);
  const beak = new THREE.Mesh(
    kit.geometry(`bird-beak-${kind}`, () =>
      new THREE.ConeGeometry(0.045, kind === "gull" ? 0.2 : 0.12, 5).rotateX(Math.PI / 2),
    ),
    kit.flat(look.beak),
  );
  beak.position.set(0, 0.08, 0.5);
  const eye = new THREE.Mesh(
    kit.geometry("bird-eye", () => new THREE.SphereGeometry(0.025, 5, 4)),
    kit.flat("#1c1217"),
  );
  const eyes = [-1, 1].map((side) => {
    const clone = eye.clone();
    clone.position.set(side * 0.1, 0.14, 0.4);
    return clone;
  });
  const tail = new THREE.Mesh(
    kit.geometry(`bird-tail-${kind}`, () => new THREE.BoxGeometry(0.2, 0.03, 0.3).translate(0, 0, -0.15)),
    kit.flat(look.tip),
  );
  tail.position.set(0, 0, -0.28);
  tail.rotation.x = 0.15;
  body.add(torso, head, beak, ...eyes, tail);

  const wingMaterial = new THREE.MeshStandardMaterial({ color: look.wing, flatShading: true, roughness: 0.86 });
  const tipMaterial = new THREE.MeshStandardMaterial({ color: look.tip, flatShading: true, roughness: 0.86 });
  const wingGeometry = kit.geometry(`bird-wing-${kind}`, () => createWingGeometry(kind));
  const wings = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.12, 0.08, 0.02);
    const inner = new THREE.Mesh(wingGeometry, wingMaterial);
    inner.scale.set(side * 0.5, 1, 1.05);
    const hinge = new THREE.Group();
    hinge.position.x = side * 0.5;
    const outer = new THREE.Mesh(wingGeometry, tipMaterial);
    outer.scale.set(side * 0.46, 1, 0.8);
    // Mirrored geometry flips its faces: both sides must be visible.
    wingMaterial.side = THREE.DoubleSide;
    tipMaterial.side = THREE.DoubleSide;
    hinge.add(outer);
    shoulder.add(inner, hinge);
    body.add(shoulder);
    return { shoulder, hinge, side };
  });

  group.scale.setScalar(look.size);
  const flapRate = kind === "songbird" ? 16 : kind === "bat" ? 11 : 3.2;
  return {
    group,
    pose: (_stride, _moving, elapsed) => {
      // Gulls beat their wings for a while, then glide with them spread; small birds never stop.
      const glide = kind === "gull" ? Math.min(1, Math.max(0, Math.sin(elapsed * 0.5) * 3 + 1.2)) : 1;
      const beat = Math.sin(elapsed * flapRate) * glide;
      const lift = kind === "gull" ? 0.4 : 0.7;
      for (const wing of wings) {
        wing.shoulder.rotation.z = wing.side * (beat * lift + (1 - glide) * 0.1);
        // The tip lags behind the shoulder: that is what makes a beat look like a beat.
        wing.hinge.rotation.z = wing.side * Math.sin(elapsed * flapRate - 0.6) * 0.3 * glide;
      }
      body.position.y = Math.cos(elapsed * flapRate) * 0.03 * glide;
    },
  };
}

// ------------------------------------------------------------------- movers

/** Walks a poseable along a path: a closed loop, or back and forth with a rest at each end. */
export class Mover {
  private readonly lengths: number[] = [];
  private readonly total: number;
  private distance: number;
  private direction = 1;
  private rest = 0;
  private stride = 0;
  private moving = 0;
  private readonly forward = new THREE.Vector3();

  constructor(
    private readonly creature: Poseable,
    private readonly points: THREE.Vector3[],
    private readonly options: { speed: number; closed: boolean; start: number; restSeconds?: number; lift?: number },
  ) {
    let sum = 0;
    const count = options.closed ? points.length : points.length - 1;
    for (let index = 0; index < count; index += 1) {
      const segment = points[index].distanceTo(points[(index + 1) % points.length]);
      this.lengths.push(segment);
      sum += segment;
    }
    this.total = sum;
    this.distance = options.start * sum;
    this.place();
  }

  update(elapsed: number, delta: number): void {
    const { speed, closed, restSeconds = 0 } = this.options;
    if (this.rest > 0) {
      this.rest -= delta;
      this.moving = Math.max(0, this.moving - delta * 4);
    } else {
      this.moving = Math.min(1, this.moving + delta * 4);
      this.distance += speed * delta * this.direction * this.moving;
      this.stride += speed * delta * this.moving;
      if (closed) {
        this.distance = ((this.distance % this.total) + this.total) % this.total;
      } else if (this.distance > this.total || this.distance < 0) {
        this.distance = THREE.MathUtils.clamp(this.distance, 0, this.total);
        this.direction *= -1;
        this.rest = restSeconds;
      }
    }
    this.place();
    this.creature.pose(this.stride, this.moving, elapsed);
  }

  private place(): void {
    let remaining = this.distance;
    let index = 0;
    while (index < this.lengths.length - 1 && remaining > this.lengths[index]) {
      remaining -= this.lengths[index];
      index += 1;
    }
    const from = this.points[index];
    const to = this.points[(index + 1) % this.points.length];
    const t = this.lengths[index] > 0 ? remaining / this.lengths[index] : 0;
    this.creature.group.position.lerpVectors(from, to, t);
    this.creature.group.position.y += this.options.lift ?? 0;
    this.forward.subVectors(to, from).multiplyScalar(this.direction);
    if (this.forward.lengthSq() > 1e-6) this.creature.group.rotation.y = Math.atan2(this.forward.x, this.forward.z);
  }
}

/** Flies a bird in a wide, tilted circle, banking into the turn. */
export function circleFlight(
  creature: Poseable,
  options: { center: THREE.Vector3; radius: number; height: number; speed: number; phase: number; squash?: number },
): (elapsed: number) => void {
  return (elapsed) => {
    const angle = elapsed * options.speed + options.phase;
    const squash = options.squash ?? 0.6;
    creature.group.position.set(
      options.center.x + Math.cos(angle) * options.radius,
      options.height + Math.sin(angle * 2.1) * 0.5,
      options.center.z + Math.sin(angle) * options.radius * squash,
    );
    creature.group.rotation.y = -angle;
    creature.group.rotation.z = -0.25;
    creature.pose(0, 0, elapsed + options.phase);
  };
}
