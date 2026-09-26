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
const FIRE_COLORS = ["#fff1a8", "#ffd166", "#ff9f43", "#ff5e3a", "#e8453c"];
const SMOKE_COLOR = "#4a3d45";

/** Short-lived juice: floating coin numbers, confetti bursts, poofs and explosions. */
export class EffectsLayer {
  readonly group = new THREE.Group();
  private readonly effects: TransientEffect[] = [];
  private readonly confettiGeometry = new THREE.PlaneGeometry(0.14, 0.09);
  private readonly poofGeometry = new THREE.IcosahedronGeometry(0.16, 0);
  private readonly flashGeometry = new THREE.SphereGeometry(1, 16, 12);
  private readonly shockwaveGeometry = new THREE.RingGeometry(0.82, 1, 40);
  private readonly debrisGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);

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

  /** A grey puff left behind by Bullet Bill's engine. */
  spawnSmokePuff(position: THREE.Vector3): void {
    const material = new THREE.MeshBasicMaterial({ color: "#d9d2d6", transparent: true, opacity: 0.75 });
    const puff = new THREE.Mesh(this.poofGeometry, material);
    const origin = position.clone();
    const drift = new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      0.5 + Math.random() * 0.3,
      (Math.random() - 0.5) * 0.4,
    );
    this.push(puff, 0.8, (progress) => {
      puff.position.copy(origin).addScaledVector(drift, progress);
      puff.scale.setScalar(1 + progress * 2.2);
      material.opacity = 0.75 * (1 - progress);
    });
  }

  /** Bullet Bill's impact: flash, fireball, shockwave, debris, smoke and a big "BOUM !". */
  spawnExplosion(position: THREE.Vector3): void {
    const center = position.clone().add(new THREE.Vector3(0, 0.8, 0));

    const flashMaterial = additive("#fff3b0", 1);
    const flash = new THREE.Mesh(this.flashGeometry, flashMaterial);
    flash.position.copy(center);
    this.push(flash, 0.32, (progress) => {
      flash.scale.setScalar(0.3 + easeOutBack(progress) * 1.9);
      flashMaterial.opacity = 1 - progress;
    });

    const shockMaterial = additive("#ffd166", 0.9);
    const shockwave = new THREE.Mesh(this.shockwaveGeometry, shockMaterial);
    shockwave.rotation.x = -Math.PI / 2;
    shockwave.position.copy(position).setY(position.y + 0.08);
    this.push(shockwave, 0.6, (progress) => {
      shockwave.scale.setScalar(0.3 + (1 - (1 - progress) ** 3) * 4);
      shockMaterial.opacity = 0.9 * (1 - progress);
    });

    for (let index = 0; index < 18; index += 1) {
      const material = additive(FIRE_COLORS[index % FIRE_COLORS.length], 1);
      const fire = new THREE.Mesh(this.poofGeometry, material);
      const direction = randomHemisphereDirection(0.25);
      const reach = 1.1 + Math.random() * 1.1;
      const size = 1.6 + Math.random() * 1.8;
      this.push(fire, 0.55 + Math.random() * 0.35, (progress) => {
        const eased = 1 - (1 - progress) ** 2;
        fire.position.copy(center).addScaledVector(direction, eased * reach);
        fire.scale.setScalar(size * (progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) * 0.8));
        material.opacity = 1 - progress;
      });
    }

    for (let index = 0; index < 10; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: SMOKE_COLOR, transparent: true, opacity: 0.8 });
      const smoke = new THREE.Mesh(this.poofGeometry, material);
      const direction = randomHemisphereDirection(0.6);
      this.push(smoke, 1.4 + Math.random() * 0.5, (progress) => {
        smoke.position
          .copy(center)
          .addScaledVector(direction, progress * 1.3)
          .add(new THREE.Vector3(0, progress, 0));
        smoke.scale.setScalar(1.5 + progress * 3);
        material.opacity = 0.8 * (1 - progress) * Math.min(1, progress * 6);
      });
    }

    for (let index = 0; index < 12; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? "#ffd166" : SCENE_COLORS.ink });
      const debris = new THREE.Mesh(this.debrisGeometry, material);
      const velocity = randomHemisphereDirection(0.4).multiplyScalar(4 + Math.random() * 3);
      const spin = new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      debris.position.copy(center);
      this.push(debris, 1.1, (progress, deltaSeconds) => {
        velocity.y -= 12 * deltaSeconds;
        debris.position.addScaledVector(velocity, deltaSeconds);
        debris.position.y = Math.max(position.y, debris.position.y);
        debris.rotation.x += spin.x * deltaSeconds;
        debris.rotation.y += spin.y * deltaSeconds;
        debris.scale.setScalar(1 - progress * 0.6);
      });
    }

    const label = createLabelSprite("BOUM !", {
      color: "#ffd166",
      stroke: SCENE_COLORS.ink,
      fontSize: 96,
      worldHeight: 1,
    });
    (label.material as THREE.SpriteMaterial).depthTest = false;
    label.renderOrder = 11;
    const labelStart = center.clone().add(new THREE.Vector3(0, 1.2, 0));
    const labelScale = label.scale.clone();
    this.push(label, 1.5, (progress) => {
      label.position.copy(labelStart).setY(labelStart.y + progress * 0.8);
      const pop = progress < 0.15 ? Math.max(0.01, easeOutBack(progress / 0.15)) : 1;
      label.scale.set(labelScale.x * pop, labelScale.y * pop, 1);
      label.material.opacity = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
    });
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
    this.flashGeometry.dispose();
    this.shockwaveGeometry.dispose();
    this.debrisGeometry.dispose();
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

function additive(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Random unit vector above the ground; `minimumUp` keeps it from grazing the board. */
function randomHemisphereDirection(minimumUp: number): THREE.Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const up = minimumUp + Math.random() * (1 - minimumUp);
  const flat = Math.sqrt(1 - up * up);
  return new THREE.Vector3(Math.cos(angle) * flat, up, Math.sin(angle) * flat);
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
