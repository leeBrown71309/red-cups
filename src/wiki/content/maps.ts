import type { ContentSection } from "../types";

/**
 * Le détail de chaque plateau. Les cases, routes, légendes et statistiques du
 * graphe sont AUTO-GÉNÉRÉS depuis les vrais fichiers de map (`maps/*.ts`) ;
 * ici seulement ce que le code ne dit pas dans les données.
 */
export const MAP_SECTIONS: Record<string, ContentSection[]> = {
  classic: [
    {
      title: "Pensé du plateau",
      body: [
        "• Transcrit de la planche d'origine : cinq colonnes, trois rangées, un anneau de routes presque entièrement fléchées.",
        "• Presque toutes les cases imposent leur sortie (flèches sur 0, 1, 2, 3, 8, 9) : le circuit tourne dans un sens, et on ne « fait du sur-place » qu'en entrant à contresens d'une flèche.",
        "• Le tunnel 7 → 1 raccourcit la boucle d'un bord à l'autre (un seul pas, sens unique) : attention aux [[item:mud|Boues]] posées en 1 et 7, l'anneau passera par là.",
        "• Le bonus du Départ se touche en entrant en 0 PAR LA FLÈCHE depuis 8 (8 → 0). Entrer en 0 depuis 4 à contresens ne paie rien.",
        "• Trois boutiques : 3, 8 et 9 — la 8 porte la première Red Cup : la boutique et la Cup au même endroit, le carrefour du début de partie.",
        "• L'Enfer est la case 11, nichée dans la boucle (accès : uniquement les effets).",
      ],
    },
  ],
  "luna-park": [
    {
      title: "Pensé du plateau",
      body: [
        "• Le carrousel 1-2-3-4 tourne à sens unique AUTOUR de l'Enfer et s'INVERSE à chaque nouvelle Red Cup : les boucles rapides changent de camp.",
        "• Le bonus du Départ ne se paie qu'en 8 → 0 ; entrer en 0 depuis le Train fantôme (12) ne rapporte rien.",
        "• Le Train fantôme (tunnel) file de 7 à 12, d'un coin à l'autre — le seul moyen de rattraper une Cup posée loin sans faire le tour.",
        "• La case 8 n'est atteignable QUE depuis 6 : un goulot pour les Boues et les embuscades ; la première Cup l'attend là, à sept pas du Départ (cinq après le premier carrousel inversé).",
        "• Quatre carrefours à rayons autour de l'Enfer (1, 2, 3, 4 chacun relié à l'anneau extérieur).",
      ],
    },
    {
      title: "Le fantôme",
      body: [
        "• Il apparaît au tour 2 ou 3, puis à CHAQUE passage de tour il dérive de 1 à 3 cases en prenant n'importe quelle route dans n'importe quel sens (flèches, tunnels, carrousel et Barrières ne l'arrêtent pas), ou a 25 % de chances de disparaître et renaître à 3 cases ou plus.",
        "• Il s'arrête au premier joueur croisé pendant sa dérive. Le joueur du tour en cours est servi le premier.",
        "• Le croiser = DUEL pour son butin : perdu, il vous emporte en Enfer (ou vole jusqu'à 300 pièces, ou un objet du sac — une seule Tomate d'une pile) ; gagné, vous reprenez pièces ou objet du butin (butin vide : 300 pièces), et il s'évapore 3 tours.",
        "• Les joueurs en Enfer sont hors d'atteinte (marqués « déjà rencontrés » en sortant). Un joueur invisible ([[card:half-seen|Mi-vu, Mi-vue]]) ne lui échappe pas ; un joueur arrivé par tunnel ([[card:mole|Taupe]]) ou téléportation ([[card:black-mage|Mage noir]]) sur sa case le rencontre.",
        "• Le [[card:game-master|Meneur de jeu]] choisit le mini-jeu du duel comme d'habitude.",
        "• Le Bouclier volé au fantôme ne se rend qu'à un Ange : les autres le convertissent en 400 pièces.",
        "• Le fantôme ignore les [[item:portal|Portails]] : seule une ARRÊTE de joueur (marche ou roue) déclenche un Portail, pas la dérive du fantôme.",
      ],
    },
  ],
  banquise: [
    {
      title: "Pensé du plateau",
      body: [
        "• Deux côtés parfaitement symétriques : la grande boucle extérieure (0-1-5-6-13-8 et 0-2-12-10-9-8) mène à la Cup en 5 marches sûres, le raccourci gelé par 3 ou 7 en 2 marches... au hasard.",
        "• La glace 3 et 7 et la temporaires du blizzard : personne n'y stationne, on glisse vers une autre route (imposée s'il n'y en a qu'une, jamais par la route d'où on vient).",
        "• Glisser en direction de la Red Cup : 80 % de chance que la GLACE TOMBE — pris au piège à mi-chemin, on brise la glace au début de son prochain tour pour finir le trajet.",
        "• La case 4 (trésor vert) n'est atteignable QUE par glissade ; sa flèche 4 → 0 est la seule route qui paie le bonus du Départ.",
        "• Un blizzard tous les 2 tours de table déplace la troisième case gelée (jamais sous la Cup ; le Départ peut geler — gelé, il ne paie plus).",
        "• Dès la première Cup ramassée, les pingouins entrent en scène : une boule de neige par passage de tour sur un joueur au hasard (ni en Enfer, ni déjà gelé, ni pris dans la glace) ; 2/3 de touche, 3 touches = gelé un tour (le Réveil peut annuler).",
        "• L'Enfer est la crevasse derrière le lac (case 11).",
      ],
    },
    {
      title: "La glace en détail",
      body: [
        "• Qui dit « arrivée » dit case FINALE : la roue, la Boue, le Portail, la Cup se déclenchent sur la case d'atterrissage de la glissade, pas sur la glace.",
        "• Posé sur la glace SANS marcher (Corde, Monopoly Man, secours de l'Ange, Portail, replacement, K.O.) : la glace vous emporte immédiatement, sans en faire une arrivée.",
        "• Une [[item:barrier|Barrière]] sur la route d'une glissade : rebond, puis nouvelle route au hasard.",
        "• Prisonnier de la glace pendant que quelque chose vous DÉPLACE (tiré, échangé, envoyé en Enfer) : la glissade en attente est annulée, elle ne reprendra pas en revenant.",
        "• Une glissade qui passe par une verte/rouge paie/give pour [[card:red-light-green-light|Red light, Green light]].",
        "• Patch 0.2.3 : la [[card:mole|Taupe]] ne creuse ni depuis ni vers la glace, et la glace emporte qui arrive, par tunnel ou par téléportation du [[card:black-mage|Mage noir]], sur une case que le blizzard a gelée depuis. La [[card:ghost-sister|Sœur Fantôme]] peut se tenir sur la glace (pas son joueur). Les pingouins visent aussi un joueur invisible ([[card:half-seen|Mi-vu, Mi-vue]]).",
      ],
    },
  ],
};
