import * as THREE from "three";
import { SCENE_COLORS } from "../../theme/palette";
import type { AccessoryId, PlayerLook } from "../../theme/player-looks";
import { addOutline, jitterGeometry, type SceneKit } from "../scene-kit";
import { createLabelSprite } from "../text-sprites";

export const PAWN_BODY_RADIUS = 0.4;

/** Parts of a pawn that the animator squashes, turns and blinks. */
export interface PawnVisual {
  root: THREE.Group;
  body: THREE.Group;
  eyes: THREE.Group;
  activeRing: THREE.Mesh;
  activeArrow: THREE.Group;
  sleepLabel: THREE.Sprite;
}

export function createPawnVisual(look: PlayerLook, kit: SceneKit, seed: number): PawnVisual {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const blobGeometry = kit.geometry(`pawn-blob-${seed % 4}`, () =>
    jitterGeometry(new THREE.IcosahedronGeometry(PAWN_BODY_RADIUS, 1), 0.035, 40 + seed),
  );
  const blob = new THREE.Mesh(blobGeometry, kit.flat(look.color));
  blob.scale.set(1, 0.9, 1);
  blob.position.y = PAWN_BODY_RADIUS * 0.92;
  blob.castShadow = true;
  addOutline(blob, kit, 1.08);
  body.add(blob);

  const footGeometry = kit.geometry("pawn-foot", () => new THREE.IcosahedronGeometry(0.13, 0));
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(footGeometry, kit.flat(look.deep));
    foot.scale.set(1, 0.55, 1.25);
    foot.position.set(side * 0.18, 0.05, 0.08);
    foot.castShadow = true;
    body.add(foot);
  }

  const eyes = new THREE.Group();
  eyes.position.set(0, PAWN_BODY_RADIUS * 1.02, PAWN_BODY_RADIUS * 0.9);
  const eyeWhiteGeometry = kit.geometry("pawn-eye", () => new THREE.SphereGeometry(0.105, 12, 10));
  const pupilGeometry = kit.geometry("pawn-pupil", () => new THREE.SphereGeometry(0.066, 10, 8));
  const glintGeometry = kit.geometry("pawn-glint", () => new THREE.SphereGeometry(0.024, 6, 4));
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.x = side * 0.15;
    const white = new THREE.Mesh(eyeWhiteGeometry, kit.glossy("#ffffff"));
    white.scale.z = 0.6;
    addOutline(white, kit, 1.18);
    const pupil = new THREE.Mesh(pupilGeometry, kit.glossy(SCENE_COLORS.ink));
    pupil.position.set(side * -0.012, -0.01, 0.052);
    pupil.scale.z = 0.5;
    const glint = new THREE.Mesh(glintGeometry, kit.unlit("#ffffff"));
    glint.position.set(0.025, 0.03, 0.09);
    eye.add(white, pupil, glint);
    eyes.add(eye);
  }
  body.add(eyes);

  const cheekGeometry = kit.geometry("pawn-cheek", () => new THREE.CircleGeometry(0.055, 8));
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(cheekGeometry, kit.unlit("#ff8fa3", 0.75));
    cheek.position.set(side * 0.25, PAWN_BODY_RADIUS * 0.84, PAWN_BODY_RADIUS * 0.8);
    cheek.rotation.y = side * 0.5;
    body.add(cheek);
  }

  const accessory = createAccessory(look.accessory, look, kit);
  accessory.position.y = PAWN_BODY_RADIUS * 1.62;
  body.add(accessory);

  const activeRing = new THREE.Mesh(
    kit.geometry("pawn-active-ring", () => new THREE.RingGeometry(0.46, 0.62, 20)),
    new THREE.MeshBasicMaterial({ color: look.color, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  activeRing.rotation.x = -Math.PI / 2;
  activeRing.position.y = 0.025;
  activeRing.visible = false;
  root.add(activeRing);

  const activeArrow = new THREE.Group();
  const arrowMesh = new THREE.Mesh(
    kit.geometry("pawn-arrow", () => new THREE.ConeGeometry(0.17, 0.3, 3)),
    kit.flat(look.color),
  );
  arrowMesh.rotation.x = Math.PI;
  addOutline(arrowMesh, kit, 1.18);
  activeArrow.add(arrowMesh);
  activeArrow.position.y = 1.55;
  activeArrow.visible = false;
  root.add(activeArrow);

  const sleepLabel = createLabelSprite("z Z", { color: "#ffffff", stroke: SCENE_COLORS.ink, worldHeight: 0.38 });
  sleepLabel.position.set(0.35, 1.3, 0);
  sleepLabel.visible = false;
  root.add(sleepLabel);

  return { root, body, eyes, activeRing, activeArrow, sleepLabel };
}

function createAccessory(accessory: AccessoryId, look: PlayerLook, kit: SceneKit): THREE.Group {
  const group = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, color: string, outline = true): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, kit.flat(color));
    mesh.castShadow = true;
    if (outline) addOutline(mesh, kit, 1.14);
    group.add(mesh);
    return mesh;
  };

  switch (accessory) {
    case "party-hat": {
      const hat = add(
        kit.geometry("acc-hat", () => new THREE.ConeGeometry(0.16, 0.38, 6)),
        "#ffd166",
      );
      hat.position.y = 0.12;
      hat.rotation.z = -0.18;
      const pompom = add(
        kit.geometry("acc-pompom", () => new THREE.IcosahedronGeometry(0.06, 0)),
        "#ff5d8f",
      );
      pompom.position.set(-0.035, 0.32, 0);
      break;
    }
    case "sprout": {
      const stem = add(
        kit.geometry("acc-stem", () => new THREE.CylinderGeometry(0.018, 0.022, 0.18, 5)),
        "#3a9a4a",
        false,
      );
      stem.position.y = 0.05;
      for (const side of [-1, 1]) {
        const leaf = add(
          kit.geometry("acc-leaf", () => new THREE.IcosahedronGeometry(0.1, 0)),
          "#7ee07a",
        );
        leaf.scale.set(1.3, 0.35, 0.7);
        leaf.position.set(side * 0.1, 0.16, 0);
        leaf.rotation.z = side * 0.5;
      }
      break;
    }
    case "bow": {
      for (const side of [-1, 1]) {
        const wing = add(
          kit.geometry("acc-bow", () => new THREE.ConeGeometry(0.1, 0.2, 4)),
          "#ff6fae",
        );
        wing.rotation.z = side * (Math.PI / 2);
        wing.position.set(side * 0.1, 0.02, 0.12);
      }
      const knot = add(
        kit.geometry("acc-knot", () => new THREE.IcosahedronGeometry(0.05, 0)),
        "#ff3f8e",
      );
      knot.position.set(0, 0.02, 0.12);
      break;
    }
    case "antenna": {
      const stick = add(
        kit.geometry("acc-antenna", () => new THREE.CylinderGeometry(0.015, 0.015, 0.3, 5)),
        look.deep,
        false,
      );
      stick.position.y = 0.1;
      const ball = add(
        kit.geometry("acc-antenna-ball", () => new THREE.IcosahedronGeometry(0.075, 1)),
        "#ffe066",
      );
      ball.position.y = 0.27;
      break;
    }
    case "horns": {
      for (const side of [-1, 1]) {
        const horn = add(
          kit.geometry("acc-horn", () => new THREE.ConeGeometry(0.07, 0.2, 5)),
          "#fff1d6",
        );
        horn.position.set(side * 0.17, 0.02, 0.02);
        horn.rotation.z = -side * 0.35;
      }
      break;
    }
    case "cat-ears": {
      for (const side of [-1, 1]) {
        const ear = add(
          kit.geometry("acc-ear", () => new THREE.ConeGeometry(0.11, 0.2, 3)),
          look.color,
        );
        ear.position.set(side * 0.2, -0.02, 0);
        ear.rotation.z = -side * 0.35;
      }
      break;
    }
    case "beanie": {
      const cap = add(
        kit.geometry("acc-beanie", () => new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2)),
        "#5aa9e6",
      );
      cap.position.y = -0.12;
      const pompom = add(
        kit.geometry("acc-beanie-pompom", () => new THREE.IcosahedronGeometry(0.08, 0)),
        "#ffffff",
      );
      pompom.position.y = 0.2;
      break;
    }
    case "halo": {
      const halo = add(
        kit.geometry("acc-halo", () => new THREE.TorusGeometry(0.17, 0.035, 5, 12)),
        "#ffe27a",
        false,
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.2;
      break;
    }
  }

  return group;
}
