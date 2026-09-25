import * as THREE from "three";
import { SCENE_COLORS, TILE_COLORS } from "../../theme/palette";
import { addOutline, jitterGeometry, type SceneKit } from "../scene-kit";
import { createLabelSprite, DISPLAY_FONT } from "../text-sprites";
import type { AnimatedProp } from "./props-model";

/** Little market booth that sits next to every blue shop tile. */
export function createShopStall(kit: SceneKit): THREE.Group {
  const stall = new THREE.Group();
  const wood = kit.flat(SCENE_COLORS.wood);

  const counter = new THREE.Mesh(
    kit.geometry("stall-counter", () => new THREE.BoxGeometry(1.2, 0.5, 0.55)),
    wood,
  );
  counter.position.y = 0.25;
  counter.castShadow = true;
  addOutline(counter, kit, 1.04);
  stall.add(counter);

  const front = new THREE.Mesh(
    kit.geometry("stall-front", () => new THREE.BoxGeometry(1.22, 0.14, 0.57)),
    kit.flat(TILE_COLORS.shop.top),
  );
  front.position.y = 0.44;
  stall.add(front);

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      kit.geometry("stall-post", () => new THREE.CylinderGeometry(0.045, 0.045, 1.25, 5)),
      wood,
    );
    post.position.set(side * 0.55, 0.62, -0.18);
    post.castShadow = true;
    stall.add(post);
  }

  const stripes = 5;
  const stripeWidth = 1.36 / stripes;
  for (let index = 0; index < stripes; index += 1) {
    const stripe = new THREE.Mesh(
      kit.geometry("stall-stripe", () => new THREE.BoxGeometry(stripeWidth, 0.06, 0.8)),
      kit.flat(index % 2 === 0 ? TILE_COLORS.shop.top : SCENE_COLORS.awningStripe),
    );
    stripe.position.set(-0.68 + stripeWidth * (index + 0.5), 1.28, 0.02);
    stripe.rotation.x = 0.32;
    stripe.castShadow = true;
    stall.add(stripe);
  }

  const coin = new THREE.Mesh(
    kit.geometry("stall-coin", () => new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10)),
    kit.flat("#ffc94d", { emissive: "#ffb000", emissiveIntensity: 0.25 }),
  );
  coin.rotation.x = Math.PI / 2;
  coin.position.set(0, 1.62, -0.1);
  addOutline(coin, kit, 1.12);
  stall.add(coin);

  const goods = ["#ff6f61", "#7ee07a", "#ffd166"];
  goods.forEach((color, index) => {
    const good = new THREE.Mesh(
      kit.geometry("stall-good", () => new THREE.IcosahedronGeometry(0.1, 0)),
      kit.flat(color),
    );
    good.position.set(-0.32 + index * 0.32, 0.6, 0.05);
    good.castShadow = true;
    stall.add(good);
  });

  return stall;
}

