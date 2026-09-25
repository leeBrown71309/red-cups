import * as THREE from "three";
import { SCENE_COLORS } from "../theme/palette";

export const DISPLAY_FONT = "Fredoka, Nunito, 'Segoe UI', sans-serif";

interface LabelOptions {
  color?: string;
  stroke?: string;
  fontSize?: number;
  background?: string;
  paddingX?: number;
  worldHeight?: number;
}

/**
 * Billboard label drawn on a canvas. Returns a sprite sized in world units
 * so the label keeps its proportions whatever the text length.
 */
export function createLabelSprite(text: string, options: LabelOptions = {}): THREE.Sprite {
  const fontSize = options.fontSize ?? 64;
  const paddingX = options.paddingX ?? (options.background ? 34 : 12);
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  const font = `700 ${fontSize}px ${DISPLAY_FONT}`;
  let textWidth = fontSize * text.length * 0.6;
  if (measureContext) {
    measureContext.font = font;
    textWidth = measureContext.measureText(text).width;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(textWidth + paddingX * 2 + 16);
  canvas.height = Math.ceil(fontSize * 1.6);
  const context = canvas.getContext("2d");
  const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  if (!context) return sprite;

  if (options.background) {
    const radius = canvas.height / 2 - 6;
    context.fillStyle = SCENE_COLORS.ink;
    roundRect(context, 4, 8, canvas.width - 8, canvas.height - 10, radius);
    context.fill();
    context.fillStyle = options.background;
    roundRect(context, 4, 4, canvas.width - 8, canvas.height - 12, radius);
    context.fill();
  }

  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  const centerY = canvas.height / 2 + (options.background ? -2 : 2);
  if (options.stroke) {
    context.lineWidth = fontSize * 0.2;
    context.strokeStyle = options.stroke;
    context.strokeText(text, canvas.width / 2, centerY);
  }
  context.fillStyle = options.color ?? "#ffffff";
  context.fillText(text, canvas.width / 2, centerY);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  material.map = texture;
  const worldHeight = options.worldHeight ?? 0.5;
  sprite.scale.set((canvas.width / canvas.height) * worldHeight, worldHeight, 1);
  return sprite;
}

export function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

/** Resolves once the display font is usable by canvas, or after a timeout. */
export function waitForDisplayFont(): Promise<void> {
  if (!("fonts" in document)) return Promise.resolve();
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 2_500));
  const load = document.fonts
    .load(`700 64px ${DISPLAY_FONT}`)
    .then(() => undefined)
    .catch(() => undefined);
  return Promise.race([load, timeout]);
}
