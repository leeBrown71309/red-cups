import type { ContentSection, WikiEntry } from "../types";
import { ref } from "../types";

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
        "• À ton tour tu reçois ton jauge pleine (3 points, [[card:red-bull|Red Bull]] +1, [[card:last-in-class|Dernier de la classe]] +1 s'il est dernier).",
        "• Phase « action » : lance d'abord tes objets (chacun coûte son énergie; les achats se font pour les tours suivants). Ensuite tu marches : le déplacement prend TOUT ce qui reste et termine le tour.",
        "• Tu peux aussi finir sur place sans marcher : après avoir dépensé de l'énergie en objet, s'il ne reste pas assez pour bouger, ou si aucune route ne mène nulle part.",
        "• La Tomate seule et les objets gratuits ne comptent pas comme « avoir agi » : ils ne te permettent pas de passer ton tour sans bouger.",
        "• La [[card:roller|Roller]] lance son dé avant toute chose; une fois le dé lancé, plus d'objets.",
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
        "• [[item:barrier|Barrière]] : route fermée, personne n'y passe à pied.",
      ],
    },
  ],
  tiles: [
    {
      title: "Ce qu'une case fait à l'ARRIVÉE",
      body: [
        "• Verte : roue du [[wheel:fortune|bonheur]]. Rouge : roue du [[wheel:misfortune|malheur]]. Bleue : la boutique s'ouvre à la fin de ton déplacement. Neutre : rien. Départ : +200 si tu y entres PAR LA FLÈCHE qui y mène (8→0 à [[map:classic|Coffre à jouets]] et [[map:luna-park|Luna Park]], 4→0 à [[map:banquise|Banquise]]).",
        "• « Arriver » = finir un déplacement, ou être posé là par une roue (« Avance d'une case », « Va au Départ », « Retourne d'où tu viens ») : la roue de la case, la Boue, le Portail et le bonus s'appliquent. Une boutique ne s'ouvre sur une pose de roue que si c'est ton tour et que tu finissais. La [[item:water-bottle|Bouteille d'eau]] échappe à la règle : sa téléportation donne la roue et la Cup, pas la Boue ni les Portails.",
        "• « Arrivé » ≠ « déplacé » : la [[item:rope|Corde]] qui tire, le [[item:monopoly-man|Monopoly Man]] qui échange, [[card:new-cup-new-me|New Cup, New Me]] et [[card:calm-down|Calme-toi]] POSENT sans déclencher la case.",
        "• Glace ([[map:banquise|Banquise]]) : personne n'y stationne — on glisse ailleurs; seule la case finale compte.",
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
      ],
    },
    {
      title: "Y vivre",
      body: [
        "• Ton tour en Enfer = roue de l'Enfer (elle prend ton énergie restante) ou objets avant; pas de marche, pas de boutique, pas de cases.",
        "• Deux joueurs en Enfer au repos de la table : DUEL (le premier en liste des sièges avec le suivant) — pas trois : un seul duel à la fois.",
        "• Sorties : la Libération de la roue (+200, case 0), [[item:water-bottle|Bouteille d'eau]] (case au hasard), le vainqueur d'un duel (Départ + 200), la fin de peine. [[card:new-cup-new-me|New Cup, New Me]] ne libère plus (patch 0.2.0).",
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
        "• [[item:black-cup|Black Cup]] et [[item:made-in-heaven|Made In Heaven]] la déplacent par des voies détournées.",
      ],
    },
  ],
  money: [
    {
      title: "Pièces",
      body: [
        "• Tout le monde démarre à 2 000 — sauf [[card:nepo-baby|Nepo Baby]] (+1 000), [[card:eshop|eShop]] (−1 000) et l'[[card:guardian-angel|Ange]] (−1 200) : les deltas se cumulent entre vos deux cartes.",
        "• Un solde qui passe SOUS zéro n'arrive jamais : le [[item:helmet|Casque]] le premier l'absorbe (il se consume), sinon le solde continue en négatif.",
        "• À −300 : K.O. — solde remis à 0 et prochain tour sauté (un [[item:wake-up|Réveil]] peut sauver le tour). Les gains par-dessus un solde négatif sont possibles.",
        "• K.O. et gains/pertes peuvent être SUSPENDUS/MISÉS par [[card:double-or-nothing|Double or nothing]] : la mise passe avant le K.O.",
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
        "• Deux manches : chacun choisit son ACTIF parmi 2 cartes distribuées, puis son PASSIF parmi 2 autres. Le diable et l'Ange-Gardien ne passent qu'UNE fois par table.",
        "• En ligne : 1 minute par manche; qui n'a pas choisi tire au sort une de ses offres. En local : l'écran passe de main en main.",
        "• L'[[card:guardian-angel|Ange]] (4+ joueurs) ne reçoit jamais de passif nuisible (Voleur, Goblin, Corrupteur, Piégeur) et ne protège aucun de ces criminels; [[card:greedy|Cupide]] n'aura jamais [[card:nepo-baby|Nepo Baby]].",
        "• [[card:lambda|Lambda]] : le remplissage quand le vivier est épuisé ou l'Ange sans protégé.",
        "• Fin de draft : le diable et l'Ange (+ son protégé) sont ANNONCÉS à toute la table, les pièces de départ et la jauge se règlent, compte à rebours de 5 s avant le premier tour.",
      ],
    },
  ],
  online: [
    {
      title: "En ligne",
      body: [
        "• Chaque joueur : 45 s par tour (uniquement ses décisions), les décisions des autres : 20 s (45 s au bras de fer). Le chrono des duels et des roues est remplacé par une sécurité de 120 s.",
        "• Temps écoulé : le choix par défaut s'applique (finir le tour, laisser passer, garder ses pièces… ou un tirage au sort quand il faut choisir : case d'avance, objet à jeter, main, vote).",
        "• 3 tours écoulés sans RIEN faire = forfait (abandon automatique).",
        "• Tout le monde réduit le même jeu d'actions avec la même chance (tire du moteur) : chaque device voit la même roue, le même fantôme, la même explosion.",
        "• L'hôte peut mettre en pause (les horloges se figent et se décalent d'autant) et exclure; un joueur exclu peut demander son retour — il revient avec ce qu'il avait (l'Ange revient en Lambda), en fin d'ordre de passage.",
        "• Rejoindre en retard : possible jusqu'à la fin du 1er tour de table, jamais pour un rôle (diable/Ange).",
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
  draft: "Le draft des cartes",
  online: "Parties en ligne",
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
  bag: "4 places, deux exemplaires par objet, des piles de Tomates — et des exceptions par carte.",
  draft: "Avant la partie : un actif puis un passif, tirés de deux mains de 2 cartes.",
  online: "Quarante-cinq secondes par tour, le choix par défaut, le forfait, la pause de l'hôte.",
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
  draft: "draft actif passif offre pick cartes",
  online: "clock chrono pause kick forfeit abandon late join host hote retard",
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
