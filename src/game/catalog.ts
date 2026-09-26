import type { ItemId, PassiveId, WheelId, WheelResult } from "./types";

export interface ItemDefinition {
  id: ItemId;
  name: string;
  price: number;
  symbol: string;
  description: string;
  target: "self" | "player" | "none" | "special";
  /** Only meaningful for player-targeted items. */
  canTargetSelf?: boolean;
}

export const ITEM_CATALOG: Record<ItemId, ItemDefinition> = {
  ndoye: {
    id: "ndoye",
    name: "Ndoye",
    price: 300,
    symbol: "◉",
    description: "Fait tourner la roue du malheur pour un joueur, toi compris.",
    target: "player",
    canTargetSelf: true,
  },
  "hollow-purple": {
    id: "hollow-purple",
    name: "Hollow Purple",
    price: 600,
    symbol: "✦",
    description: "Envoie un joueur en Enfer. Peut te cibler.",
    target: "player",
    canTargetSelf: true,
  },
  rope: {
    id: "rope",
    name: "Corde",
    price: 500,
    symbol: "↝",
    description: "Attire un autre joueur sur ta case.",
    target: "player",
  },
  boot: {
    id: "boot",
    name: "Botte",
    price: 100,
    symbol: "⇢",
    description: "À utiliser avant de bouger pour parcourir deux cases.",
    target: "special",
  },
  mud: {
    id: "mud",
    name: "Boue",
    price: 200,
    symbol: "●",
    description: "Pose-la sur ta case puis joue ton tour : qui s’y arrête perd 200 pièces et t’en donne 100.",
    target: "self",
  },
  eraser: {
    id: "eraser",
    name: "Gomme",
    price: 350,
    symbol: "⌫",
    description: "Annule un résultat de roue après son tirage.",
    target: "special",
  },
  "bullet-bill": {
    id: "bullet-bill",
    name: "Bullet Bill",
    price: 500,
    symbol: "➤",
    description: "Attend au départ dès l’achat, puis fonce sur le joueur le plus proche à chaque tour de table.",
    target: "special",
  },
  "middle-finger": {
    id: "middle-finger",
    name: "Middle Finger",
    price: 400,
    symbol: "✋",
    description: "Fait passer le prochain tour d’un joueur. Peut te cibler.",
    target: "player",
    canTargetSelf: true,
  },
  "monopoly-man": {
    id: "monopoly-man",
    name: "Monopoly Man",
    price: 550,
    symbol: "⇄",
    description: "Échange ta position avec celle d’un autre joueur.",
    target: "player",
  },
  "water-bottle": {
    id: "water-bottle",
    name: "Bouteille d’eau",
    price: 600,
    symbol: "♧",
    description: "Te sort de l’Enfer et te téléporte sur une case hors Enfer.",
    target: "special",
  },
  helmet: {
    id: "helmet",
    name: "Casque",
    price: 400,
    symbol: "⬡",
    description: "S’active automatiquement pour éviter un solde négatif.",
    target: "special",
  },
  draven: {
    id: "draven",
    name: "Draven",
    price: 700,
    symbol: "✹",
    description: "Envoie tout le monde en Enfer, utilisateur compris.",
    target: "self",
  },
};

export const ITEM_ORDER: ItemId[] = [
  "ndoye",
  "hollow-purple",
  "rope",
  "boot",
  "mud",
  "eraser",
  "bullet-bill",
  "middle-finger",
  "monopoly-man",
  "water-bottle",
  "helmet",
  "draven",
];

export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  shortName: string;
  description: string;
}

export const PASSIVE_CATALOG: Record<PassiveId, PassiveDefinition> = {
  "built-like-a-tank": {
    id: "built-like-a-tank",
    name: "Baraqué",
    shortName: "Baraqué",
    description: "La Corde te déplace de moitié. Le Monopoly Man ne t’affecte pas.",
  },
  "new-cup-new-me": {
    id: "new-cup-new-me",
    name: "New Cup, New Me",
    shortName: "New Cup",
    description: "À chaque nouvelle Cup, choisis ta case avant qu’elle soit révélée (sans roue ni boutique).",
  },
  "red-light-green-light": {
    id: "red-light-green-light",
    name: "Red light, Green light",
    shortName: "Red / Green",
    description: "+100 pièces sur une case verte, −100 sur une case rouge.",
  },
  "no-thanks": {
    id: "no-thanks",
    name: "Non merci",
    shortName: "Non merci",
    description: "Une fois tous les 3 tours, annule l’action d’un joueur.",
  },
  delinquent: {
    id: "delinquent",
    name: "Délinquant",
    shortName: "Délinquant",
    description: "Ignore une flèche en perdant 400 pièces (pas pour quitter le départ au 1er tour).",
  },
  penta: {
    id: "penta",
    name: "Penta",
    shortName: "Penta",
    description: "Possède un emplacement d’objet supplémentaire.",
  },
  troll: {
    id: "troll",
    name: "Troll",
    shortName: "Troll",
    description: "À chaque nouvelle Cup, vole 100 pièces à deux joueurs.",
  },
  "im-cups": {
    id: "im-cups",
    name: "Je suis Cups",
    shortName: "Cups",
    description: "Ne gagne pas les 200 pièces du départ.",
  },
  "i-take-notes": {
    id: "i-take-notes",
    name: "Je note",
    shortName: "Je note",
    description: "Quand un objet t’affecte, tu en reçois une copie (sauf Draven).",
  },
  "calm-down": {
    id: "calm-down",
    name: "Calme-toi",
    shortName: "Calme-toi",
    description: "Fais reculer de trois cases le joueur qui vient d’obtenir une Cup.",
  },
};

