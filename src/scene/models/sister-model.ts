import * as THREE from "three";
import { jitterGeometry, type SceneKit } from "../scene-kit";

/** What the actor asks of the little ghost this frame; the model blends it with its own bobbing and swaying. */
export interface SisterPose {
  /** 0 gone, 1 fully there. */
  opacity: number;
  /** 1 upright; above 1 stretched thin, as when she dissolves into mist. */
  stretch: number;
  /** Forward lean of the body, in radians. */
  lean: number;
  /** Extra height over her hovering, in world units: the hop's arc. */
  lift: number;
  /** How hard the hem flutters: 1 hovering, more when she hops. */
  flutter: number;
}

export interface SisterVisual {
  /** Holds everything; the actor moves it. */
  group: THREE.Group;
  /** The little girl herself, faces +Z; the actor turns and scales it. */
  figure: THREE.Group;
  pose: SisterPose;
  update: (elapsed: number, delta: number) => void;
  /** Frees what is her own: the hem's geometry and her materials. */
  dispose: () => void;
}

/** Radius / height pairs of the sheet, from the crown of the head down to the hem. */
const SHEET_PROFILE: [number, number][] = [
  [0, 1],
  [0.11, 0.985],
  [0.18, 0.93],
  [0.21, 0.84],
  [0.19, 0.74],
  [0.15, 0.66],
  [0.18, 0.6],
  [0.21, 0.48],
  [0.26, 0.32],
  [0.31, 0.16],
  [0.34, 0.05],
];
const SHEET_CENTER_Y = 0.5;
const SHEET_SEGMENTS = 14;
const HEM_TOP_Y = 0.3;
const HOVER_HEIGHT = 0.2;

const SHEET_COLOR = "#d6ecff";
const SHEET_GLOW = "#8fc4ff";
const RIBBON_COLOR = "#ff4a5e";
const INK = "#1b2340";

interface HemVertex {
  index: number;
  x: number;
  y: number;
  z: number;
  phi: number;
  weight: number;
}

/**
 * The Sœur Fantôme: a little girl in a sheet, pale blue and see-through, a floating wavy hem, pigtails tied with red
 * ribbons, big dark eyes, a gentle sway. Cousin of the Luna Park ghost (its materials fade together, no light of its
 * own, so the shaders are never rebuilt) but sweet where it is menacing. `accent` tints the glow under her, so the
 * table sees whose sister she is.
 */
