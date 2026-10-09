import {
  CARAVAN_RIDE,
  CARAVAN_STEP,
  OASIS_ENERGY,
  QUAY_HOLDER_REWARD,
  STORM_ROUNDS,
  THIRST_ENERGY,
  TIDE_ROUNDS,
  WELL_PRICE,
} from "../../game/types";
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
  archipel: [
    {
      title: "Pensé du plateau",
      body: [
        "• Première « grande carte » (patch 0.2.4) : 41 cases pour 6 à 8 joueurs. À moins de six, elle est grisée dans le choix de carte et la partie refuse de démarrer ; le tirage au sort ne la propose pas non plus.",
        "• Cinq îles de six cases en cercle : le Port (Départ en 0), les Perles, le Phare, les Épaves, Corail. Chaque île est une petite boucle : le Quai (par où l'on arrive), la case de passage, la sortie, puis trois cases du côté du large. Elles sont reliées par cinq chaussées de deux cases.",
        "• L'Enfer est le Maelström, au milieu du cercle (case 11 comme partout).",
        "• Quatre boutiques : une au Port (4), aux Perles (10), au Phare (17) et à Corail (29). L'île des Épaves n'en a pas — c'est celle des deux tourbillons et des deux cases rouges.",
        "• Le bonus du Départ : le Quai du Port (1) mène droit au Départ par une flèche — c'est la seule route qui paie les 200 pièces, dans les deux sens du tour.",
        "• La première Red Cup attend dans la boutique des Perles (10), à six pas du Départ.",
        "• Quand une Cup est prise, la suivante naît sur UNE AUTRE ÎLE que la précédente, à 5 à 8 pas du joueur le plus proche (la marée ne compte pas) : jamais sur un Quai, une chaussée ou un tourbillon.",
      ],
    },
    {
      title: "Les marées",
      body: [
        `• La marée tourne tous les ${TIDE_ROUNDS} tours de table : tours 1-2 marée basse, 3-4 marée haute, et ainsi de suite. Un compteur en haut de l'écran l'annonce un tour à l'avance.`,
        "• La chaussée du Port (31-32) est une digue qui ne se noie jamais. Les chaussées Perles–Phare (33-34) et Épaves–Corail (37-38) émergent à marée basse et se noient à marée haute ; Phare–Épaves (35-36) et Corail–Port (39-40) font l'inverse.",
        "• Une chaussée noyée est fermée comme par une [[item:barrier|Barrière]] pour tout le monde — marche, Botte, Corrupteur, [[item:bullet-bill|Bullet Bill]] — et le joueur qui s'y trouve quand la mer monte est déposé sur le Quai de l'île vers laquelle il allait (sur la case de passage voisine si le Quai est tenu).",
        "• Jamais deux chaussées voisines noyées en même temps : chaque île garde toujours une sortie. Mais le cercle se coupe en deux groupes d'îles pour deux tours : le bac et les tourbillons servent à passer.",
        "• Des bouées bordent chaque chaussée : leur feu est vert (digue), bleu (ouverte à marée basse) ou orange (ouverte à marée haute), et elles restent à flot quand la chaussée disparaît.",
      ],
    },
    {
      title: "Le bac",
      body: [
        "• Un bateau fait le tour des cinq Quais dans l'ordre Port → Perles → Phare → Épaves → Corail → Port, d'un Quai au suivant à chaque nouveau tour de table. Le bandeau du haut dit où il est amarré et où il ira.",
        "• Sur le Quai où il est amarré, tu peux le prendre À LA PLACE de ta marche : tu es déposé au Quai suivant du circuit. C'est un déplacement ordinaire (il prend toute l'énergie restante, et finit le tour) mais sans route : pas de chaussée, pas de Barrière qui compte, pas de bonus du Départ.",
        "• Impossible si le Quai suivant est tenu ou si la Botte est préparée pour deux cases.",
      ],
    },
    {
      title: "Les Quais et les tourbillons",
      body: [
        `• Un Quai n'accueille qu'un joueur. On ne peut pas finir sa marche sur un Quai tenu ; si autre chose y amène un second joueur (une roue, la Corde, un échange, un tunnel, une téléportation), il est repoussé sur la case d'où il venait et celui qui tient le Quai touche ${QUAY_HOLDER_REWARD} pièces.`,
        "• Un Quai compte comme une case sans effet : ni roue, ni boutique.",
        "• Le tourbillon (Perles 9, Épaves 23) aspire qui y arrive vers le Quai d'une autre île tirée au hasard (jamais la sienne, de préférence un Quai libre). C'est une arrivée sur le tourbillon (Boue, Portail et le reste y jouent) puis un voyage sans roue ni boutique à l'autre bout. Personne n'y reste.",
      ],
    },
  ],
  desert: [
    {
      title: "Pensé du plateau",
      body: [
        "• Deuxième « grande carte » (patch 0.2.4) : 41 cases pour 6 à 8 joueurs, un monde ouvert sans cadre. Comme l'Archipel, elle est grisée sous six joueurs et le tirage au sort ne la propose pas. Elle se joue en ligne : sur un écran partagé on ne pourrait pas cacher laquelle des deux Red Cups est la vraie.",
        "• Une grande boucle de caravane de 24 cases (0 à 23, le Départ au sud) autour d'une boucle de dunes de 12 cases, reliées par quatre passes. L'Enfer est le Sable mouvant, au centre (case 11 comme partout).",
        "• Quatre oasis (3, 9, 16, 22) tiennent lieu de boutiques ; deux puits (27 et 33) sur la boucle intérieure.",
        "• La grande boucle se parcourt dans le sens horaire : la flèche des oasis et celle de la dernière case avant le Départ imposent la sortie. Le bonus du Départ se paie en entrant en 0 par cette flèche.",
      ],
    },
    {
      title: "Les mirages",
      body: [
        "• Deux Red Cups sont posées en permanence : une vraie et un mirage. Rien ne les distingue : même dessin, même lumière, même ligne dans le journal à l'arrivée.",
        `• Arriver sur le mirage : il se dissipe (« Ce n'était qu'un mirage ! »). Le joueur finit son tour, perd aucune pièce, mais a soif : ${THIRST_ENERGY} point d'énergie de moins à son prochain tour.`,
        "• Quand un mirage est pris, les DEUX Cups disparaissent et deux nouvelles apparaissent ailleurs, sur deux cases qu'aucune des deux anciennes occupait : si seule la vraie avait changé de place, ce serait elle qu'on reconnaîtrait. Même chose quand la vraie est prise.",
        "• Le couple est tiré au hasard du moteur (donc identique chez tous) : la vraie à 5 à 7 pas du joueur le plus proche, le mirage à 4 à 8 pas, au moins 6 pas entre les deux et à 6 pas de qui vient de ramasser. Jamais sur une oasis, un puits, une passe, le Départ, l'Enfer ou une case occupée.",
        "• Tout ce que la vraie Cup déclenche est déclenché à l'identique sur le mirage jusqu'à la révélation : le dé du [[card:roller|Roller]] (un 6 pour la vraie comme pour le mirage), la question « quel objet jeter ? » d'un sac plein (rien n'est jeté si c'était un mirage), [[card:greedy|Cupide]] qui encaisse, [[card:blind-luck|Chance aveugle]] qui ne voit aucune des deux, [[card:half-seen|Mi-vu, Mi-vue]] qui se découvre à une case de l'une ou de l'autre.",
        "• [[card:new-cup-new-me|New Cup, New Me]], [[card:calm-down|Calme-toi]] et [[card:goblin|Gobelin]] ne se déclenchent qu'à la prise de la vraie : un mirage dissipé n'est pas une « nouvelle Cup ».",
      ],
    },
    {
      title: "Puits et oasis",
      body: [
        `• Sur un puits, paie ${WELL_PRICE} pièces : tu sais, toi seul, laquelle est la vraie. Une fois par paire de Cups ; la connaissance disparaît quand le couple change. Le journal dit seulement « X puise au puits », la même ligne pour tous. L'information est sur ton écran seulement (comme les sacs, l'état partagé la contient techniquement).`,
        `• Une oasis est la boutique à une place : un second joueur est repoussé, aucun objet ne peut viser son occupant, et il gagne ${OASIS_ENERGY} point d'énergie à son tour suivant s'il y est toujours.`,
      ],
    },
    {
      title: "La caravane et les tempêtes",
      body: [
        `• La caravane avance de ${CARAVAN_STEP} cases à chaque nouveau tour de table sur la grande boucle, dans le sens horaire. Sur sa case, tu peux y monter À LA PLACE de ta marche : elle t'emporte de ${CARAVAN_RIDE} cases (arrivée normale, sans bonus du Départ). Impossible si l'arrivée est une oasis tenue.`,
        `• Toutes les ${STORM_ROUNDS} manches une tempête de sable ferme deux passes (38 et 40, puis 37 et 39, en alternance) et ouvre les deux autres. Une passe fermée est une route fermée pour tout le monde ; qui s'y trouve est déposé sur la grande boucle. Les Cups ne bougent pas : aucune information ne se perd ni ne s'ajoute.`,
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
