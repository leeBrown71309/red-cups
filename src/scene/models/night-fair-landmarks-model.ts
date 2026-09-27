import * as THREE from "three";
import { TILE_COLORS } from "../../theme/palette";
import { addOutline, type SceneKit } from "../scene-kit";
import { createLabelSprite } from "../text-sprites";
import { createSwirlTexture, paintHellFace } from "./landmarks-model";
import type { AnimatedProp } from "./props-model";

/** Hell of the night fair, at the heart of the carousel. Its ride turns the way the carousel goes. */
export interface CarouselHell extends AnimatedProp {
  setReversed: (reversed: boolean) => void;
}

/** Kept low: anything tall in the middle of the board would hide tile 3 from the camera. */
const POLE_HEIGHT = 0.95;
const RIDE_RADIUS = 1.32;
const RIDE_HEIGHT = 0.78;
const TOP_SLICES = 8;
/** Radians per second; the sign follows the carousel's direction. */
const SPIN_SPEED = 0.6;

/**
 * Tile 11 at Luna Park: a cursed merry-go-round. Players sent to Hell stand
 * on its platform, around the lava face, while bats ride round its edge in
 * the carousel's current direction (1 → 2 → 3 → 4 is anticlockwise seen from
 * above, i.e. a positive turn around the vertical axis).
 */
