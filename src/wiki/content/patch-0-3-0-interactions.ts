import { FOOL_CUP_FINE, RED_GREEN_PENALTY } from "../../game/types";
import type { Interaction } from "../types";

/**
 * Les interactions du patch 0.3.0 : Le Fou qui paie la Red Cup au lieu de la ramasser, Red light, Green light sous
 * Doomsday, la Bombe de fumée qui n'aveugle plus et le Miroir déjà utilisé en boutique. Chaque ligne se vérifie dans
 * `game-effects.ts` (`forfeitCup`, `addRedGreenBonuses`), `mist.ts` (`isBlinded`) et `passive-rules.ts`.
 */
export const PATCH_030_INTERACTIONS: Interaction[] = [
  {
    a: "card:fool",
    b: "system:cups",
    text: `Arriver sur la Red Cup lui coûte ${FOOL_CUP_FINE} pièces : elle ne prend aucune place de sac et une nouvelle Cup apparaît. Trois Cups le font passer sous −2 500 pièces.`,
  },
  {
    a: "card:fool",
    b: "card:last-in-class",
    text: "Le Fou ne garde aucune Red Cup : il reste hors de la comparaison qui décide qui est le dernier en Cups.",
  },
  {
    a: "card:fool",
    b: "item:helmet",
    text: "Le Casque absorbe l'amende de la Red Cup tant qu'elle ferait passer le solde sous zéro : le Fou perd alors son Casque, pas ses pièces.",
  },
  {
    a: "card:red-light-green-light",
    b: "item:doomsday",
    text: `Sous Doomsday toutes les cases sont rouges pour lui : une case verte coûte ${RED_GREEN_PENALTY} pièces au lieu de rapporter 100, dans la limite de deux rouges par Cup.`,
  },
  {
    a: "item:smoke-bomb",
    b: "card:mime",
    text: "Invisible par la Bombe de fumée, un Mime voit la table : il peut copier un autre joueur visible. Invisible par Mi-vu, Mi-vue, il ne copie personne.",
  },
  {
    a: "item:smoke-bomb",
    b: "card:calm-down",
    text: "Invisible, Calme-toi ne le choisit pas, mais s'il tient Calme-toi, il voit la table et peut replacer un joueur.",
  },
  {
    a: "item:mirror",
    b: "hub:shop",
    text: "Le Miroir se vend une fois à chaque joueur, même s'il a déjà servi : ensuite l'étal le grise avec la mention « Déjà utilisé ».",
  },
];
