import * as THREE from "three";
import { SCENE_COLORS } from "../theme/palette";
import { createVerticalFadeTexture } from "./models/props-model";
import { clamp01, easeInCubic, easeOutBack, easeOutCubic, phase, prefersReducedMotion } from "./scene-kit";
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
/** Sœur Fantôme: her mist is pale blue and white, a gentler cousin of the carousel ghost's. */
export const SISTER_MIST_COLORS = ["#cfe9ff", "#9fd0ff", "#ffffff", "#bfe0ff"];
const SOIL_COLORS = ["#8a5a3c", "#6b4529", "#a87a52", "#5a3820"];
const DUST_COLOR = "#d3bc9c";
const VORTEX_COLORS = ["#b05cff", "#ff3b7a", "#7a35d6", "#e23cff"];
const HELLFIRE_COLORS = ["#ff3b2f", "#ff7a2f", "#ffb02e", "#ff2f6a", "#c43bff"];
const ASH_COLORS = ["#3b3238", "#57494f", "#7a6a70", "#2a2226"];
const EMBER_COLORS = ["#ffd166", "#ff9f43", "#ff5e3a"];
/** Radii of the arcs that whirl in the mage's vortex. */
const VORTEX_RADII = [0.35, 0.6, 0.85, 1.1];

/** Short-lived juice: floating coin numbers, confetti bursts, poofs and explosions. */
export class EffectsLayer {
  readonly group = new THREE.Group();
  private readonly effects: TransientEffect[] = [];
  private disposed = false;
  private readonly clodGeometry = new THREE.IcosahedronGeometry(0.1, 0);
  private readonly sparkleGeometry = new THREE.OctahedronGeometry(0.07, 0);
  private readonly discGeometry = new THREE.CircleGeometry(1, 28);
  private readonly beamGeometry = new THREE.BoxGeometry(1, 1, 1);
  /** A column of light standing on the ground: its height runs from 0 to 1. */
  private readonly columnGeometry = new THREE.CylinderGeometry(0.4, 0.55, 1, 14, 1, true).translate(0, 0.5, 0);
  private readonly tongueGeometry = new THREE.ConeGeometry(0.2, 1, 5).translate(0, 0.5, 0);
  private readonly vortexArcGeometries = VORTEX_RADII.map(
    (radius) => new THREE.RingGeometry(radius - 0.045, radius + 0.045, 22, 1, 0, 3.4),
  );
  /** Painted once, shared by every effect that uses them. */
  private fadeTexture: THREE.CanvasTexture | null = null;
  private flameTexture: THREE.CanvasTexture | null = null;
  private maskTexture: THREE.CanvasTexture | null = null;
  private readonly confettiGeometry = new THREE.PlaneGeometry(0.14, 0.09);
  private readonly poofGeometry = new THREE.IcosahedronGeometry(0.16, 0);
  private readonly flashGeometry = new THREE.SphereGeometry(1, 16, 12);
  private readonly shockwaveGeometry = new THREE.RingGeometry(0.82, 1, 40);
  private readonly debrisGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private readonly iceShardGeometry = new THREE.ConeGeometry(0.08, 0.3, 4);
  private readonly iceChunkGeometry = new THREE.IcosahedronGeometry(0.28, 0);
  private readonly streakGeometry = new THREE.PlaneGeometry(0.9, 0.05);
  private readonly tomatoGeometry = new THREE.SphereGeometry(0.2, 14, 10);
  private readonly tomatoLeafGeometry = new THREE.ConeGeometry(0.12, 0.08, 5);

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

  /** Désert: a wall of sand blown across the whole world, from the left, low over the dunes. */
  spawnSandstorm(halfWidth: number, halfDepth: number): void {
    for (let index = 0; index < 190; index += 1) {
      const material = additive(index % 3 === 0 ? "#f3d9a2" : "#e8c48a", 0.7);
      const streak = new THREE.Mesh(this.streakGeometry, material);
      const z = (Math.random() * 2 - 1) * (halfDepth + 2);
      const y = 0.3 + Math.random() * 3;
      const speed = 0.7 + Math.random() * 0.8;
      const start = -halfWidth - 6 - Math.random() * 14;
      const wave = Math.random() * Math.PI * 2;
      streak.rotation.y = -0.1;
      this.push(streak, 2.8, (progress) => {
        streak.position.set(
          start + progress * (halfWidth * 2 + 24) * speed,
          y + Math.sin(progress * 11 + wave) * 0.35,
          z,
        );
        material.opacity = 0.7 * Math.sin(progress * Math.PI);
      });
    }
  }

