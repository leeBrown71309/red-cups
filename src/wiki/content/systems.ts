import { PASSIVE_ORDER } from "../../game/catalog";
import { CARD_KINDS } from "../../game/cards";
import {
  BASE_ENERGY,
  QUAY_HOLDER_REWARD,
  TIDE_ROUNDS,
  HERMIT_DISTANCE,
  HERMIT_ENERGY_BONUS,
  HERMIT_START_BONUS,
  INSURER_HELL_REWARD,
  INSURER_RATE,
  INSURER_ROUND_CAP,
  MAGE_MAX_LUCK,
  MOLE_DIG_ENERGY,
  SISTER_SWAP_ENERGY,
} from "../../game/types";
import { percent } from "../format";
import type { ContentSection, WikiEntry } from "../types";
import { ref } from "../types";

/**
 * Cups Power and passifs a draft deals: Lambda only fills an empty slot, and L'Ange-Gardien needs four players
 * (so one fewer Cups Power at a smaller table).
 */
const DEALT_CUPS_POWER = PASSIVE_ORDER.filter((id) => CARD_KINDS[id] === "actif" && id !== "lambda").length;
const DEALT_PASSIFS = PASSIVE_ORDER.filter((id) => CARD_KINDS[id] === "passif").length;

/**
 * Les « systèmes » : les règles transverses du jeu (le tour, la marche,
 * l'Enfer…), rédigées d'après `rules.ts`, `energy.ts`, `turn-actions.ts`,
 * `game-effects.ts`, `state-utils.ts`, `turn-clock.ts`, `draft.ts`.
 */
