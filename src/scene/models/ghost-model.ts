import * as THREE from "three";
import { jitterGeometry, type SceneKit } from "../scene-kit";

/**
 * What the actor asks of the ghost this frame. The model blends it with its
 * own idle motion (bobbing, fluttering hem, flickering eyes).
 */
export interface GhostPose {
  /** 0 arms reaching forward, 1 raised high over the head. */
  armsUp: number;
  /** The slapping arm: −1 wound back out to the side, 0 at rest, 1 swung right across. */
  slap: number;
  /** 0 free arms, 1 stretched down to hold a pawn. */
  grip: number;
  /** Forward lean of the body, in radians. */
  lean: number;
  /** 0 smouldering eyes, 1 flaring. */
  glare: number;
  /** 0 gaping as usual, 1 screaming wide. */
  mouth: number;
  /** 1 upright; above 1 stretched thin, as when it dissolves. */
  stretch: number;
  /** How hard the torn hem flaps: 1 hovering, more when flying. */
  flutter: number;
  /** 0 gone, 1 fully there. */
  opacity: number;
}

export interface GhostVisual {
  /** Holds the figure and its glow light, which never leaves the scene so shaders are not recompiled. */
  group: THREE.Group;
  /** Everything visible; the actor moves, turns and scales it. Faces +Z. */
  figure: THREE.Group;
  body: THREE.Group;
  /** Left (−X) and right (+X) sleeves; the right one slaps. */
  arms: [THREE.Group, THREE.Group];
  eyes: THREE.Group;
  /** Invisible, generous volume that clicks are tested against. */
  pickMesh: THREE.Mesh;
  pose: GhostPose;
  /** Number of pieces of loot the ghost carries: its sack grows with it. */
  setLoot: (count: number) => void;
  /** The sack swells for a moment, as the ghost stuffs something into it. */
  gulpLoot: () => void;
  update: (elapsed: number, delta: number) => void;
}

/** Height the body floats at above the figure's origin, before bobbing. */
const HOVER_HEIGHT = 0.22;
/** The sheet is built around this height so its outline scales from its middle. */
const SHEET_CENTER_Y = 1.25;
const SHEET_SEGMENTS = 16;
/** Radius / height pairs of the sheet, from the crown of the head down to the hem. */
const SHEET_PROFILE: [number, number][] = [
  [0, 2.16],
  [0.19, 2.11],
  [0.32, 2.01],
  [0.41, 1.87],
  [0.45, 1.71],
  [0.44, 1.55],
  [0.39, 1.41],
  [0.42, 1.25],
  [0.48, 1.05],
  [0.55, 0.85],
  [0.62, 0.65],
  [0.7, 0.46],
];
/** Below this height the sheet ripples. */
const HEM_TOP_Y = 0.95;
const SHOULDER = new THREE.Vector3(0.41, 1.3 - SHEET_CENTER_Y, 0.04);
const SLEEVE_LENGTH = 0.74;
const WISP_COUNT = 6;

const SHEET_COLOR = "#f2fff9";
const SHEET_GLOW = "#8dffc0";
const VOID_COLOR = "#05010b";
const EYE_COLOR = "#ff3b2f";
const EYE_HALO = "#ff1f4b";

interface HemVertex {
  index: number;
  x: number;
  y: number;
  z: number;
  /** Angle around the body, for the ripple's phase. */
  phi: number;
  /** 0 at the top of the hem, 1 at its torn edge. */
  weight: number;
}

interface Wisp {
  mesh: THREE.Mesh;
  radius: number;
  speed: number;
  height: number;
  phase: number;
}

/**
 * Luna Park's ghost: a tall, pale, glowing sheet with a torn hem, hollow
 * black eye sockets burning red, a jagged gaping mouth and two ragged sleeves
 * ending in claws. It towers over the chibi pawns on purpose, and haunts
 * wisps and a green glow on the tiles around it.
 */