/** Tile 11: a sunken crater with a grinning lava face, like the purple smiley of the original board. */
export function createHellPit(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();

  const crater = new THREE.Mesh(
    jitterGeometry(new THREE.TorusGeometry(1.25, 0.45, 5, 12), 0.12, 11),
    kit.flat(SCENE_COLORS.hellRock),
  );
  crater.rotation.x = Math.PI / 2;
  crater.scale.set(1, 1, 0.55);
  crater.position.y = 0.2;
  crater.castShadow = true;
  crater.receiveShadow = true;
  addOutline(crater, kit, 1.03);
  group.add(crater);

  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 256;
  faceCanvas.height = 256;
  paintHellFace(faceCanvas, 0);
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  const lava = new THREE.Mesh(new THREE.CircleGeometry(1.12, 14), new THREE.MeshBasicMaterial({ map: faceTexture }));
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = 0.12;
  group.add(lava);

  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(
      kit.geometry("hell-horn", () => new THREE.ConeGeometry(0.28, 0.75, 5)),
      kit.flat("#3d2654"),
    );
    horn.position.set(side * 1.05, 0.62, -0.75);
    horn.rotation.z = -side * 0.42;
    horn.rotation.x = -0.25;
    horn.castShadow = true;
    addOutline(horn, kit, 1.08);
    group.add(horn);
  }

  const glow = new THREE.PointLight("#c86bff", 6, 6, 1.6);
  glow.position.y = 0.9;
  group.add(glow);

  const emberCount = 22;
  const emberPositions = new Float32Array(emberCount * 3);
  const emberSeeds = Array.from({ length: emberCount }, (_, index) => ({
    angle: (index / emberCount) * Math.PI * 2 * 3.7,
    radius: 0.3 + ((index * 37) % 10) / 12,
    speed: 0.35 + ((index * 13) % 7) / 10,
    offset: ((index * 29) % 17) / 17,
  }));
  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute("position", new THREE.BufferAttribute(emberPositions, 3));
  const embers = new THREE.Points(
    emberGeometry,
    new THREE.PointsMaterial({
      color: "#f3a6ff",
      size: 0.13,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(embers);

  const label = createLabelSprite("ENFER", {
    color: "#ffffff",
    background: TILE_COLORS.hell.top,
    fontSize: 54,
    worldHeight: 0.62,
  });
  label.position.set(0, 2.25, -0.3);
  group.add(label);

  let lastPaint = 0;
  return {
    group,
    update: (elapsed) => {
      glow.intensity = 5 + Math.sin(elapsed * 2.4) * 1.6;
      emberSeeds.forEach((seed, index) => {
        const progress = (elapsed * seed.speed * 0.4 + seed.offset) % 1;
        emberPositions[index * 3] = Math.cos(seed.angle + progress) * seed.radius;
        emberPositions[index * 3 + 1] = 0.2 + progress * 2.2;
        emberPositions[index * 3 + 2] = Math.sin(seed.angle + progress) * seed.radius;
      });
      emberGeometry.attributes.position.needsUpdate = true;
      label.position.y = 2.25 + Math.sin(elapsed * 1.8) * 0.06;

      // Repainting the face ten times per second is enough for a lazy blink cycle.
      if (elapsed - lastPaint > 0.1) {
        lastPaint = elapsed;
        paintHellFace(faceCanvas, elapsed);
        faceTexture.needsUpdate = true;
      }
    },
  };
}

function paintHellFace(canvas: HTMLCanvasElement, elapsed: number): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const size = canvas.width;
  const center = size / 2;
  const pulse = 0.5 + Math.sin(elapsed * 2.4) * 0.5;
  const gradient = context.createRadialGradient(center, center, 10, center, center, center);
  gradient.addColorStop(0, `rgb(255, ${170 + pulse * 40}, 255)`);
  gradient.addColorStop(0.45, "#d173ff");
  gradient.addColorStop(1, "#6b2fb3");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const blinking = elapsed % 4.2 > 4.05;
  context.fillStyle = "#3a1760";
  for (const side of [-1, 1]) {
    context.beginPath();
    context.ellipse(center + side * 44, center - 34, 20, blinking ? 3 : 26, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.beginPath();
  context.lineWidth = 16;
  context.lineCap = "round";
  context.strokeStyle = "#3a1760";
  context.arc(center, center + 6, 62, 0.18 * Math.PI, 0.82 * Math.PI);
  context.stroke();
}

/** Arched opening in the tray rim: players walk in on one side and pop out on the other. */
export function createTunnelPortal(kit: SceneKit, facing: 1 | -1, signText: string): AnimatedProp {
  const group = new THREE.Group();
  const holder = new THREE.Group();
  holder.rotation.y = facing * (Math.PI / 2);
  group.add(holder);

  const archShape = new THREE.Shape();
  archShape.moveTo(-0.62, 0);
  archShape.lineTo(-0.62, 0.62);
  archShape.absarc(0, 0.62, 0.62, Math.PI, 0, true);
  archShape.lineTo(0.62, 0);
  archShape.closePath();
  const hole = new THREE.Mesh(new THREE.ShapeGeometry(archShape, 8), kit.unlit("#1d1430"));
  hole.position.z = 0.01;
  holder.add(hole);

  const swirlTexture = createSwirlTexture();
  const swirl = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 20),
    new THREE.MeshBasicMaterial({
      map: swirlTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  swirl.position.set(0, 0.62, 0.02);
  holder.add(swirl);

  const stone = kit.flat("#d9cbb8");
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.12, 4, 9, Math.PI), stone);
  frame.position.y = 0.62;
  frame.castShadow = true;
  addOutline(frame, kit, 1.05);
  holder.add(frame);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(
      kit.geometry("tunnel-pillar", () => new THREE.BoxGeometry(0.24, 0.66, 0.24)),
      stone,
    );
    pillar.position.set(side * 0.66, 0.31, 0);
    pillar.castShadow = true;
    holder.add(pillar);
  }

  const sign = createLabelSprite(signText, {
    color: "#ffffff",
    background: "#2f9fd0",
    fontSize: 44,
    worldHeight: 0.46,
  });
  sign.position.set(facing * 0.7, 1.95, 0);
  group.add(sign);

  return {
    group,
    update: (elapsed) => {
      swirl.rotation.z = elapsed * -2.2;
      swirl.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.05);
      sign.position.y = 1.95 + Math.sin(elapsed * 2 + facing) * 0.05;
    },
  };
}

function createSwirlTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const center = 64;
    const gradient = context.createRadialGradient(center, center, 4, center, center, 64);
    gradient.addColorStop(0, "rgba(180, 250, 255, 1)");
    gradient.addColorStop(0.6, "rgba(60, 180, 240, 0.7)");
    gradient.addColorStop(1, "rgba(30, 60, 120, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    context.strokeStyle = "rgba(255, 255, 255, 0.85)";
    context.lineWidth = 5;
    context.lineCap = "round";
    for (let arm = 0; arm < 3; arm += 1) {
      context.beginPath();
      for (let step = 0; step < 40; step += 1) {
        const angle = arm * ((Math.PI * 2) / 3) + step * 0.16;
        const radius = step * 1.4;
        context.lineTo(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
      }
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Waving flag planted on the start tile. */
export function createStartFlag(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 6), kit.flat("#f8e9d4"));
  pole.position.y = 0.95;
  pole.castShadow = true;
  addOutline(pole, kit, 1.2);
  group.add(pole);

  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), kit.flat("#ffc94d"));
  knob.position.y = 1.95;
  group.add(knob);

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = SCENE_COLORS.cupRed;
    context.fillRect(0, 0, 256, 160);
    context.fillStyle = "#ffffff";
    context.font = `700 70px ${DISPLAY_FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("GO!", 128, 84);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const flagGeometry = new THREE.PlaneGeometry(0.9, 0.56, 8, 2);
  flagGeometry.translate(0.45, 0, 0);
  const basePositions = Float32Array.from(flagGeometry.attributes.position.array as Float32Array);
  const flag = new THREE.Mesh(
    flagGeometry,
    new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 0.8, flatShading: true }),
  );
  flag.position.set(0.05, 1.6, 0);
  flag.castShadow = true;
  group.add(flag);

  return {
    group,
    update: (elapsed) => {
      const positions = flagGeometry.attributes.position.array as Float32Array;
      for (let index = 0; index < positions.length; index += 3) {
        const x = basePositions[index];
        positions[index + 2] = Math.sin(elapsed * 4 - x * 5) * 0.09 * x;
      }
      flagGeometry.attributes.position.needsUpdate = true;
      flagGeometry.computeVertexNormals();
    },
  };
}
