import type { ReactNode } from "react";
import { hasCarousel, hasIce, resolveBoard } from "../../game/board";
import type { MapId } from "../../game/types";
import {
  GHOST_COOLDOWN_ROUNDS,
  GHOST_EMPTY_LOOT_REWARD,
  GHOST_LOOT_COINS,
  GHOST_MAX_DRIFT_STEPS,
  GHOST_STEAL_COINS,
  SNOWBALL_HITS_TO_FREEZE,
} from "../../game/types";
import { GhostAvatar } from "../components/ghost-avatar";
import { RedCupIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

/** A rule only some boards have, presented in the How to play board tab. */
export interface MapMechanic {
  id: string;
  title: string;
  icon: ReactNode;
  tone: "ice" | "night" | "fair";
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
