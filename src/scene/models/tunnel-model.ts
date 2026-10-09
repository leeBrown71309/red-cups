import * as THREE from "three";
import { createRandom, easeInCubic, easeOutBack, jitterGeometry, phase, type SceneKit } from "../scene-kit";

/** Where one end of the tunnel opens, and how high the tile it opens on stands. */
export interface TunnelEnd {
  x: number;
  z: number;
}

export interface TunnelPropOptions {
  a: TunnelEnd;
  b: TunnelEnd;
  /** Height of whatever the ridge rests on at (x, z): the top of a tile, or the ground between them. */
  surfaceY: (x: number, z: number) => number;
  /** Whether something stands where the ridge would run (Hell's pit, the carousel): it goes under it, unseen. */
  isBlocked?: (x: number, z: number) => boolean;
}

/** A tunnel on the board: two mouths linked by a ridge of loose soil, dug in, crossed, then caved in. */
export interface TunnelProp {
  group: THREE.Group;
  /** The dig: the mouths open and the ridge rises from the first end to the second. */
  dig: () => void;
  /** Shows the tunnel already dug, without the dig (a restored game, a tunnel nobody saw dug). */
  reveal: () => void;
  /** Something crosses it: a bump of soil runs under the ridge from one end to the other. */
  cross: (towardB: boolean) => void;
  /** Caves in: the ridge sinks lump by lump, the mouths fill up. */
  collapse: () => void;
  /** Whether it has been dug (or revealed) and not yet caved in. */
  isOpen: () => boolean;
  /** Whether the cave-in is over: the world may drop the prop. */
  isGone: () => boolean;
  update: (elapsed: number, delta: number) => void;
  dispose: () => void;
}

const SOIL_COLORS = ["#8a5a3c", "#76492d", "#9a6a46", "#6b4128", "#a67852"];
const RIDGE_SPACING = 0.4;
/** The ridge stops this far from each tile centre, where the mouth's own mound takes over. */
const MOUTH_CLEARANCE = 0.74;
const MOUTH_LUMPS = 8;
const MOUTH_RADIUS = 0.52;
const HOLE_RADIUS = 0.36;
const OUTLINE_SCALE = 1.16;
/** How long a lump takes to pop up, and how long the dig takes to sweep from one mouth to the other. */
const LUMP_POP_SECONDS = 0.2;
const DIG_SWEEP_START = 0.22;
const DIG_SWEEP_SECONDS = 0.5;
const COLLAPSE_SECONDS = 0.9;
const BUMP_SECONDS = 0.7;
/** How tall and how wide the bump under the ridge is, in world units. */
const BUMP_HEIGHT = 0.3;
const BUMP_REACH = 0.55;

interface Lump {
  x: number;
  y: number;
  z: number;
  scale: THREE.Vector3;
  yaw: number;
  /** How far along the tunnel (0 at the first mouth, 1 at the second) the lump lies. */
  along: number;
  /** When, in the dig, it pops up. */
  appearAt: number;
  /** When, in the cave-in, it starts to sink. */
  collapseAt: number;
}

interface Bump {
  start: number;
  /** Runs from the second mouth to the first. */
  reverse: boolean;
}

