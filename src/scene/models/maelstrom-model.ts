import * as THREE from "three";
import { createRandom, type SceneKit } from "../scene-kit";
import { paintHellFace } from "./landmarks-model";
import type { AnimatedProp } from "./props-model";

/**
 * Hell of the Archipel: the Maelström, a whirlpool in the middle of the ring of islands. White-capped spiral arms
 * wind round a dark abyss where the purple face of Hell glows, and the pawns sent there stand on the glow. A few
 * sparks rise out of it, and the water around it never stops turning.
 */
export function createMaelstrom(kit: SceneKit): AnimatedProp {
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
        float arms = sin(a * 3.0 - r * 9.0 + uTime * 2.6);
        float rings = sin(r * 22.0 - uTime * 3.2);
        float foam = smoothstep(0.62, 1.0, arms) * smoothstep(0.18, 0.5, r);
        float edge = 1.0 - smoothstep(0.78, 1.0, r);
        float core = smoothstep(0.2, 0.38, r);
        vec3 deep = vec3(0.04, 0.22, 0.42);
        vec3 water = vec3(0.12, 0.62, 0.78);
        vec3 color = mix(deep, water, smoothstep(0.2, 0.9, r));
        color += vec3(0.25) * smoothstep(0.7, 1.0, rings) * 0.35;
        color = mix(color, vec3(1.0), foam * 0.85);
        gl_FragColor = vec4(color, edge * core * 0.92);
      }
    `,
  });
  const whirl = new THREE.Mesh(new THREE.CircleGeometry(3.7, 48), swirl);
  whirl.rotation.x = -Math.PI / 2;
  whirl.position.y = 0.1;
  whirl.renderOrder = 2;
  whirl.raycast = () => undefined;
  group.add(whirl);

  const abyss = new THREE.Mesh(
    kit.geometry("maelstrom-abyss", () => new THREE.CylinderGeometry(1.45, 1.1, 0.16, 20)),
    kit.flat("#1d1345"),
  );
  abyss.position.y = 0.04;
  abyss.receiveShadow = true;
  group.add(abyss);

  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 256;
  faceCanvas.height = 256;
  paintHellFace(faceCanvas, 0);
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 24),
    new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, depthWrite: false }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.14;
  face.renderOrder = 3;
  face.raycast = () => undefined;
  group.add(face);

  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(1.42, 0.09, 6, 28),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85 }),
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.13;
  group.add(lip);

  const glow = new THREE.PointLight("#b36bff", 5, 7, 1.6);
  glow.position.y = 0.9;
  group.add(glow);

  const random = createRandom(4_040);
  const sparkCount = 24;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkSeeds = Array.from({ length: sparkCount }, (_, index) => ({
    angle: random() * Math.PI * 2,
    radius: 0.2 + random() * 1.0,
    speed: 0.25 + random() * 0.45,
    offset: random(),
    index,
  }));
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  const sparks = new THREE.Points(
    sparkGeometry,
    new THREE.PointsMaterial({ color: "#e6d4ff", size: 0.13, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  sparks.frustumCulled = false;
  group.add(sparks);

  let nextFace = 0;
  return {
    group,
    update: (elapsed) => {
      swirl.uniforms.uTime.value = elapsed;
      glow.intensity = 4.2 + Math.sin(elapsed * 2.4) * 1.1;
      lip.scale.setScalar(1 + Math.sin(elapsed * 2.4) * 0.03);
      // The face of Hell breathes: repainted a few times a second, as the other maps' Hell does.
      if (elapsed >= nextFace) {
        nextFace = elapsed + 0.12;
        paintHellFace(faceCanvas, elapsed);
        faceTexture.needsUpdate = true;
      }
      for (const seed of sparkSeeds) {
        const progress = (elapsed * seed.speed + seed.offset) % 1;
        const angle = seed.angle + elapsed * 0.7;
        sparkPositions[seed.index * 3] = Math.cos(angle) * seed.radius * (1 - progress * 0.4);
        sparkPositions[seed.index * 3 + 1] = 0.2 + progress * 1.9;
        sparkPositions[seed.index * 3 + 2] = Math.sin(angle) * seed.radius * (1 - progress * 0.4);
      }
      sparkGeometry.attributes.position.needsUpdate = true;
    },
  };
}
