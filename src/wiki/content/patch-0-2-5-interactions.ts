import { FOOL_GOAL, FOOL_STUN_FINE, MIST_COOLDOWN_ROUNDS, MIST_HIDDEN_TURNS } from "../../game/types";
import type { Interaction } from "../types";

/**
 * Les interactions du patch 0.2.5 : Le Fou, la Bombe de fumée, « Disparaître » de Mi-vu, Mi-vue et la Taupe qui ne
 * creuse plus que vers les dernières cases visitées. Chaque ligne se vérifie dans `state-utils.ts` (`loseTurns`),
 * `mist.ts`, `mist-cycle.ts` et `turn-actions.ts`.
 */
export const PATCH_025_INTERACTIONS: Interaction[] = [
  // ————— Le Fou —————
  {
    a: "card:fool",
    b: "card:greedy",
    text: "L'inverse l'un de l'autre : Cupide gagne à 6 000 pièces, Le Fou à −2 500. Cupide ne lui vole rien en marchant sur lui : Le Fou n'est jamais assommé.",
  },
  {
    a: "card:fool",
    b: "item:middle-finger",
    text: `Un Middle Finger ne lui fait pas sauter de tour : il perd ${FOOL_STUN_FINE} pièces à la place.`,
  },
  {
    a: "card:fool",
    b: "item:bullet-bill",
    text: `Bullet Bill lui prend ses pièces comme aux autres, mais ne lui fait pas sauter de tour : ${FOOL_STUN_FINE} pièces de plus à la place.`,
  },
  {
    a: "card:fool",
    b: "item:tomato",
    text: `Une Tomate qui assomme lui coûte ${FOOL_STUN_FINE} pièces au lieu d'un tour.`,
  },
  {
    a: "card:fool",
    b: "item:wake-up",
    text: "Le Réveil ne se déclenche jamais pour Le Fou : il n'a aucun tour sauté à annuler, et reste dans son sac.",
  },
  {
    a: "card:fool",
    b: "item:hell-touch",
    text: "Le Toucher d'Enfer vise les joueurs assommés ou privés de tour : Le Fou n'en est jamais un.",
  },
  {
    a: "card:fool",
    b: "wheel:misfortune",
    text: `« Passe ton prochain tour » ne lui fait rien sauter : il perd ${FOOL_STUN_FINE} pièces. Les roues qui lui font perdre des pièces le rapprochent de son objectif.`,
  },
  {
    a: "card:fool",
    b: "card:insurer",
    text: "L'amende de 100 pièces n'est pas une perte subie : L'Assureur ne touche rien dessus (il touche sur les autres pertes du Fou).",
  },
  {
    a: "card:fool",
    b: "card:double-or-nothing",
    text: "L'amende n'est pas misable : seuls les gains et pertes de pièces ordinaires déclenchent le 50/50.",
  },
  {
    a: "card:fool",
    b: "system:money",
    text: "Le reset à −300 (solde remis à 0 et tour sauté) ne l'atteint pas : son solde peut descendre jusqu'à son objectif.",
  },
  {
    a: "card:fool",
    b: "system:victory",
    text: `Le Fou gagne dès que son solde est à ${FOOL_GOAL} pièces ou moins, au tour de qui que ce soit. Il peut aussi gagner par ses Red Cups.`,
  },

  // ————— Bombe de fumée —————
  {
    a: "item:smoke-bomb",
    b: "item:bullet-bill",
    text: "Invisible, le joueur n'est pas traqué par Bullet Bill ; mais l'explosion qui éclate sur sa case le touche quand même.",
  },
  {
    a: "item:smoke-bomb",
    b: "card:half-seen",
    text: `Même invisibilité que Disparaître (${MIST_HIDDEN_TURNS} tours, ${MIST_COOLDOWN_ROUNDS} tours d'attente) mais pour 1 tour seulement, sans limite de Red Cup. Une Bombe de fumée ne s'utilise pas déjà invisible : l'invisibilité ne se cumule pas.`,
  },
  {
    a: "item:smoke-bomb",
    b: "item:draven",
    text: "Draven épargne un joueur invisible : la fumée protège de la table qui part en Enfer.",
  },
  {
    a: "item:smoke-bomb",
    b: "system:turn",
    text: "L'invisibilité de la Bombe de fumée court jusqu'au début du prochain tour de son lanceur : elle couvre la fin de son tour et tous ceux des autres.",
  },

  // ————— Disparaître et Taupe —————
  {
    a: "card:half-seen",
    b: "card:mole",
    text: "Un invisible ne creuse ni ne traverse autrement qu'un autre : la Taupe ne le cible pas, et un tunnel ouvert reste traversable par lui comme par tout le monde.",
  },
];