export function createCarouselHell(kit: SceneKit): CarouselHell {
  const group = new THREE.Group();

  const platform = new THREE.Mesh(
    kit.geometry("carousel-platform", () => new THREE.CylinderGeometry(1.4, 1.5, 0.3, 16)),
    kit.flat("#3d2654"),
  );
  platform.position.y = 0.15;
  platform.castShadow = true;
  platform.receiveShadow = true;
  addOutline(platform, kit, 1.03);
  group.add(platform);

  const neonEdge = new THREE.Mesh(
    kit.geometry("carousel-edge", () => new THREE.TorusGeometry(1.46, 0.05, 4, 32)),
    kit.unlit(TILE_COLORS.hell.top),
  );
  neonEdge.rotation.x = Math.PI / 2;
  neonEdge.position.y = 0.3;
  group.add(neonEdge);

  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 256;
  faceCanvas.height = 256;
  paintHellFace(faceCanvas, 0);
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  const lava = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20), new THREE.MeshBasicMaterial({ map: faceTexture }));
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = 0.31;
  group.add(lava);

  const rotor = new THREE.Group();
  group.add(rotor);

  const pole = new THREE.Mesh(
    kit.geometry("carousel-pole", () => new THREE.CylinderGeometry(0.07, 0.09, POLE_HEIGHT, 6)),
    kit.flat("#ffd166", { emissive: "#ffb000", emissiveIntensity: 0.3 }),
  );
  pole.position.y = POLE_HEIGHT / 2 + 0.3;
  addOutline(pole, kit, 1.25);
  rotor.add(pole);

  for (let slice = 0; slice < TOP_SLICES; slice += 1) {
    const wedge = new THREE.Mesh(
      kit.geometry(
        `carousel-top-${slice}`,
        () =>
          new THREE.ConeGeometry(
            0.5,
            0.42,
            2,
            1,
            false,
            (slice / TOP_SLICES) * Math.PI * 2,
            (Math.PI * 2) / TOP_SLICES,
          ),
      ),
      kit.flat(slice % 2 === 0 ? "#ff4fa3" : "#5b1d8f"),
    );
    wedge.position.y = POLE_HEIGHT + 0.5;
    rotor.add(wedge);
  }

  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(
      kit.geometry("hell-horn", () => new THREE.ConeGeometry(0.28, 0.75, 5)),
      kit.flat("#3d2654"),
    );
    horn.scale.setScalar(0.45);
    horn.position.set(side * 0.17, POLE_HEIGHT + 0.86, 0);
    horn.rotation.z = -side * 0.5;
    addOutline(horn, kit, 1.08);
    rotor.add(horn);
  }

  const bulbGeometry = kit.geometry("fair-bulb", () => new THREE.IcosahedronGeometry(0.07, 0));
  const bulbs: THREE.Mesh[] = [];
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const bulb = new THREE.Mesh(bulbGeometry, kit.unlit(index % 2 === 0 ? "#ffd166" : "#ffffff"));
    bulb.position.set(Math.cos(angle) * 1.46, 0.36, Math.sin(angle) * 1.46);
    rotor.add(bulb);
    bulbs.push(bulb);
  }

  // Bats ride round the platform edge like carousel horses, bobbing out of step with each other.
  const seats: THREE.Group[] = [];
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    const seat = createBatSeat(kit);
    seat.position.set(Math.cos(angle) * RIDE_RADIUS, RIDE_HEIGHT, Math.sin(angle) * RIDE_RADIUS);
    rotor.add(seat);
    seats.push(seat);
  }

  const glow = new THREE.PointLight("#c86bff", 7, 7, 1.6);
  glow.position.y = 1.2;
  group.add(glow);

  const label = createLabelSprite("ENFER", {
    color: "#ffffff",
    background: TILE_COLORS.hell.top,
    fontSize: 54,
    worldHeight: 0.62,
  });
  // Nudged towards the camera so it floats over the platform, not over tile 3 behind it.
  const labelHeight = POLE_HEIGHT + 1.1;
  label.position.set(0, labelHeight, 0.95);
  group.add(label);

  let direction = 1;
  let speed = SPIN_SPEED;
  let lastPaint = 0;

  return {
    group,
    setReversed: (reversed) => {
      direction = reversed ? -1 : 1;
    },
    update: (elapsed, delta) => {
      // Eases into the new direction instead of snapping, like a real ride changing course.
      speed += (direction * SPIN_SPEED - speed) * Math.min(1, delta * 1.5);
      rotor.rotation.y += speed * delta;
      seats.forEach((seat, index) => {
        seat.position.y = RIDE_HEIGHT + Math.sin(elapsed * 2.2 + index * 1.6) * 0.14;
        // A positive turn moves each bat along (sin a, −cos a): its face (local +z) points there at π − a.
        seat.rotation.y = -((index / seats.length) * Math.PI * 2) + (speed > 0 ? Math.PI : 0);
      });
      bulbs.forEach((bulb, index) => {
        bulb.scale.setScalar(0.8 + (Math.sin(elapsed * 5 + index) > 0.4 ? 0.5 : 0));
      });
      glow.intensity = 6 + Math.sin(elapsed * 2.4) * 1.6;
      label.position.y = labelHeight + Math.sin(elapsed * 1.8) * 0.06;
      if (elapsed - lastPaint > 0.1) {
        lastPaint = elapsed;
        paintHellFace(faceCanvas, elapsed);
        faceTexture.needsUpdate = true;
      }
    },
  };
}

function createBatSeat(kit: SceneKit): THREE.Group {
  const seat = new THREE.Group();
  const rod = new THREE.Mesh(
    kit.geometry("bat-rod", () => new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4)),
    kit.flat("#ffd166"),
  );
  rod.position.y = -0.3;
  seat.add(rod);

  const body = new THREE.Mesh(
    kit.geometry("bat-body", () => new THREE.IcosahedronGeometry(0.2, 0)),
    kit.flat("#2d2250"),
  );
  addOutline(body, kit, 1.12);
  seat.add(body);

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      kit.geometry("bat-wing", () => new THREE.ConeGeometry(0.16, 0.42, 3)),
      kit.flat("#4b2a6b"),
    );
    wing.rotation.z = side * (Math.PI / 2);
    wing.position.x = side * 0.3;
    seat.add(wing);
  }

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      kit.geometry("bat-eye", () => new THREE.IcosahedronGeometry(0.04, 0)),
      kit.unlit("#ffe66d"),
    );
    eye.position.set(side * 0.07, 0.05, 0.17);
    seat.add(eye);
  }
  return seat;
}

/**
 * One end of the ghost train: a crooked haunted house whose door swallows or
 * spits out the pawns. Its door faces local +z; the caller turns it to its tile.
 */
