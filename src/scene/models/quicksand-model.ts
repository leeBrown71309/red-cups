import * as THREE from "three";
import { createRandom, type SceneKit } from "../scene-kit";
import { paintHellFace } from "./landmarks-model";
import type { AnimatedProp } from "./props-model";

/**
 * Hell of the Désert: the Quicksand, a sinkhole in the middle of the dunes. Rings of sand wind slowly down into a dark
 * pit where the purple face of Hell glows, a skeletal hand reaches out of the grit and sinks again, and fine sand
 * keeps trickling in from the rim.
 */
export function createQuicksand(kit: SceneKit): AnimatedProp {
  const group = new THREE.Group();

  const swirl = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float arms = sin(a * 4.0 + r * 10.0 - uTime * 1.2);
        float rings = sin(r * 26.0 + uTime * 1.6);
        vec3 light = vec3(0.93, 0.80, 0.55);
        vec3 dark = vec3(0.62, 0.42, 0.22);
        vec3 color = mix(dark, light, smoothstep(-0.2, 0.9, arms * 0.6 + rings * 0.25 + r * 0.6));
        float edge = 1.0 - smoothstep(0.82, 1.0, r);
        float core = smoothstep(0.2, 0.4, r);
        gl_FragColor = vec4(color, edge * core);
      }
    `,
  });
  const whirl = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), swirl);
  whirl.rotation.x = -Math.PI / 2;
  whirl.position.y = 0.05;
  whirl.renderOrder = 2;
  whirl.raycast = () => undefined;
  group.add(whirl);

  const pit = new THREE.Mesh(
    kit.geometry("quicksand-pit", () => new THREE.CylinderGeometry(1.7, 1.2, 0.2, 20)),
    kit.flat("#3a2418"),
  );
  pit.position.y = 0.0;
  pit.receiveShadow = true;
  group.add(pit);

  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 256;
  faceCanvas.height = 256;
  paintHellFace(faceCanvas, 0);
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 24),
    new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, depthWrite: false }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.12;
  face.renderOrder = 3;
  face.raycast = () => undefined;
  group.add(face);

  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.68, 0.14, 6, 28), kit.flat("#b9895a"));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.1;
  group.add(lip);

  // A hand that reaches up out of the sand, and slowly sinks back.
  const hand = new THREE.Group();
  const palm = new THREE.Mesh(
    kit.geometry("qs-palm", () => new THREE.BoxGeometry(0.34, 0.1, 0.3)),
    kit.flat("#efe6cf"),
  );
  hand.add(palm);
  for (let finger = 0; finger < 4; finger += 1) {
    const bone = new THREE.Mesh(
      kit.geometry("qs-finger", () => new THREE.CylinderGeometry(0.03, 0.04, 0.34, 4)),
      kit.flat("#efe6cf"),
    );
    bone.position.set(-0.12 + finger * 0.08, 0.2, 0);
    bone.rotation.z = (finger - 1.5) * 0.12;
    hand.add(bone);
  }
  const wrist = new THREE.Mesh(
    kit.geometry("qs-wrist", () => new THREE.CylinderGeometry(0.06, 0.07, 0.8, 5)),
    kit.flat("#e2d8bd"),
  );
  wrist.position.y = -0.4;
  hand.add(wrist);
  hand.position.set(2.5, 0, -1.2);
  hand.rotation.set(0, 0.6, 0.18);
  group.add(hand);

  const glow = new THREE.PointLight("#c28bff", 4, 7, 1.6);
  glow.position.y = 0.9;
  group.add(glow);

  const random = createRandom(5_150);
  const count = 26;
  const positions = new Float32Array(count * 3);
  const seeds = Array.from({ length: count }, (_, index) => ({
    angle: random() * Math.PI * 2,
    radius: 1.8 + random() * 2,
    speed: 0.2 + random() * 0.3,
    offset: random(),
    index,
  }));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const grains = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: "#f3d9a2", size: 0.12, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  grains.frustumCulled = false;
  group.add(grains);

  let nextFace = 0;
  return {
    group,
    update: (elapsed) => {
      swirl.uniforms.uTime.value = elapsed;
      glow.intensity = 3.4 + Math.sin(elapsed * 2.4) * 0.9;
      hand.position.y = -0.2 + Math.max(0, Math.sin(elapsed * 0.5)) * 0.65;
      hand.rotation.z = 0.18 + Math.sin(elapsed * 1.7) * 0.08;
      if (elapsed >= nextFace) {
        nextFace = elapsed + 0.12;
        paintHellFace(faceCanvas, elapsed);
        faceTexture.needsUpdate = true;
      }
      for (const seed of seeds) {
        // Grains slide down the slope towards the pit and vanish into it.
        const progress = (elapsed * seed.speed + seed.offset) % 1;
        const radius = seed.radius * (1 - progress * 0.85);
        const angle = seed.angle + progress * 1.6;
        positions[seed.index * 3] = Math.cos(angle) * radius;
        positions[seed.index * 3 + 1] = 0.12 + (1 - progress) * 0.2;
        positions[seed.index * 3 + 2] = Math.sin(angle) * radius;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
