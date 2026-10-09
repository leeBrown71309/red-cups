import * as THREE from "three";
import { easeOutBack, easeOutCubic, phase, type SceneKit } from "../scene-kit";

/** A glowing pentagram laid flat on a tile: the mark of a Mage noir, seen by the whole table. */
export interface MarkProp {
  /** Its origin is the tile's top: it is laid on the tile's `surface` group. */
  group: THREE.Group;
  /** Draws itself: the ring and the five strokes of the star sweep out in turn. */
  draw: () => void;
  /** Shows it complete at once (a restored game, a mark nobody saw drawn). */
  reveal: () => void;
  /** Flares up bright for a moment: the mage steps out of it. */
  flash: () => void;
  /** Burns out, after `delaySeconds`. */
  burnOut: (delaySeconds?: number) => void;
  isDying: () => boolean;
  /** Whether it has burnt out and the world may drop it. */
  isGone: () => boolean;
  update: (elapsed: number, delta: number) => void;
  dispose: () => void;
}

export interface MarkPropOptions {
  /** The owner's colour: the little runes and the inner ring wear it. */
  ownerColor: string;
  /** Radius of the outer ring, in world units. */
  radius?: number;
}

const RING_SEGMENTS = 72;
const STAR_VERTICES = 5;
const RING_COLOR = "#c44bff";
const STAR_COLOR = "#ff3b6b";
const GLOW_COLOR = "#8a2bd6";
const EMBER_COUNT = 6;
const EMBER_COLORS = ["#ff7a9a", "#d38bff"];
const BURN_SECONDS = 0.6;
/** The sweep of the drawing, in seconds: the outer ring, then the strokes of the star one after the other. */
const RING_DRAW_SECONDS = 0.35;
const STROKE_START = 0.2;
const STROKE_GAP = 0.11;
const STROKE_SECONDS = 0.2;
const INNER_RING_START = 0.5;
const RUNES_START = 0.8;
const DRAWN_SECONDS = 1.1;
/** Above the tile's painted number, which sits 0.012 over the top. */
const LIFT = 0.025;