export function createGhostTrainPortal(kit: SceneKit, signText: string): AnimatedProp {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    kit.geometry("haunted-body", () => new THREE.BoxGeometry(1.6, 1.2, 1.1)),
    kit.flat("#2d2250"),
  );
  body.position.y = 0.6;
  body.rotation.z = 0.04;
  body.castShadow = true;
  addOutline(body, kit, 1.03);
  group.add(body);

  const roof = new THREE.Mesh(
    kit.geometry("haunted-roof", () => new THREE.ConeGeometry(1.3, 0.95, 4)),
    kit.flat("#4b2a6b"),
  );
  roof.position.y = 1.66;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  addOutline(roof, kit, 1.04);
  group.add(roof);

  const archShape = new THREE.Shape();
  archShape.moveTo(-0.4, 0);
  archShape.lineTo(-0.4, 0.45);
  archShape.absarc(0, 0.45, 0.4, Math.PI, 0, true);
  archShape.lineTo(0.4, 0);
  archShape.closePath();
  const door = new THREE.Mesh(
    kit.geometry("haunted-door", () => new THREE.ShapeGeometry(archShape, 8)),
    kit.unlit("#0b0716"),
  );
  door.position.z = 0.56;
  group.add(door);

  const swirl = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 20),
    new THREE.MeshBasicMaterial({
      map: createSwirlTexture(["rgba(210, 255, 225, 1)", "rgba(80, 230, 150, 0.7)", "rgba(20, 70, 50, 0)"]),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  swirl.position.set(0, 0.42, 0.57);
  group.add(swirl);

  const windows: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const pane = new THREE.Mesh(
      kit.geometry("haunted-window", () => new THREE.PlaneGeometry(0.26, 0.3)),
      new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true }),
    );
    pane.position.set(side * 0.55, 0.9, 0.56);
    group.add(pane);
    windows.push(pane);
  }

  const ghost = createGhost(kit);
  group.add(ghost);

  const sign = createLabelSprite(signText, {
    color: "#ffffff",
    background: "#2fbf7f",
    fontSize: 44,
    worldHeight: 0.46,
  });
  sign.position.set(0, 2.65, 0);
  group.add(sign);

  const seed = signText.length;
  return {
    group,
    update: (elapsed) => {
      swirl.rotation.z = elapsed * -2.4;
      swirl.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.06);
      windows.forEach((pane, index) => {
        const flicker = Math.sin(elapsed * 11 + index * 3 + seed) > 0.85 ? 0.35 : 1;
        (pane.material as THREE.MeshBasicMaterial).opacity = flicker;
      });
      const orbit = elapsed * 0.9 + seed;
      ghost.position.set(Math.cos(orbit) * 1.05, 1.9 + Math.sin(elapsed * 2.1) * 0.15, Math.sin(orbit) * 0.8);
      ghost.rotation.y = -orbit;
      sign.position.y = 2.65 + Math.sin(elapsed * 2 + seed) * 0.05;
    },
  };
}

function createGhost(kit: SceneKit): THREE.Group {
  const ghost = new THREE.Group();
  const white = kit.flat("#f4f1ff", { emissive: "#bfc6ff", emissiveIntensity: 0.35 });
  const head = new THREE.Mesh(
    kit.geometry("ghost-head", () => new THREE.SphereGeometry(0.22, 8, 6)),
    white,
  );
  head.position.y = 0.12;
  ghost.add(head);
  const tail = new THREE.Mesh(
    kit.geometry("ghost-tail", () => new THREE.ConeGeometry(0.22, 0.34, 8, 1, true)),
    white,
  );
  tail.rotation.x = Math.PI;
  tail.position.y = -0.1;
  ghost.add(tail);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      kit.geometry("ghost-eye", () => new THREE.IcosahedronGeometry(0.035, 0)),
      kit.unlit("#1b1f3b"),
    );
    eye.position.set(side * 0.07, 0.16, 0.2);
    ghost.add(eye);
  }
  return ghost;
}
