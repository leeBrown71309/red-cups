import type { ItemId, PassiveId, WheelId, WheelResult } from "./types";

export interface ItemDefinition {
  id: ItemId;
  name: string;
  price: number;
  symbol: string;
  /** One line, for the shop, the bag and the target picker. */
  description: string;
  /** Every condition of the effect, for How to play. */
  details: string[];
  target: "self" | "player" | "none" | "special";
  /** Stackable items pile up to this many in a single bag slot, and only one slot may hold them. */
  stackLimit?: number;
  /** Only meaningful for player-targeted items. */
  canTargetSelf?: boolean;
}

export const ITEM_CATALOG: Record<ItemId, ItemDefinition> = {
  ndoye: {
    id: "ndoye",
    name: "Ndoye",
    price: 300,
    symbol: "◉",
    description: "Fait tourner la roue du malheur à un joueur, toi compris.",
    details: [
      "C’est ton action du tour ; utilisable depuis l’Enfer.",
      "La cible tourne la roue : elle seule peut appliquer ou gommer le résultat.",
      "« Tourne la roue du bonheur » enchaîne sur une seconde roue.",
      "Je note : la cible n’en reçoit une copie que si le résultat s’applique, jamais s’il est gommé.",
    ],
    target: "player",
    canTargetSelf: true,
  },
  "hollow-purple": {
    id: "hollow-purple",
    name: "Hollow Purple",
    price: 600,
    symbol: "✦",
    description: "Envoie un joueur en Enfer. Peut te cibler.",
    details: [
      "C’est ton action du tour ; utilisable depuis l’Enfer.",
      "Si quelqu’un est déjà en Enfer, un duel commence aussitôt.",
      "Une cible déjà en Enfer y reste, sans autre effet.",
    ],
    target: "player",
    canTargetSelf: true,
  },
  rope: {
    id: "rope",
    name: "Corde",
    price: 500,
    symbol: "↝",
    description: "Attire un autre joueur sur ta case.",
    details: [
      "Ni roue, ni boutique, ni Boue, ni Red Cup pour ce déplacement, même si la Cup est sur ta case.",
      "Baraqué ne fait que la moitié du chemin, arrondie au-dessus : à une case, il est tiré jusqu’au bout.",
      "Elle sort ta cible de l’Enfer (sauf Baraqué). Utilisée depuis l’Enfer, elle y attire ta cible : duel.",
      "Tu ne peux pas te viser.",
    ],
    target: "player",
  },
  boot: {
    id: "boot",
    name: "Botte",
    price: 100,
    symbol: "⇢",
    description: "Avant de bouger : ton déplacement fait exactement deux cases.",
    details: [
      "Elle se prépare avant ton action et ne compte pas comme une ; une par tour, pas en Enfer.",
      "La case du milieu ne donne ni roue, ni Boue, ni Red Cup, mais compte pour Red light, Green light et pour le bonus du départ.",
      "Elle est perdue si Non merci annule le déplacement, ou si tu utilises finalement un objet.",
      "Son prix monte de 50 pièces à chaque tour de table après son premier achat, jusqu’à 500.",
    ],
    target: "special",
  },
  mud: {
    id: "mud",
    name: "Boue",
    price: 200,
    symbol: "●",
    description: "Pose-la sur ta case puis joue ton tour : qui s’y arrête perd 200 pièces et t’en donne 100.",
    details: [
      "Elle ne compte pas comme ton action ; une par tour, pas en Enfer.",
      "Elle attend qu’un joueur s’y arrête en marchant : téléportation, Corde, échange ou recul ne la déclenchent pas.",
      "Une seule victime, puis elle disparaît. Ta propre Boue te coûte aussi 200 pièces, sans rien te rendre.",
      "Annulée par Non merci, elle est perdue, mais tu joues encore ton tour.",
    ],
    target: "self",
  },
  eraser: {
    id: "eraser",
    name: "Gomme",
    price: 350,
    symbol: "⌫",
    description: "Annule un résultat de roue après son tirage.",
    details: [
      "Seulement pour une roue tournée pour toi : case, Enfer, Ndoye, roue enchaînée ou Tour de Bénédiction.",
      "Elle efface n’importe quel résultat, bon ou mauvais, y compris « Duel » et « Tourne la roue… ».",
      "Une seule Gomme à la fois ; elle est consommée à l’usage.",
    ],
    target: "special",
  },
  "bullet-bill": {
    id: "bullet-bill",
    name: "Bullet Bill",
    price: 500,
    symbol: "➤",
    description: "Attend au départ, puis fonce sur le joueur le plus proche à chaque tour de table.",
    details: [
      "Il n’appartient à personne et ne prend pas de place dans le sac ; un seul à la fois sur le plateau. Non merci ne l’arrête pas.",
      "Dès le tour de table suivant l’achat, il avance de 2 cases vers le joueur le plus proche, sans tenir compte des flèches : à 2 cases ou moins, il frappe.",
      "Les joueurs en Enfer sont hors d’atteinte ; à égalité, il vise le premier dans l’ordre du tour, acheteur compris.",
      "Sa victime perd 200 pièces et passe son prochain tour ; Bullet Bill disparaît ensuite.",
    ],
    target: "special",
  },
  "middle-finger": {
    id: "middle-finger",
    name: "Middle Finger",
    price: 400,
    symbol: "✋",
    description: "Fait passer le prochain tour d’un joueur. Peut te cibler.",
    details: [
      "C’est ton action du tour ; utilisable depuis l’Enfer.",
      "Les tours à passer s’additionnent : deux Middle Finger, deux tours passés.",
      "Un tour passé en Enfer compte dans les 5 tours maximum.",
    ],
    target: "player",
    canTargetSelf: true,
  },
  "monopoly-man": {
    id: "monopoly-man",
    name: "Monopoly Man",
    price: 550,
    symbol: "⇄",
    description: "Échange ta position avec celle d’un autre joueur.",
    details: [
      "Ni roue, ni boutique, ni Boue, ni Red Cup, pour aucun des deux.",
      "Sans effet sur Baraqué : l’objet est perdu.",
      "Échanger avec un joueur en Enfer t’y envoie ; utilisé depuis l’Enfer, il t’en sort. Deux joueurs en Enfer : duel.",
    ],
    target: "player",
  },
  "water-bottle": {
    id: "water-bottle",
    name: "Bouteille d’eau",
    price: 600,
    symbol: "♧",
    description: "En Enfer seulement : te téléporte sur une case au hasard.",
    details: [
      "C’est ton action du tour.",
      "Toute case hors Enfer peut sortir, Départ et boutiques compris, mais sans bonus du départ ni boutique.",
      "Une case verte ou rouge fait tourner sa roue ; atterrir sur la Red Cup la ramasse ; la Boue ne se déclenche pas.",
    ],
    target: "special",
  },
  helmet: {
    id: "helmet",
    name: "Casque",
    price: 400,
    symbol: "⬡",
    description: "S’active tout seul pour éviter un solde négatif.",
    details: [
      "À la première perte qui te ferait passer sous 0, ton solde reste à 0 et le Casque est consommé.",
      "Déjà dans le rouge ? Il te remet à 0.",
      "Il t’évite donc la remise à zéro à −300 et le tour passé qui va avec. Il ne s’utilise pas à la main.",
    ],
    target: "special",
  },
  draven: {
    id: "draven",
    name: "Draven",
    price: 700,
    symbol: "✹",
    description: "Envoie tout le monde en Enfer, toi compris.",
    details: [
      "C’est ton action du tour ; utilisable depuis l’Enfer. Qui y était déjà garde son décompte.",
      "Les duels s’enchaînent ensuite deux par deux, jusqu’à ce qu’il ne reste qu’un joueur en Enfer.",
      "Je note ne le copie jamais.",
    ],
    target: "self",
  },
  tomato: {
    id: "tomato",
    name: "Tomate",
    price: 10,
    symbol: "✺",
    description: "Lance-la sur un joueur, pour rire : 2 chances sur 100 de l’assommer un tour.",
    details: [
      "Elle se lance avant ton action et ne compte pas comme une : choisis ta cible puis combien en lancer d’un coup.",
      "Sur n’importe quel autre joueur, même en Enfer, et même depuis l’Enfer. Jamais sur toi.",
      "2 chances sur 100 que la cible soit assommée : elle passe son prochain tour. Sinon, juste une tomate écrasée.",
      "Jusqu’à 5 Tomates dans une seule place du sac ; on ne peut pas en remplir une seconde.",
      "Trop petite pour Non merci, qui ne peut pas l’annuler. Je note en récupère une à chaque tomate reçue.",
    ],
    target: "player",
    stackLimit: 5,
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
];

export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  shortName: string;
  /** One line, for the passive tooltip and the player card. */
  description: string;
  /** Every condition of the effect, for How to play and the player card. */
  details: string[];
}