export function createMarkProp(kit: SceneKit, options: MarkPropOptions): MarkProp {
  const radius = options.radius ?? 0.88;
  const group = new THREE.Group();
  group.position.y = LIFT;

  // Each mark owns its materials (they fade and flare on their own); the geometry is shared, except the rings'.
  const ownMaterial = (color: string, opacity: number): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  const ringMaterial = ownMaterial(RING_COLOR, 0.95);
  const starMaterial = ownMaterial(STAR_COLOR, 0.95);
  const accentMaterial = ownMaterial(options.ownerColor, 0.9);
  const glowMaterial = ownMaterial(GLOW_COLOR, 0.55);
  glowMaterial.map = kit.texture("mark-glow", paintGlowTexture);
  const materials = [ringMaterial, starMaterial, accentMaterial, glowMaterial];
  const baseOpacities = materials.map((material) => material.opacity);
  const ordered = <T extends THREE.Object3D>(object: T): T => {
    // Drawn after the tile's number, which is also laid flat on the tile.
    object.renderOrder = 3;
    object.raycast = () => undefined;
    return object;
  };

  const glow = ordered(
    new THREE.Mesh(
      kit.geometry(`mark-glow-${radius}`, () => new THREE.CircleGeometry(radius * 1.25, 28)),
      glowMaterial,
    ),
  );
  glow.rotation.x = -Math.PI / 2;
  group.add(glow);

  // Rings are drawn by a growing draw range, which belongs to the geometry: each mark has its own.
  const outerGeometry = new THREE.RingGeometry(radius - 0.055, radius + 0.055, RING_SEGMENTS, 1);
  const innerGeometry = new THREE.RingGeometry(radius * 0.86 - 0.024, radius * 0.86 + 0.024, RING_SEGMENTS, 1);
  const outerRing = ordered(new THREE.Mesh(outerGeometry, ringMaterial));
  const innerRing = ordered(new THREE.Mesh(innerGeometry, accentMaterial));
  for (const ring of [outerRing, innerRing]) ring.rotation.x = -Math.PI / 2;
  group.add(outerRing, innerRing);

  // The star turns slowly, the strokes anchored on its points.
  const star = new THREE.Group();
  group.add(star);
  const strokeGeometry = kit.geometry("mark-stroke", () =>
    new THREE.PlaneGeometry(1, 0.11).rotateX(-Math.PI / 2).translate(0.5, 0, 0),
  );
  const vertexAngle = (index: number) => -Math.PI / 2 + (index / STAR_VERTICES) * Math.PI * 2;
  const vertices = Array.from({ length: STAR_VERTICES }, (_, index) => {
    const angle = vertexAngle(index);
    return new THREE.Vector3(Math.cos(angle) * radius * 0.96, 0, Math.sin(angle) * radius * 0.96);
  });
  const strokes = vertices.map((from, index) => {
    const to = vertices[(index + 2) % STAR_VERTICES];
    const stroke = ordered(new THREE.Mesh(strokeGeometry, starMaterial));
    stroke.position.copy(from).setY(0.002);
    stroke.rotation.y = -Math.atan2(to.z - from.z, to.x - from.x);
    stroke.scale.x = 0.001;
    star.add(stroke);
    return { stroke, length: from.distanceTo(to) };
  });
  const runeGeometry = kit.geometry("mark-rune", () => new THREE.OctahedronGeometry(0.075, 0));
  const runes = vertices.map((vertex) => {
    const rune = ordered(new THREE.Mesh(runeGeometry, accentMaterial));
    rune.position.copy(vertex).setY(0.03);
    rune.scale.set(0.001, 0.001, 0.001);
    star.add(rune);
    return rune;
  });

  const emberGeometry = kit.geometry("mark-ember", () => new THREE.OctahedronGeometry(0.05, 0));
  const embers = Array.from({ length: EMBER_COUNT }, (_, index) => {
    const ember = ordered(new THREE.Mesh(emberGeometry, kit.glow(EMBER_COLORS[index % EMBER_COLORS.length], 1)));
    ember.visible = false;
    group.add(ember);
    return {
      ember,
      angle: (index / EMBER_COUNT) * Math.PI * 2,
      radius: radius * (0.2 + ((index * 0.37) % 0.6)),
      offset: index / EMBER_COUNT,
    };
  });

  let age = 0;
  /** When the drawing began; a long time ago for a mark shown complete. Null until it is shown. */
  let drawStart: number | null = null;
  let flashStart = -10;
  let burnStart: number | null = null;
  group.visible = false;

  const setOpacity = (scale: number) => {
    materials.forEach((material, index) => {
      material.opacity = baseOpacities[index] * scale;
    });
  };

  return {
    group,
    draw: () => {
      if (drawStart !== null) return;
      drawStart = age;
      group.visible = true;
    },
    reveal: () => {
      if (drawStart !== null) return;
      drawStart = age - 10;
      group.visible = true;
    },
    flash: () => {
      flashStart = age;
    },
    burnOut: (delaySeconds = 0) => {
      if (burnStart !== null) return;
      if (drawStart === null) drawStart = age - 10;
      burnStart = age + delaySeconds;
      group.visible = true;
    },
    isDying: () => burnStart !== null,
    isGone: () => burnStart !== null && age - burnStart > BURN_SECONDS,
    update: (elapsed, delta) => {
      age += delta;
      if (drawStart === null || !group.visible) return;
      const drawn = age - drawStart;
      const burn = burnStart === null ? 0 : phase(age - burnStart, 0, BURN_SECONDS);
      if (burn >= 1) {
        group.visible = false;
        return;
      }

      outerGeometry.setDrawRange(0, Math.ceil(phase(drawn, 0, RING_DRAW_SECONDS) * RING_SEGMENTS) * 6);
      innerGeometry.setDrawRange(
        0,
        Math.ceil(phase(drawn, INNER_RING_START, INNER_RING_START + RING_DRAW_SECONDS) * RING_SEGMENTS) * 6,
      );
      strokes.forEach(({ stroke, length }, index) => {
        const begin = STROKE_START + index * STROKE_GAP;
        stroke.scale.x = Math.max(0.001, length * easeOutCubic(phase(drawn, begin, begin + STROKE_SECONDS)));
      });
      runes.forEach((rune, index) => {
        const begin = RUNES_START + index * 0.04;
        const size =
          Math.max(0.001, easeOutBack(phase(drawn, begin, begin + 0.2))) * (1 + Math.sin(elapsed * 3 + index) * 0.12);
        rune.scale.setScalar(size);
        rune.rotation.y = elapsed * 1.5;
      });

      // Slowly turning, slowly breathing; a mark that was just drawn or just used flares up.
      star.rotation.y = elapsed * 0.22;
      innerRing.rotation.z = -elapsed * 0.3;
      const justDrawn = Math.max(0, 1 - Math.abs(drawn - DRAWN_SECONDS) / 0.25);
      const flare = Math.max(justDrawn, Math.max(0, 1 - (age - flashStart) / 0.7));
      const breathe = 0.82 + Math.sin(elapsed * 2.1) * 0.18;
      const flicker = burn > 0 ? 1 - 0.5 * Math.abs(Math.sin(elapsed * 38)) * burn : 1;
      setOpacity(Math.min(1.6, (breathe + flare * 0.7) * flicker * (1 - burn)));
      group.scale.setScalar(1 + flare * 0.06 + burn * 0.14);

      embers.forEach(({ ember, angle, radius: reach, offset }) => {
        const rising = drawn > DRAWN_SECONDS * 0.6 || burn > 0;
        const cycle = (elapsed * 0.45 + offset) % 1;
        ember.visible = rising;
        if (!rising) return;
        const turn = angle + elapsed * 0.5;
        ember.position.set(Math.cos(turn) * reach, 0.05 + cycle * 0.9, Math.sin(turn) * reach);
        ember.scale.setScalar(Math.max(0.001, Math.sin(cycle * Math.PI) * (1 + burn * 1.2)));
        ember.rotation.y = elapsed * 4;
      });
    },
    dispose: () => {
      outerGeometry.dispose();
      innerGeometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

/** A soft violet glow, strongest at the middle, that lights the tile under the pentagram. */
function paintGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 6, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.55)");
    gradient.addColorStop(0.55, "rgba(255, 255, 255, 0.28)");
    gradient.addColorStop(0.85, "rgba(255, 255, 255, 0.1)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