export function createSisterModel(kit: SceneKit, accent: string, seed: number): SisterVisual {
  const group = new THREE.Group();
  const figure = new THREE.Group();
  const body = new THREE.Group();
  figure.add(body);
  group.add(figure);

  // Every material fades with her, so each remembers its full opacity. They are hers alone: the pawns' are shared.
  const fading: { material: THREE.Material; opacity: number }[] = [];
  const fade = <T extends THREE.Material>(material: T, opacity = 1): T => {
    material.transparent = true;
    material.opacity = opacity;
    fading.push({ material, opacity });
    return material;
  };
  const glowMaterial = (color: string, side: THREE.Side = THREE.DoubleSide) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side,
    });

  const sheetMaterial = fade(
    new THREE.MeshStandardMaterial({
      color: SHEET_COLOR,
      emissive: SHEET_GLOW,
      emissiveIntensity: 0.55,
      roughness: 0.8,
      flatShading: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    0.66,
  );
  const auraMaterial = fade(glowMaterial(SHEET_GLOW, THREE.BackSide), 0.16);
  const inkMaterial = fade(new THREE.MeshBasicMaterial({ color: INK, depthWrite: false }), 0.95);
  const ribbonMaterial = fade(
    new THREE.MeshStandardMaterial({
      color: RIBBON_COLOR,
      emissive: "#ff2540",
      emissiveIntensity: 0.45,
      flatShading: true,
      depthWrite: false,
    }),
    0.92,
  );
  const blushMaterial = fade(new THREE.MeshBasicMaterial({ color: "#ff9fc0", depthWrite: false }), 0.6);

  const { geometry: sheetGeometry, hem } = createSheetGeometry(seed);
  const sheet = new THREE.Mesh(sheetGeometry, sheetMaterial);
  sheet.position.y = SHEET_CENTER_Y;
  body.add(sheet);
  const aura = new THREE.Mesh(sheetGeometry, auraMaterial);
  aura.scale.setScalar(1.14);
  aura.raycast = () => undefined;
  sheet.add(aura);

  // Big dark eyes with a glint each, rosy cheeks and a tiny round mouth, on the front of the head.
  const face = new THREE.Group();
  face.position.y = 0;
  body.add(face);
  const eyes = new THREE.Group();
  face.add(eyes);
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.078, 0.8, 0.188);
    eye.rotation.y = side * 0.4;
    const dark = new THREE.Mesh(
      kit.geometry("sister-eye", () => new THREE.CircleGeometry(0.058, 12)),
      inkMaterial,
    );
    dark.scale.set(0.82, 1.2, 1);
    const glint = new THREE.Mesh(
      kit.geometry("sister-glint", () => new THREE.CircleGeometry(0.02, 8)),
      fade(new THREE.MeshBasicMaterial({ color: "#ffffff", depthWrite: false }), 1),
    );
    glint.position.set(-0.015, 0.025, 0.004);
    eye.add(dark, glint);
    eyes.add(eye);

    const blush = new THREE.Mesh(
      kit.geometry("sister-blush", () => new THREE.CircleGeometry(0.032, 8)),
      blushMaterial,
    );
    blush.position.set(side * 0.135, 0.725, 0.15);
    blush.rotation.y = side * 0.75;
    blush.scale.y = 0.7;
    face.add(blush);
  }
  const mouth = new THREE.Mesh(
    kit.geometry("sister-mouth", () => new THREE.CircleGeometry(0.018, 8)),
    inkMaterial,
  );
  mouth.position.set(0, 0.695, 0.2);
  face.add(mouth);

  // Pigtails, each tied with a red bow, swinging a little out of step with each other.
  const pigtails = [-1, 1].map((side) => {
    const pigtail = new THREE.Group();
    pigtail.position.set(side * 0.2, 0.86, -0.01);
    const sizes = [0.075, 0.065, 0.05];
    sizes.forEach((size, index) => {
      const tuft = new THREE.Mesh(
        kit.geometry(`sister-tuft-${index}`, () => new THREE.IcosahedronGeometry(size, 0)),
        sheetMaterial,
      );
      tuft.position.set(side * (0.04 + index * 0.045), -0.08 - index * 0.1, 0);
      pigtail.add(tuft);
    });
    const bow = new THREE.Group();
    bow.position.set(side * 0.015, 0.03, 0.02);
    for (const wing of [-1, 1]) {
      const cone = new THREE.Mesh(
        kit.geometry("sister-bow", () => new THREE.ConeGeometry(0.05, 0.11, 4)),
        ribbonMaterial,
      );
      cone.rotation.z = wing * (Math.PI / 2);
      cone.position.x = wing * 0.055;
      bow.add(cone);
    }
    const knot = new THREE.Mesh(
      kit.geometry("sister-knot", () => new THREE.IcosahedronGeometry(0.03, 0)),
      ribbonMaterial,
    );
    bow.add(knot);
    pigtail.add(bow);
    body.add(pigtail);
    return { pigtail, side };
  });

  // Two little stubs of arms, waving gently.
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Mesh(
      kit.geometry("sister-arm", () => new THREE.IcosahedronGeometry(0.06, 0)),
      sheetMaterial,
    );
    arm.scale.set(0.75, 1.5, 0.75);
    arm.position.set(side * 0.255, 0.42, 0.05);
    body.add(arm);
    return { arm, side };
  });

  // A few wisps of light drifting round her, and a glow on the tile, in the colour of her owner.
  const wispMaterial = fade(glowMaterial("#dff0ff"), 0.8);
  const wisps = Array.from({ length: 3 }, (_, index) => {
    const wisp = new THREE.Mesh(
      kit.geometry("sister-wisp", () => new THREE.IcosahedronGeometry(0.035, 0)),
      wispMaterial,
    );
    figure.add(wisp);
    return { wisp, phase: index * 2.1 };
  });
  const groundMaterial = fade(glowMaterial(accent), 0.7);
  groundMaterial.map = kit.texture("sister-glow", paintGlowTexture);
  const groundGlow = new THREE.Mesh(
    kit.geometry("sister-ground", () => new THREE.CircleGeometry(0.62, 22)),
    groundMaterial,
  );
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.y = 0.02;
  groundGlow.raycast = () => undefined;
  group.add(groundGlow);

  const pose: SisterPose = { opacity: 1, stretch: 1, lean: 0, lift: 0, flutter: 1 };
  const hemPositions = sheetGeometry.getAttribute("position") as THREE.BufferAttribute;
  const timeOffset = seed * 1.7;
  let hemClock = 0;
  let nextBlink = 2 + (seed % 3);

  return {
    group,
    figure,
    pose,
    update: (elapsed, delta) => {
      const time = elapsed + timeOffset;
      const opacity = THREE.MathUtils.clamp(pose.opacity, 0, 1);
      group.visible = opacity > 0.01;
      for (const entry of fading) entry.material.opacity = entry.opacity * opacity;

      body.position.y = HOVER_HEIGHT + Math.sin(time * 1.8) * 0.06 + pose.lift;
      body.rotation.z = Math.sin(time * 1.1) * 0.06;
      body.rotation.x = pose.lean + Math.sin(time * 1.4) * 0.025;
      const stretch = Math.max(0.3, pose.stretch);
      const thin = 1 / Math.sqrt(stretch);
      body.scale.set(thin, stretch, thin);

      // The hem ripples like a sheet in a slow breeze; harder when she hops.
      hemClock += delta * (0.6 + pose.flutter * 0.5);
      const amplitude = 0.6 + pose.flutter * 0.4;
      for (const vertex of hem) {
        const swell = 1 + Math.sin(vertex.phi * 3 + hemClock * 2.4) * 0.07 * vertex.weight * amplitude;
        const lift = Math.sin(vertex.phi * 4 - hemClock * 3) * 0.04 * vertex.weight * amplitude;
        hemPositions.setXYZ(vertex.index, vertex.x * swell, vertex.y + lift, vertex.z * swell);
      }
      hemPositions.needsUpdate = true;

      pigtails.forEach(({ pigtail, side }, index) => {
        pigtail.rotation.z = side * (0.12 + Math.sin(time * 2.2 + index * 1.4) * 0.1) + pose.lean * -side * 0.6;
        pigtail.rotation.x = Math.sin(time * 1.7 + index) * 0.08;
      });
      arms.forEach(({ arm, side }, index) => {
        arm.rotation.z = side * (0.45 + Math.sin(time * 2 + index * 2) * 0.18);
      });

      // Blinks now and then.
      if (elapsed > nextBlink) {
        const progress = (elapsed - nextBlink) / 0.14;
        eyes.scale.y = progress < 1 ? Math.max(0.1, Math.abs(1 - progress * 2)) : 1;
        if (progress >= 1) nextBlink = elapsed + 2.6 + ((seed * 7) % 3);
      }

      wisps.forEach(({ wisp, phase }, index) => {
        const angle = time * (index % 2 === 0 ? 0.9 : -0.7) + phase;
        wisp.position.set(
          Math.cos(angle) * 0.5,
          0.35 + index * 0.22 + Math.sin(time * 1.6 + phase) * 0.1,
          Math.sin(angle) * 0.42,
        );
        wisp.scale.setScalar(0.7 + Math.sin(time * 4 + phase) * 0.3);
      });
      groundGlow.scale.setScalar(1 + Math.sin(time * 1.8) * 0.06);
    },
    dispose: () => {
      sheetGeometry.dispose();
      for (const { material } of fading) material.dispose();
    },
  };
}