export function createTunnelProp(kit: SceneKit, options: TunnelPropOptions): TunnelProp {
  const { a, b, surfaceY, isBlocked } = options;
  const group = new THREE.Group();
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const direction = new THREE.Vector2((b.x - a.x) / length, (b.z - a.z) / length);
  const side = new THREE.Vector2(-direction.y, direction.x);
  const random = createRandom(Math.round(a.x * 31 + a.z * 17 + b.x * 13 + b.z * 7 + 101));

  const lumps: Lump[] = [];
  const addLump = (x: number, z: number, along: number, size: number, flat: number, appearAt: number) => {
    const scale = new THREE.Vector3(size * (0.9 + random() * 0.3), size * flat, size * (0.9 + random() * 0.3));
    // The lump rests on whatever lies under it, a tile top or the ground, half sunk in.
    lumps.push({
      x,
      y: surfaceY(x, z) + scale.y * 0.35,
      z,
      scale,
      yaw: random() * Math.PI,
      along,
      appearAt,
      collapseAt: 0.04 + random() * 0.28 + along * 0.16,
    });
  };

  // The ridge: lumps along the straight line between the mouths, in a loose, wandering row.
  const ridgeLength = Math.max(0, length - MOUTH_CLEARANCE * 2);
  const ridgeCount = Math.max(1, Math.round(ridgeLength / RIDGE_SPACING));
  for (let index = 0; index <= ridgeCount; index += 1) {
    const distance = MOUTH_CLEARANCE + (ridgeLength * index) / ridgeCount;
    const along = distance / length;
    const wander = (random() - 0.5) * 0.2;
    const x = a.x + direction.x * distance + side.x * wander;
    const z = a.z + direction.y * distance + side.y * wander;
    if (isBlocked?.(x, z)) continue;
    const size = 0.2 + random() * 0.1;
    addLump(x, z, along, size, 0.62 + random() * 0.2, DIG_SWEEP_START + along * DIG_SWEEP_SECONDS);
  }

  // The mouths: a crown of mounds around each hole.
  for (const [end, along, appearAt] of [
    [a, 0, 0.06],
    [b, 1, DIG_SWEEP_START + DIG_SWEEP_SECONDS - 0.02],
  ] as const) {
    for (let index = 0; index < MOUTH_LUMPS; index += 1) {
      const angle = (index / MOUTH_LUMPS) * Math.PI * 2 + random() * 0.3;
      const reach = MOUTH_RADIUS * (0.92 + random() * 0.2);
      addLump(
        end.x + Math.cos(angle) * reach,
        end.z + Math.sin(angle) * reach,
        along,
        0.22 + random() * 0.08,
        0.7 + random() * 0.2,
        appearAt + index * 0.015,
      );
    }
  }

  const geometry = kit.geometry("tunnel-lump", () => jitterGeometry(new THREE.IcosahedronGeometry(1, 1), 0.14, 31));
  const lumpMesh = new THREE.InstancedMesh(geometry, kit.flat("#ffffff"), lumps.length);
  lumpMesh.castShadow = true;
  lumpMesh.receiveShadow = true;
  lumpMesh.frustumCulled = false;
  lumpMesh.raycast = () => undefined;
  const outlineMesh = new THREE.InstancedMesh(geometry, kit.outline(), lumps.length);
  outlineMesh.frustumCulled = false;
  outlineMesh.raycast = () => undefined;
  const palette = SOIL_COLORS.map((color) => new THREE.Color(color));
  lumps.forEach((_, index) => lumpMesh.setColorAt(index, palette[Math.floor(random() * palette.length)]));
  group.add(outlineMesh, lumpMesh);

  // The holes: a black pit with a faint warm rim, which reads even on the night fair's dark tiles.
  const holeGeometry = kit.geometry("tunnel-hole", () => new THREE.CircleGeometry(HOLE_RADIUS, 18));
  const rimGeometry = kit.geometry(
    "tunnel-hole-rim",
    () => new THREE.RingGeometry(HOLE_RADIUS - 0.02, HOLE_RADIUS + 0.09, 18),
  );
  const holeMaterial = kit.unlit("#100703");
  const rimMaterial = kit.glow("#ffb36b", 0.4);
  const holes = [a, b].map((end) => {
    const hole = new THREE.Group();
    hole.position.set(end.x, surfaceY(end.x, end.z) + 0.035, end.z);
    const pit = new THREE.Mesh(holeGeometry, holeMaterial);
    pit.rotation.x = -Math.PI / 2;
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.004;
    pit.raycast = () => undefined;
    rim.raycast = () => undefined;
    hole.add(pit, rim);
    hole.scale.setScalar(0.001);
    group.add(hole);
    return hole;
  });

  let age = 0;
  /** When the dig began (a very long time ago for a tunnel shown already dug); null while it has not. */
  let digStart: number | null = null;
  let collapseStart: number | null = null;
  const bumps: Bump[] = [];
  group.visible = false;

  const matrix = new THREE.Matrix4();
  const outlineMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  /** How much of the soil is up, 0 to 1, for a moment of the dig. */
  const appearance = (lump: Lump): number => {
    if (digStart === null) return 0;
    return easeOutBack(phase(age - digStart, lump.appearAt, lump.appearAt + LUMP_POP_SECONDS));
  };

  /** How much a bump running along the tunnel lifts the lump, 0 to 1. */
  const bumpLift = (lump: Lump): number => {
    let lift = 0;
    for (const bump of bumps) {
      const progress = (age - bump.start) / BUMP_SECONDS;
      if (progress < 0 || progress > 1) continue;
      const head = bump.reverse ? 1 - progress : progress;
      // Beyond the tunnel's ends the bump is still felt a little, so the mouths heave as it leaves and arrives.
      const gap = ((lump.along - (-0.1 + head * 1.2)) * length) / BUMP_REACH;
      lift = Math.max(lift, Math.exp(-gap * gap) * Math.sin(progress * Math.PI) ** 0.5);
    }
    return lift;
  };

  return {
    group,
    dig: () => {
      if (digStart !== null) return;
      digStart = age;
      group.visible = true;
      // The mole runs underground from the first mouth to the second: the dig and its bump sweep together.
      bumps.push({ start: age + DIG_SWEEP_START * 0.6, reverse: false });
    },
    reveal: () => {
      if (digStart !== null) return;
      digStart = age - 10;
      group.visible = true;
    },
    cross: (towardB) => {
      if (digStart === null || collapseStart !== null) return;
      bumps.push({ start: age, reverse: !towardB });
    },
    collapse: () => {
      if (collapseStart !== null) return;
      if (digStart === null) digStart = age - 10;
      collapseStart = age;
      group.visible = true;
    },
    isOpen: () => digStart !== null && collapseStart === null,
    isGone: () => collapseStart !== null && age - collapseStart > COLLAPSE_SECONDS + 0.5,
    update: (_elapsed, delta) => {
      age += delta;
      if (digStart === null || !group.visible) return;
      const sinceCollapse = collapseStart === null ? null : age - collapseStart;
      if (sinceCollapse !== null && sinceCollapse > COLLAPSE_SECONDS + 0.4) {
        group.visible = false;
        return;
      }
      for (let index = bumps.length - 1; index >= 0; index -= 1) {
        if (age - bumps[index].start > BUMP_SECONDS) bumps.splice(index, 1);
      }

      lumps.forEach((lump, index) => {
        const sunk =
          sinceCollapse === null ? 0 : easeInCubic(phase(sinceCollapse, lump.collapseAt, lump.collapseAt + 0.45));
        const size = Math.max(0.001, appearance(lump) * (1 - sunk));
        const lift = bumpLift(lump);
        position.set(lump.x, lump.y + lift * BUMP_HEIGHT - sunk * 0.18, lump.z);
        scale.set(lump.scale.x * size, lump.scale.y * size * (1 + lift * 0.5), lump.scale.z * size);
        quaternion.setFromAxisAngle(up, lump.yaw);
        matrix.compose(position, quaternion, scale);
        lumpMesh.setMatrixAt(index, matrix);
        outlineMatrix.compose(position, quaternion, scale.multiplyScalar(OUTLINE_SCALE));
        outlineMesh.setMatrixAt(index, outlineMatrix);
      });
      lumpMesh.instanceMatrix.needsUpdate = true;
      outlineMesh.instanceMatrix.needsUpdate = true;

      holes.forEach((hole, index) => {
        const opensAt = index === 0 ? 0.04 : DIG_SWEEP_START + DIG_SWEEP_SECONDS - 0.04;
        const open = digStart === null ? 0 : easeOutBack(phase(age - digStart, opensAt, opensAt + 0.25));
        const filled = sinceCollapse === null ? 0 : easeInCubic(phase(sinceCollapse, 0.35, 0.8));
        hole.scale.setScalar(Math.max(0.001, open * (1 - filled)));
      });
    },
    dispose: () => {
      lumpMesh.dispose();
      outlineMesh.dispose();
    },
  };
}