export function createGhostModel(kit: SceneKit): GhostVisual {
  const group = new THREE.Group();
  const figure = new THREE.Group();
  const body = new THREE.Group();
  figure.add(body);
  group.add(figure);

  // Every material fades with the ghost, so each remembers its full opacity.
  const fading: { material: THREE.Material; opacity: number }[] = [];
  const fade = <T extends THREE.Material>(material: T, opacity = 1): T => {
    material.transparent = true;
    material.opacity = opacity;
    fading.push({ material, opacity });
    return material;
  };

  const sheetMaterial = fade(
    new THREE.MeshStandardMaterial({
      color: SHEET_COLOR,
      emissive: SHEET_GLOW,
      emissiveIntensity: 0.5,
      roughness: 0.75,
      metalness: 0,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
    0.94,
  );
  // Opaque, so it is drawn before the translucent sheet; hidden while the ghost fades.
  const inkMaterial = new THREE.MeshBasicMaterial({ color: "#10061d", side: THREE.BackSide });
  const auraMaterial = fade(glowMaterial(SHEET_GLOW, THREE.BackSide), 0.16);
  const voidMaterial = fade(new THREE.MeshBasicMaterial({ color: VOID_COLOR, depthWrite: false }));

  const { geometry: sheetGeometry, hem } = createSheetGeometry();
  const sheet = new THREE.Mesh(sheetGeometry, sheetMaterial);
  sheet.position.y = SHEET_CENTER_Y;
  sheet.castShadow = true;
  body.add(sheet);
  sheet.add(hull(sheetGeometry, inkMaterial, 1.05), hull(sheetGeometry, auraMaterial, 1.16));
  body.position.y = HOVER_HEIGHT;

  const face = new THREE.Group();
  face.position.y = SHEET_CENTER_Y;
  body.add(face);

  const eyes = new THREE.Group();
  face.add(eyes);
  const pupilMaterial = fade(new THREE.MeshBasicMaterial({ color: EYE_COLOR, depthWrite: false }));
  const haloMaterial = fade(glowMaterial(EYE_HALO), 0.55);
  const pupils: THREE.Mesh[] = [];
  const halos: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const socket = new THREE.Group();
    socket.position.set(side * 0.17, 1.74 - SHEET_CENTER_Y, 0.43);
    socket.rotation.set(-0.18, side * 0.38, side * -0.5);
    const hollow = new THREE.Mesh(
      kit.geometry("spectre-socket", () => new THREE.CircleGeometry(0.13, 7)),
      voidMaterial,
    );
    hollow.scale.set(0.82, 1.35, 1);
    const halo = new THREE.Mesh(
      kit.geometry("spectre-halo", () => new THREE.CircleGeometry(0.085, 10)),
      haloMaterial,
    );
    halo.position.z = 0.006;
    const pupil = new THREE.Mesh(
      kit.geometry("spectre-pupil", () => new THREE.IcosahedronGeometry(0.042, 0)),
      pupilMaterial,
    );
    pupil.position.set(side * 0.012, -0.02, 0.012);
    pupil.scale.z = 0.4;
    socket.add(hollow, halo, pupil);
    eyes.add(socket);
    pupils.push(pupil);
    halos.push(halo);
  }

  const mouth = new THREE.Group();
  mouth.position.set(0, 1.45 - SHEET_CENTER_Y, 0.43);
  mouth.rotation.x = -0.12;
  const mouthHole = new THREE.Mesh(
    kit.geometry("spectre-mouth", () => new THREE.ShapeGeometry(createJaggedMouthShape())),
    voidMaterial,
  );
  const throatMaterial = fade(new THREE.MeshBasicMaterial({ color: "#5c0020", depthWrite: false }));
  const throat = new THREE.Mesh(
    kit.geometry("spectre-throat", () => new THREE.CircleGeometry(0.045, 8)),
    throatMaterial,
  );
  throat.position.set(0, -0.02, 0.004);
  throat.scale.y = 1.5;
  mouth.add(mouthHole, throat);
  face.add(mouth);

  const clawMaterial = fade(
    new THREE.MeshStandardMaterial({
      color: "#f2fff8",
      emissive: "#9dffd8",
      emissiveIntensity: 0.45,
      flatShading: true,
      roughness: 0.6,
    }),
  );
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * SHOULDER.x, SHEET_CENTER_Y + SHOULDER.y, SHOULDER.z);
    const sleeveGeometry = kit.geometry("spectre-sleeve", createSleeveGeometry);
    const sleeve = new THREE.Mesh(sleeveGeometry, sheetMaterial);
    sleeve.castShadow = true;
    sleeve.add(hull(sleeveGeometry, inkMaterial, 1.12));
    arm.add(sleeve);
    [-1, 0, 1].forEach((finger) => {
      const claw = new THREE.Mesh(
        kit.geometry("spectre-claw", () => new THREE.ConeGeometry(0.024, 0.26, 4)),
        clawMaterial,
      );
      claw.position.set(finger * 0.06, -SLEEVE_LENGTH - 0.1, 0.03);
      claw.rotation.set(Math.PI - 0.25, 0, finger * 0.28);
      arm.add(claw);
    });
    body.add(arm);
    return arm;
  }) as [THREE.Group, THREE.Group];

  const wispMaterials = [fade(glowMaterial("#8dffd1"), 0.75), fade(glowMaterial("#b77bff"), 0.7)];
  const wisps: Wisp[] = [];
  for (let index = 0; index < WISP_COUNT; index += 1) {
    const mesh = new THREE.Mesh(
      kit.geometry("spectre-wisp", () => new THREE.IcosahedronGeometry(0.07, 0)),
      wispMaterials[index % 2],
    );
    mesh.scale.setScalar(0.7 + (index % 3) * 0.25);
    figure.add(mesh);
    wisps.push({
      mesh,
      radius: 0.72 + (index % 3) * 0.14,
      speed: (index % 2 === 0 ? 1 : -1) * (0.7 + index * 0.13),
      height: 0.45 + ((index * 0.37) % 1.4),
      phase: index * 1.9,
    });
  }

  const groundGlowMaterial = fade(
    new THREE.MeshBasicMaterial({
      map: createGlowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    0.55,
  );
  const groundGlow = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), groundGlowMaterial);
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.y = 0.03;
  groundGlow.raycast = () => undefined;
  figure.add(groundGlow);

  const { sack, coins } = createLootSack(fade);
  figure.add(sack);

  const pickMesh = new THREE.Mesh(
    kit.geometry("spectre-pick", () => new THREE.CylinderGeometry(0.7, 0.7, 2.2, 8)),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pickMesh.position.y = 1.2;
  body.add(pickMesh);

  // A cheap eerie green light on the tiles around the ghost.
  const light = new THREE.PointLight("#7dffc8", 0, 4.6, 1.6);
  group.add(light);

  const pose: GhostPose = {
    armsUp: 0,
    slap: 0,
    grip: 0,
    lean: 0,
    glare: 0.2,
    mouth: 0,
    stretch: 1,
    flutter: 1,
    opacity: 1,
  };
  const hemPositions = sheetGeometry.getAttribute("position") as THREE.BufferAttribute;
  let lootCount = 0;
  let sackScale = 0;
  let gulp = 0;
  let hemClock = 0;

  return {
    group,
    figure,
    body,
    arms,
    eyes,
    pickMesh,
    pose,
    setLoot: (count) => {
      lootCount = Math.max(0, count);
    },
    gulpLoot: () => {
      gulp = 1;
    },
    update: (elapsed, delta) => {
      const opacity = THREE.MathUtils.clamp(pose.opacity, 0, 1);
      figure.visible = opacity > 0.01;
      for (const entry of fading) entry.material.opacity = entry.opacity * opacity;
      inkMaterial.visible = opacity > 0.9;

      body.position.y = HOVER_HEIGHT + Math.sin(elapsed * 1.7) * 0.1;
      body.rotation.x = pose.lean + Math.sin(elapsed * 1.3) * 0.03;
      body.rotation.z = Math.sin(elapsed * 0.9) * 0.06;
      const stretch = Math.max(0.2, pose.stretch);
      const thin = 1 / Math.sqrt(stretch);
      body.scale.set(thin, stretch, thin);

      // The torn hem flaps like a sheet in the wind; faster when the ghost flies.
      hemClock += delta * (0.6 + pose.flutter * 0.4);
      const amplitude = 0.7 + pose.flutter * 0.3;
      for (const vertex of hem) {
        const swell = 1 + Math.sin(vertex.phi * 3 + hemClock * 2.6) * 0.06 * vertex.weight * amplitude;
        const lift = Math.sin(vertex.phi * 5 - hemClock * 3.3) * 0.05 * vertex.weight * amplitude;
        hemPositions.setXYZ(vertex.index, vertex.x * swell, vertex.y + lift, vertex.z * swell);
      }
      hemPositions.needsUpdate = true;

      arms.forEach((arm, index) => poseArm(arm, index === 0 ? -1 : 1, pose, elapsed));

      // Now and then the eyes gutter out like candles, which makes them all the more alive.
      const guttering = Math.sin(elapsed * 13.7) + Math.sin(elapsed * 5.3 + 1) > 1.75 ? 0.25 : 1;
      const burn = (0.85 + pose.glare * 0.9 + Math.sin(elapsed * 9) * 0.08) * guttering;
      pupils.forEach((pupil) => pupil.scale.set(burn, burn, 0.4 * burn));
      halos.forEach((halo) => halo.scale.setScalar(0.7 + pose.glare * 0.9 * guttering));

      const scream = pose.mouth;
      mouth.scale.set(1 + scream * 0.2, 1 + scream * 0.8 + Math.sin(elapsed * 2.1) * 0.05, 1);

      wisps.forEach((wisp) => {
        const angle = elapsed * wisp.speed + wisp.phase;
        wisp.mesh.position.set(
          Math.cos(angle) * wisp.radius,
          wisp.height + Math.sin(elapsed * 1.6 + wisp.phase) * 0.18,
          Math.sin(angle) * wisp.radius * 0.8,
        );
        wisp.mesh.rotation.y = angle;
      });

      const sackTarget = lootCount === 0 ? 0 : Math.min(1.25, 0.7 + lootCount * 0.15);
      sackScale += (sackTarget - sackScale) * Math.min(1, delta * 5);
      gulp = Math.max(0, gulp - delta * 2.2);
      sack.visible = sackScale > 0.02;
      sack.scale.setScalar(Math.max(0.001, sackScale * (1 + Math.sin(gulp * Math.PI) * 0.35)));
      sack.position.y = 0.6 + Math.sin(elapsed * 2.2 + 1) * 0.07;
      sack.rotation.z = Math.sin(elapsed * 1.4) * 0.15;
      coins.forEach((coin, index) => {
        coin.visible = index < lootCount + 1;
        const angle = elapsed * 2.4 + (index / coins.length) * Math.PI * 2;
        coin.position.set(Math.cos(angle) * 0.36, 0.12 + Math.sin(angle * 2) * 0.05, Math.sin(angle) * 0.36);
        coin.rotation.y = angle * 2;
      });

      light.position.copy(figure.position).setY(figure.position.y + 1.1 * figure.scale.y);
      light.intensity = (2.4 + pose.glare * 2.2 + (guttering < 1 ? -0.8 : 0)) * opacity;
    },
  };
}