  /** Luna Park: the ghost's violet and green mist, swirling up as it rises from or melts into the ground. */
  spawnGhostMist(
    position: THREE.Vector3,
    amount = 16,
    colors: readonly string[] = GHOST_MIST_COLORS,
    soft = false,
  ): void {
    // Soft mist is translucent colour, not light: pale additive puffs would blot a bright board out in white.
    const peak = soft ? 0.5 : 0.7;
    for (let index = 0; index < amount; index += 1) {
      const material = soft
        ? solid(colors[index % colors.length], peak)
        : additive(colors[index % colors.length], peak);
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
        puff.scale.setScalar(size * (soft ? 0.3 : 0.4) * (soft ? 1 + eased * 1.4 : 1 + eased * 2.5));
        material.opacity = peak * (1 - progress) * Math.min(1, progress * 8);
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

  /**
   * A Tomate lobbed in a high arc from `from` to `to`, spinning, then a red
   * splat: a flattened blob and a spray of juice. `onLand` runs at impact.
   */
  spawnTomatoThrow(from: THREE.Vector3, to: THREE.Vector3, flightSeconds: number, onLand: () => void): void {
    // A volley is timed from outside: a Tomate due after the board was rebuilt is simply dropped.
    if (this.disposed) return;
    const tomato = new THREE.Group();
    const fruit = new THREE.Mesh(
      this.tomatoGeometry,
      new THREE.MeshStandardMaterial({ color: "#e8453c", roughness: 0.35 }),
    );
    fruit.scale.set(1, 0.85, 1);
    const leaf = new THREE.Mesh(
      this.tomatoLeafGeometry,
      new THREE.MeshStandardMaterial({ color: "#5cc46a", flatShading: true }),
    );
    leaf.position.y = 0.17;
    tomato.add(fruit, leaf);
    const end = to.clone().add(new THREE.Vector3(0, 0.9, 0));
    this.lob(tomato, from.clone().add(new THREE.Vector3(0, 1.1, 0)), end, flightSeconds, () => {
      this.spawnTomatoSplat(end);
      onLand();
    });
  }

  /**
   * Banquise: a penguin's snowball, lobbed from `from` onto `to`, bursting in
   * a puff of powder snow. A miss is aimed beside the target by the caller.
   */
  spawnSnowballThrow(from: THREE.Vector3, to: THREE.Vector3, flightSeconds: number, onLand: () => void): void {
    if (this.disposed) return;
    const ball = new THREE.Mesh(
      this.tomatoGeometry,
      new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, flatShading: true }),
    );
    ball.scale.setScalar(0.85);
    const end = to.clone().add(new THREE.Vector3(0, 0.8, 0));
    this.lob(ball, from.clone().add(new THREE.Vector3(0, 0.75, 0)), end, flightSeconds, () => {
      this.spawnPoof(end.clone().setY(end.y - 0.5), "#ffffff");
      onLand();
    });
  }

  /** Something thrown in a high arc, spinning, calling `onLand` once it gets there. */
  private lob(
    projectile: THREE.Object3D,
    start: THREE.Vector3,
    end: THREE.Vector3,
    flightSeconds: number,
    onLand: () => void,
  ): void {
    const apex = Math.max(start.y, end.y) + 1.6 + start.distanceTo(end) * 0.12;
    let landed = false;
    this.push(projectile, flightSeconds, (progress) => {
      projectile.position.lerpVectors(start, end, progress);
      // A parabola through the apex: up fast, then dropping onto the target.
      const lift = 4 * progress * (1 - progress);
      projectile.position.y = start.y + (end.y - start.y) * progress + lift * (apex - Math.max(start.y, end.y));
      projectile.rotation.set(progress * 9, progress * 5, 0);
      if (progress >= 1 && !landed) {
        landed = true;
        onLand();
      }
    });
  }