export const PASSIVE_ORDER: PassiveId[] = [
  "built-like-a-tank",
  "new-cup-new-me",
  "red-light-green-light",
  "no-thanks",
  "delinquent",
  "penta",
  "troll",
  "im-cups",
  "i-take-notes",
  "calm-down",
];

export interface WeightedWheelResult {
  wheelId: WheelId;
  id: WheelResult["id"];
  label: string;
  amount?: number;
  weight: number;
}

// Starter tables are intentionally data-driven so playtest feedback can rebalance them.
export const WHEEL_RESULTS: Record<WheelId, WeightedWheelResult[]> = {
  misfortune: [
    { wheelId: "misfortune", id: "lose-100", label: "−100 pièces", amount: 100, weight: 1 },
    { wheelId: "misfortune", id: "lose-200", label: "−200 pièces", amount: 200, weight: 1 },
    { wheelId: "misfortune", id: "lose-400", label: "−400 pièces", amount: 400, weight: 1 },
    { wheelId: "misfortune", id: "lose-item", label: "Perds un objet", weight: 1 },
    { wheelId: "misfortune", id: "skip-turn", label: "Passe ton prochain tour", weight: 1 },
    { wheelId: "misfortune", id: "go-to-hell", label: "Direction l’Enfer", weight: 1 },
    { wheelId: "misfortune", id: "spin-fortune", label: "Tourne la roue du bonheur", weight: 1 },
    { wheelId: "misfortune", id: "nothing", label: "Rien ne se passe", weight: 1 },
  ],
  fortune: [
    { wheelId: "fortune", id: "gain-100", label: "+100 pièces", amount: 100, weight: 2 },
    { wheelId: "fortune", id: "gain-200", label: "+200 pièces", amount: 200, weight: 2 },
    { wheelId: "fortune", id: "gain-300", label: "+300 pièces", amount: 300, weight: 1 },
    { wheelId: "fortune", id: "gain-400", label: "+400 pièces", amount: 400, weight: 1 },
    { wheelId: "fortune", id: "gain-500", label: "+500 pièces", amount: 500, weight: 1 },
    { wheelId: "fortune", id: "free-item", label: "Un objet gratuit à 300 pièces max", weight: 1 },
    { wheelId: "fortune", id: "spin-misfortune", label: "Tourne la roue du malheur", weight: 1 },
    { wheelId: "fortune", id: "escape", label: "Libération de l’Enfer ou +500 pièces", amount: 500, weight: 1 },
  ],
  hell: [
    { wheelId: "hell", id: "lose-100", label: "−100 pièces", amount: 100, weight: 2 },
    { wheelId: "hell", id: "lose-200", label: "−200 pièces", amount: 200, weight: 1 },
    { wheelId: "hell", id: "lose-400", label: "−400 pièces", amount: 400, weight: 1 },
    { wheelId: "hell", id: "lose-item", label: "Perds un objet", weight: 1 },
    { wheelId: "hell", id: "hell-skip", label: "Tu sautes ton prochain tour", weight: 1 },
    { wheelId: "hell", id: "challenge", label: "Choisis un joueur à affronter", weight: 1 },
    { wheelId: "hell", id: "escape", label: "Libération — retour case 0", weight: 2 },
  ],
};

export function chooseWheelResult(wheelId: WheelId, randomValue: number): WheelResult {
  const results = WHEEL_RESULTS[wheelId];
  const totalWeight = results.reduce((sum, result) => sum + result.weight, 0);
  const normalizedValue = Math.min(Math.max(randomValue, 0), 0.999_999_999);
  let cursor = normalizedValue * totalWeight;

  for (const result of results) {
    cursor -= result.weight;
    if (cursor < 0) {
      return {
        id: result.id,
        label: result.label,
        amount: result.amount,
      };
    }
  }

  const lastResult = results[results.length - 1];
  return { id: lastResult.id, label: lastResult.label, amount: lastResult.amount };
}