/** The lathed sheet, jittered, with its hem cut into uneven scallops that the model ripples. */
function createSheetGeometry(seed: number): { geometry: THREE.BufferGeometry; hem: HemVertex[] } {
  // Lathed from the hem up, so the faces point outwards.
  const points = [...SHEET_PROFILE].reverse().map(([radius, y]) => new THREE.Vector2(radius, y - SHEET_CENTER_Y));
  const lathe = new THREE.LatheGeometry(points, SHEET_SEGMENTS);
  const geometry = jitterGeometry(lathe, 0.014, 500 + seed);
  lathe.dispose();

  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const hemTop = HEM_TOP_Y - SHEET_CENTER_Y;
  const hemBottom = SHEET_PROFILE[SHEET_PROFILE.length - 1][1] - SHEET_CENTER_Y;
  const hem: HemVertex[] = [];
  for (let index = 0; index < position.count; index += 1) {
    let x = position.getX(index);
    let y = position.getY(index);
    let z = position.getZ(index);
    if (y > hemTop) continue;
    const weight = Math.min(1, (hemTop - y) / (hemTop - hemBottom));
    const phi = Math.atan2(x, z);
    if (weight > 0.9) {
      // Scalloped edge: every other point hangs a little lower.
      const segment = Math.round(((phi + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / SHEET_SEGMENTS));
      const drop = segment % 2 === 0 ? 0.09 : 0.01;
      y -= drop;
      x *= 1 + drop * 0.3;
      z *= 1 + drop * 0.3;
      position.setXYZ(index, x, y, z);
    }
    hem.push({ index, x, y, z, phi, weight });
  }
  geometry.computeBoundingSphere();
  return { geometry, hem };
}

/** Soft round glow painted on the tile under her, white so that the material can tint it with her owner's colour. */
function paintGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.75)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.32)");
    gradient.addColorStop(0.85, "rgba(255, 255, 255, 0.1)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