const SYSTEM_SECTIONS: Record<string, ContentSection[]> = {
  turn: [
    {
      title: "Déroulé",
      body: [
        `• À ton tour tu reçois ton jauge pleine (${BASE_ENERGY} points, [[card:red-bull|Red Bull]] +1, [[card:last-in-class|Dernier de la classe]] +1 s'il est dernier, [[card:hermit|L'Ermite]] +${HERMIT_ENERGY_BONUS} s'il est seul à ${HERMIT_DISTANCE} cases ou moins).`,
        "• Phase « action » : lance d'abord tes objets (chacun coûte son énergie; les achats se font pour les tours suivants). Ensuite tu marches : le déplacement prend TOUT ce qui reste et termine le tour.",
        "• Tu peux aussi finir sur place sans marcher : après avoir dépensé de l'énergie en objet, s'il ne reste pas assez pour bouger, ou si aucune route ne mène nulle part.",
        "• La Tomate seule et les objets gratuits ne comptent pas comme « avoir agi » : ils ne te permettent pas de passer ton tour sans bouger.",
        "• La [[card:roller|Roller]] lance son dé avant toute chose; une fois le dé lancé, plus d'objets.",
        `• Les Cups Power à bouton se jouent comme des objets, avant le déplacement : la copie du [[card:mime|Mime]] (aucune énergie), le tunnel de la [[card:mole|Taupe]] (${MOLE_DIG_ENERGY} points, il tient lieu de marche) et le Swap de la [[card:ghost-sister|Sœur Fantôme]] (${SISTER_SWAP_ENERGY} points). Le pentagramme et la téléportation du [[card:black-mage|Mage noir]] ne coûtent aucune énergie (un pentagramme de la réserve par téléportation, ${MAGE_MAX_LUCK} au départ).`,
        "• En Enfer, la roue remplace la marche (et prend le reste de l'énergie).",
      ],
    },
    {
      title: "Passage de tour",
      body: [
        "• Quand tout le monde a joué, un nouveau tour de table commence : [[item:bullet-bill|Bullet Bill]] charge, le blizzard peut souffler, le prix de la [[item:boot|Botte]] peut monter, les sorts du [[card:devil|diable]] et les [[item:barrier|Barrières]] s'éteignent, et la peine de chacun en Enfer avance d'un cran.",
        "• Les tours sautés (K.O., [[item:middle-finger|Middle Finger]], roues…) se consomment au passage : le tour perdu EST celui-ci, pas le suivant.",
        "• L'assommement affiche un statut (patch 0.2.0) : il naît quand un tour est perdu et ne s'efface que quand le joueur peut rejouer — le tour d'après. [[item:hell-touch|Toucher d'Enfer]] et les vols du [[card:greedy|Cupide]] peuvent donc le viser même une fois le tour sauté consommé.",
        "• Un tour sauté en Enfer compte dans la peine — et rapporte son point au [[card:devil|diable]].",
      ],
    },
  ],
  move: [
    {
      title: "La marche",
      body: [
        "• Une case par tour, le long des routes. Une marche ne peut JAMAIS entrer en Enfer : on n'y va que par les effets (roues, objets, duels…).",
        "• Case fléchée : la flèche SORT de la case — on ne la quitte que par cette route, mais on y entre par n'importe laquelle (quitte à arriver à contresens d'un sens unique).",
        "• Chemin libre : dans les deux sens. Tunnel et carrousel : sens unique (le carrousel s'inverse à chaque nouvelle Cup).",
        "• Le déplacement s'arrête sur une case de glace à [[map:banquise|Banquise]] : la glissade décide ensuite, pas toi.",
      ],
    },
    {
      title: "Qui change la marche",
      body: [
        "• [[item:boot|Botte]] : deux cases au lieu d'une (ou un saut par-dessus une [[item:barrier|Barrière]]).",
        "• [[card:corrupter|Corrupteur]] : 400 pièces pour ignorer flèches et sens uniques — jamais les Barrières.",
        "• [[card:roller|Roller]] : dé de 1 à 6, chemin sans repasser par une case déjà foulée.",
        "• [[card:mole|Taupe]] : un tunnel creusé vers une case déjà visitée, que tout joueur peut traverser une fois — un déplacement de plus, sans bonus du Départ.",
        "• [[card:black-mage|Mage noir]] : la téléportation sur son pentagramme n'est pas un pas : routes, Barrières et flèches sont ignorées.",
        "• [[card:ghost-sister|Sœur Fantôme]] : chaque pas du joueur est reflété par la petite sœur, qui suit les vraies routes.",
        "• [[item:barrier|Barrière]] : route fermée, personne n'y passe à pied.",
      ],
    },
  ],
  tiles: [
    {
      title: "Ce qu'une case fait à l'ARRIVÉE",
      body: [
        "• Verte : roue du [[wheel:fortune|bonheur]]. Rouge : roue du [[wheel:misfortune|malheur]]. Bleue : la boutique s'ouvre à la fin de ton déplacement. Neutre : rien. Départ : +200 si tu y entres PAR LA FLÈCHE qui y mène (8→0 à [[map:classic|Coffre à jouets]] et [[map:luna-park|Luna Park]], 4→0 à [[map:banquise|Banquise]]).",
        "• « Arriver » = finir un déplacement, ou être posé là par une roue (« Avance d'une case », « Va au Départ », « Retourne d'où tu viens ») : la roue de la case, la Boue, le Portail et le bonus s'appliquent. Seul le Portail qui AVALE la case éteint tout le reste : pas de roue, pas de boutique (une Red Cup posée là se ramasse quand même avant la chute). Une boutique ne s'ouvre sur une pose de roue que si c'est ton tour et que tu finissais. La [[item:water-bottle|Bouteille d'eau]] échappe à la règle : sa téléportation donne la roue et la Cup, pas la Boue ni les Portails.",
        "• « Arrivé » ≠ « déplacé » : la [[item:rope|Corde]] qui tire, le [[item:monopoly-man|Monopoly Man]] qui échange, [[card:new-cup-new-me|New Cup, New Me]] et [[card:calm-down|Calme-toi]] POSENT sans déclencher la case, comme le Swap de la [[card:ghost-sister|Sœur Fantôme]]. En revanche, un tunnel de la [[card:mole|Taupe]] et la téléportation du [[card:black-mage|Mage noir]] SONT des arrivées.",
        "• Glace ([[map:banquise|Banquise]]) : personne n'y stationne — on glisse ailleurs; seule la case finale compte.",
        "• Archipel ([[map:archipel|Archipel des Marées]]) : un Quai, une chaussée et un tourbillon sont des cases sans roue ni boutique ; personne ne reste sur un tourbillon ni sur une chaussée noyée. Voir [[system:tide|Marées, bac et Quais]].",
      ],
    },
  ],
  hell: [
    {
      title: "Y entrer",
      body: [
        "• Jamais en marchant. Sources : [[wheel:misfortune|roue du malheur]] (« Direction l'Enfer »), [[item:hollow-purple|Hollow Purple]], [[item:draven|Draven]], [[item:sentence|Sentence]], [[item:portal|Portails]], un échange [[item:monopoly-man|Monopoly Man]] qui vous y met, le défi lancé depuis la roue de l'Enfer, et la claque du fantôme à [[map:luna-park|Luna Park]].",
        "• Entrée = remise à zéro du compteur de peine; y être déjà n'ajoute rien.",
        "• [[item:parachute|Parachute]] : la première descente est annulée, quelle que soit la porte d'entrée.",
        "• [[card:guardian-angel|L'Ange-Gardien]] n'y va jamais : il perd un tour à la place.",
        `• Un [[card:black-mage|Mage noir]] qui a un pentagramme peut esquiver ([[item:hollow-purple|Hollow Purple]], [[item:draven|Draven]], « Direction l'Enfer ») en se téléportant : pas d'entrée, donc rien pour le diable, l'Habitué ni l'Assureur. Chaque entrée d'un autre rapporte ${INSURER_HELL_REWARD} pièces à [[card:insurer|L'Assureur]].`,
      ],
    },
    {
      title: "Y vivre",
      body: [
        "• Ton tour en Enfer = objets d'abord si tu veux, puis la roue de l'Enfer (elle prend ton énergie restante) : la roue n'est pas un choix, tu ne peux pas finir ton tour à côté d'elle tant qu'il te reste l'énergie pour la tourner. Pas de marche, pas de boutique, pas de cases.",
        "• Deux joueurs en Enfer au repos de la table : DUEL (le premier en liste des sièges avec le suivant) — pas trois : un seul duel à la fois.",
        "• Sorties : la Libération de la roue (+200, case 0), [[item:water-bottle|Bouteille d'eau]] (case au hasard), le vainqueur d'un duel (Départ + 200), la fin de peine, la téléportation d'un [[card:black-mage|Mage noir]] sur son pentagramme (à son tour, sans bonus ni péage). [[card:new-cup-new-me|New Cup, New Me]] ne libère plus (patch 0.2.0).",
        "• Peine : 5 de TES tours commencés là-bas (3 pour l'[[card:hell-regular|Habitué de l'Enfer]]) → sortie d'office en case 0 avec le bonus du Départ, contre 500 pièces de péage (le bonus d'abord, le péage ensuite : le Casque peut jouer).",
        "• Le [[card:devil|diable]] en sort quand il veut pour 1 point d'énergie.",
      ],
    },
  ],
  cups: [
    {
      title: "La Red Cup",
      body: [
        "• Une Cup est posée sur une case du plateau (ni Départ, ni Enfer, ni la case de la Cup précédente, jamais la glace). Marchez dessus pour la ramasser : 3 Cups = victoire.",
        "• Ramassée, elle occupe une place du sac; sac plein : défausse obligée d'un objet (jamais d'une Cup).",
        "• À la prise : une nouvelle Cup apparaît ailleurs et le cycle redémarre — compteurs [[card:red-light-green-light|Red light, Green light]] remis à zéro, vols du [[card:goblin|Goblin]], choix [[card:new-cup-new-me|New Cup, New Me]], triage [[card:calm-down|Calme-toi]], et le carrousel de [[map:luna-park|Luna Park]] change de sens.",
        "• Le [[card:greedy|Cupide]] la convertit en +1 000 pièces; le [[card:devil|diable]] et [[card:guardian-angel|l'Ange]] passent dessus sans la voir (aucun effet).",
        "• [[card:blind-luck|Chance aveugle]] ne la voit JAMAIS à l'écran.",
        "• [[item:black-cup|Black Cup]] et [[item:made-in-heaven|Made In Heaven]] la déplacent par des voies détournées ; le Swap de la [[card:ghost-sister|Sœur Fantôme]] peut aussi l'emporter.",
        "• Patch 0.2.3 : on ne creuse jamais vers elle ([[card:mole|Taupe]]), un [[card:black-mage|Mage noir]] qui se téléporte sur elle la ramasse, et [[card:half-seen|Mi-vu, Mi-vue]] redevient visible à une case d'elle.",
      ],
    },
  ],
  money: [
    {
      title: "Pièces",
      body: [
        "• Tout le monde démarre à 2 000 — sauf [[card:nepo-baby|Nepo Baby]] (+1 000), [[card:eshop|eShop]] (−1 000) et l'[[card:guardian-angel|Ange]] (−1 200) : les deltas se cumulent entre ton Cups Power et ton passif.",
        "• Un solde qui passe SOUS zéro n'arrive jamais : le [[item:helmet|Casque]] le premier l'absorbe (il se consume), sinon le solde continue en négatif.",
        "• À −300 : K.O. — solde remis à 0 et prochain tour sauté (un [[item:wake-up|Réveil]] peut sauver le tour). Les gains par-dessus un solde négatif sont possibles.",
        "• K.O. et gains/pertes peuvent être SUSPENDUS/MISÉS par [[card:double-or-nothing|Double or nothing]] : la mise passe avant le K.O.",
        `• [[card:insurer|L'Assureur]] touche ${percent(INSURER_RATE)} de chaque perte subie par un autre, versés par la banque (au plus ${INSURER_ROUND_CAP} pièces par tour de table), et ${INSURER_HELL_REWARD} pièces par descente d'un autre en Enfer : jamais pour les achats, le Corrupteur ou l'amende du Voleur, et au moment de la perte, même si un 50/50 l'annule ensuite.`,
        `• [[card:hermit|L'Ermite]] seul touche ${HERMIT_START_BONUS} pièces de plus à chaque bonus du Départ.`,
      ],
    },
  ],
  bag: [
    {
      title: "Le sac",
      body: [
        "• 4 places ([[card:guardian-angel|l'Ange]] : 2), Cup comprises.",
        "• Deux exemplaires max d'un même objet; exception : une seule Gomme, un seul [[item:made-in-heaven|Made In Heaven]], un seul [[item:mirror|Miroir]] — et TOUS les objets du [[card:devil|diable]] en un seul exemplaire.",
        "• La [[item:tomato|Tomate]] s'empile par piles de 5 : une pile = un emplacement et un « exemplaire »; deux piles max (une par place pour [[card:tomato-enjoyer|Tomato Enjoyer]]). Une pile jetée par une roue part EN TOTALITÉ.",
        "• Les objets achetés s'utilisent au tour suivant (jamais pendant la boutique).",
      ],
    },
  ],
  draft: [
    {
      title: "Avant la partie",
      body: [
        `• Deux manches : chacun choisit son CUPS POWER parmi 2 propositions, puis découvre son PASSIF, tiré au sort (patch 0.2.1) : deux joueurs n'ont jamais le même passif. Le catalogue donne ${DEALT_CUPS_POWER} Cups Power (un de moins sous 4 joueurs, sans l'Ange-Gardien) et ${DEALT_PASSIFS} passifs ; le diable et l'Ange-Gardien ne passent qu'UNE fois par table.`,
        "• En ligne : 1 minute pour le Cups Power (qui n'a pas choisi tire au sort un de ses deux), puis 20 secondes pour lire son passif et confirmer. En local : l'écran passe de main en main.",
        "• L'[[card:guardian-angel|Ange]] (4+ joueurs) ne reçoit jamais de passif nuisible (Voleur, Goblin, Corrupteur, Piégeur) et ne protège aucun de ces criminels; [[card:greedy|Cupide]] n'aura jamais [[card:nepo-baby|Nepo Baby]].",
        "• [[card:lambda|Lambda]] : le remplissage quand le vivier est épuisé ou l'Ange sans protégé.",
        "• Fin de draft : l’Ange (+ son protégé) est ANNONCÉ à toute la table (le diable ne l’est pas), les pièces de départ et la jauge se règlent, compte à rebours de 5 s avant le premier tour.",
      ],
    },
  ],
  online: [
    {
      title: "En ligne",
      body: [
        "• Chaque joueur : 45 s par tour (uniquement ses décisions), les décisions des autres : 20 s (45 s au bras de fer). Le chrono des duels et des roues est remplacé par une sécurité de 120 s.",
        "• Temps écoulé : le choix par défaut s'applique (finir le tour, laisser passer, garder ses pièces… ou un tirage au sort quand il faut choisir : case d'avance, objet à jeter, main, vote).",
        "• Chances : chaque joueur en a 3 (un trèfle à quatre feuilles chacune, affiché sous son nom). Un tour écoulé sans RIEN faire en coûte une ; à la dernière, une alerte prévient au début de son tour ; quand elles sont toutes perdues, c'est le forfait (abandon automatique). Rien ne les rend : jouer simplement ne coûte rien.",
        "• Tout le monde réduit le même jeu d'actions avec la même chance (tire du moteur) : chaque device voit la même roue, le même fantôme, la même explosion.",
        "• L'hôte peut mettre en pause (les horloges se figent et se décalent d'autant) et exclure; un joueur exclu peut demander son retour — il revient avec ce qu'il avait (l'Ange revient en Lambda), en fin d'ordre de passage.",
        "• Rejoindre en retard : possible jusqu'à la fin du 1er tour de table, jamais pour un rôle (diable/Ange).",
      ],
    },
    {
      title: "Secrets et brouillard",
      body: [
        "• Le sac et le Cups Power des autres restent cachés ; les passifs et le protégé de l'Ange sont publics. Les lignes du journal d'un achat, d'un vol ou d'une copie n'apparaissent en clair que pour leur propriétaire.",
        "• [[card:mime|Mime]] : la table lit « X copie le Cups Power de Y jusqu'à la fin de son tour », sans savoir lequel ; seul le Mime le sait.",
        "• [[card:half-seen|Mi-vu, Mi-vue]] : tant que quelqu'un est invisible, chaque écran cache ce qu'il ne doit pas voir. L'invisible, pendant son tour, ne voit plus les autres pions, leurs actions (le journal ne garde que son propre tour), leurs sacs, leurs pièces, les pièges, la Red Cup ni Bullet Bill ; son propre pion est dessiné translucide, pour lui seul. Les autres ne voient plus son pion, ses actions, son sac ni ses pièces. Le journal garde « Tour de X » et les annonces d'invisibilité pour tout le monde.",
        "• Ces voiles sont visuels : chaque appareil rejoue le même jeu, l'état est partagé — comme pour la Red Cup de [[card:blind-luck|Chance aveugle]]. Sur un écran partagé (local), le brouillard suit le joueur qui doit décider.",
      ],
    },
  ],
  mirage: [
    {
      title: "Les deux Red Cups du désert",
      body: [
        "• Sur le [[map:desert|Désert des Mirages]], deux Red Cups sont posées en permanence : une vraie et un mirage. Rien ne les distingue avant l'arrivée, ni dans la scène, ni dans le journal.",
        "• Atteindre le mirage le dissipe : le joueur a soif (1 point d'énergie de moins à son prochain tour) et les DEUX Cups sont retirées pour deux nouvelles, ailleurs, sur deux cases neuves. Atteindre la vraie la ramasse, avec la même relève des deux Cups.",
        "• Le [[map:desert|puits]] vend en secret la place de la vraie (300 pièces, une fois par paire).",
      ],
    },
  ],
  tide: [
    {
      title: "Marée, bac, Quais et tourbillons",
      body: [
        "• Ces règles n'existent que sur l'[[map:archipel|Archipel des Marées]] (patch 0.2.4), la première grande carte : 6 à 8 joueurs.",
        `• La marée tourne tous les ${TIDE_ROUNDS} tours de table. Une chaussée noyée est une route fermée pour tout le monde, et qui s'y trouve est déposé sur le Quai voisin au moment où la mer monte.`,
        "• Le bac passe d'un Quai au suivant à chaque nouveau tour de table ; sur son Quai, on le prend à la place de la marche.",
        `• Un Quai n'accueille qu'un joueur : on ne finit pas sa marche sur un Quai tenu, et un second joueur amené là d'une autre façon est repoussé en rapportant ${QUAY_HOLDER_REWARD} pièces à celui qui le tient.`,
        "• Un tourbillon aspire vers le Quai d'une autre île, au hasard.",
        "• Rien de tout cela n'est une case à roue : Quais, chaussées et tourbillons ne déclenchent ni roue ni boutique, et la Red Cup n'y apparaît jamais.",
      ],
    },
  ],
  blessing: [
    {
      title: "Tour de Bénédiction",
      body: [
        "• Quand une fin de tour trouve TOUTE la table à 0 pièce ou moins, chaque joueur tourne la roue du bonheur dans l'ordre, à partir du suivant.",
        "• Rien d'autre ne se joue pendant ce temps; le tour passe ensuite normalement.",
        "• La roue peut envoyer en Enfer, faire gagner des objets… comme d'habitude.",
      ],
    },
  ],
  victory: [
    {
      title: "Gagner",
      body: [
        "• 3 Red Cups (la voie royale).",
        "• 6 000 pièces pour [[card:greedy|Cupide]] — vérifié après CHAQUE action, même hors de son tour.",
        "• Le quota d'Enfer pour le [[card:devil|diable]] (⌊4N − N/2⌋).",
        "• L'[[card:guardian-angel|Ange-Gardien]] gagne avec son protégé (peu importe comment le protégé gagne).",
        "• Un [[card:black-mage|Mage noir]] sans aucun pentagramme n'est pas éliminé : il ne peut simplement plus se téléporter, et en retrouve un tous les 15 tours.",
        "• Par abandon : le dernier joueur assis l'emporte si la table se vide.",
        "• Classement final : vainqueur(s) en tête, puis aux Cups, puis aux pièces; les partis après sont listés à part.",
      ],
    },
  ],
};