/** The lathed sheet, jittered, with a hem torn into uneven points. */
function createSheetGeometry(): { geometry: THREE.BufferGeometry; hem: HemVertex[] } {
  // Lathed from the hem up, so the faces point outwards and the outline hull stays behind the sheet.
  const points = [...SHEET_PROFILE].reverse().map(([radius, y]) => new THREE.Vector2(radius, y - SHEET_CENTER_Y));
  const lathe = new THREE.LatheGeometry(points, SHEET_SEGMENTS);
  const geometry = jitterGeometry(lathe, 0.028, 913);
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
    // The lathe places its vertices at x = sin φ, z = cos φ.
    const phi = Math.atan2(x, z);
    if (weight > 0.92) {
      const segment = Math.round(((phi + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / SHEET_SEGMENTS));
      const drop = segment % 2 === 0 ? 0.26 + (segment % 3) * 0.06 : 0.02;
      y -= drop;
      x *= 1 + drop * 0.35;
      z *= 1 + drop * 0.35;
      position.setXYZ(index, x, y, z);
    }
    hem.push({ index, x, y, z, phi, weight });
  }
  geometry.computeBoundingSphere();
  return { geometry, hem };
}

/** A sleeve hanging from its shoulder (the origin), flared and torn at the cuff. */
function createSleeveGeometry(): THREE.BufferGeometry {
  const cylinder = new THREE.CylinderGeometry(0.07, 0.16, SLEEVE_LENGTH, 7, 2, true);
  cylinder.translate(0, -SLEEVE_LENGTH / 2, 0);
  const geometry = jitterGeometry(cylinder, 0.025, 377);
  cylinder.dispose();
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index += 1) {
    if (position.getY(index) > -SLEEVE_LENGTH + 0.02) continue;
    const phi = Math.atan2(position.getX(index), position.getZ(index));
    position.setY(index, position.getY(index) + (Math.round(phi * 2.2) % 2 === 0 ? -0.09 : 0.04));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A gaping oval whose rim is broken into jagged teeth. */
function createJaggedMouthShape(): THREE.Shape {
  const shape = new THREE.Shape();
  const points = 16;
  for (let index = 0; index <= points; index += 1) {
    const angle = (index / points) * Math.PI * 2 + Math.PI / 2;
    const tooth = index % 2 === 0 ? 1 : 0.72;
    const x = Math.cos(angle) * 0.14 * tooth;
    const y = Math.sin(angle) * 0.16 * tooth - (Math.sin(angle) < 0 ? 0.04 : 0);
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

/** Blends the actor's pose into one sleeve, over a slow zombie-like sway. */
function poseArm(arm: THREE.Group, side: number, pose: GhostPose, elapsed: number): void {
  const sway = Math.sin(elapsed * 1.4 + side) * 0.12;
  let pitch = THREE.MathUtils.lerp(-1.05, -2.5, pose.armsUp) + sway;
  let roll = side * (0.18 + pose.armsUp * 0.4) + Math.sin(elapsed * 1.1 + side * 2) * 0.06;
  let reach = 1;

  pitch = THREE.MathUtils.lerp(pitch, -0.55, pose.grip);
  roll = THREE.MathUtils.lerp(roll, side * -0.15, pose.grip);
  reach = THREE.MathUtils.lerp(reach, 1.5, pose.grip);

  if (side === 1 && pose.slap !== 0) {
    // Wound back: out to the side and raised. Swung through: right across the front.
    const amount = Math.min(1, Math.abs(pose.slap));
    const target = pose.slap < 0 ? { pitch: -0.5, roll: 1.85 } : { pitch: -1.45, roll: -0.55 };
    pitch = THREE.MathUtils.lerp(pitch, target.pitch, amount);
    roll = THREE.MathUtils.lerp(roll, target.roll, amount);
    reach = THREE.MathUtils.lerp(reach, 1.2, amount);
  }

  arm.rotation.set(pitch, 0, roll);
  arm.scale.set(1, reach, 1);
}

/** The ghost's loot: a little sack with a gold glow and coins circling it. */
function createLootSack(fade: <T extends THREE.Material>(material: T, opacity?: number) => T): {
  sack: THREE.Group;
  coins: THREE.Mesh[];
} {
  const sack = new THREE.Group();
  sack.position.set(-0.68, 0.6, 0.4);

  const cloth = fade(
    new THREE.MeshStandardMaterial({
      color: "#b07a45",
      emissive: "#5a3312",
      emissiveIntensity: 0.6,
      flatShading: true,
      roughness: 0.9,
    }),
  );
  const gold = fade(
    new THREE.MeshStandardMaterial({
      color: "#ffd166",
      emissive: "#ffb000",
      emissiveIntensity: 0.55,
      flatShading: true,
      roughness: 0.4,
      metalness: 0.3,
    }),
  );
  const bag = new THREE.Mesh(jitterGeometry(new THREE.IcosahedronGeometry(0.22, 1), 0.03, 58), cloth);
  bag.scale.set(1, 0.9, 1);
  bag.castShadow = true;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.1, 6), cloth);
  neck.position.y = 0.22;
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.02, 4, 10), gold);
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 0.21;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), fade(glowMaterial("#ffd166"), 0.2));
  halo.raycast = () => undefined;
  sack.add(bag, neck, tie, halo);

  const coinGeometry = new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10);
  coinGeometry.rotateX(Math.PI / 2);
  const coins = [0, 1, 2, 3].map(() => {
    const coin = new THREE.Mesh(coinGeometry, gold);
    sack.add(coin);
    return coin;
  });
  sack.visible = false;
  return { sack, coins };
}

/** An inverted hull behind a mesh: the ink contour, or with a glow material, an aura. */
function hull(geometry: THREE.BufferGeometry, material: THREE.Material, thickness: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(thickness);
  mesh.raycast = () => undefined;
  return mesh;
}

function glowMaterial(color: string, side: THREE.Side = THREE.DoubleSide): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side,
  });
}

/** Soft round glow painted on the tile under the ghost. */
function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, "rgba(150, 255, 210, 0.9)");
    gradient.addColorStop(0.45, "rgba(90, 230, 170, 0.45)");
    gradient.addColorStop(0.8, "rgba(150, 80, 255, 0.15)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
