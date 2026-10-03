import type { ItemId, PassiveId, Player, WheelId, WheelResult } from "./types";

export interface ItemDefinition {
  id: ItemId;
  name: string;
  price: number;
  symbol: string;
  /** A general description, for the shop, the bag, How to play and the target picker. */
  description: string;
  target: "self" | "player" | "none" | "special";
  /** Energy spent to use it on your turn; nothing for the items that trigger on their own. */
  energyCost: number;
  /**
   * Stackable items pile up to this many in a bag slot. Each stack counts as
   * one copy, and only one stack is thrown from per turn.
   */
  stackLimit?: number;
  /** Only meaningful for player-targeted items. */
  canTargetSelf?: boolean;
}

export const ITEM_CATALOG: Record<ItemId, ItemDefinition> = {
  ndoye: {
    id: "ndoye",
    name: "Ndoye",
    price: 250,
    symbol: "◉",
    description: "Fait tourner la roue du malheur à un joueur, toi compris.",
    target: "player",
    energyCost: 2,
    canTargetSelf: true,
  },
  "hollow-purple": {
    id: "hollow-purple",
    name: "Hollow Purple",
    price: 600,
    symbol: "✦",
    description: "Envoie un joueur en Enfer. Peut te cibler.",
    target: "player",
    energyCost: 3,
    canTargetSelf: true,
  },
  rope: {
    id: "rope",
    name: "Corde",
    price: 400,
    symbol: "↝",
    description: "Attire un autre joueur sur ta case, sans roue ni boutique pour lui.",
    target: "player",
    energyCost: 2,
  },
  boot: {
    id: "boot",
    name: "Botte",
    price: 100,
    symbol: "⇢",
    description:
      "Avant de bouger : ton déplacement fait exactement deux cases, et garde 1 point d’énergie pour lui. " +
      "Son prix monte à chaque tour de table.",
    target: "special",
    energyCost: 1,
  },
  mud: {
    id: "mud",
    name: "Boue",
    price: 200,
    symbol: "●",
    description: "Pose-la sur ta case avant de bouger : qui s’y arrête perd 200 pièces et t’en donne 100.",
    target: "self",
    energyCost: 1,
  },
  eraser: {
    id: "eraser",
    name: "Gomme",
    price: 200,
    symbol: "⌫",
    description: "Annule le résultat d’une roue tournée pour toi, bon ou mauvais.",
    target: "special",
    energyCost: 0,
  },
  "bullet-bill": {
    id: "bullet-bill",
    name: "Bullet Bill",
    price: 550,
    symbol: "➤",
    description:
      "Lance-le depuis ton sac : il attend au départ, puis fonce sur le joueur le plus proche à chaque tour de " +
      "table. Sa victime perd 200 pièces et un tour.",
    target: "none",
    energyCost: 2,
  },
  "middle-finger": {
    id: "middle-finger",
    name: "Middle Finger",
    price: 400,
    symbol: "✋",
    description: "Fait passer le prochain tour d’un joueur. Peut te cibler.",
    target: "player",
    energyCost: 2,
    canTargetSelf: true,
  },
  "monopoly-man": {
    id: "monopoly-man",
    name: "Monopoly Man",
    price: 600,
    symbol: "⇄",
    description:
      "Échange ta position avec celle d’un autre joueur, sans roue ni boutique. Contre Baraqué, un bras de fer " +
      "décide.",
    target: "player",
    energyCost: 3,
  },
  "water-bottle": {
    id: "water-bottle",
    name: "Bouteille d’eau",
    price: 600,
    symbol: "♧",
    description: "En Enfer seulement : te téléporte sur une case au hasard.",
    target: "special",
    energyCost: 3,
  },
  helmet: {
    id: "helmet",
    name: "Casque",
    price: 200,
    symbol: "⬡",
    description: "S’active tout seul pour éviter un solde négatif.",
    target: "special",
    energyCost: 0,
  },
  draven: {
    id: "draven",
    name: "Draven",
    price: 700,
    symbol: "✹",
    description: "Envoie tout le monde en Enfer, toi compris.",
    target: "self",
    energyCost: 3,
  },
  tomato: {
    id: "tomato",
    name: "Tomate",
    price: 10,
    symbol: "✺",
    description:
      "Lance-la sur un joueur pour rire, sans énergie : 2 chances sur 100 de l’assommer un tour. " +
      "Une seule pile de 5 dans le sac.",
    target: "player",
    energyCost: 0,
    stackLimit: 5,
  },
  "made-in-heaven": {
    id: "made-in-heaven",
    name: "Made In Heaven",
    price: 1_200,
    symbol: "✧",
    description:
      "Chance aveugle seulement : renvoie tous les autres joueurs au Départ, Enfer compris, sans bonus, et pose " +
      "la Red Cup en case 8. En vente tant qu’elle n’y est pas, un seul à la fois.",
    target: "none",
    energyCost: 3,
  },
  portal: {
    id: "portal",
    name: "Portail",
    price: 300,
    symbol: "◎",
    description:
      "Le diable : ouvre un portail vers l’Enfer sur une case au hasard, ni l’Enfer, ni le Départ, ni la Red Cup. " +
      "Qui s’y arrête, toi compris, tombe en Enfer. Il se referme après 2 tours de table.",
    target: "none",
    energyCost: 2,
  },
  "hell-touch": {
    id: "hell-touch",
    name: "Toucher d’Enfer",
    price: 400,
    symbol: "☠",
    description:
      "Le diable : agit tout seul. Tout joueur assommé ou privé de tour sur ta case part en Enfer, tous d’un coup.",
    target: "special",
    energyCost: 0,
  },
  "black-cup": {
    id: "black-cup",
    name: "Black Cup",
    price: 400,
    symbol: "▼",
    description:
      "Le diable : la Red Cup passe 2 tours de table en Enfer, puis revient sur sa case. Un autre joueur qui " +
      "arrive en Enfer entre-temps la ramasse.",
    target: "none",
    energyCost: 3,
  },
  sentence: {
    id: "sentence",
    name: "Sentence",
    price: 400,
    symbol: "⚖",
    description: "Le diable : envoie en Enfer tous les autres joueurs à 0 pièce ou moins.",
    target: "none",
    energyCost: 2,
  },
  doomsday: {
    id: "doomsday",
    name: "Doomsday",
    price: 666,
    symbol: "☄",
    description:
      "Le diable : jusqu’à ton prochain tour, toutes les cases font tourner la roue du malheur, Départ et " +
      "boutiques compris. Le Départ ne paie plus et la boutique ne s’ouvre pas.",
    target: "none",
    energyCost: 3,
  },
  shield: {
    id: "shield",
    name: "Bouclier",
    price: 500,
    symbol: "⛨",
    description:
      "L’Ange-Gardien : quand un objet ou Bullet Bill vise ton protégé, tu peux le bloquer, même hors de ton tour.",
    target: "special",
    energyCost: 0,
  },
};