  private spawnTomatoSplat(position: THREE.Vector3): void {
    const blobMaterial = new THREE.MeshStandardMaterial({ color: "#d63a31", roughness: 0.4, transparent: true });
    const blob = new THREE.Mesh(this.tomatoGeometry, blobMaterial);
    blob.position.copy(position);
    this.push(blob, 0.7, (progress) => {
      const squash = Math.min(1, progress * 5);
      blob.scale.set(1 + squash * 1.2, Math.max(0.15, 1 - squash * 0.85), 1 + squash * 1.2);
      blobMaterial.opacity = progress > 0.5 ? 1 - (progress - 0.5) / 0.5 : 1;
    });
    for (let index = 0; index < 14; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: index % 3 === 0 ? "#ffd166" : "#e8453c",
        transparent: true,
      });
      const drop = new THREE.Mesh(this.poofGeometry, material);
      const velocity = randomHemisphereDirection(0.2).multiplyScalar(2 + Math.random() * 2.5);
      drop.position.copy(position);
      drop.scale.setScalar(0.35 + Math.random() * 0.35);
      this.push(drop, 0.7 + Math.random() * 0.25, (progress, deltaSeconds) => {
        velocity.y -= 10 * deltaSeconds;
        drop.position.addScaledVector(velocity, deltaSeconds);
        material.opacity = progress > 0.55 ? 1 - (progress - 0.55) / 0.45 : 1;
      });
    }
  }

  /** Taupe: clods of soil thrown up where a pawn digs in or bursts out of the ground, with a puff of dust. */
  spawnDirtBurst(position: THREE.Vector3, amount = 16): void {
    const count = prefersReducedMotion() ? Math.ceil(amount / 2) : amount;
    const floorY = position.y + 0.04;
    for (let index = 0; index < count; index += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: SOIL_COLORS[index % SOIL_COLORS.length],
        flatShading: true,
        roughness: 1,
        transparent: true,
      });
      const clod = new THREE.Mesh(this.clodGeometry, material);
      const velocity = randomHemisphereDirection(0.5).multiplyScalar(2.4 + Math.random() * 2.6);
      const spin = new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9);
      const size = 0.6 + Math.random();
      clod.position
        .copy(position)
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.1, (Math.random() - 0.5) * 0.4));
      this.push(clod, 0.85 + Math.random() * 0.35, (progress, deltaSeconds) => {
        velocity.y -= 12 * deltaSeconds;
        clod.position.addScaledVector(velocity, deltaSeconds);
        if (clod.position.y < floorY) {
          // A clod that lands bounces once, softly, and rolls to a stop.
          clod.position.y = floorY;
          velocity.multiplyScalar(0.35);
          velocity.y = Math.abs(velocity.y) * 0.4;
        }
        clod.rotation.x += spin.x * deltaSeconds;
        clod.rotation.y += spin.y * deltaSeconds;
        clod.scale.setScalar(size * (1 - easeInCubic(phase(progress, 0.6, 1)) * 0.7));
        material.opacity = 1 - phase(progress, 0.65, 1);
      });
    }
    this.spawnDust(position, 6, 0.9);
  }

  /** A cloud of dust that rises and spreads out: a tunnel collapsing, a pawn dropping into the ground. */
  spawnDust(position: THREE.Vector3, amount = 6, spread = 0.8): void {
    const origin = position.clone().add(new THREE.Vector3(0, 0.12, 0));
    for (let index = 0; index < amount; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: DUST_COLOR,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const puff = new THREE.Mesh(this.poofGeometry, material);
      const angle = (index / amount) * Math.PI * 2 + Math.random() * 0.6;
      const reach = spread * (0.6 + Math.random() * 0.6);
      this.push(puff, 0.75 + Math.random() * 0.3, (progress) => {
        const eased = easeOutCubic(progress);
        puff.position.set(
          origin.x + Math.cos(angle) * reach * eased,
          origin.y + eased * 0.55,
          origin.z + Math.sin(angle) * reach * eased,
        );
        puff.scale.setScalar(1.2 + progress * 2.2);
        material.opacity = 0.55 * (1 - progress) * Math.min(1, progress * 10);
      });
    }
  }

  /** A flash of light that swells and fades. */
  spawnFlash(position: THREE.Vector3, color: string, size = 1.5, seconds = 0.4): void {
    const material = additive(color, 0.7);
    const flash = new THREE.Mesh(this.flashGeometry, material);
    flash.position.copy(position);
    this.push(flash, seconds, (progress) => {
      flash.scale.setScalar(0.2 + easeOutCubic(progress) * size);
      material.opacity = 0.7 * (1 - progress) ** 1.5;
    });
  }

  /** A ring that spreads out flat over the tile, after `delaySeconds`. */
  spawnShockRing(
    position: THREE.Vector3,
    color: string,
    size = 2.4,
    seconds = 0.6,
    delaySeconds = 0,
    plain = false,
  ): void {
    const material = plain ? solid(color, 0.85) : additive(color, 0.9);
    const ring = new THREE.Mesh(this.shockwaveGeometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position).setY(position.y + 0.06);
    ring.scale.setScalar(0.001);
    const total = seconds + delaySeconds;
    this.push(ring, total, (progress) => {
      const time = clamp01((progress * total - delaySeconds) / seconds);
      ring.scale.setScalar(Math.max(0.001, time === 0 ? 0 : 0.2 + easeOutCubic(time) * size));
      material.opacity = (plain ? 0.85 : 0.9) * (1 - time);
    });
  }

  /** Little four-pointed sparkles that rise from around `position` and twinkle out. */
  spawnSparkles(
    position: THREE.Vector3,
    color: string | readonly string[],
    amount = 12,
    radius = 0.5,
    seconds = 0.9,
  ): void {
    const colors = typeof color === "string" ? [color] : color;
    const count = prefersReducedMotion() ? Math.ceil(amount / 2) : amount;
    for (let index = 0; index < count; index += 1) {
      const material = additive(colors[index % colors.length], 1);
      const sparkle = new THREE.Mesh(this.sparkleGeometry, material);
      const angle = Math.random() * Math.PI * 2;
      const reach = radius * Math.sqrt(Math.random());
      const start = position
        .clone()
        .add(new THREE.Vector3(Math.cos(angle) * reach, Math.random() * 0.9, Math.sin(angle) * reach));
      const rise = 0.5 + Math.random() * 0.8;
      const delay = Math.random() * 0.35;
      const size = 0.8 + Math.random() * 1.2;
      const turn = 3 + Math.random() * 5;
      sparkle.scale.setScalar(0.001);
      this.push(sparkle, seconds, (progress) => {
        const time = clamp01((progress - delay) / (1 - delay));
        sparkle.position.set(start.x, start.y + rise * time, start.z);
        sparkle.rotation.y = time * turn;
        sparkle.scale.set(size * Math.sin(time * Math.PI), size * 1.7 * Math.sin(time * Math.PI), size * 0.5);
      });
    }
  }

  /** Puffs of mist streaming over the board from one point to another, in a low arc: where a swap carries two ghosts. */
  spawnMistStream(
    from: THREE.Vector3,
    to: THREE.Vector3,
    colors: readonly string[],
    seconds = 0.6,
    delaySeconds = 0,
    amount = 9,
  ): void {
    const count = prefersReducedMotion() ? Math.ceil(amount / 2) : amount;
    const total = seconds + delaySeconds;
    for (let index = 0; index < count; index += 1) {
      const material = solid(colors[index % colors.length], 0.5);
      const puff = new THREE.Mesh(this.poofGeometry, material);
      const lead = (index / count) * 0.45;
      const sway = (Math.random() - 0.5) * 0.7;
      const size = 1 + Math.random() * 1.1;
      puff.scale.setScalar(0.001);
      this.push(puff, total, (progress) => {
        const time = clamp01((progress * total - delaySeconds) / seconds);
        const travel = clamp01((time - lead) / (1 - 0.45));
        if (travel === 0) return;
        puff.position.lerpVectors(from, to, easeOutCubic(travel));
        puff.position.y += 0.55 + Math.sin(travel * Math.PI) * 0.7;
        puff.position.x += Math.sin(travel * Math.PI) * sway;
        puff.scale.setScalar(Math.max(0.001, size * Math.sin(travel * Math.PI) * 0.9));
        material.opacity = 0.5 * Math.sin(travel * Math.PI);
      });
    }
  }

  /** A ring of twinkling sparkles spreading out around a pawn. */
  spawnSparkleRing(position: THREE.Vector3, color: string, radius = 1, amount = 14, seconds = 0.75): void {
    const count = prefersReducedMotion() ? Math.ceil(amount / 2) : amount;
    for (let index = 0; index < count; index += 1) {
      const material = additive(color, 1);
      const sparkle = new THREE.Mesh(this.sparkleGeometry, material);
      const angle = (index / count) * Math.PI * 2;
      const height = 0.55 + (index % 3) * 0.12;
      sparkle.scale.setScalar(0.001);
      this.push(sparkle, seconds, (progress) => {
        const reach = radius * easeOutCubic(progress);
        sparkle.position.set(
          position.x + Math.cos(angle) * reach,
          position.y + height + progress * 0.35,
          position.z + Math.sin(angle) * reach,
        );
        sparkle.rotation.y = progress * 6;
        const pulse = Math.sin(progress * Math.PI);
        sparkle.scale.set(1.5 * pulse, 2.6 * pulse, 0.7);
      });
    }
  }

  /**
   * Mage noir: a dark vortex whirling on the ground that draws the mage in. It swells, spins faster and faster, then
   * collapses on itself, and smoke is sucked up in its spiral.
   */
  spawnVortex(position: THREE.Vector3, seconds = 1): void {
    const vortex = new THREE.Group();
    vortex.position.copy(position).setY(position.y + 0.035);
    const voidMaterial = new THREE.MeshBasicMaterial({
      color: "#07020f",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const hole = new THREE.Mesh(this.discGeometry, voidMaterial);
    hole.rotation.x = -Math.PI / 2;
    hole.scale.setScalar(0.9);
    vortex.add(hole);
    const arms = this.vortexArcGeometries.map((geometry, index) => {
      const material = additive(VORTEX_COLORS[index % VORTEX_COLORS.length], 0.9);
      const arm = new THREE.Mesh(geometry, material);
      arm.rotation.x = -Math.PI / 2;
      arm.rotation.z = index * 1.7;
      arm.position.y = 0.012 * (index + 1);
      vortex.add(arm);
      return { arm, material, speed: (index % 2 === 0 ? 1 : -1) * (7 - index * 1.2) };
    });
    this.push(vortex, seconds, (progress, deltaSeconds) => {
      const swell = easeOutBack(phase(progress, 0, 0.3));
      const collapse = 1 - easeInCubic(phase(progress, 0.78, 1));
      vortex.scale.set(Math.max(0.001, swell * collapse), 1, Math.max(0.001, swell * collapse));
      voidMaterial.opacity = 0.9 * Math.min(1, progress * 5) * (1 - phase(progress, 0.9, 1));
      for (const { arm, material, speed } of arms) {
        arm.rotation.z += speed * deltaSeconds * (1 + progress * 2.4);
        material.opacity = 0.9 * collapse;
      }
    });

    const smokeCount = prefersReducedMotion() ? 5 : 10;
    for (let index = 0; index < smokeCount; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: index % 3 === 0 ? "#6a2cc4" : "#1c0b2e",
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      });
      const puff = new THREE.Mesh(this.poofGeometry, material);
      const startAngle = (index / smokeCount) * Math.PI * 2;
      const delay = (index / smokeCount) * 0.4;
      this.push(puff, seconds, (progress) => {
        const time = clamp01((progress - delay) / 0.55);
        const angle = startAngle + time * 4.5;
        const radius = 0.15 + (1 - time) * 0.95;
        puff.position.set(
          position.x + Math.cos(angle) * radius,
          position.y + 0.12 + time * 1.7,
          position.z + Math.sin(angle) * radius,
        );
        puff.scale.setScalar(0.8 + time * 1);
        material.opacity = 0.4 * Math.sin(time * Math.PI);
      });
    }
  }

  /** Mage noir: the mage steps out of a burst of red-violet light, onto their pentagram. */
  spawnEmergeBurst(position: THREE.Vector3): void {
    if (!prefersReducedMotion())
      this.spawnFlash(position.clone().add(new THREE.Vector3(0, 0.7, 0)), "#ff7fb8", 0.85, 0.3);
    this.spawnShockRing(position, "#ff3b7a", 2.8, 0.6, 0, true);
    this.spawnShockRing(position, "#b05cff", 2, 0.45, 0.08, true);

    const material = solid("#e03bff", 0.7);
    material.alphaMap = this.getFadeTexture();
    const column = new THREE.Mesh(this.columnGeometry, material);
    column.position.copy(position);
    this.push(column, 0.65, (progress) => {
      const rise = easeOutCubic(phase(progress, 0, 0.35));
      const slim = 1 - progress * 0.7;
      column.scale.set(slim, 0.4 + rise * 2.6, slim);
      material.opacity = 0.7 * (1 - phase(progress, 0.25, 1));
    });

    const emberCount = prefersReducedMotion() ? 6 : 14;
    for (let index = 0; index < emberCount; index += 1) {
      const emberMaterial = additive(VORTEX_COLORS[index % VORTEX_COLORS.length], 1);
      const ember = new THREE.Mesh(this.sparkleGeometry, emberMaterial);
      const angle = (index / emberCount) * Math.PI * 2 + Math.random() * 0.5;
      const reach = 0.3 + Math.random() * 0.8;
      const rise = 0.9 + Math.random() * 1.5;
      this.push(ember, 0.7 + Math.random() * 0.4, (progress) => {
        const turn = angle + progress * 2.4;
        ember.position.set(
          position.x + Math.cos(turn) * reach * easeOutCubic(progress),
          position.y + 0.2 + rise * easeOutCubic(progress),
          position.z + Math.sin(turn) * reach * easeOutCubic(progress),
        );
        ember.scale.setScalar(1.6 * Math.sin(progress * Math.PI) + 0.001);
        ember.rotation.y = progress * 8;
      });
    }
  }

  /** Mage noir: hellfire shoots up out of the pentagram and swallows the players left on it. */
  spawnFlameColumn(position: THREE.Vector3, seconds = 0.9): void {
    const reduced = prefersReducedMotion();
    const layers = [
      { color: "#ff3b22", width: 1.5, height: 3.6, opacity: 0.88, plain: true },
      { color: "#ff9f2e", width: 1.0, height: 3.2, opacity: 0.9, plain: true },
      { color: "#fff0a0", width: 0.5, height: 2.8, opacity: 0.85, plain: false },
    ];
    for (const { color, width, height, opacity, plain } of layers) {
      const material = plain ? solid(color, opacity) : additive(color, opacity);
      material.alphaMap = this.getFlameTexture();
      const column = new THREE.Mesh(this.columnGeometry, material);
      column.position.copy(position);
      this.push(column, seconds, (progress) => {
        const rise = easeOutCubic(phase(progress, 0, 0.2));
        const fall = phase(progress, 0.6, 1);
        const wobble = 1 + Math.sin(progress * 46 + width * 5) * 0.07;
        column.scale.set(
          width * wobble * (1 - fall * 0.7),
          height * rise * (1 - easeInCubic(fall) * 0.9),
          width * wobble * (1 - fall * 0.7),
        );
        material.opacity = opacity * (1 - fall) * Math.min(1, progress * 12);
      });
    }

    const tongueCount = reduced ? 8 : 20;
    for (let index = 0; index < tongueCount; index += 1) {
      const material = solid(HELLFIRE_COLORS[index % HELLFIRE_COLORS.length], 0.9);
      const tongue = new THREE.Mesh(this.tongueGeometry, material);
      const angle = Math.random() * Math.PI * 2;
      const reach = 0.05 + Math.random() * 0.55;
      const speed = 1.5 + Math.random() * 1.1;
      const offset = Math.random();
      const height = 1.2 + Math.random() * 1.5;
      this.push(tongue, seconds, (progress) => {
        const cycle = (progress * speed * 2 + offset) % 1;
        const alive = easeOutCubic(phase(progress, 0, 0.15)) * (1 - phase(progress, 0.7, 1));
        tongue.position.set(
          position.x + Math.cos(angle + cycle * 2) * reach * (1 - cycle * 0.5),
          position.y + cycle * height,
          position.z + Math.sin(angle + cycle * 2) * reach * (1 - cycle * 0.5),
        );
        tongue.scale.set(
          Math.max(0.001, (1.2 - cycle) * alive),
          Math.max(0.001, (1.5 - cycle * 0.9) * alive),
          Math.max(0.001, (1.2 - cycle) * alive),
        );
        material.opacity = 0.9 * (1 - cycle * 0.8) * alive;
      });
    }

    this.spawnShockRing(position, "#ff4a1a", 2.2, 0.5, 0, true);
    const glowMaterial = solid("#ff3b1a", 0.55);
    const glow = new THREE.Mesh(this.discGeometry, glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.copy(position).setY(position.y + 0.05);
    this.push(glow, seconds, (progress) => {
      glow.scale.setScalar(1.35 + Math.sin(progress * 30) * 0.06);
      glowMaterial.opacity = 0.55 * Math.min(1, progress * 8) * (1 - phase(progress, 0.55, 1));
    });

    const sparkCount = reduced ? 5 : 12;
    for (let index = 0; index < sparkCount; index += 1) {
      const material = additive(EMBER_COLORS[index % EMBER_COLORS.length], 1);
      const spark = new THREE.Mesh(this.sparkleGeometry, material);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        3.2 + Math.random() * 3,
        (Math.random() - 0.5) * 2.2,
      );
      spark.position.copy(position).setY(position.y + 0.2);
      this.push(spark, seconds + 0.2, (progress, deltaSeconds) => {
        velocity.y -= 7 * deltaSeconds;
        spark.position.addScaledVector(velocity, deltaSeconds);
        spark.scale.setScalar(Math.max(0.001, 1.8 * (1 - progress)));
        spark.rotation.y += deltaSeconds * 9;
      });
    }
  }

  /**
   * Mage noir: out of chances, the mage crumbles to ash, which drifts away over a scorch mark, and a red ring of
   * "game over" spreads over their tile.
   */
  spawnAshCrumble(position: THREE.Vector3, seconds = 1.9): void {
    const reduced = prefersReducedMotion();
    const flakeCount = reduced ? 14 : 32;
    for (let index = 0; index < flakeCount; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: ASH_COLORS[index % ASH_COLORS.length],
        transparent: true,
      });
      const flake = new THREE.Mesh(this.debrisGeometry, material);
      const delay = (index / flakeCount) * 0.45;
      const angle = Math.random() * Math.PI * 2;
      const reach = Math.random() * 0.28;
      const start = position
        .clone()
        .add(new THREE.Vector3(Math.cos(angle) * reach, 0.15 + Math.random() * 0.8, Math.sin(angle) * reach));
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 1.2,
        0.5 + Math.random() * 1.3,
        (Math.random() - 0.5) * 1.2,
      );
      const size = 0.35 + Math.random() * 0.55;
      const flutter = Math.random() * 6;
      flake.position.copy(start);
      flake.scale.setScalar(0.001);
      this.push(flake, seconds, (progress, deltaSeconds) => {
        if (progress < delay) return;
        velocity.y -= 2.4 * deltaSeconds;
        velocity.multiplyScalar(1 - deltaSeconds * 0.9);
        flake.position.addScaledVector(velocity, deltaSeconds);
        flake.position.y = Math.max(position.y + 0.03, flake.position.y);
        flake.rotation.x += deltaSeconds * (3 + flutter);
        flake.rotation.z += deltaSeconds * flutter;
        flake.scale.setScalar(size * Math.min(1, (progress - delay) * 10));
        material.opacity = 1 - phase(progress, 0.72, 1);
      });
    }

    const emberCount = reduced ? 5 : 12;
    for (let index = 0; index < emberCount; index += 1) {
      const material = additive(EMBER_COLORS[index % EMBER_COLORS.length], 1);
      const ember = new THREE.Mesh(this.sparkleGeometry, material);
      const angle = Math.random() * Math.PI * 2;
      const reach = Math.random() * 0.4;
      const delay = Math.random() * 0.45;
      const rise = 1.1 + Math.random() * 1.2;
      this.push(ember, seconds, (progress) => {
        const time = clamp01((progress - delay) / (1 - delay));
        ember.position.set(
          position.x + Math.cos(angle + time * 2) * reach,
          position.y + 0.3 + rise * easeOutCubic(time),
          position.z + Math.sin(angle + time * 2) * reach,
        );
        ember.scale.setScalar(Math.max(0.001, 1.5 * Math.sin(time * Math.PI)));
        ember.rotation.y = time * 7;
      });
    }

    const scorchMaterial = new THREE.MeshBasicMaterial({
      color: "#14090d",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const scorch = new THREE.Mesh(this.discGeometry, scorchMaterial);
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.copy(position).setY(position.y + 0.045);
    scorch.scale.setScalar(0.85);
    this.push(scorch, seconds, (progress) => {
      scorchMaterial.opacity = 0.55 * phase(progress, 0.05, 0.3) * (1 - phase(progress, 0.75, 1));
    });

    this.spawnShockRing(position, "#ff2b3b", 3.4, 1, 0.1);
    this.spawnShockRing(position, "#ff8a8a", 2.4, 0.8, 0.45);
  }

  /** Mime: a thin beam of light runs from the pawn that is copied to the copier, a bright spark riding it. */
  spawnBeam(from: THREE.Vector3, to: THREE.Vector3, seconds = 0.55, color = "#fff2b8"): void {
    const length = from.distanceTo(to);
    if (length < 0.05) return;
    const material = additive(color, 0.9);
    const beam = new THREE.Mesh(this.beamGeometry, material);
    beam.position.copy(from).lerp(to, 0.5);
    beam.lookAt(to);
    this.push(beam, seconds, (progress) => {
      const draw = easeOutCubic(phase(progress, 0, 0.4));
      const thickness = 0.04 + Math.sin(clamp01(progress) * Math.PI) * 0.07;
      beam.scale.set(thickness, thickness, Math.max(0.001, length * draw));
      // Grows out of `from`: its middle is always half way to its tip.
      beam.position.copy(from).lerp(to, 0.5 * draw);
      material.opacity = 0.9 * (1 - phase(progress, 0.6, 1));
    });

    const sparkMaterial = additive("#ffffff", 1);
    const spark = new THREE.Mesh(this.flashGeometry, sparkMaterial);
    this.push(spark, seconds, (progress) => {
      const travel = easeOutCubic(phase(progress, 0, 0.65));
      spark.position.copy(from).lerp(to, travel);
      spark.scale.setScalar(0.08 + 0.1 * Math.sin(travel * Math.PI));
      sparkMaterial.opacity = 1 - phase(progress, 0.65, 0.85);
    });
  }

  /** Mime: a white theatre mask pops out over the copier's head, wobbles, and floats away. */
  spawnMask(position: THREE.Vector3, seconds = 1): void {
    const material = new THREE.SpriteMaterial({
      map: this.getMaskTexture(),
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const mask = new THREE.Sprite(material);
    mask.renderOrder = 12;
    const start = position.clone().add(new THREE.Vector3(0, 1.45, 0));
    this.push(mask, seconds, (progress) => {
      const pop = Math.max(0.001, easeOutBack(phase(progress, 0, 0.22)));
      mask.scale.set(0.74 * pop, 0.92 * pop, 1);
      material.rotation = Math.sin(progress * Math.PI * 4) * 0.14 * (1 - progress);
      mask.position.copy(start).setY(start.y + easeOutCubic(progress) * 0.45);
      material.opacity = 1 - phase(progress, 0.7, 1);
    });
  }

  /** Mime: a mirror's glint sweeps over the copier, a bright slanted streak sliding across the pawn. */
  spawnGlint(position: THREE.Vector3, seconds = 0.5): void {
    for (const [offset, thickness, tilt] of [
      [0, 2.4, 0.5],
      [0.2, 1.1, 0.5],
    ]) {
      const material = additive("#ffffff", 0);
      const glint = new THREE.Mesh(this.streakGeometry, material);
      glint.rotation.z = Math.PI / 2 - tilt;
      glint.scale.set(1.6, thickness, 1);
      this.push(glint, seconds, (progress) => {
        glint.position.set(
          position.x - 0.7 + easeOutCubic(progress) * 1.4 + offset,
          position.y + 0.55,
          position.z + 0.5,
        );
        material.opacity = Math.sin(progress * Math.PI);
      });
    }
  }

  private getFadeTexture(): THREE.CanvasTexture {
    if (!this.fadeTexture) {
      this.fadeTexture = createVerticalFadeTexture();
      this.fadeTexture.userData.shared = true;
    }
    return this.fadeTexture;
  }

  /** Opaque at the foot of a column of fire, fading out towards the tip, but later than the Red Cup's beam. */
  private getFlameTexture(): THREE.CanvasTexture {
    if (!this.flameTexture) {
      const canvas = document.createElement("canvas");
      canvas.width = 4;
      canvas.height = 128;
      const context = canvas.getContext("2d");
      if (context) {
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "#000000");
        gradient.addColorStop(0.35, "#707070");
        gradient.addColorStop(0.75, "#ffffff");
        gradient.addColorStop(1, "#ffffff");
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      this.flameTexture = new THREE.CanvasTexture(canvas);
      this.flameTexture.userData.shared = true;
    }
    return this.flameTexture;
  }

  private getMaskTexture(): THREE.CanvasTexture {
    this.maskTexture ??= paintMaskTexture();
    return this.maskTexture;
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
    this.tomatoGeometry.dispose();
    this.tomatoLeafGeometry.dispose();
    this.clodGeometry.dispose();
    this.sparkleGeometry.dispose();
    this.discGeometry.dispose();
    this.beamGeometry.dispose();
    this.columnGeometry.dispose();
    this.tongueGeometry.dispose();
    for (const geometry of this.vortexArcGeometries) geometry.dispose();
    this.fadeTexture?.dispose();
    this.flameTexture?.dispose();
    this.maskTexture?.dispose();
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

/** Plain translucent colour: it stays saturated over a bright tile, where additive light would wash out to white. */
function solid(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
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

/**
 * Transient effects own their materials (and sprite textures) but share geometries; a group is searched through.
 * A texture marked `shared` belongs to the layer, which frees it when it is disposed.
 */
function disposeTransient(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Sprite) {
      if (!child.material.map?.userData.shared) child.material.map?.dispose();
      child.material.dispose();
    } else if (child instanceof THREE.Mesh) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    }
  });
}

/** A white theatre mask, smiling, with an ink contour, painted once for every Mime copy. */
function paintMaskTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context) {
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(64, 10);
    context.bezierCurveTo(112, 10, 122, 60, 108, 100);
    context.bezierCurveTo(98, 135, 80, 152, 64, 154);
    context.bezierCurveTo(48, 152, 30, 135, 20, 100);
    context.bezierCurveTo(6, 60, 16, 10, 64, 10);
    context.closePath();
    context.fillStyle = "#fffaf0";
    context.fill();
    context.lineWidth = 8;
    context.strokeStyle = SCENE_COLORS.ink;
    context.stroke();

    context.fillStyle = SCENE_COLORS.ink;
    for (const side of [-1, 1]) {
      context.beginPath();
      context.ellipse(64 + side * 24, 62, 14, 8, side * -0.35, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = "rgba(255, 110, 140, 0.55)";
    for (const side of [-1, 1]) {
      context.beginPath();
      context.ellipse(64 + side * 37, 92, 9, 6, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.beginPath();
    context.arc(64, 94, 26, Math.PI * 0.22, Math.PI * 0.78);
    context.lineWidth = 6;
    context.stroke();
    context.fillStyle = "#ffc94d";
    context.beginPath();
    for (let point = 0; point < 10; point += 1) {
      const angle = (Math.PI / 5) * point - Math.PI / 2;
      const length = point % 2 === 0 ? 11 : 5;
      context.lineTo(64 + Math.cos(angle) * length, 32 + Math.sin(angle) * length);
    }
    context.closePath();
    context.fill();
    context.lineWidth = 3;
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.shared = true;
  return texture;
}
