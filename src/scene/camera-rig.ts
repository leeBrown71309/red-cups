import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { easeInOutCubic } from "./scene-kit";

export type CameraMode = "attract" | "play";

const FIELD_OF_VIEW = 34;
const HOME_POLAR = 0.86;
const HOME_TARGET = new THREE.Vector3(0, 0, 0.9);
const BOARD_HALF_WIDTH = 13.4;
const BOARD_HALF_DEPTH = 9.6;
const PAN_LIMIT = { x: 11, z: 7.5 };

interface CameraTween {
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  from: THREE.Spherical;
  to: THREE.Spherical;
  elapsed: number;
  duration: number;
}

/**
 * Board camera: map-style panning (one finger / left drag), pinch or wheel
 * zoom, gentle rotation, plus scripted moves for recentring and focusing.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.5, 200);
  private readonly controls: MapControls;
  private fitDistance = 34;
  private tween: CameraTween | null = null;
  private mode: CameraMode = "attract";
  private attractTime = 0;

  constructor(domElement: HTMLElement) {
    this.controls = new MapControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.screenSpacePanning = false;
    this.controls.zoomToCursor = true;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.12;
    this.controls.minAzimuthAngle = -0.75;
    this.controls.maxAzimuthAngle = 0.75;
    this.controls.rotateSpeed = 0.55;
    this.controls.panSpeed = 1.1;
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.addEventListener("start", () => {
      this.tween = null;
    });
    this.controls.enabled = false;
    this.placeAtHome(1.12);
  }

  resize(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const halfFov = THREE.MathUtils.degToRad(FIELD_OF_VIEW / 2);
    const verticalExtent = BOARD_HALF_DEPTH * Math.cos(HOME_POLAR) + 2.2;
    const verticalDistance = verticalExtent / Math.tan(halfFov);
    const horizontalDistance = BOARD_HALF_WIDTH / (Math.tan(halfFov) * aspect);
    // Short landscape phones need extra room for the HUD bars at the top and bottom.
    const hudMargin = height < 520 ? 1.2 : 1.08;
    this.fitDistance = Math.max(verticalDistance, horizontalDistance) * hudMargin;
    this.controls.minDistance = this.fitDistance * 0.32;
    this.controls.maxDistance = this.fitDistance * 1.3;
    if (this.mode === "attract") this.placeAtHome(1.12);
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.controls.enabled = mode === "play";
    if (mode === "play") this.recenter();
  }

  /** Back to the full-board view, facing the board straight on. */
  recenter(): void {
    this.startTween(HOME_TARGET, new THREE.Spherical(this.fitDistance, HOME_POLAR, 0), 900);
  }

  focusOn(point: THREE.Vector3, zoom = 0.62): void {
    const target = new THREE.Vector3(
      THREE.MathUtils.clamp(point.x, -PAN_LIMIT.x, PAN_LIMIT.x),
      0,
      THREE.MathUtils.clamp(point.z + 0.6, -PAN_LIMIT.z, PAN_LIMIT.z),
    );
    const current = this.currentSpherical();
    this.startTween(target, new THREE.Spherical(this.fitDistance * zoom, current.phi, current.theta), 800);
  }

  zoomBy(factor: number): void {
    const current = this.currentSpherical();
    const distance = THREE.MathUtils.clamp(
      current.radius * factor,
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    this.startTween(this.controls.target.clone(), new THREE.Spherical(distance, current.phi, current.theta), 320);
  }

  update(deltaSeconds: number): void {
    if (this.mode === "attract") {
      this.attractTime += deltaSeconds;
      const azimuth = Math.sin(this.attractTime * 0.11) * 0.5;
      const polar = 0.92 + Math.sin(this.attractTime * 0.07) * 0.06;
      this.camera.position.setFromSpherical(new THREE.Spherical(this.fitDistance * 1.08, polar, azimuth));
      this.camera.position.add(HOME_TARGET);
      this.controls.target.copy(HOME_TARGET);
      this.camera.lookAt(HOME_TARGET);
      return;
    }

    if (this.tween) {
      const tween = this.tween;
      tween.elapsed += deltaSeconds * 1_000;
      const progress = easeInOutCubic(Math.min(1, tween.elapsed / tween.duration));
      const target = tween.fromTarget.clone().lerp(tween.toTarget, progress);
      const spherical = new THREE.Spherical(
        THREE.MathUtils.lerp(tween.from.radius, tween.to.radius, progress),
        THREE.MathUtils.lerp(tween.from.phi, tween.to.phi, progress),
        THREE.MathUtils.lerp(tween.from.theta, tween.to.theta, progress),
      );
      this.controls.target.copy(target);
      this.camera.position.setFromSpherical(spherical).add(target);
      this.camera.lookAt(target);
      if (progress >= 1) this.tween = null;
    }

    this.controls.update();
    this.clampTarget();
  }

  dispose(): void {
    this.controls.dispose();
  }

  private startTween(target: THREE.Vector3, to: THREE.Spherical, duration: number): void {
    this.tween = {
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      from: this.currentSpherical(),
      to,
      elapsed: 0,
      duration,
    };
  }

  private currentSpherical(): THREE.Spherical {
    return new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
  }

  private placeAtHome(distanceFactor: number): void {
    this.controls.target.copy(HOME_TARGET);
    this.camera.position.setFromSpherical(new THREE.Spherical(this.fitDistance * distanceFactor, HOME_POLAR, 0));
    this.camera.position.add(HOME_TARGET);
    this.camera.lookAt(HOME_TARGET);
  }

  /** Keeps the board on screen: panning past the tray edges drags the camera back. */
  private clampTarget(): void {
    const target = this.controls.target;
    const clampedX = THREE.MathUtils.clamp(target.x, -PAN_LIMIT.x, PAN_LIMIT.x);
    const clampedZ = THREE.MathUtils.clamp(target.z, -PAN_LIMIT.z, PAN_LIMIT.z);
    const shift = new THREE.Vector3(clampedX - target.x, -target.y, clampedZ - target.z);
    if (shift.lengthSq() === 0) return;
    target.add(shift);
    this.camera.position.add(shift);
  }
}
