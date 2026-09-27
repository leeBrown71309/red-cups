import * as THREE from "three";
import { TILE_COLORS } from "../../theme/palette";
import { addOutline, createRandom, jitterGeometry, type SceneKit } from "../scene-kit";
import { createLabelSprite } from "../text-sprites";
import { paintHellFace } from "./landmarks-model";
import type { AnimatedProp } from "./props-model";

/**
 * Tile 11 at Banquise: a crevasse torn in the ice behind the lake. Jagged ice
 * shards ring a pit where the purple lava face of Hell glows up through the
 * cold, and frosty sparks drift up.
 */
export function createIceCrevasse(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const random = createRandom(1_111);

  const pit = new THREE.Mesh(
    kit.geometry("crevasse-pit", () => new THREE.CylinderGeometry(1.25, 1.05, 0.2, 11)),
    kit.flat("#2d2250"),
  );
  pit.position.y = 0.02;
  pit.receiveShadow = true;
  group.add(pit);

  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 256;
  faceCanvas.height = 256;
  paintHellFace(faceCanvas, 0);
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  const lava = new THREE.Mesh(new THREE.CircleGeometry(1.02, 16), new THREE.MeshBasicMaterial({ map: faceTexture }));
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = 0.13;
  group.add(lava);

  const shardCount = 11;
  for (let index = 0; index < shardCount; index += 1) {
    const angle = (index / shardCount) * Math.PI * 2 + random() * 0.2;
    // Kept short at the front so the camera looks into the pit.
    const front = Math.sin(angle) > 0.3;
    const height = front ? 0.35 + random() * 0.2 : 0.7 + random() * 0.6;
    const shard = new THREE.Mesh(
      kit.geometry(`ice-shard-${index % 3}`, () => jitterGeometry(new THREE.ConeGeometry(0.32, 1, 4), 0.06, index)),
      new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? "#cfefff" : "#a9dcf5",
        roughness: 0.15,
        metalness: 0.1,
        flatShading: true,
      }),
    );
    shard.scale.set(1, height, 1);
    shard.position.set(Math.cos(angle) * 1.32, height / 2, Math.sin(angle) * 1.32);
    shard.rotation.set((random() - 0.5) * 0.5, random() * Math.PI, (random() - 0.5) * 0.5);
    shard.castShadow = true;
    addOutline(shard, kit, 1.06);
    group.add(shard);
  }

  const glow = new THREE.PointLight("#c86bff", 6, 6, 1.6);
  glow.position.y = 0.8;
  group.add(glow);

  const sparkCount = 18;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkSeeds = Array.from({ length: sparkCount }, (_, index) => ({
    angle: index * 2.4,
    radius: 0.2 + ((index * 17) % 9) / 10,
    speed: 0.3 + ((index * 7) % 5) / 10,
    offset: ((index * 13) % 11) / 11,
  }));
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const sparks = new THREE.Points(
    sparkGeometry,
    new THREE.PointsMaterial({
      color: "#e6d4ff",
      size: 0.12,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(sparks);

  const label = createLabelSprite("ENFER", {
    color: "#ffffff",
    background: TILE_COLORS.hell.top,
    fontSize: 54,
    worldHeight: 0.62,
  });
  // In front of the pit, so it does not cover the shop tile 8 standing behind.
  label.position.set(0, 1.7, 0.9);
  group.add(label);

  let lastPaint = 0;
  return {
    group,
    update: (elapsed) => {
      glow.intensity = 5 + Math.sin(elapsed * 2.2) * 1.5;
      sparkSeeds.forEach((seed, index) => {
        const progress = (elapsed * seed.speed * 0.4 + seed.offset) % 1;
        sparkPositions[index * 3] = Math.cos(seed.angle + progress) * seed.radius;
        sparkPositions[index * 3 + 1] = 0.2 + progress * 2;
        sparkPositions[index * 3 + 2] = Math.sin(seed.angle + progress) * seed.radius;
      });
      sparkGeometry.attributes.position.needsUpdate = true;
      label.position.y = 1.7 + Math.sin(elapsed * 1.8) * 0.06;
      if (elapsed - lastPaint > 0.1) {
        lastPaint = elapsed;
        paintHellFace(faceCanvas, elapsed);
        faceTexture.needsUpdate = true;
      }
    },
  };
}