const SYSTEM_TITLES: Record<string, string> = {
  turn: "Le tour et l'énergie",
  move: "Se déplacer",
  tiles: "Les cases",
  hell: "L'Enfer",
  cups: "La Red Cup",
  money: "Pièces et K.O.",
  bag: "Le sac",
  draft: "Le draft des Cups Power",
  online: "Parties en ligne",
  tide: "Marées, bac et Quais",
  mirage: "Mirages et puits du désert",
  blessing: "Tour de Bénédiction",
  victory: "Gagner la partie",
};

const SYSTEM_SUMMARY: Record<string, string> = {
  turn: "3 points par tour : objets d'abord, la marche prend le reste et termine le tour.",
  move: "Une case par tour le long des routes; les flèches dictent la sortie, les tunnels un sens.",
  tiles: "Départ, boutique, verte, rouge, neutre, Enfer — et ce qui compte comme une vraie arrivée.",
  hell: "On n'y marche jamais; on y purge 5 tours, on s'y bat à deux, on en sort par le péage.",
  cups: "3 pour gagner; une Cup prise, une nouvelle naît, et les passifs du cycle se réveillent.",
  money: "2 000 au départ, Casque sous zéro, K.O. à −300 : la loi des pièces.",
  bag: "4 places, deux exemplaires par objet, des piles de Tomates — et des exceptions par Cups Power et passif.",
  draft:
    "Avant la partie : un Cups Power choisi parmi 2 propositions, un passif tiré au sort, jamais deux fois le même.",
  online: "Quarante-cinq secondes par tour, le choix par défaut, le forfait, la pause de l'hôte.",
  mirage: "Désert : deux Red Cups dont un mirage, un puits qui vend la vérité, une soif qui coûte un point d'énergie.",
  tide: "Archipel : la mer noie les chaussées, un bac fait le tour des Quais, les tourbillons dispersent.",
  blessing: "Toute la table fauchée ? Chacun tourne la roue du bonheur, dans l'ordre.",
  victory: "3 Cups, 6 000 pièces pour Cupide, le quota d'Enfer du diable, ou la table vidée.",
};

