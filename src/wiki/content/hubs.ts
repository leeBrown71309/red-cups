import type { ContentSection } from "../types";

/**
 * Les deux « mécaniques » transverses : la boutique et les duels. Sources :
 * `shopping.ts`, `passive-rules.ts` (rayons), `rules.ts` (prix), `duel*.ts`,
 * `blackjack.ts`, `ghost.ts` (enjeux du fantôme).
 */
export const HUB_SECTIONS: Record<string, ContentSection[]> = {
  shop: [
    {
      title: "Comment elle s'ouvre",
      body: [
        "• En finissant UN déplacement sur une case bleue — la boutique devient la dernière phase du tour.",
        "• [[card:eshop|eShop]] : après chaque déplacement, n'importe où.",
        "• Jamais en Enfer, et rien ne s'ouvre pendant un [[item:doomsday|Doomsday]] (sauf pour [[card:blind-luck|Chance aveugle]], épargné).",
        "• Téléporté, tiré, échangé ou remplacé sur une case bleue : pas de boutique — seule la FIN d'un déplacement l'ouvre. (Exception : une roue qui vous POSE en fin de tour peut ouvrir la boutique, voir « Les cases ».)",
      ],
    },
    {
      title: "Ce qui est en rayon",
      body: [
        "• Les 18 objets « publics », pour tout le monde.",
        "• 5 objets du [[card:devil|Diable]] (Portails, Toucher d'Enfer, Black Cup, Sentence, Doomsday) : onglet violet, au diable seul.",
        "• [[item:shield|Bouclier]] : à l'[[card:guardian-angel|Ange-Gardien]] seule main.",
        "• [[item:made-in-heaven|Made In Heaven]] : à [[card:blind-luck|Chance aveugle]] seul, et seulement tant que la Red Cup n'est pas en case 8.",
        "• L'Ange ne peut ACHETER ni utiliser 11 objets nuisibles (liste sur sa fiche); le [[card:roller|Roller]] n'a pas de [[item:boot|Botte]].",
        "• Limite d'exemplaires : 2 par objet, Gomme/Made In Heaven/Miroir en un seul, tous les achats du Diable en un seul; Tomate en piles de 5 (2 piles, 1 par place pour [[card:tomato-enjoyer|Tomato Enjoyer]]).",
        "• Le [[item:mirror|Miroir]] ne se vend QU'UNE fois par joueur pour la partie, usé ou non.",
      ],
    },
    {
      title: "Les prix",
      body: [
        "• Le prix affiché est celui du [[item:tomato|code]] : la [[item:boot|Botte]] monte de 50 par tour de table après son premier achat (100 → 400, plafonné).",
        "• La [[item:mud|Boue]] coûte 100 à [[card:greedy|Cupide]] et au [[card:trapper|Piégeur]] (200 aux autres).",
        "• [[card:last-in-class|Dernier de la classe]] : −10 % sur tout, arrondi aux 10 du dessus.",
        "• On peut acheter PLUSIEURS exemplaires (ou une pile entière de Tomates) d'un coup si le sac et la bourse le permettent — jusqu'à 40 unités par commande.",
        "• Les achats ne coûtent PAS d'énergie et ne s'utilisent qu'au tour suivant.",
      ],
    },
    {
      title: "Autour du comptoir",
      body: [
        "• [[card:thief|Voleur]] : une tentative de vol par VISITE (1 % du prix par 10 pièces ; raté → Enfer + amende 1,5×).",
        "• [[card:junk-dealer|Brocanteur]] : onglet « Revente », 60 % du prix arrondi aux 5, jamais de Cup.",
        "• La roulette du bonheur « objet gratuit » tire dans un panier à part : les 8 objets à 400 ou moins du panier public.",
        "• Sac plein ou limite atteinte : l'objet reste grisé avec la vraie raison écrite dessous.",
      ],
    },
  ],
  duels: [
    {
      title: "Quand on se bat",
      body: [
        "• Deux joueurs en Enfer quand le plateau se repose : duel (le tour passe au vainqueur). Jamais trois à la fois : un seul duel, les autres attendent.",
        "• « Choisis un joueur à affronter » sur la roue de l'Enfer : la victime choisie est ENVOYÉE en Enfer avec vous, puis duel.",
        "• À [[map:luna-park|Luna Park]], croiser le fantôme est un duel à enjeux différents (voir la fiche du plateau).",
        "• Ne peuvent être tirés comme victime : ni l'[[card:guardian-angel|Ange]] (il n'y va jamais), ni [[card:blind-luck|Chance aveugle]] (rien ne l'atteint). Sans cible, le défi tombe.",
        "• Un [[item:parachute|Parachute]] sur la victime du défi annule sa venue en Enfer → pas de duel.",
      ],
    },
    {
      title: "Les cinq mini-jeux",
      body: [
        "• Pile ou face : la pièce est déjà tirée par le moteur au début du duel ; on ne fait que la révéler.",
        "• Pierre-Feuille-Ciseaux : choix secrets simultanés ; égalité = on rejoue (jusqu'à ce que ça cède).",
        "• Vote de la table : les autres votent en secret ; égalité = la pièce départage. Uniquement s'il reste des votants (3+ joueurs).",
        "• Basket : 15 secondes chacun pour mettre le plus de paniers ; le fantôme tire avec un modèle « chaud-froid » moyen de ~6 paniers ; égalité = pièce.",
        "• Blackjack : 2 cartes chacun, tire ou reste au plus proche de 21 sans dépasser ; le fantôme joue en croupier (tire jusqu'à 17) ; mains à égalité = pièce.",
        "• Le mini-jeu est tiré au sort parmi les jeux disponibles — sauf si un [[card:game-master|Meneur de jeu]] est dans le duel : il tire deux jeux et choisit.",
      ],
    },
    {
      title: "L'enjeu",
      body: [
        "• Enfer classique : le vainqueur repart au Départ avec le bonus de 200 (et la glace de Banquise l'emporte si le Départ est gelé) ; le vaincu reste en Enfer purger sa peine.",
        "• Le duel ne change rien d'autre : pas de Cup, pas de pièces échangées entre les duellistes.",
        "• À noter : le « bras de fer » Botte/[[card:built-like-a-tank|Baraqué]]-[[item:monopoly-man|Monopoly Man]] n'est PAS un duel (pas de mini-jeu aléatoire, pas de Meneur : 10 secondes de taps, force ×1,2 pour Baraqué).",
      ],
    },
  ],
};
