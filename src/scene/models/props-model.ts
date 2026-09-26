import * as THREE from "three";
import { SCENE_COLORS } from "../../theme/palette";
import { addOutline, jitterGeometry, type SceneKit } from "../scene-kit";

export interface AnimatedProp {
  group: THREE.Group;
  update: (elapsed: number, delta: number) => void;
}

/** The iconic red plastic cup, floating above its tile with a light pillar. */
export function createRedCup(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const floating = new THREE.Group();
  group.add(floating);

  const profile = [
    [0, 0],
    [0.27, 0],
    [0.29, 0.03],
    [0.31, 0.22],
    [0.325, 0.25],
    [0.35, 0.48],
    [0.365, 0.51],
    [0.39, 0.74],
    [0.41, 0.78],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  // Lathe walls are single faces, so the cup needs its own double-sided material.
  const cupMaterial = new THREE.MeshStandardMaterial({
    color: SCENE_COLORS.cupRed,
    flatShading: true,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 12), cupMaterial);
  cup.castShadow = true;
  addOutline(cup, kit, 1.07);
  floating.add(cup);

  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.37, 12), kit.flat(SCENE_COLORS.cupInner));
  inside.rotation.x = -Math.PI / 2;
  inside.position.y = 0.7;
  floating.add(inside);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.035, 5, 14), kit.flat(SCENE_COLORS.cupInner));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.78;
  floating.add(rim);
  floating.scale.setScalar(1.25);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.95, 6, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: "#ffcf8a",
      transparent: true,
      opacity: 0.32,
      alphaMap: createVerticalFadeTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 3;
  beam.raycast = () => undefined;
  group.add(beam);

  const sparkles: THREE.Mesh[] = [];
  const sparkleGeometry = kit.geometry("sparkle", () => new THREE.OctahedronGeometry(0.08, 0));
  for (let index = 0; index < 5; index += 1) {
    const sparkle = new THREE.Mesh(sparkleGeometry, kit.unlit("#fff1a8"));
    sparkles.push(sparkle);
    group.add(sparkle);
  }

  return {
    group,
    update: (elapsed) => {
      floating.position.y = 0.85 + Math.sin(elapsed * 2.2) * 0.12;
      floating.rotation.y = elapsed * 0.7;
      floating.rotation.z = Math.sin(elapsed * 1.3) * 0.08;
      beam.rotation.y = -elapsed * 0.3;
      sparkles.forEach((sparkle, index) => {
        const angle = elapsed * 0.9 + (index / sparkles.length) * Math.PI * 2;
        sparkle.position.set(Math.cos(angle) * 0.85, 1 + Math.sin(elapsed * 2 + index) * 0.4, Math.sin(angle) * 0.85);
        sparkle.rotation.y = elapsed * 3;
        sparkle.scale.setScalar(0.6 + Math.sin(elapsed * 5 + index * 2) * 0.4);
      });
    },
  };
}

export function createMudPuddle(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const puddle = new THREE.Mesh(
    kit.geometry("mud-puddle", () => jitterGeometry(new THREE.CylinderGeometry(0.5, 0.56, 0.07, 9), 0.06, 7)),
    kit.glossy(SCENE_COLORS.mud),
  );
  puddle.position.y = 0.38;
  puddle.receiveShadow = true;
  group.add(puddle);

  const bubbles: THREE.Mesh[] = [];
  const bubbleGeometry = kit.geometry("mud-bubble", () => new THREE.IcosahedronGeometry(0.07, 0));
  for (let index = 0; index < 3; index += 1) {
    const bubble = new THREE.Mesh(bubbleGeometry, kit.glossy("#a8734f"));
    bubble.position.set(Math.cos(index * 2.1) * 0.24, 0.42, Math.sin(index * 2.1) * 0.24);
    bubbles.push(bubble);
    group.add(bubble);
  }

  return {
    group,
    update: (elapsed) => {
      bubbles.forEach((bubble, index) => {
        const cycle = (elapsed * 0.8 + index * 0.33) % 1;
        bubble.scale.setScalar(cycle < 0.85 ? cycle : 0);
      });
    },
  };
}

export function createVerticalFadeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#000000");
    gradient.addColorStop(0.7, "#8a8a8a");
    gradient.addColorStop(1, "#ffffff");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return new THREE.CanvasTexture(canvas);
}