const SYSTEM_KEYWORDS: Record<string, string> = {
  turn: "energy phase stage action tour energy jauge end turn",
  move: "walk road arrow tunnel carousel one way barrier boot die roller marcher",
  tiles: "start shop green red tile arrival depart boutique verte rouge",
  hell: "enfer hell sentence toll sortie duels wheel of hell",
  cups: "red cup victoire cycle apparition ramasser",
  money: "pieces coins ko knockout 300 casque helmet solde",
  bag: "sac inventory slots copies pile stack tomate",
  draft: "draft cups power cp actif passif offre pick cartes tirage hasard",
  online: "clock chrono pause kick forfeit abandon late join host hote retard",
  mirage: "mirage desert désert puits well soif thirst cup vraie fausse caravane tempete tempête oasis sable",
  tide: "maree marée bac ferry quai chaussee chaussée tourbillon whirlpool archipel noyee eau",
  blessing: "tour beneuf fortune broke fauchee blessing",
  victory: "win winreason co winner classement standings",
};

export const SYSTEM_ENTRIES: WikiEntry[] = Object.entries(SYSTEM_SECTIONS).map(([id, sections]) => ({
  ref: ref("system", id),
  kind: "system",
  title: SYSTEM_TITLES[id],
  summary: SYSTEM_SUMMARY[id],
  facts: [],
  sections,
  keywords: SYSTEM_KEYWORDS[id],
}));
