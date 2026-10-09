import type { PassiveId } from "../../game/types";
import type { FrameId, GlyphId, ShapeId } from "./card-ornaments";
import type { CardPalette, PatternId } from "./card-patterns";

/**
 * The look of every card. There are no families any more: each Cups Power and each passif has its own texture, its
 * own colours, its own medallion, corner glyph and frame, chosen for what the card does. The back of a card is built
 * from the same design, so it can be told apart before a word of it is read.
 */

export interface CardDesign {
  pattern: PatternId;
  palette: CardPalette;
  /** The shape the emblem stands in. */
  shape: ShapeId;
  /** The mark in the four corners. */
  glyph: GlyphId;
  frame: FrameId;
  /** What rings the medallion on the back: a crown of rays, of beads, or nothing. */
  ring: "rays" | "beads" | "none";
}

const pal = (deep: string, mid: string, hi: string, accent: string, paper: string): CardPalette => ({
  deep,
  mid,
  hi,
  accent,
  paper,
});

export const CARD_DESIGNS: Record<PassiveId, CardDesign> = {
  // ---- Cups Power ----
  // Cupide: a purse of gold.
  greedy: {
    pattern: "coins",
    palette: pal("#4a3200", "#8a5d00", "#ffd24a", "#e6a417", "#fff3c9"),
    shape: "scallop",
    glyph: "coin",
    frame: "double",
    ring: "beads",
  },
  // Le diable: crimson flames.
  devil: {
    pattern: "flames",
    palette: pal("#2a0b10", "#7a1520", "#ff6a2a", "#d92b2b", "#ffe3dc"),
    shape: "burst",
    glyph: "flame",
    frame: "jagged",
    ring: "rays",
  },
  // L'Ange-Gardien: clouds and a halo.
  "guardian-angel": {
    pattern: "clouds",
    palette: pal("#3a6fb0", "#6fa3dd", "#ffffff", "#e9b93a", "#f3f8ff"),
    shape: "egg",
    glyph: "ring",
    frame: "scallop",
    ring: "rays",
  },
  // Red Bull: electric blue.
  "red-bull": {
    pattern: "bolts",
    palette: pal("#0c2a52", "#1d5fb5", "#8fe0ff", "#2aa4f4", "#e3f4ff"),
    shape: "diamond",
    glyph: "bolt",
    frame: "notched",
    ring: "rays",
  },
  // eShop: a green circuit board.
  eshop: {
    pattern: "circuit",
    palette: pal("#0f3a2e", "#1f7a5c", "#6ff2b6", "#19b27a", "#e0fbee"),
    shape: "squircle",
    glyph: "arrow",
    frame: "ticket",
    ring: "none",
  },
  // Tomato Enjoyer: ripe tomatoes.
  "tomato-enjoyer": {
    pattern: "tomatoes",
    palette: pal("#5a0f10", "#c22a2a", "#7ed14f", "#e03a30", "#ffe5df"),
    shape: "circle",
    glyph: "leaf",
    frame: "wavy",
    ring: "beads",
  },
  // Roller: dice on an amber felt.
  roller: {
    pattern: "pips",
    palette: pal("#5c2d0a", "#b8651a", "#ffe9a8", "#ea8a2a", "#fff0dc"),
    shape: "octagon",
    glyph: "die",
    frame: "double",
    ring: "none",
  },
  // Chance aveugle: four-leaf clovers.
  "blind-luck": {
    pattern: "clover",
    palette: pal("#12351f", "#2c7a45", "#bff5c8", "#3fb560", "#e9fbe9"),
    shape: "scallop",
    glyph: "clover",
    frame: "stitch",
    ring: "beads",
  },
  // Double or nothing: the casino floor.
  "double-or-nothing": {
    pattern: "casino",
    palette: pal("#16161a", "#3d3d46", "#e8c24a", "#c9a227", "#fff7d9"),
    shape: "diamond",
    glyph: "heart",
    frame: "notched",
    ring: "beads",
  },
  // Mime: a harlequin's diamonds, black, white and one red.
  mime: {
    pattern: "harlequin",
    palette: pal("#fafafa", "#17171a", "#e43c3c", "#17171a", "#f6f6f6"),
    shape: "arch",
    glyph: "drop",
    frame: "arch",
    ring: "none",
  },
  // Taupe: layers of earth and a tunnel.
  mole: {
    pattern: "strata",
    palette: pal("#3a2616", "#6b4a2a", "#d6b077", "#9a6a3a", "#f4e6d0"),
    shape: "arch",
    glyph: "triangle",
    frame: "wavy",
    ring: "none",
  },
  // Mage noir: pentagrams in the dark.
  "black-mage": {
    pattern: "pentagrams",
    palette: pal("#150a26", "#3b1c6b", "#c58bff", "#7a2fd0", "#efe3ff"),
    shape: "hex",
    glyph: "star5",
    frame: "double",
    ring: "rays",
  },
  // Mi-vu, Mi-vue: day on one side, night on the other.
  "half-seen": {
    pattern: "moonsplit",
    palette: pal("#1d1b3a", "#f0a53a", "#fbf0d2", "#5b52c9", "#f1efff"),
    shape: "circle",
    glyph: "moon",
    frame: "plain",
    ring: "beads",
  },
  // Sœur Fantôme: two wisps, mirror images.
  "ghost-sister": {
    pattern: "wisps",
    palette: pal("#284a6b", "#4f84ad", "#e6f6ff", "#6fb7e8", "#eaf7ff"),
    shape: "egg",
    glyph: "star4",
    frame: "wavy",
    ring: "none",
  },
  // Lambda: nothing in particular.
  lambda: {
    pattern: "stripes",
    palette: pal("#3d3d46", "#5c5c68", "#b9b9c6", "#8a8a98", "#f0f0f4"),
    shape: "circle",
    glyph: "diamond",
    frame: "plain",
    ring: "none",
  },
  // ---- Passifs ----
  // Baraqué: a wall of bricks.
  "built-like-a-tank": {
    pattern: "bricks",
    palette: pal("#4a2c1c", "#7d4a2e", "#e0aa70", "#c0602a", "#fbe9d8"),
    shape: "shield",
    glyph: "shield",
    frame: "notched",
    ring: "none",
  },
  // Non merci: the forbidden sign.
  "no-thanks": {
    pattern: "slashes",
    palette: pal("#4a0f1a", "#8a1f33", "#ffb3bd", "#d63a52", "#ffe3e8"),
    shape: "octagon",
    glyph: "triangle",
    frame: "plain",
    ring: "none",
  },
  // J'prends des notes: a notebook.
  "i-take-notes": {
    pattern: "notebook",
    palette: pal("#2e4f7a", "#6d97c9", "#fdfbf0", "#3f78c4", "#fffdf0"),
    shape: "squircle",
    glyph: "page",
    frame: "stitch",
    ring: "none",
  },
  // Corrupteur: a banknote's guilloche.
  corrupter: {
    pattern: "plaid",
    palette: pal("#3b3a12", "#7a7424", "#ecdd7a", "#a39a2a", "#f7f3cf"),
    shape: "hex",
    glyph: "coin",
    frame: "double",
    ring: "beads",
  },
  // Le Voleur: keyholes in the night.
  thief: {
    pattern: "keyholes",
    palette: pal("#1a1d2e", "#343a5c", "#9aa5d8", "#4a5390", "#e8ebfa"),
    shape: "drop",
    glyph: "key",
    frame: "ticket",
    ring: "none",
  },
  // Feu rouge, feu vert: the two lights.
  "red-light-green-light": {
    pattern: "chevrons",
    palette: pal("#143b26", "#d63a3a", "#4fdc84", "#d94a3a", "#f3fbe8"),
    shape: "squircle",
    glyph: "arrow",
    frame: "notched",
    ring: "none",
  },
  // New Cup, New Me: a fresh red cup.
  "new-cup-new-me": {
    pattern: "cups",
    palette: pal("#8a1f1a", "#e8453c", "#fff0ee", "#e8453c", "#ffeceb"),
    shape: "scallop",
    glyph: "cup",
    frame: "scallop",
    ring: "rays",
  },
  // Calme-toi: slow blue-green waves.
  "calm-down": {
    pattern: "waves",
    palette: pal("#1c4f5a", "#2e8a9a", "#bff0f5", "#2aa3b5", "#e2f8fa"),
    shape: "drop",
    glyph: "drop",
    frame: "wavy",
    ring: "none",
  },
  // Bébé de papa: scales of a spoiled child, pink and gold.
  "nepo-baby": {
    pattern: "scales",
    palette: pal("#5a2a52", "#9a4f8f", "#ffd9a8", "#d86ab8", "#ffeaf8"),
    shape: "scallop",
    glyph: "crown",
    frame: "scallop",
    ring: "beads",
  },
  // Goblin: green and warty.
  goblin: {
    pattern: "spikes",
    palette: pal("#1f3b14", "#3f7a24", "#b6e36a", "#5aa532", "#eefadb"),
    shape: "burst",
    glyph: "eye",
    frame: "jagged",
    ring: "none",
  },
  // Dernier de la classe: stairs, indigo and chalk.
  "last-in-class": {
    pattern: "steps",
    palette: pal("#35306b", "#5b55b0", "#ffe08a", "#6f69d6", "#eeedff"),
    shape: "hex",
    glyph: "arrow",
    frame: "ticket",
    ring: "none",
  },
  // Habitué de l'Enfer: embers.
  "hell-regular": {
    pattern: "embers",
    palette: pal("#3b1205", "#8a2a0a", "#ff9a3a", "#e8641a", "#ffe9d6"),
    shape: "squircle",
    glyph: "flame",
    frame: "stitch",
    ring: "beads",
  },
  // Main verte: leaves.
  "green-hand": {
    pattern: "leaves",
    palette: pal("#17421f", "#2f8a3a", "#c7f5a0", "#3fa94c", "#e8fbe0"),
    shape: "egg",
    glyph: "leaf",
    frame: "arch",
    ring: "none",
  },
  // Main rouge: a red zigzag.
  "red-hand": {
    pattern: "zigzag",
    palette: pal("#4a1010", "#c02a2a", "#ffc2b8", "#e04040", "#ffe6e1"),
    shape: "diamond",
    glyph: "triangle",
    frame: "jagged",
    ring: "none",
  },
  // Touché angélique: rays of light.
  "angelic-touch": {
    pattern: "sunburst",
    palette: pal("#c99a2a", "#f0c85a", "#fffbe6", "#f2b630", "#fffbea"),
    shape: "burst",
    glyph: "ring",
    frame: "double",
    ring: "rays",
  },
  // Touché funeste: claw marks.
  "devils-hand": {
    pattern: "claws",
    palette: pal("#240a14", "#5a1130", "#ff5c7a", "#c01f4a", "#ffe1e8"),
    shape: "burst",
    glyph: "flame",
    frame: "notched",
    ring: "rays",
  },
  // Meneur de jeu: a mosaic of pieces.
  "game-master": {
    pattern: "triangles",
    palette: pal("#2a1550", "#b0309a", "#4de0e0", "#d63fb8", "#fbe6f8"),
    shape: "octagon",
    glyph: "die",
    frame: "ticket",
    ring: "beads",
  },
  // Brocanteur: a patchwork of finds.
  "junk-dealer": {
    pattern: "patchwork",
    palette: pal("#4d3b22", "#a8823f", "#ecdcb0", "#c49a4a", "#f8efd8"),
    shape: "squircle",
    glyph: "coin",
    frame: "stitch",
    ring: "none",
  },
  // Piégeur: the jaws of a trap.
  trapper: {
    pattern: "jaws",
    palette: pal("#26292e", "#50565f", "#e0503f", "#8a929e", "#eceff2"),
    shape: "hex",
    glyph: "triangle",
    frame: "jagged",
    ring: "none",
  },
  // L'Ermite: a night sky and one lantern.
  hermit: {
    pattern: "nightsky",
    palette: pal("#0f2230", "#2a5c7a", "#ffd98a", "#e0a63a", "#fff4d9"),
    shape: "arch",
    glyph: "moon",
    frame: "arch",
    ring: "beads",
  },
  // L'Assureur: umbrellas against the rain.
  insurer: {
    pattern: "umbrellas",
    palette: pal("#14264a", "#2a4a8a", "#ffd34d", "#2f5fb8", "#e8eefc"),
    shape: "shield",
    glyph: "shield",
    frame: "double",
    ring: "beads",
  },
};
