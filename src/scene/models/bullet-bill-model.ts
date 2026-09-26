import * as THREE from "three";
import { addOutline, type SceneKit } from "../scene-kit";
import { createLabelSprite } from "../text-sprites";

/** How Bullet Bill behaves on screen; the actor switches between them. */
export type BulletMood = "waiting" | "hunting" | "charging";

export interface BulletBillVisual {
  group: THREE.Group;
  /** Rotated towards the flight direction; faces +Z. */
  body: THREE.Group;
  setMood: (mood: BulletMood) => void;
  update: (elapsed: number, delta: number) => void;
}

const BODY_SCALE = 1.5;
const HOVER_HEIGHT = 1.35;
const DANGER_RED = "#ff3b30";

/**
 * A cute angry projectile, big enough to read from across the table: an
 * exhaust flame, a pulsing danger ring on the ground and a "!" badge above.
 */
export function createBulletBillModel(kit: SceneKit): BulletBillVisual {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const rig = new THREE.Group();
  body.add(rig);
  body.scale.setScalar(BODY_SCALE);
  group.add(body);

  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 9), kit.flat("#2f2a33"));
  shell.scale.set(1, 1, 1.45);
  shell.castShadow = true;
  addOutline(shell, kit, 1.06);
  rig.add(shell);

  const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 16), kit.flat("#ffffff"));
  band.position.z = -0.28;
  rig.add(band);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      kit.geometry("bullet-eye", () => new THREE.SphereGeometry(0.1, 10, 8)),
      kit.glossy("#ffffff"),
    );
    eye.position.set(side * 0.14, 0.1, 0.36);
    eye.scale.z = 0.5;
    const pupil = new THREE.Mesh(
      kit.geometry("bullet-pupil", () => new THREE.SphereGeometry(0.05, 8, 6)),
      kit.glossy("#111111"),
    );
    pupil.position.set(side * 0.13, 0.08, 0.41);
    const brow = new THREE.Mesh(
      kit.geometry("bullet-brow", () => new THREE.BoxGeometry(0.16, 0.035, 0.04)),
      kit.flat("#ffffff"),
    );
    brow.position.set(side * 0.14, 0.22, 0.38);
    brow.rotation.z = side * -0.4;
    rig.add(eye, pupil, brow);

    const fin = new THREE.Mesh(
      kit.geometry("bullet-fin", () => new THREE.ConeGeometry(0.12, 0.3, 3)),
      kit.flat("#ffffff"),
    );
    fin.position.set(side * 0.3, 0, -0.38);
    fin.rotation.set(-Math.PI / 2, 0, side * 0.6);
    rig.add(fin);
  }

  const grin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.03), kit.flat("#ffffff"));
  grin.position.set(0, -0.07, 0.47);
  rig.add(grin);

  // Two nested cones, an orange flame around a hot yellow core. The group's +Y points backwards,
  // so stretching it along Y lengthens the flame away from the shell.
  const flame = new THREE.Group();
  flame.position.z = -0.5;
  flame.rotation.x = -Math.PI / 2;
  const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 8, 1, true), glowMaterial("#ff8a2b", 0.85));
  outerFlame.position.y = 0.35;
  const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 8, 1, true), glowMaterial("#fff1a8", 0.95));
  innerFlame.position.y = 0.225;
  flame.add(outerFlame, innerFlame);
  rig.add(flame);

  const ringMaterial = glowMaterial(DANGER_RED, 0.8);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.98, 32), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  const discMaterial = glowMaterial(DANGER_RED, 0.18);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.72, 32), discMaterial);
  disc.rotation.x = -Math.PI / 2;
  const ground = new THREE.Group();
  ground.position.y = 0.4;
  ground.add(disc, ring);
  ground.traverse((object) => (object.raycast = () => undefined));
  group.add(ground);

  const badge = createLabelSprite("!", { background: DANGER_RED, color: "#ffffff", fontSize: 72, worldHeight: 0.6 });
  (badge.material as THREE.SpriteMaterial).depthTest = false;
  badge.renderOrder = 8;
  const badgeScale = badge.scale.clone();
  group.add(badge);

  let mood: BulletMood = "hunting";

  return {
    group,
    body,
    setMood: (next) => {
      mood = next;
    },
    update: (elapsed) => {
      const charging = mood === "charging";
      const waiting = mood === "waiting";
      // Revving on the start, cruising while hunting, full throttle on a charge.
      const throttle = charging ? 1.7 : waiting ? 0.7 : 1;
      const flicker = 0.8 + Math.sin(elapsed * 38) * 0.12 + Math.sin(elapsed * 23) * 0.08;
      flame.scale.set(1, throttle * flicker, 1);

      rig.position.y = charging ? 0 : Math.sin(elapsed * 4) * 0.08;
      rig.position.x = waiting ? Math.sin(elapsed * 61) * 0.015 : 0;
      rig.rotation.z = Math.sin(elapsed * (charging ? 18 : 6)) * (charging ? 0.2 : 0.1);
      body.position.y = HOVER_HEIGHT;

      const pulse = 0.5 + Math.sin(elapsed * (waiting ? 5 : 7)) * 0.5;
      ring.scale.setScalar(0.92 + pulse * 0.16);
      ringMaterial.opacity = 0.45 + pulse * 0.45;
      discMaterial.opacity = 0.1 + pulse * 0.14;
      ground.visible = !charging;

      badge.visible = !charging;
      badge.position.y = HOVER_HEIGHT + 1.05 + Math.sin(elapsed * 3.2) * 0.1;
      const badgePop = 1 + pulse * 0.12;
      badge.scale.set(badgeScale.x * badgePop, badgeScale.y * badgePop, 1);
    },
  };
}

function glowMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
