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
const GHOST_MIST_COLORS = ["#b77bff", "#7dffc8", "#8a4dff", "#c9fff0"];

/** Short-lived juice: floating coin numbers, confetti bursts, poofs and explosions. */
export class EffectsLayer {
  readonly group = new THREE.Group();
  private readonly effects: TransientEffect[] = [];
  private disposed = false;
  private readonly confettiGeometry = new THREE.PlaneGeometry(0.14, 0.09);
  private readonly poofGeometry = new THREE.IcosahedronGeometry(0.16, 0);
  private readonly flashGeometry = new THREE.SphereGeometry(1, 16, 12);
  private readonly shockwaveGeometry = new THREE.RingGeometry(0.82, 1, 40);
  private readonly debrisGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private readonly iceShardGeometry = new THREE.ConeGeometry(0.08, 0.3, 4);
  private readonly iceChunkGeometry = new THREE.IcosahedronGeometry(0.28, 0);
  private readonly streakGeometry = new THREE.PlaneGeometry(0.9, 0.05);

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

  /** Banquise: shards of ice bursting out, when a block breaks or a tile freezes or melts. */
  spawnIceBurst(position: THREE.Vector3, amount = 14): void {
    for (let index = 0; index < amount; index += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? "#dff6ff" : "#a9dcf5",
        roughness: 0.1,
        metalness: 0.2,
        flatShading: true,
        transparent: true,
      });
      const shard = new THREE.Mesh(this.iceShardGeometry, material);
      const velocity = randomHemisphereDirection(0.35).multiplyScalar(2.5 + Math.random() * 2.5);
      const spin = new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9);
      shard.position.copy(position).add(new THREE.Vector3(0, 0.5, 0));
      this.push(shard, 0.9 + Math.random() * 0.3, (progress, deltaSeconds) => {
        velocity.y -= 11 * deltaSeconds;
        shard.position.addScaledVector(velocity, deltaSeconds);
        shard.position.y = Math.max(position.y + 0.05, shard.position.y);
        shard.rotation.x += spin.x * deltaSeconds;
        shard.rotation.z += spin.z * deltaSeconds;
        material.opacity = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;
      });
    }
  }

  /**
   * Banquise: chunks of ice dropping from the sky onto a sliding player. A hit
   * lands right on the pawn; a miss crashes beside it.
   */
  spawnIceFall(position: THREE.Vector3, hit: boolean): void {
    const target = hit ? position.clone() : position.clone().add(new THREE.Vector3(1.1, 0, -0.6));
    for (let index = 0; index < 6; index += 1) {
      const material = new THREE.MeshStandardMaterial({ color: "#cfefff", roughness: 0.1, flatShading: true });
      const chunk = new THREE.Mesh(this.iceChunkGeometry, material);
      const offset = new THREE.Vector3((Math.random() - 0.5) * 0.7, 0, (Math.random() - 0.5) * 0.7);
      const delay = index * 0.07;
      chunk.scale.setScalar(0.001);
      this.push(chunk, 0.75 + delay, (progress) => {
        const time = progress * (0.75 + delay) - delay;
        if (time < 0) return;
        const fall = Math.min(1, time / 0.45);
        chunk.scale.setScalar(0.7);
        chunk.position
          .copy(target)
          .add(offset)
          .setY(target.y + 7 * (1 - fall * fall) + 0.3);
        chunk.rotation.set(fall * 4, fall * 2, 0);
      });
    }
    // The chunks shatter as they reach the ground.
    window.setTimeout(() => {
      if (!this.disposed) this.spawnIceBurst(target, hit ? 18 : 10);
    }, 520);
  }

  /** Banquise: a gust of snow blown across the whole tray, from left to right. */
  spawnBlizzard(halfWidth: number, halfDepth: number): void {
    for (let index = 0; index < 170; index += 1) {
      const material = additive("#ffffff", 0.85);
      const streak = new THREE.Mesh(this.streakGeometry, material);
      const z = (Math.random() * 2 - 1) * (halfDepth + 1);
      const y = 0.4 + Math.random() * 4;
      const speed = 0.6 + Math.random() * 0.7;
      const start = -halfWidth - 4 - Math.random() * 10;
      const wave = Math.random() * Math.PI * 2;
      streak.rotation.y = -0.12;
      this.push(streak, 2.6, (progress) => {
        streak.position.set(
          start + progress * (halfWidth * 2 + 18) * speed,
          y + Math.sin(progress * 9 + wave) * 0.25,
          z,
        );
        material.opacity = 0.85 * Math.sin(progress * Math.PI);
      });
    }
  }

  /** Luna Park: the ghost's violet and green mist, swirling up as it rises from or melts into the ground. */
  spawnGhostMist(position: THREE.Vector3, amount = 16): void {
    for (let index = 0; index < amount; index += 1) {
      const material = additive(GHOST_MIST_COLORS[index % GHOST_MIST_COLORS.length], 0.7);
      const puff = new THREE.Mesh(this.poofGeometry, material);
      const angle = (index / amount) * Math.PI * 2 + Math.random() * 0.4;
      const reach = 0.6 + Math.random() * 0.7;
      const rise = 0.8 + Math.random() * 1.4;
      const size = 1.4 + Math.random() * 1.6;
      const swirl = 1.6 + Math.random() * 1.2;
      this.push(puff, 1.1 + Math.random() * 0.5, (progress) => {
        const eased = 1 - (1 - progress) ** 2;
        const turn = angle + eased * swirl;
        puff.position.set(
          position.x + Math.cos(turn) * reach * eased,
          position.y + 0.2 + rise * eased,
          position.z + Math.sin(turn) * reach * eased,
        );
        puff.scale.setScalar(size * (0.4 + eased));
        material.opacity = 0.7 * (1 - progress) * Math.min(1, progress * 8);
      });
    }
  }

  /** Luna Park: one wisp of the trail the ghost leaves as it flies. */
  spawnGhostWisp(position: THREE.Vector3): void {
    const material = additive(GHOST_MIST_COLORS[Math.floor(Math.random() * GHOST_MIST_COLORS.length)], 0.5);
    const wisp = new THREE.Mesh(this.poofGeometry, material);
    const origin = position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4));
    this.push(wisp, 0.7, (progress) => {
      wisp.position.copy(origin).setY(origin.y + progress * 0.35);
      wisp.scale.setScalar(1.6 * (1 - progress * 0.6));
      material.opacity = 0.5 * (1 - progress);
    });
  }

  /** Luna Park: the ghost's slap lands, a white flash, a ring and a big "PAF !". */
  spawnSlapImpact(position: THREE.Vector3): void {
    const flashMaterial = additive("#ffffff", 1);
    const flash = new THREE.Mesh(this.flashGeometry, flashMaterial);
    flash.position.copy(position);
    this.push(flash, 0.22, (progress) => {
      flash.scale.setScalar(0.15 + easeOutBack(progress) * 0.55);
      flashMaterial.opacity = 1 - progress;
    });

    const ringMaterial = additive("#c9a2ff", 0.9);
    const ring = new THREE.Mesh(this.shockwaveGeometry, ringMaterial);
    ring.position.copy(position);
    ring.lookAt(position.x, position.y, position.z + 1);
    this.push(ring, 0.4, (progress) => {
      ring.scale.setScalar(0.2 + (1 - (1 - progress) ** 3) * 1.2);
      ringMaterial.opacity = 0.9 * (1 - progress);
    });

    for (let index = 0; index < 8; index += 1) {
      const material = additive(index % 2 === 0 ? "#ffffff" : "#ffd166", 1);
      const streak = new THREE.Mesh(this.streakGeometry, material);
      const angle = (index / 8) * Math.PI * 2;
      streak.rotation.z = angle;
      this.push(streak, 0.3, (progress) => {
        const reach = 0.25 + progress * 0.7;
        streak.position.set(
          position.x + Math.cos(angle) * reach,
          position.y + Math.sin(angle) * reach,
          position.z + 0.1,
        );
        streak.scale.set(0.5 * (1 - progress), 1.4, 1);
        material.opacity = 1 - progress;
      });
    }

    const label = createLabelSprite("PAF !", {
      color: "#ffffff",
      stroke: "#5b1d8f",
      fontSize: 96,
      worldHeight: 0.8,
    });
    (label.material as THREE.SpriteMaterial).depthTest = false;
    label.renderOrder = 11;
    const labelStart = position.clone().add(new THREE.Vector3(0.3, 0.7, 0));
    const labelScale = label.scale.clone();
    this.push(label, 1.1, (progress) => {
      label.position.copy(labelStart).setY(labelStart.y + progress * 0.5);
      const pop = progress < 0.15 ? Math.max(0.01, easeOutBack(progress / 0.15)) : 1;
      label.scale.set(labelScale.x * pop, labelScale.y * pop, 1);
      label.material.rotation = -0.2;
      label.material.opacity = progress > 0.65 ? 1 - (progress - 0.65) / 0.35 : 1;
    });
  }

  /**
   * Luna Park: gold sparkles torn out of a player and sucked into the ghost's
   * sack. `target` is read every frame, so the loot follows a ghost on the move.
   */
  spawnLootSuck(from: THREE.Vector3, target: () => THREE.Vector3): void {
    for (let index = 0; index < 14; index += 1) {
      const material = additive(index % 3 === 0 ? "#ffffff" : "#ffd166", 1);
      const sparkle = new THREE.Mesh(this.debrisGeometry, material);
      const start = from.clone().add(new THREE.Vector3(0, 0.6 + Math.random() * 0.4, 0));
      const bulge = randomHemisphereDirection(0.3).multiplyScalar(0.8 + Math.random() * 0.6);
      const delay = index * 0.035;
      const lifetime = 0.75 + delay;
      const spin = 6 + Math.random() * 6;
      sparkle.scale.setScalar(0.001);
      this.push(sparkle, lifetime, (progress) => {
        const time = Math.max(0, (progress * lifetime - delay) / 0.75);
        if (time === 0) return;
        const eased = time * time;
        const end = target();
        sparkle.position.lerpVectors(start, end, eased).addScaledVector(bulge, Math.sin(time * Math.PI));
        sparkle.rotation.set(time * spin, time * spin * 0.7, 0);
        sparkle.scale.setScalar(Math.max(0.001, 0.9 * (1 - eased * 0.7)));
        material.opacity = time > 0.85 ? (1 - time) / 0.15 : 1;
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
    this.disposed = true;
    for (const effect of this.effects) disposeTransient(effect.object);
    this.effects.length = 0;
    this.confettiGeometry.dispose();
    this.poofGeometry.dispose();
    this.flashGeometry.dispose();
    this.shockwaveGeometry.dispose();
    this.debrisGeometry.dispose();
    this.iceShardGeometry.dispose();
    this.iceChunkGeometry.dispose();
    this.streakGeometry.dispose();
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