export const ITEM_ORDER: ItemId[] = [
  "ndoye",
  "hollow-purple",
  "rope",
  "boot",
  "mud",
  "tomato",
  "eraser",
  "bullet-bill",
  "middle-finger",
  "monopoly-man",
  "water-bottle",
  "helmet",
  "draven",
  "made-in-heaven",
  "shield",
  "portal",
  "hell-touch",
  "black-cup",
  "sentence",
  "doomsday",
];

/** Le diable's own shop, a second tab on the blue tiles. */
export const DEVIL_ITEMS: ItemId[] = ["portal", "hell-touch", "black-cup", "sentence", "doomsday"];

/**
 * Wheel of fortune: the items of 400 coins or less at the shop, one of which
 * is given away. Listed by hand so a price change never alters the draw
 * unnoticed (a test checks every price stays within the limit).
 */
export const FREE_ITEM_POOL: ItemId[] = ["ndoye", "rope", "boot", "mud", "tomato", "eraser", "middle-finger", "helmet"];

export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  shortName: string;
  /** A general description, for How to play and the player card. */
  description: string;
}

export const PASSIVE_CATALOG: Record<PassiveId, PassiveDefinition> = {
  "built-like-a-tank": {
    id: "built-like-a-tank",
    name: "Baraqué",
    shortName: "Baraqué",
    description:
      "La Corde te déplace de moitié. Contre le Monopoly Man, un bras de fer décide de l’échange, et tes coups " +
      "comptent 1,2 fois.",
  },
  "new-cup-new-me": {
    id: "new-cup-new-me",
    name: "New Cup, New Me",
    shortName: "New Cup",
    description: "À chaque nouvelle Cup, avant qu’elle apparaisse : file au Départ (+200 pièces) ou reste où tu es.",
  },
  "red-light-green-light": {
    id: "red-light-green-light",
    name: "Red light, Green light",
    shortName: "Red / Green",
    description:
      "Par Red Cup, tes deux premières cases vertes traversées rapportent 100 pièces, tes deux premières rouges en " +
      "coûtent 100.",
  },
  "no-thanks": {
    id: "no-thanks",
    name: "Non merci",
    shortName: "Non merci",
    description:
      "Une fois tous les 5 tours de table, annule un objet utilisé contre toi, une roue qui t’affecte ou Bullet " +
      "Bill qui fonce sur toi.",
  },
  corrupter: {
    id: "corrupter",
    name: "Corrupteur",
    shortName: "Corrupteur",
    description: "Ignore les sens interdits pour 400 pièces par déplacement.",
  },
  goblin: {
    id: "goblin",
    name: "Goblin",
    shortName: "Goblin",
    description: "À chaque nouvelle Cup, vole 100 pièces à deux adversaires au hasard.",
  },
  "i-take-notes": {
    id: "i-take-notes",
    name: "Je note",
    shortName: "Je note",
    description: "Quand un objet à cible unique est utilisé contre toi, une chance sur trois d’en garder une copie.",
  },
  "calm-down": {
    id: "calm-down",
    name: "Calme-toi",
    shortName: "Calme-toi",
    description:
      "À chaque nouvelle Cup, replace à 3 cases d’elle un joueur qui en est à 1 ou 2 cases, s’il en est plus près " +
      "que toi.",
  },
  lambda: {
    id: "lambda",
    name: "Lambda",
    shortName: "Lambda",
    description: "Rien de spécial : tu es une personne normale.",
  },
  "nepo-baby": {
    id: "nepo-baby",
    name: "Nepo Baby",
    shortName: "Nepo Baby",
    description: "Tu commences la partie avec 3 000 pièces.",
  },
  "red-bull": {
    id: "red-bull",
    name: "Red Bull",
    shortName: "Red Bull",
    description: "Tu as 4 points d’énergie à chaque tour.",
  },
  eshop: {
    id: "eshop",
    name: "eShop",
    shortName: "eShop",
    description: "Après chaque déplacement, la boutique s’ouvre où que tu sois. Tu commences avec 1 000 pièces.",
  },
  "tomato-enjoyer": {
    id: "tomato-enjoyer",
    name: "Tomato Enjoyer",
    shortName: "Tomato",
    description:
      "Chaque place de ton sac tient une pile de 5 Tomates, et tu en lances autant de piles que tu veux par " +
      "tour. Tes Tomates assomment 5 fois sur 100, et chaque Tomate reçue te rapporte 5 pièces.",
  },
  roller: {
    id: "roller",
    name: "Roller",
    shortName: "Roller",
    description:
      "Tu lances un dé à 6 faces pour chaque déplacement, sans repasser par une case. Pas de Botte pour toi.",
  },
  greedy: {
    id: "greedy",
    name: "Cupide",
    shortName: "Cupide",
    description:
      "Tu gagnes à 5 000 pièces. Une Red Cup te rapporte 1 000 pièces au lieu d’une place, marcher sur un joueur " +
      "assommé lui vole 50 pièces, ta Boue coûte 100 et rapporte 200, et ce que ton Ndoye fait perdre te revient.",
  },
  "double-or-nothing": {
    id: "double-or-nothing",
    name: "Double or nothing",
    shortName: "Double",
    description:
      "À chaque gain ou perte de pièces, tu peux tenter un 50/50 : la somme est doublée ou annulée. Tes achats et " +
      "le Corrupteur ne comptent pas.",
  },
  "blind-luck": {
    id: "blind-luck",
    name: "Chance aveugle",
    shortName: "Aveugle",
    description:
      "Tu ne vois jamais la Red Cup. Aucun objet ne peut te nuire, Bullet Bill compris : la Boue te fait juste " +
      "reculer d’une case. Toi seul peux acheter Made In Heaven.",
  },
  devil: {
    id: "devil",
    name: "Le diable",
    shortName: "Diable",
    description:
      "Toute la table le sait. Tu gagnes quand les autres ont passé assez de tours en Enfer (4 par joueur, moins " +
      "la moitié du nombre de joueurs). Pas de Red Cup pour toi, mais chaque descente en Enfer te rapporte 100 " +
      "pièces, tu en sors quand tu veux (1 point d’énergie) et tu as ta boutique. Jamais deux fois le même objet.",
  },
  "guardian-angel": {
    id: "guardian-angel",
    name: "L’Ange-Gardien",
    shortName: "Ange",
    description:
      "Tu protèges un joueur tiré au sort et tu gagnes avec lui. Ni Red Cup ni Enfer pour toi (tu passes ton tour " +
      "à la place), 600 pièces et 2 places. Tu ne vises que ton protégé et peux le tirer de l’Enfer : ton tour " +
      "s’arrête et tu perds tes 2 prochains tours.",
  },
  thief: {
    id: "thief",
    name: "Voleur",
    shortName: "Voleur",
    description:
      "Une fois par visite à la boutique, tente de voler un objet : 1 % de risque par tranche de 10 pièces de son " +
      "prix. Pris, tu files en Enfer et perds des objets valant 1,5 fois son prix, sinon des pièces.",
  },
};

