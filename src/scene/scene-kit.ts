import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SCENE_COLORS } from "../theme/palette";
import { createSeededRandom } from "../utils/seeded-random";

/**
 * Shared low-poly building blocks: a per-world material cache, seeded noise
 * and geometry helpers. Every world owns one kit so disposal stays scoped.
 */
export class SceneKit {
  private readonly materials = new Map<string, THREE.Material>();
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly textures = new Map<string, THREE.Texture>();

  /** Faceted, matte material: the core of the low-poly look. */
  flat(color: string, options: { emissive?: string; emissiveIntensity?: number } = {}): THREE.MeshStandardMaterial {
    const key = `flat:${color}:${options.emissive ?? ""}:${options.emissiveIntensity ?? 0}`;
    return this.cached(
      key,
      () =>
        new THREE.MeshStandardMaterial({
          color,
          flatShading: true,
          roughness: 0.86,
          metalness: 0,
          emissive: options.emissive ?? "#000000",
          emissiveIntensity: options.emissiveIntensity ?? 0,
        }),
    );
  }

  /** Smooth, slightly glossy material for eyes and the Red Cup. */
  glossy(color: string): THREE.MeshStandardMaterial {
    return this.cached(
      `glossy:${color}`,
      () => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0 }),
    );
  }

  unlit(color: string, opacity = 1): THREE.MeshBasicMaterial {
    return this.cached(
      `unlit:${color}:${opacity}`,
      () =>
        new THREE.MeshBasicMaterial({
          color,
          transparent: opacity < 1,
          opacity,
          depthWrite: opacity >= 1,
        }),
    );
  }

  /** Additive, depth-free light that adds to what lies under it: rims, glows, pentagram strokes. */
  glow(color: string, opacity = 1): THREE.MeshBasicMaterial {
    return this.cached(
      `glow:${color}:${opacity}`,
      () =>
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
    );
  }

  /** Inverted-hull outline material that gives the toon ink contour. */
  outline(color: string = SCENE_COLORS.ink): THREE.MeshBasicMaterial {
    return this.cached(`outline:${color}`, () => new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  }

  geometry<T extends THREE.BufferGeometry>(key: string, create: () => T): T {
    const existing = this.geometries.get(key);
    if (existing) return existing as T;
    const geometry = create();
    this.geometries.set(key, geometry);
    return geometry;
  }

  /** A canvas texture painted once per world, however many props use it. */
  texture<T extends THREE.Texture>(key: string, create: () => T): T {
    const existing = this.textures.get(key);
    if (existing) return existing as T;
    const texture = create();
    this.textures.set(key, texture);
    return texture;
  }

  dispose(): void {
    for (const material of this.materials.values()) material.dispose();
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const texture of this.textures.values()) texture.dispose();
    this.materials.clear();
    this.geometries.clear();
    this.textures.clear();
  }

  private cached<T extends THREE.Material>(key: string, create: () => T): T {
    const existing = this.materials.get(key);
    if (existing) return existing as T;
    const material = create();
    this.materials.set(key, material);
    return material;
  }
}

/** Deterministic PRNG so scenery stays identical between sessions. */
export const createRandom = createSeededRandom;

/**
 * Displaces vertices to break perfect symmetry. Vertices are merged first so
 * faces stay connected, which keeps the faceted silhouette crack-free.
 */
export function jitterGeometry(geometry: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const withoutNormals = geometry.clone();
  withoutNormals.deleteAttribute("normal");
  withoutNormals.deleteAttribute("uv");
  const merged = mergeVertices(withoutNormals);
  withoutNormals.dispose();
  const random = createRandom(seed);
  const position = merged.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    position.setXYZ(
      index,
      position.getX(index) + (random() - 0.5) * amount,
      position.getY(index) + (random() - 0.5) * amount,
      position.getZ(index) + (random() - 0.5) * amount,
    );
  }

  merged.computeVertexNormals();
  return merged;
}

export function createRoundedRectShape(width: number, depth: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  appendRoundedRect(shape, width, depth, radius);
  return shape;
}

export function appendRoundedRect(path: THREE.Path, width: number, depth: number, radius: number): void {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  path.moveTo(-halfWidth + radius, -halfDepth);
  path.lineTo(halfWidth - radius, -halfDepth);
  path.quadraticCurveTo(halfWidth, -halfDepth, halfWidth, -halfDepth + radius);
  path.lineTo(halfWidth, halfDepth - radius);
  path.quadraticCurveTo(halfWidth, halfDepth, halfWidth - radius, halfDepth);
  path.lineTo(-halfWidth + radius, halfDepth);
  path.quadraticCurveTo(-halfWidth, halfDepth, -halfWidth, halfDepth - radius);
  path.lineTo(-halfWidth, -halfDepth + radius);
  path.quadraticCurveTo(-halfWidth, -halfDepth, -halfWidth + radius, -halfDepth);
}

/** Adds an inverted-hull contour behind a mesh. */
export function addOutline(mesh: THREE.Mesh, kit: SceneKit, thickness = 1.07): THREE.Mesh {
  const hull = new THREE.Mesh(mesh.geometry, kit.outline());
  hull.scale.setScalar(thickness);
  hull.raycast = () => undefined;
  // Lets a pawn that turns see-through find its contours and hide them.
  hull.userData.isOutline = true;
  mesh.add(hull);
  return hull;
}

export function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - (-2 * value + 2) ** 3 / 2;
}

export function easeOutBack(value: number): number {
  const overshoot = 1.70158;
  const shifted = value - 1;
  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

export function easeInCubic(value: number): number {
  return value * value * value;
}

/** Where `value` stands between `start` and `end`, clamped to 0..1: slices one animation into phases. */
export function phase(value: number, start: number, end: number): number {
  return clamp01((value - start) / (end - start));
}

/** Whether the player asked their system for fewer flashes and less motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