export const PASSIVE_CATALOG: Record<PassiveId, PassiveDefinition> = {
  "built-like-a-tank": {
    id: "built-like-a-tank",
    name: "Baraqué",
    shortName: "Baraqué",
    description: "La Corde te déplace de moitié. Le Monopoly Man ne t’affecte pas.",
    details: [
      "La Corde ne te fait parcourir que la moitié du chemin, arrondie au-dessus : à une case, tu es tiré jusqu’au bout. En Enfer, elle ne peut pas te sortir.",
      "Le Monopoly Man ne peut pas t’échanger : l’objet est perdu pour celui qui l’utilise.",
    ],
  },
  "new-cup-new-me": {
    id: "new-cup-new-me",
    name: "New Cup, New Me",
    shortName: "New Cup",
    description: "À chaque nouvelle Cup, choisis ta case avant qu’elle soit révélée.",
    details: [
      "À chaque Red Cup ramassée, par n’importe qui, sauf la dernière.",
      "Toute case hors Enfer, Départ et ta case actuelle compris ; si tu es en Enfer, tu en sors forcément.",
      "Ce placement ne donne ni roue, ni boutique, ni Boue, ni Red Cup, ni bonus du départ.",
      "Si tu quittes ta case, tu perds la roue ou la boutique qu’elle te devait.",
      "Placé sur la case de la future Cup, tu devras en sortir puis revenir pour la ramasser.",
    ],
  },
  "red-light-green-light": {
    id: "red-light-green-light",
    name: "Red light, Green light",
    shortName: "Red / Green",
    description: "+100 pièces par case verte traversée en marchant, −100 par case rouge.",
    details: [
      "Toutes les cases d’une marche comptent, y compris celle du milieu avec la Botte.",
      "Téléportation, Corde, échange, recul ou placement ne comptent pas.",
      "Ça s’ajoute à la roue de la case d’arrivée.",
    ],
  },
  "no-thanks": {
    id: "no-thanks",
    name: "Non merci",
    shortName: "Non merci",
    description: "Une fois tous les 3 tours de table, annule l’action d’un autre joueur.",
    details: [
      "Il annule un déplacement ou l’usage d’un objet ; jamais la Botte, un achat ou la roue de l’Enfer.",
      "L’action annulée termine le tour de son auteur et l’objet est perdu. Exception : une Boue annulée est perdue, mais son auteur joue encore.",
      "Utilisé au tour de table N, il revient au tour N + 3.",
      "En local, tu as 15 secondes pour décider ; sans réponse, l’action passe.",
    ],
  },
  delinquent: {
    id: "delinquent",
    name: "Délinquant",
    shortName: "Délinquant",
    description: "Ignore les sens interdits pour 400 pièces par déplacement.",
    details: [
      "Il lève d’un coup les flèches, le sens du tunnel et celui du carrousel : 400 pièces par déplacement, même avec la Botte.",
      "Tu ne paies que si la case choisie l’exige vraiment, et il faut avoir 400 pièces.",
      "Pas pour quitter le départ au premier tour de table.",
      "Rien n’est payé si Non merci annule le déplacement.",
    ],
  },
  penta: {
    id: "penta",
    name: "Penta",
    shortName: "Penta",
    description: "Possède un emplacement d’objet supplémentaire.",
    details: ["Ton sac a 5 places au lieu de 4, Red Cups comprises."],
  },
  troll: {
    id: "troll",
    name: "Troll",
    shortName: "Troll",
    description: "À chaque nouvelle Cup, vole 100 pièces à deux adversaires au hasard.",
    details: [
      "À chaque Red Cup ramassée, par n’importe qui, sauf la dernière.",
      "Les victimes peuvent passer en négatif (Casque et remise à zéro à −300 compris) ; tu gagnes toujours 100 pièces par victime.",
      "Avec un seul adversaire, il n’en vise qu’un.",
    ],
  },
  "im-cups": {
    id: "im-cups",
    name: "Je suis Cups",
    shortName: "Cups",
    description: "Ne gagne jamais les 200 pièces du départ.",
    details: [
      "Ni en bouclant vers le Départ, ni en sortant de l’Enfer (roues, duel gagné, fin de peine).",
      "À la fin des 5 tours en Enfer, tu paies donc les 500 pièces sans compensation.",
    ],
  },
  "i-take-notes": {
    id: "i-take-notes",
    name: "Je note",
    shortName: "Je note",
    description: "Quand l’objet d’un autre joueur t’affecte, tu en reçois une copie.",
    details: [
      "Copiés : Hollow Purple, Corde, Middle Finger, Monopoly Man (si l’échange a lieu), Ndoye (si le résultat s’applique) et Boue.",
      "Jamais copiés : Draven, Bullet Bill, un objet utilisé sur toi-même, ta propre Boue, ni une Boue piétinée sur la case de la Red Cup.",
      "Jamais plus de 2 exemplaires (une seule Gomme). Sac plein : tu choisis un objet à jeter, jamais une Red Cup.",
    ],
  },
  "calm-down": {
    id: "calm-down",
    name: "Calme-toi",
    shortName: "Calme-toi",
    description: "Fais reculer de trois cases un joueur qui prend une Cup trop près de la nouvelle.",
    details: [
      "Proposé quand un autre joueur ramasse une Red Cup et se trouve à 1 ou 2 cases de la nouvelle ; pas pour la dernière Cup, ni s’il est en Enfer.",
      "C’est toi qui décides : Laisser passer ou Recule !",
      "Il recule de 3 cases, vers la case la plus loin de la nouvelle Cup, sans tenir compte des flèches.",
      "Il tourne la roue de cette case ; pas de Boue, de Red light, Green light ni de bonus, et sa boutique se ferme.",
    ],
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
    { wheelId: "misfortune", id: "lose-item", label: "Perds un objet (sinon −100 pièces)", weight: 1 },
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
    { wheelId: "fortune", id: "free-item", label: "Objet gratuit : Ndoye, Botte ou Boue", weight: 1 },
    { wheelId: "fortune", id: "spin-misfortune", label: "Tourne la roue du malheur", weight: 1 },
    { wheelId: "fortune", id: "escape", label: "Libération de l’Enfer (+200) ou +500 pièces", amount: 500, weight: 1 },
  ],
  hell: [
    { wheelId: "hell", id: "lose-100", label: "−100 pièces", amount: 100, weight: 2 },
    { wheelId: "hell", id: "lose-200", label: "−200 pièces", amount: 200, weight: 1 },
    { wheelId: "hell", id: "lose-400", label: "−400 pièces", amount: 400, weight: 1 },
    { wheelId: "hell", id: "lose-item", label: "Perds un objet (sinon −100 pièces)", weight: 1 },
    { wheelId: "hell", id: "hell-skip", label: "Tu sautes ton prochain tour", weight: 1 },
    { wheelId: "hell", id: "challenge", label: "Choisis un joueur à affronter", weight: 1 },
    { wheelId: "hell", id: "escape", label: "Libération : retour case 0 avec +200", weight: 2 },
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
