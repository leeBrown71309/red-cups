import * as THREE from "three";
import { SCENE_COLORS } from "../theme/palette";
import { easeOutBack } from "./scene-kit";
import { createLabelSprite } from "./text-sprites";

interface TransientEffect {
  object: THREE.Object3D;
  age: number;
  lifetime: number;
  update: (progress: number, deltaSeconds: number) => void;
}

const CONFETTI_COLORS = ["#e8453c", "#ffc94d", "#5cc46a", "#4fa5f2", "#ff8fc7", "#ffffff"];

/** Short-lived juice: floating coin numbers, confetti bursts and poofs. */
export class EffectsLayer {
  readonly group = new THREE.Group();
  private readonly effects: TransientEffect[] = [];
  private readonly confettiGeometry = new THREE.PlaneGeometry(0.14, 0.09);
  private readonly poofGeometry = new THREE.IcosahedronGeometry(0.16, 0);

  spawnFloatingText(position: THREE.Vector3, text: string, color: string): void {
    const sprite = createLabelSprite(text, { color, stroke: SCENE_COLORS.ink, fontSize: 72, worldHeight: 0.62 });
    const start = position.clone().add(new THREE.Vector3(0, 1.6, 0));
    sprite.position.copy(start);
    sprite.renderOrder = 10;
    (sprite.material as THREE.SpriteMaterial).depthTest = false;
    const baseScale = sprite.scale.clone();
    this.push(sprite, 1.6, (progress) => {
      sprite.position.y = start.y + (1 - (1 - progress) ** 2) * 1.1;
      const pop = progress < 0.12 ? Math.max(0.01, easeOutBack(progress / 0.12)) : 1;
      sprite.scale.set(baseScale.x * pop, baseScale.y * pop, 1);
      sprite.material.opacity = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
    });
  }

  spawnConfetti(position: THREE.Vector3, amount = 46): void {
    for (let index = 0; index < amount; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        side: THREE.DoubleSide,
        transparent: true,
      });
      const piece = new THREE.Mesh(this.confettiGeometry, material);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 3;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed * 0.5,
        4 + Math.random() * 3.5,
        Math.sin(angle) * speed * 0.5,
      );
      const spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      piece.position.copy(position).add(new THREE.Vector3(0, 1.2, 0));
      this.push(piece, 1.8 + Math.random() * 0.6, (progress, deltaSeconds) => {
        velocity.y -= 9 * deltaSeconds;
        velocity.multiplyScalar(0.985);
        piece.position.addScaledVector(velocity, deltaSeconds);
        piece.rotation.x += spin.x * deltaSeconds;
        piece.rotation.y += spin.y * deltaSeconds;
        piece.rotation.z += spin.z * deltaSeconds;
        material.opacity = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;
      });
    }
  }

  spawnPoof(position: THREE.Vector3, color = "#ffffff"): void {
    for (let index = 0; index < 9; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true });
      const puff = new THREE.Mesh(this.poofGeometry, material);
      const angle = (index / 9) * Math.PI * 2;
      const direction = new THREE.Vector3(Math.cos(angle), 0.35, Math.sin(angle));
      const origin = position.clone().add(new THREE.Vector3(0, 0.5, 0));
      this.push(puff, 0.55, (progress) => {
        puff.position.copy(origin).addScaledVector(direction, progress * 0.9);
        puff.scale.setScalar(1 + progress * 1.4);
        material.opacity = 1 - progress;
      });
    }
  }

  update(deltaSeconds: number): void {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.age += deltaSeconds;
      const progress = Math.min(1, effect.age / effect.lifetime);
      effect.update(progress, deltaSeconds);
      if (progress >= 1) {
        this.group.remove(effect.object);
        disposeTransient(effect.object);
        this.effects.splice(index, 1);
      }
    }
  }

  dispose(): void {
    for (const effect of this.effects) disposeTransient(effect.object);
    this.effects.length = 0;
    this.confettiGeometry.dispose();
    this.poofGeometry.dispose();
  }

  private push(
    object: THREE.Object3D,
    lifetime: number,
    update: (progress: number, deltaSeconds: number) => void,
  ): void {
    this.group.add(object);
    this.effects.push({ object, age: 0, lifetime, update });
  }
}

/** Transient effects own their materials (and sprite textures) but share geometries. */
function disposeTransient(object: THREE.Object3D): void {
  if (object instanceof THREE.Sprite) {
    object.material.map?.dispose();
    object.material.dispose();
  } else if (object instanceof THREE.Mesh) {
    (object.material as THREE.Material).dispose();
  }
}
