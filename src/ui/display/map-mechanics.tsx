import type { ReactNode } from "react";
import { hasCarousel, hasIce, resolveBoard } from "../../game/board";
import type { MapId } from "../../game/types";
import {
  CARAVAN_RIDE,
  CARAVAN_STEP,
  GHOST_COOLDOWN_ROUNDS,
  GHOST_EMPTY_LOOT_REWARD,
  GHOST_LOOT_COINS,
  GHOST_MAX_DRIFT_STEPS,
  GHOST_STEAL_COINS,
  OASIS_ENERGY,
  QUAY_HOLDER_REWARD,
  SNOWBALL_HITS_TO_FREEZE,
  STORM_ROUNDS,
  THIRST_ENERGY,
  TIDE_ROUNDS,
  WELL_PRICE,
} from "../../game/types";
import { GhostAvatar } from "../components/ghost-avatar";
import { RedCupIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

/** A rule only some boards have, presented in the How to play board tab. */
export interface MapMechanic {
  id: string;
  title: string;
  icon: ReactNode;
  tone: "ice" | "night" | "fair" | "sea" | "sand";
  paragraphs: string[];
}

/**
 * The mechanics of a board, from what the board has (ice, carousel, ghost,
 * snowballs) rather than from its name, so a new map with ice explains it too.
 * The classic board has none: its tunnel is a road, in the road legend.
 */
export function getMapMechanics(mapId: MapId): MapMechanic[] {
  const board = resolveBoard(mapId);
  const mechanics: MapMechanic[] = [];

  if (hasIce(board)) {
    mechanics.push(
      {
        id: "ice",
        title: "Glace",
        icon: "❄",
        tone: "ice",
        paragraphs: [
          "Arrivé sur la glace, tu glisses au hasard vers l’une de ses autres routes, jusqu’à une case sans glace.",
          "Seule la case d’arrivée compte : roue, boutique, Boue, Red Cup.",
        ],
      },
      {
        id: "ice-fall",
        title: "Tombée de glace",
        icon: <RedCupIcon size={26} />,
        tone: "ice",
        paragraphs: [
          "Si ta glissade file vers la Red Cup, la glace a 80 % de chances de te tomber dessus : tu restes pris sur " +
            "la route.",
          "Au début de ton tour suivant, tu brises la glace et tu arrives sur la Red Cup, avant de jouer.",
        ],
      },
      {
        id: "blizzard",
        title: "Blizzard",
        icon: <UiIcon name="refresh" size={22} strokeWidth={2.8} />,
        tone: "ice",
        paragraphs: [
          "Une troisième case glissante apparaît au hasard, le Départ compris, et se déplace tous les deux tours " +
            "de table.",
          "Un Départ gelé ne paie pas les 200 pièces.",
        ],
      },
    );
  }

  if (board.map.snowballs) {
    mechanics.push({
      id: "snowballs",
      title: "Boules de neige",
      icon: <UiIcon name="target" size={22} strokeWidth={2.8} />,
      tone: "ice",
      paragraphs: [
        "Dès qu’une Red Cup a été ramassée, les pingouins lancent une boule de neige sur un joueur au hasard à " +
          "chaque fin de tour, jamais en Enfer. Un tiers ratent.",
        `À la ${SNOWBALL_HITS_TO_FREEZE}ᵉ boule reçue, tu gèles sur place et tu passes ton prochain tour.`,
      ],
    });
  }

  if (board.map.tidal) {
    mechanics.push(
      {
        id: "tide",
        title: "Marées",
        icon: <UiIcon name="waves" size={22} strokeWidth={2.8} />,
        tone: "sea",
        paragraphs: [
          `Tous les ${TIDE_ROUNDS} tours de table la mer monte ou se retire : les chaussées Perles–Phare et Épaves–Corail se noient à marée haute, les deux autres à marée basse. Celle du Port est une digue.`,
          "Une chaussée noyée est fermée à tout le monde, et qui s’y trouve quand la mer monte est déposé sur le Quai où elle menait. Le compteur du haut annonce la marée suivante un tour à l’avance.",
        ],
      },
      {
        id: "ferry",
        title: "Bac",
        icon: <UiIcon name="ferry" size={22} strokeWidth={2.8} />,
        tone: "sea",
        paragraphs: [
          "Un bateau passe d’un Quai au suivant à chaque tour de table. Sur son Quai, monte à son bord à la place de ta marche : tu es déposé au Quai suivant.",
        ],
      },
      {
        id: "quays",
        title: "Quais et tourbillons",
        icon: <UiIcon name="anchor" size={22} strokeWidth={2.8} />,
        tone: "sea",
        paragraphs: [
          `Un Quai n’a qu’une place : on ne finit pas sa marche sur un Quai tenu, et un second joueur qui y est amené est repoussé, le tenant touchant ${QUAY_HOLDER_REWARD} pièces.`,
          "Le tourbillon aspire vers le Quai d’une autre île, au hasard. Ni roue ni boutique sur un Quai, une chaussée ou un tourbillon.",
        ],
      },
    );
  }

  if (board.map.desert) {
    mechanics.push(
      {
        id: "mirage",
        title: "Mirages",
        icon: <RedCupIcon size={26} />,
        tone: "sand",
        paragraphs: [
          "Deux Red Cups sont posées sur le sable en permanence : une vraie, un mirage. Personne ne sait laquelle est laquelle.",
          `Arrivé sur le mirage, il se dissipe : tu as soif, un point d’énergie de moins à ton prochain tour (${THIRST_ENERGY}). Les deux Cups disparaissent alors et deux nouvelles apparaissent ailleurs, sur deux cases neuves : la Cup qui n’a pas bougé ne trahit donc rien. Pareil quand la vraie est prise.`,
        ],
      },
      {
        id: "well",
        title: "Puits",
        icon: <UiIcon name="eye" size={22} strokeWidth={2.8} />,
        tone: "sand",
        paragraphs: [
          `Sur un puits, paie ${WELL_PRICE} pièces pour savoir, toi seul, laquelle est la vraie Cup. Une fois par paire de Cups. Le journal dit seulement que tu as puisé.`,
        ],
      },
      {
        id: "oasis",
        title: "Oasis",
        icon: <UiIcon name="sparkle" size={22} strokeWidth={2.8} />,
        tone: "sand",
        paragraphs: [
          `C’est la boutique, mais à une seule place : aucun objet ne peut te viser là, et tu gagnes ${OASIS_ENERGY} point d’énergie à ton tour suivant. Un second joueur qui y arrive est repoussé.`,
        ],
      },
      {
        id: "caravan",
        title: "Caravane et tempêtes",
        icon: <UiIcon name="ferry" size={22} strokeWidth={2.8} />,
        tone: "sand",
        paragraphs: [
          `La caravane avance de ${CARAVAN_STEP} cases par tour de table sur la grande boucle. Sur sa case, monte à bord à la place de ta marche : elle t’emporte de ${CARAVAN_RIDE} cases.`,
          `Toutes les ${STORM_ROUNDS} manches une tempête de sable ferme deux passes et ouvre les deux autres. Qui se trouve sur une passe qui se ferme est déposé sur la grande boucle.`,
        ],
      },
    );
  }

  if (hasCarousel(board)) {
    mechanics.push({
      id: "carousel",
      title: "Carrousel",
      icon: <UiIcon name="rotate" size={22} strokeWidth={2.8} />,
      tone: "fair",
      paragraphs: [
        "Il tourne dans un seul sens autour de l’Enfer et s’inverse à chaque nouvelle Red Cup.",
        "Corrupteur peut le prendre à contresens.",
      ],
    });
  }

  if (board.map.haunted) {
    mechanics.push({
      id: "ghost",
      title: "Le fantôme",
      icon: <GhostAvatar size={30} />,
      tone: "night",
      paragraphs: [
        "Il rôde sur tout le plateau, sans respecter les routes : à chaque fin de tour, il glisse de 1 à " +
          `${GHOST_MAX_DRIFT_STEPS} cases en s’arrêtant sur le premier joueur qu’il croise, ou disparaît pour ` +
          "réapparaître au loin. Jamais en Enfer.",
        "S’il tombe sur toi, ou si tu t’arrêtes sur sa case, c’est le duel.",
        `Perdu : il t’emporte en Enfer, ou te vole ${GHOST_STEAL_COINS} pièces ou un objet, qu’il garde dans son ` +
          `butin. Gagné : tu reprends un objet ou ${GHOST_LOOT_COINS} pièces de ce butin, ou ` +
          `${GHOST_EMPTY_LOOT_REWARD} pièces s’il est vide, et il disparaît ${GHOST_COOLDOWN_ROUNDS} tours de table.`,
        "Clique sur le fantôme pour voir son butin.",
      ],
    });
  }

  return mechanics;
}