export const PASSIVE_ORDER: PassiveId[] = [
  "built-like-a-tank",
  "new-cup-new-me",
  "red-light-green-light",
  "no-thanks",
  "corrupter",
  "goblin",
  "i-take-notes",
  "calm-down",
  "lambda",
  "nepo-baby",
  "red-bull",
  "eshop",
  "tomato-enjoyer",
  "roller",
  "greedy",
  "double-or-nothing",
  "blind-luck",
  "thief",
  "devil",
  "guardian-angel",
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
    { wheelId: "misfortune", id: "lose-200", label: "−200 pièces", amount: 200, weight: 1 },
    { wheelId: "misfortune", id: "lose-300", label: "−300 pièces", amount: 300, weight: 1 },
    { wheelId: "misfortune", id: "lose-400", label: "−400 pièces", amount: 400, weight: 1 },
    { wheelId: "misfortune", id: "go-back", label: "Retourne d’où tu viens", weight: 1 },
    { wheelId: "misfortune", id: "spin-fortune", label: "Tourne la roue du bonheur", weight: 1 },
    {
      wheelId: "misfortune",
      id: "lose-item",
      label: "Perds un objet au hasard (sinon −200 pièces)",
      amount: 200,
      weight: 1,
    },
    { wheelId: "misfortune", id: "go-to-hell", label: "Direction l’Enfer", weight: 1 },
    { wheelId: "misfortune", id: "skip-turn", label: "Passe ton prochain tour", weight: 1 },
  ],
  fortune: [
    { wheelId: "fortune", id: "gain-100", label: "+100 pièces", amount: 100, weight: 1 },
    { wheelId: "fortune", id: "gain-200", label: "+200 pièces", amount: 200, weight: 1 },
    { wheelId: "fortune", id: "gain-300", label: "+300 pièces", amount: 300, weight: 1 },
    { wheelId: "fortune", id: "gain-400", label: "+400 pièces", amount: 400, weight: 1 },
    { wheelId: "fortune", id: "advance-one", label: "Avance d’une case", weight: 1 },
    { wheelId: "fortune", id: "spin-misfortune", label: "Tourne la roue du malheur", weight: 1 },
    { wheelId: "fortune", id: "free-item", label: "Objet gratuit à 400 pièces ou moins", weight: 1 },
    { wheelId: "fortune", id: "go-to-start", label: "Va au Départ et gagne 200 pièces", weight: 1 },
  ],
  // The wheel of Hell is unchanged by patch 0.1.4: an empty bag pays 100 coins for the lost item, not 200.
  hell: [
    { wheelId: "hell", id: "lose-100", label: "−100 pièces", amount: 100, weight: 2 },
    { wheelId: "hell", id: "lose-200", label: "−200 pièces", amount: 200, weight: 1 },
    { wheelId: "hell", id: "lose-400", label: "−400 pièces", amount: 400, weight: 1 },
    { wheelId: "hell", id: "lose-item", label: "Perds un objet (sinon −100 pièces)", amount: 100, weight: 1 },
    { wheelId: "hell", id: "hell-skip", label: "Tu sautes ton prochain tour", weight: 1 },
    { wheelId: "hell", id: "challenge", label: "Choisis un joueur à affronter", weight: 1 },
    { wheelId: "hell", id: "escape", label: "Libération : retour case 0 avec +200", weight: 2 },
  ],
};

/** L'Ange-Gardien's wheel of misfortune has two wedges only. */
const GUARDIAN_MISFORTUNE_RESULTS: WeightedWheelResult[] = [
  { wheelId: "misfortune", id: "skip-turn", label: "Passe ton prochain tour", weight: 1 },
  { wheelId: "misfortune", id: "nothing", label: "Rien du tout", weight: 1 },
];

/** The wedges of a wheel as `player` spins it. */
export function getWheelResults(wheelId: WheelId, player?: Pick<Player, "passiveId">): WeightedWheelResult[] {
  if (wheelId === "misfortune" && player?.passiveId === "guardian-angel") return GUARDIAN_MISFORTUNE_RESULTS;
  return WHEEL_RESULTS[wheelId];
}

export function chooseWheelResult(
  wheelId: WheelId,
  randomValue: number,
  player?: Pick<Player, "passiveId">,
): WheelResult {
  const results = getWheelResults(wheelId, player);
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
