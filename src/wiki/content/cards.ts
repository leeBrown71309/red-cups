import type { ContentSection } from "../types";

/**
 * Le détail de chaque carte, rédigé d'après le moteur : `passive-rules.ts`
 * (effets de règle), `game-effects.ts`, `turn-actions.ts`, `draft.ts`,
 * `devil.ts`, `guardian.ts`, `hell-regular.ts`, `gamble.ts`.
 */
export const CARD_SECTIONS: Record<string, ContentSection[]> = {
  // ————— Actifs —————
  "built-like-a-tank": [
    {
      title: "Détail",
      body: [
        "• Corde : tu n'es tiré que de la moitié du chemin le plus court vers la case du lanceur, arrondi à l'entier supérieur (à 1 case près, tu viens quand même).",
        "• Monopoly Man : pas d'échange forcé, bras de fer. Tes tapements comptent 1,2 fois. Toi qui gagnes : personne ne bouge. L'attaquant qui gagne : échange. Égalité : l'attaquant avance d'une case vers toi, tu recules d'une case au plus loin de lui.",
        "• Le bras de fer ne se joue que quand C'EST TOI qu'on vise avec le Monopoly Man.",
        "• Le reste de la vie est normal : tu paies la Boue, tu tournes les roues, tu vas en Enfer comme tout le monde.",
      ],
    },
  ],
  "new-cup-new-me": [
    {
      title: "Détail",
      body: [
        "• À CHAQUE nouvelle Red Cup, AVANT qu'elle apparaisse : tu choisis de filer au Départ (avec les 200 du bonus) ou de rester où tu es.",
        "• Filer au Départ n'est pas une arrivée : pas de boutique, pas de roue sur la case, et une roue que tu devais encore sur la case quittée s'efface.",
        "• La nouvelle Cup se pose après ton choix; tu peux donc te retrouver juste à côté d'elle.",
        "• En Enfer, la carte ne libère pas (patch 0.2.0) : « aller au Départ » t'est refusé, tu restes purger ta peine.",
        "• À Banquise, si le Départ est gelé, la glace t'emporte.",
      ],
    },
  ],
  "red-light-green-light": [
    {
      title: "Détail",
      body: [
        "• Par cycle de Cup : tes DEUX premières cases vertes touchées en marchant paient +100 chacun, tes deux premières rouges coûtent −50 chacun.",
        "• Le compteur se remet à zéro à chaque nouvelle Cup.",
        "• Toutes les cases du chemin comptent, pas seulement l'arrivée : saut de Botte (2 cases), glissade de Banquise, « Avance d'une case » de la roue du bonheur.",
        "• Une téléportation ou un remplacement (Corde, Calme-toi) ne traverse rien : rien à payer, rien à gagner.",
      ],
    },
  ],
  "no-thanks": [
    {
      title: "Détail",
      body: [
        "• Une fois tous les 5 tours de table, tu peux annuler : un objet utilisé CONTRE toi, une roue qui vient de s'arrêter POUR toi, ou la charge imminente de Bullet Bill.",
        "• L'objet annulé est quand même consommé chez son lanceur (et l'énergie dépensée aussi).",
        "• Contre Draven : toi seul es épargné, le reste de la table y va quand même.",
        "• Ne s'annulent pas : les déplacements subis (Corde, échange, Made In Heaven…), la Tomate, les pièges déjà posés (Boue, Barrière, Portails).",
        "• Sur une roue : l'annulation se déclare APRÈS avoir vu le résultat — tu sais ce que tu effaces.",
        "• Sur un couple de roues (Touché angélique, Main du diable) : seul le résultat en cours est annulé, la seconde roue s'appliquera.",
        "• Le délai se compte en tours de table, pas en tours joués : tu peux enchaîner les utilisations une fois rechargé.",
      ],
    },
  ],
  corrupter: [
    {
      title: "Détail",
      body: [
        "• Un déplacement contre une flèche, un tunnel ou le sens du carrousel : 400 pièces, payées seulement quand la destination l'exige vraiment.",
        "• Au premier tour, impossible de sortir du Départ à contresens.",
        "• Sans les 400 pièces, l'option reste verrouillée.",
        "• Ne lève PAS les Barrières, et ne rend jamais l'Enfer atteignable à pied.",
        "• Le paiement du Corrupteur n'est jamais mis en jeu par Double or nothing.",
      ],
    },
  ],
  goblin: [
    {
      title: "Détail",
      body: [
        "• À chaque nouvelle Red Cup apparue : −150 pièces pour CHACUN des autres joueurs, +150 pour toi à chaque vol.",
        "• Deux Goblins à table ? Les deux passent, dans l'ordre des sièges — et se volent mutuellement.",
        "• Ces pièces sont des gains/pertes comme les autres : Double or nothing peut les miser, un Casque peut absorber la chute sous zéro.",
        "• Un joueur qui part à −300 sur un vol de Goblin tombe K.O. comme d'habitude.",
      ],
    },
  ],
  "i-take-notes": [
    {
      title: "Détail",
      body: [
        "• Chaque fois qu'un objet À CIBLE JOUEUR (Ndoye, Hollow Purple, Corde, Middle Finger, Monopoly Man, Tomate) est utilisé contre toi par UN AUTRE : 1 chance sur 3 d'en garder une copie.",
        "• Ndoye : la copie se joue APRÈS la résolution de la roue. Tomate : une chance par Tomate reçue (une volée de 5 peut donc te laisser jusqu'à 5 piles de copies, dans tes limites de sac).",
        "• Un objet que tu te lances À TOI-MÊME ne se copie pas (sinon Ndoye sur soi gratis à chaque tour).",
        "• Les limites passent avant la copie : jamais une 3ᵉ copie, une 2ᵈ Gomme, une 6ᵉ Tomate. Et si ton sac est plein d'autres choses, on te force à en jeter une pour faire place.",
        "• Les objets des boutiques exclusives (diable, Bouclier, Made In Heaven) ne ciblent jamais un joueur : rien à noter de ce côté-là.",
      ],
    },
  ],
  "calm-down": [
    {
      title: "Détail",
      body: [
        "• À chaque nouvelle Red Cup : chaque AUTRE joueur à 1 ou 2 cases de la Cup, plus proche d'elle que toi, peut être posé exactement à 3 cases de la Cup — sur la case de ton choix.",
        "• Un seul joueur déplacé par cycle; la liste se décide un par un, « ou laisse tomber » pour tous.",
        "• Le remplacement déclenche RIEN sur la case : pas de roue, pas de boutique, pas de Boue, pas de Cup — et une roue due ailleurs par ce joueur s'efface.",
        "• Jamais remplacé sur la glace de Banquise (personne n'y stationne).",
        "• Jamais sur toi-même, jamais sur un joueur déjà à 3 ou plus.",
      ],
    },
  ],
  lambda: [
    {
      title: "Détail",
      body: [
        "• Rien. Aucune règle spéciale, la carte de remplissage.",
        "• Distribuée comme actif quand un slot n'a plus de vraie carte (tables pleines) ou quand l'Ange-Gardien n'a personne à protéger.",
        "• Un joueur exclu avec l'Ange-Gardien revient en Lambda : les rôles ne se redonnent jamais en cours de partie.",
      ],
    },
  ],
  "nepo-baby": [
    {
      title: "Détail",
      body: [
        "• +1 000 pièces au départ (3 000 quand l'autre carte est neutre, contre 2 000 pour tout le monde).",
        "• Jamais distribué au même joueur que Cupide.",
        "• Avec eShop les départs se corrigent : 2 000 + 1 000 − 1 000 = 2 000.",
      ],
    },
  ],
  "red-bull": [
    {
      title: "Détail",
      body: [
        "• 4 points d'énergie par tour au lieu de 3.",
        "• Cumulable avec le +1 de Dernier de la classe : 5 dans les bons jours.",
        "• Le déplacement prend toujours TOUT ce qui reste : le surplus se dépense en objets avant de marcher.",
      ],
    },
  ],
  eshop: [
    {
      title: "Détail",
      body: [
        "• Après CHAQUE déplacement, la boutique s'ouvre, n'importe où tu t'arrêtes — case neutre, rouge, verte, peu importe.",
        "• Jamais en Enfer, et Doomsday la ferme comme les autres boutiques.",
        "• 1 000 pièces au départ au lieu de 2 000 : le commerce se finance à crédit.",
        "• Une case bleue classique t'ouvre la boutique normalement aussi (l'un n'empêche pas l'autre).",
      ],
    },
  ],
  "tomato-enjoyer": [
    {
      title: "Détail",
      body: [
        "• Chaque place du sac peut tenir une pile de 5 Tomates : 4 places = jusqu'à 20 projectiles en poche.",
        "• Toi seul peux lancer PLUSIEURS piles dans le même tour.",
        "• Tes Tomates assomment à 5 % par tomate (2 % pour les autres).",
        "• Chaque Tomate que TU reçois te rapporte 5 pièces : te faire arroser te paie.",
        "• Les limites habituelles tiennent : une pile par emplacement, jamais de 6ᵉ tomate dans une pile.",
      ],
    },
  ],
  roller: [
    {
      title: "Détail",
      body: [
        "• Au début de ton tour de marche : dé à 6 faces, puis parcours EXACTEMENT ce nombre de cases, sans jamais repasser par une case déjà foulée pendant le trajet (la case de départ comprise).",
        "• Pas de chemin aussi long ? Les plus longs possibles sont proposés à la place.",
        "• Pas de Botte pour toi : ni en achat, ni en usage — le dé te suffit.",
        "• Une fois le dé lancé, plus d'objets : il ne reste que marcher.",
        "• En Enfer, le dé reste dans la poche : la roue remplace la marche.",
        "• Les cases traversées comptent pour Red light, Green light.",
      ],
    },
  ],
  greedy: [
    {
      title: "Détail",
      body: [
        "• Victoire propre : dès qu'il atteint 6 000 pièces, le compte est bon, Cups ou pas Cups, au tour de qui que ce soit.",
        "• Une Red Cup lui rapporte 1 000 pièces au lieu d'occuper une place de sac (une nouvelle Cup apparaît comme d'habitude).",
        "• Marcher sur un joueur ASSOMMÉ lui vole 50 pièces (à chaque assommé de la case) — l'assommement court jusqu'à ce que la victime puisse rejouer (patch 0.2.0).",
        "• Sa Boue coûte 100; qui tombe dedans lui paie 200.",
        "• Les pièces que son Ndoye fait perdre à la cible finissent dans sa poche — jamais s'il se vise lui-même.",
        "• Hors du jeu des Cups : il compte dans le sac mais n'en garde aucune, et reste hors de la comparaison pour Dernier de la classe.",
      ],
    },
  ],
  "double-or-nothing": [
    {
      title: "Détail",
      body: [
        "• Chaque changement de pièces qui le concerne (gain comme perte) est mis en file, puis proposé UNE PAR UNE quand la table revient au repos : 50/50, la somme est doublée… ou annulée.",
        "• Ne se mettent JAMAIS en jeu : les achats, les reventes du Brocanteur, le paiement du Corrupteur, l'amende quand le Voleur se fait prendre, et le résultat du 50/50 lui-même.",
        "• Boue subie : la récompense versée au poseur est LIÉE à ton 50/50 — doublée avec toi ou annulée avec toi.",
        "• Un passage sous −300 en jeu est SUSPENDU : annulé, tu rejoues normalement; le K.O. n'attend que ça. Une partie qui se finit pendant l'attente solde le K.O. de toute façon.",
        "• Un tour peut empiler plusieurs mises (roue + vol de Goblin + Boue) : chacune se joue séparément.",
        "• Le résultat est annoncé à toute la table.",
      ],
    },
  ],
  "blind-luck": [
    {
      title: "Détail",
      body: [
        "• Ne vois JAMAIS où est la Red Cup : elle est masquée à son écran.",
        "• Aucun objet ne peut lui nuire : jamais cible d'un objet, épargné par Draven, Bullet Bill, Sentence, Portails et Doomsday; la Boue le fait simplement reculer d'une case sans rien lui coûter.",
        "• Lui seul peut acheter et utiliser Made In Heaven.",
        "• On ne peut pas le tirer en duel depuis l'Enfer (roue de l'Enfer « Duel »).",
        "• Ses propres objets marchent normalement : c'est ce qui tombe SUR lui qui rebondit.",
        "• Une Barrière posée sur sa route le bloque comme tout le monde (ce n'est pas un objet).",
      ],
    },
  ],
  devil: [
    {
      title: "Détail",
      body: [
        "• Son identité est ANNONCÉE à toute la table dès que les cartes sont prises (fin de draft, ou départ sans draft).",
        "• Victoire propre : quand les autres ont cumulé ⌊4 × N − N/2⌋ passages en Enfer (N = joueurs de départ; 2 → 7, 4 → 14, 8 → 28). Comptent : chaque ENTRÉE d'un autre en Enfer (+1 point) et chaque tour commencé là-bas (+1 point), tour sauté compris — mais ses propres tours ne comptent pas.",
        "• Pas de Red Cup pour lui : il marche dessus comme sur une case neutre.",
        "• Sa propre descente en Enfer le paie +100 pièces; celle d'un autre : +50 pièces et +1 point.",
        "• Il sort de l'Enfer quand il veut pour 1 point d'énergie : retour au Départ, sans bonus, et son tour continue.",
        "• Sa boutique (onglet violet sur les cases bleues) vend ses 5 objets : Portails, Toucher d'Enfer, Black Cup, Sentence, Doomsday — et il est seul à pouvoir les acheter.",
        "• Jamais deux fois le même objet dans son sac : tout est en un seul exemplaire (la pile de Tomates reste une pile).",
        "• Hors du classement des Cups pour Dernier de la classe.",
      ],
    },
  ],
  "guardian-angel": [
    {
      title: "Détail",
      body: [
        "• Seulement à 4 joueurs et plus. Le protégé est tiré au début et ANNONCÉ à toute la table — jamais un joueur portant le Diable, le Voleur, le Goblin ou le Corrupteur. S'il n'y a personne à protéger, l'ange devient Lambda.",
        "• Ils gagnent ENSEMBLE : le protégé lève les 3 Cups, l'ange est co-vainqueur avec lui.",
        "• Départ à 800 pièces, sac de 2 places seulement.",
        "• Ni Cup, ni Enfer pour l'ange : toute descente en Enfer lui coûte UN tour (un Réveil peut l'annuler).",
        "• Il ne peut acheter ni utiliser les 11 objets nuisibles : Ndoye, Hollow Purple, Boue, Tomate, Bullet Bill, Middle Finger, Draven, Casque, Parachute, Barrière, Miroir. Un objet pareil gagné sur une roue reste planqué dans le sac, inutilisable.",
        "• Il ne peut viser QUE son protégé : Corde pour l'attirer sur sa case (le sort d'après, c'est le diable), Monopoly Man pour échanger avec lui — les deux pour le sortir d'un mauvais pas, jamais l'inverse en pratique.",
        "• Le Bouclier (objet exclusif, automatique) bloque un objet visant le protégé ou la charge de Bullet Bill sur lui.",
        "• Au secours : sur son tour, si le protégé est en Enfer, l'ange peut le tirer sur SA case (sans effet de case) — contre ses 2 prochains tours, et son tour s'arrête là.",
        "• L'ange qui abandonne libère le protégé; le protégé qui abandonne fait reprendre à l'ange sa place, ses cartes, son sac, son argent — en redémarrant depuis l'Enfer.",
        "• Sa roue du malheur à lui n'a que deux secteurs : « Passe ton prochain tour » ou « Rien du tout ».",
      ],
    },
  ],
  // ————— Passifs —————
  "last-in-class": [
    {
      title: "Détail",
      body: [
        "• Tant qu'il a STRICTEMENT moins de Red Cups que chaque autre joueur qui peut en ramasser (Diable, Ange et Cupide sont hors course) :",
        "• +1 point d'énergie par tour.",
        "• −10 % sur chaque prix de boutique, arrondi aux 10 pièces supérieures (le prix monté de la Botte inclus).",
        "• Au premier rang comme à égalité : plus rien ne s'applique.",
      ],
    },
  ],
  "hell-regular": [
    {
      title: "Détail",
      body: [
        "• +150 pièces à chaque descente en Enfer, quelle que soit la porte d'entrée (un Parachute qui l'évite l'Enfer ne paie rien).",
        "• Il sort au bout de 3 tours au lieu de 5 — toujours contre le péage de 500.",
      ],
    },
  ],
  "green-hand": [
    {
      title: "Détail",
      body: [
        "• Sur la roue du BONHEUR : deux secteurs tirés, il garde le meilleur (chaque résultat a une valeur cachée de 1 à 9; à égalité, le premier).",
        "• Sur les autres roues : rien.",
        "• C'est un choix, pas un couple : un seul résultat s'applique (contrairement à Touché angélique).",
      ],
    },
  ],
  "red-hand": [
    {
      title: "Détail",
      body: [
        "• Sur la roue du MALHEUR : deux secteurs tirés, il garde le moins mauvais.",
        "• La roue de l'Enfer n'est pas « du malheur » au sens de cette carte : son tirage reste simple (c'est Main du diable qui s'en occupe).",
        "• Les roues enchaînées (« Tourne la roue du malheur » depuis le bonheur) profitent du choix aussi.",
      ],
    },
  ],
  "angelic-touch": [
    {
      title: "Détail",
      body: [
        "• Roue du bonheur, et roue du malheur VERSION ANGE : deux roues tournent, les DEUX résultats s'appliquent, bons ou mauvais.",
        "• Le second attend que la table revienne au repos : un duel, une boutique ou un « Avance d'une case » ouvert par le premier résultat passe avant.",
        "• Gomme et Non merci n'effacent que le résultat en cours : la roue jumelle suivra.",
        "• Compatible Main verte : les deux roues se comparent d'abord, la meilleure est gardée, la jumelle suit.",
      ],
    },
  ],
  "devils-hand": [
    {
      title: "Détail",
      body: [
        "• Roue du malheur ET roue de l'Enfer : deux tirages, les deux résultats s'appliquent, bons ou mauvais.",
        "• Le second s'applique dès la table au repos, dans la foulée.",
        "• « Direction l'Enfer » en premier ? Le second résultat se joue depuis l'Enfer (et une roue de l'Enfer qui s'enchaîne, etc.).",
        "• Gomme et Non merci n'effacent que le résultat en cours.",
      ],
    },
  ],
  "game-master": [
    {
      title: "Détail",
      body: [
        "• Dans tout duel où il participe (deux en Enfer, défi de la roue de l'Enfer, rencontre avec le fantôme) : deux mini-jeux sont tirés au sort et C'EST LUI qui choisit lequel se joue.",
        "• Les duels des autres gardent leur tirage unique.",
        "• Le vote de la table n'est proposé que s'il reste quelqu'un pour voter (3+ joueurs).",
      ],
    },
  ],
  "junk-dealer": [
    {
      title: "Détail",
      body: [
        "• Un onglet « Revente » s'ajoute à la boutique : il vend UN objet de son sac à 60 % de son prix, arrondi aux 5 pièces (la Botte se revend à son prix courant).",
        "• Jamais une Red Cup à la revente.",
        "• La vente est un choix, jamais un 50/50 de Double or nothing.",
        "• Les limites d'exemplaires du diable s'appliquent aussi : racheter l'objet vendu plus tard se heurte aux mêmes règles.",
      ],
    },
  ],
  trapper: [
    {
      title: "Détail",
      body: [
        "• Sa Boue coûte 100 pièces au lieu de 200.",
        "• Mais UNE seule de ses Boues attend sa victime à la fois : la première levée, il peut reposer.",
        "• Elle rapporte toujours 100 (les 200 de récompense, c'est Cupide).",
      ],
    },
  ],
  thief: [
    {
      title: "Détail",
      body: [
        "• Une tentative de vol par VISITE de boutique : un objet de l'étal, gratuitement s'il passe au travers.",
        "• Risque : 1 % par tranche de 10 pièces du prix — un objet à 600 = 60 %, la Made In Heaven (1 300) = coup sûr.",
        "• Pris : direction l'Enfer (fin du tour), et amende de 1,5 × le prix — ses objets partent d'abord (les plus chers en premier), ses pièces paient le reste.",
        "• L'amende n'est jamais mise en jeu par Double or nothing.",
        "• Un objet qu'il ne peut même pas acheter ne peut pas être volé.",
        "• Il est « criminel » : jamais choisi comme protégé par un Ange-Gardien.",
      ],
    },
  ],
};
