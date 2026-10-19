import type { Interaction } from "../types";

/**
 * Les interactions du patch 0.3.0 : le Bouclier contre les Tomates, les objets propres à un Cups Power volés par le
 * fantôme, eShop à la sortie de l'Enfer, le Goblin à deux victimes, la Barrière d'un poseur assommé et la Sœur Fantôme
 * qui ignore les flèches. Chaque ligne se vérifie dans `turn-actions.ts`, `ghost.ts`, `game-actions.ts`,
 * `game-effects.ts` et `sister.ts`.
 */
export const PATCH_030_MORE_INTERACTIONS: Interaction[] = [
  {
    a: "item:shield",
    b: "item:tomato",
    text: "Le Bouclier de l'Ange bloque une volée de Tomates lancée sur son protégé, même hors de son tour et même si elle allait assommer : toute la volée est annulée.",
  },
  {
    a: "map:luna-park",
    b: "item:shield",
    text: "Un objet propre à un Cups Power (Bouclier, objets du diable, Made In Heaven) volé par le fantôme ne se rend qu'à son propriétaire : un autre vainqueur touche sa valeur en pièces et l'objet disparaît.",
  },
  {
    a: "card:eshop",
    b: "wheel:hell",
    text: "Libéré par « Libération » au Départ, eShop ouvre sa boutique, copié par le Mime compris.",
  },
  {
    a: "item:barrier",
    b: "system:turn",
    text: "La Barrière dure un tour de table de son poseur : un tour sauté (assommé) compte, elle tombe quand même.",
  },
  {
    a: "card:goblin",
    b: "card:guardian-angel",
    text: "Le Goblin ne vole qu'à deux joueurs tirés au hasard : l'Ange ou son protégé peuvent y échapper.",
  },
  {
    a: "card:ghost-sister",
    b: "card:corrupter",
    text: "La petite sœur ne subit jamais le sens des flèches, quel que soit le pas de sa joueuse.",
  },
  {
    a: "card:black-mage",
    b: "system:turn",
    text: "Poser le pentagramme ne compte pas comme une action : il ne permet pas de finir le tour sans bouger.",
  },
];
