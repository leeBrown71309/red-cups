import {
  BASE_ENERGY,
  GREEDY_GOAL,
  HERMIT_DISTANCE,
  HERMIT_ENERGY_BONUS,
  HERMIT_START_BONUS,
  INSURER_HELL_REWARD,
  INSURER_RATE,
  INSURER_ROUND_CAP,
  MAGE_LUCK_RETURN_ROUNDS,
  MAGE_MAX_LUCK,
  MARK_HELL_CHANCE,
  MARK_MUD_HELL_CHANCE,
  MIME_COOLDOWN_ROUNDS,
  MIST_CUP_DISTANCE,
  MIST_CYCLE_TURNS,
  MOLE_COOLDOWN_ROUNDS,
  MOLE_DIG_ENERGY,
  MOLE_OWN_CROSSING_ENERGY,
  SISTER_SWAP_COOLDOWN_ROUNDS,
  SISTER_SWAP_ENERGY,
} from "../../game/types";
import { formatCoins, percent } from "../format";
import type { ContentSection } from "../types";

/**
 * Le détail de chaque Cups Power (le code dit « actif ») et de chaque passif, rédigé d'après le moteur :
 * `passive-rules.ts` (effets de règle), `game-effects.ts`, `turn-actions.ts`, `draft.ts`, `devil.ts`,
 * `guardian.ts`, `hell-regular.ts`, `gamble.ts` et, pour le patch 0.2.3, `mime.ts`, `mole.ts`, `black-mage.ts`,
 * `mist.ts`, `sister.ts`, `hermit.ts`, `insurer.ts`. Les nombres du patch 0.2.3 viennent des constantes de
 * `types.ts` : ils se mettent à jour avec le moteur.
 */
export const CARD_SECTIONS: Record<string, ContentSection[]> = {
  // ————— Cups Power —————
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
        "• En Enfer, le passif ne libère pas (patch 0.2.0) : « aller au Départ » t'est refusé, tu restes purger ta peine.",
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
        "• Sur un couple de roues (Touché angélique, Touché funeste) : seul le résultat en cours est annulé, la seconde roue s'appliquera.",
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
        "• Un joueur invisible ([[card:half-seen|Mi-vu, Mi-vue]]) n'est jamais proposé, et un détenteur invisible ne replace personne.",
      ],
    },
  ],
  lambda: [
    {
      title: "Détail",
      body: [
        "• Rien. Aucune règle spéciale : c'est le Cups Power de remplissage.",
        "• Donnée à la place d'un Cups Power quand un joueur n'en a pas de vrai (tables pleines) ou quand l'Ange-Gardien n'a personne à protéger.",
        "• Un joueur exclu avec l'Ange-Gardien revient en Lambda : les rôles ne se redonnent jamais en cours de partie.",
      ],
    },
  ],
  "nepo-baby": [
    {
      title: "Détail",
      body: [
        "• +1 000 pièces au départ (3 000 quand ton Cups Power est neutre, contre 2 000 pour tout le monde).",
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
        "• La Red Cup se MÉRITE : en arrivant dessus, il faut un 6 au dé pour la ramasser, avec deux essais. Les lancers sont montrés à TOUTE la table, puis annoncés sur la bannière.",
        "• Deux ratés : la Red Cup reste là et le Roller aussi. À son prochain tour on ne lui demande pas de bouger : il peut utiliser ses objets, puis retente ses deux essais (le dé vise la Cup, pas une marche). Le tour se termine ensuite dans tous les cas.",
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
        "• Aucun objet ne peut lui nuire : jamais cible d'un objet, épargné par Draven, Bullet Bill, Sentence, Portails et Doomsday; la Boue le fait simplement reculer d'une case sans rien lui coûter (il pose d'abord le pied dessus, glisse, et la Boue ne disparaît qu'après).",
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
        "• Son identité n'est PAS annoncée : c'est un Cups Power comme les autres (ni bannière, ni toast, ni ligne de journal).",
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
        "• Seulement à 4 joueurs et plus. Le protégé est tiré au début et ANNONCÉ à toute la table — jamais un joueur portant le Diable, le Voleur, le Goblin, le Corrupteur ou le Mage noir. S'il n'y a personne à protéger, l'ange devient Lambda.",
        "• Ils gagnent ENSEMBLE : le protégé lève les 3 Cups, l'ange est co-vainqueur avec lui.",
        "• Départ à 800 pièces, sac de 2 places seulement.",
        "• Ni Cup, ni Enfer pour l'ange : toute descente en Enfer lui coûte UN tour (un Réveil peut l'annuler).",
        "• Il ne peut acheter ni utiliser les 11 objets nuisibles : Ndoye, Hollow Purple, Boue, Tomate, Bullet Bill, Middle Finger, Draven, Casque, Parachute, Barrière, Miroir. Un objet pareil gagné sur une roue reste planqué dans le sac, inutilisable.",
        "• Il ne peut viser QUE son protégé : Corde pour l'attirer sur sa case (le sort d'après, c'est le diable), Monopoly Man pour échanger avec lui — les deux pour le sortir d'un mauvais pas, jamais l'inverse en pratique.",
        "• Le Bouclier (objet exclusif, automatique) bloque un objet visant le protégé ou la charge de Bullet Bill sur lui.",
        "• Au secours : sur son tour, si le protégé est en Enfer, l'ange peut le tirer sur SA case (sans effet de case) — contre ses 2 prochains tours, et son tour s'arrête là.",
        "• L'ange qui abandonne libère le protégé; le protégé qui abandonne fait reprendre à l'ange sa place, son Cups Power et son passif, son sac, son argent — en redémarrant depuis l'Enfer.",
        "• Sa roue du malheur à lui n'a que deux secteurs : « Passe ton prochain tour » ou « Rien du tout ».",
      ],
    },
  ],
  // ————— Cups Power du patch 0.2.3 —————
  mime: [
    {
      title: "Détail",
      body: [
        `• Une copie tous les ${MIME_COOLDOWN_ROUNDS} tours de table (copie au tour 1, prête à nouveau au tour ${1 + MIME_COOLDOWN_ROUNDS}), AVANT de te déplacer : tu désignes un joueur et tu choisis SON Cups Power ou SON passif : tu le tiens jusqu'à la fin de ton tour (un seul des deux par copie).`,
        "• La copie est entière, avantages ET défauts : l'immunité de [[card:blind-luck|Chance aveugle]] (et sa Red Cup invisible à l'écran), la Red Cup à 1 000 pièces de [[card:greedy|Cupide]] (et plus de place de sac pour elle), le point d'énergie de [[card:red-bull|Red Bull]] (versé aussitôt), la boutique partout d'[[card:eshop|eShop]], le dé du [[card:roller|Roller]], les piles de [[card:tomato-enjoyer|Tomato Enjoyer]], le 50/50 de [[card:double-or-nothing|Double or nothing]], les tunnels de la [[card:mole|Taupe]].",
        "• Copier ne coûte aucune énergie et n'est pas une action du tour : seule, une copie ne te permet pas de finir ton tour sur place (et, en ligne, un tour où tu n'as fait que copier compte comme un tour sans jouer).",
        "• La copie tombe à la fin de ton tour, quoi qu'il arrive : jamais gardée d'un tour à l'autre.",
        "• Un Cups Power copié reste TON secret : la table lit « X copie le Cups Power de Y jusqu'à la fin de son tour », sans savoir lequel (en ligne, comme le contenu d'un sac). Un passif, lui, est public : le journal dit lequel tu as copié.",
      ],
    },
    {
      title: "Qui peut être copié",
      body: [
        "• Refusés : [[card:devil|le diable]] et [[card:guardian-angel|L'Ange-Gardien]] (des rôles posés au départ, avec leur victoire, leur boutique ou leur protégé), [[card:black-mage|Mage noir]], [[card:ghost-sister|Sœur Fantôme]] et [[card:half-seen|Mi-vu, Mi-vue]] (des états qui vivent d'un tour à l'autre chez leur titulaire), [[card:lambda|Lambda]] (rien à copier) et un autre Mime.",
        "• Passifs refusés : [[card:no-thanks|Non merci]] (son délai appartient à son titulaire), [[card:hermit|L'Ermite]] et [[card:insurer|L'Assureur]] (leur prime et leurs gains se gardent d'un tour à l'autre), et [[card:hell-regular|L'Habitué de l'Enfer]] (il fixe la durée de la peine en cours). Un joueur sans passif n'en offre pas.",
        "• Ta liste ne propose que les joueurs copiables, et pour chacun ce qui peut l'être : celui qui n'y figure pas ne tient que des cartes refusées — ou est invisible.",
        "• Un joueur invisible ([[card:half-seen|Mi-vu, Mi-vue]]) ne se copie pas, et un Mime invisible ne copie personne.",
        "• Il faut être à son tour, avant tout déplacement : ni dé lancé par le [[card:roller|Roller]], ni [[item:boot|Botte]] chaussée, et une seule copie à la fois. C'est aussi possible depuis l'Enfer, avant la roue.",
      ],
    },
    {
      title: "Cas limites",
      body: [
        `• Taupe copiée : tu creuses avec TON compteur de ${MOLE_COOLDOWN_ROUNDS} tours et TES cases visitées (le Mime les note dès le début de la partie, comme une Taupe) ; le tunnel est à toi (traversée à ${MOLE_OWN_CROSSING_ENERGY} énergie).`,
        `• Cupide copié : sa victoire à ${formatCoins(GREEDY_GOAL)} pièces se vérifie après chaque action, copie comprise — un Mime qui a déjà ces pièces gagne dès qu'il le copie.`,
        "• Roller copié : le dé se lance avant de bouger, plus d'objet ensuite, la Red Cup se mérite par un 6, et la Botte est interdite (chaussée comme achetée) jusqu'à la fin du tour.",
        "• Red Bull copié : le point d'énergie est versé tout de suite, la jauge de ce tour passe à 4.",
      ],
    },
  ],
  mole: [
    {
      title: "Creuser",
      body: [
        `• Une fois tous les ${MOLE_COOLDOWN_ROUNDS} tours de table, pour ${MOLE_DIG_ENERGY} points d'énergie, avant de te déplacer (ni dé lancé, ni Botte chaussée) : tu creuses un tunnel de ta case vers une case DÉJÀ VISITÉE et tu t'y déplaces aussitôt.`,
        "• Case visitée = une case où tu t'es arrêté OU que tu as traversée (Botte, glissade de Banquise, long parcours du Roller), le Départ compris. L'Enfer n'en est jamais une.",
        "• Creuser EST ton déplacement du tour : il prend toute l'énergie qui reste (le surplus est perdu). L'arrivée est une arrivée comme une autre : Boue, Portail, Red Cup, roue de la case, boutique, glace.",
        "• Pas de bonus du Départ en arrivant par un tunnel, même vers le Départ par sa flèche. Seule la case d'arrivée compte pour [[card:red-light-green-light|Red light, Green light]] : une case de tunnel n'est pas « traversée ».",
        `• Le compteur court à partir du tour où tu creuses : creuser au tour 2, c'est être prêt au tour ${2 + MOLE_COOLDOWN_ROUNDS}.`,
      ],
    },
    {
      title: "Le tunnel",
      body: [
        "• Visible de tous, ouvert dans les deux sens. Le creuser est sa première utilisation : il se referme après UNE traversée de plus, faite par n'importe qui.",
        `• Traverser : tout joueur debout sur une extrémité (jamais en Enfer), avant son déplacement, avec au moins ${MOLE_DIG_ENERGY} points d'énergie — ${MOLE_OWN_CROSSING_ENERGY} pour celui qui l'a creusé. Traverser est un déplacement : toute l'énergie part avec, et l'arrivée est complète.`,
        "• Un tunnel n'est pas une route : une [[item:barrier|Barrière]], une flèche ou un sens unique ne le concernent pas, le [[card:corrupter|Corrupteur]] n'a rien à payer, et [[item:bullet-bill|Bullet Bill]], [[card:calm-down|Calme-toi]], [[card:hermit|L'Ermite]] et la [[card:ghost-sister|Sœur Fantôme]] l'ignorent.",
        "• Interdit de creuser depuis ou vers : l'Enfer, une case de glace, la case de la Red Cup, une case piégée ([[item:mud|Boue]], Portail du [[card:devil|diable]]) ou qui porte déjà un tunnel.",
        "• Un piège ou une Red Cup qui apparaît après coup sur une extrémité se déclenche à l'arrivée de qui traverse. Si le blizzard de [[map:banquise|Banquise]] gèle une extrémité, la glace emporte à son tour qui y arrive.",
      ],
    },
  ],
  "black-mage": [
    {
      title: "Détail",
      body: [
        `• Commence avec ${MAGE_MAX_LUCK} pentagrammes en réserve, jamais plus. Un pentagramme revient tous les ${MAGE_LUCK_RETURN_ROUNDS} tours de table : l'horloge démarre au premier dépensé et court tant qu'il lui en manque.`,
        "• Poser le pentagramme : sur sa case, pendant son tour (avant ou après son déplacement), sans énergie. Un seul à la fois, jamais sur une case de Boue ni en Enfer. Visible de tous.",
        "• Poser ou se téléporter compte comme avoir joué : le Mage peut finir son tour sans marcher.",
        "• Se téléporter sur le pentagramme coûte 1 pentagramme de la réserve et ignore routes, Barrières et flèches.",
      ],
    },
    {
      title: "Les téléportations",
      body: [
        "• À son tour, avant de bouger — même depuis l'Enfer, dont il sort (sans bonus ni péage). Aucune énergie : le tour continue, il peut encore se déplacer. Impossible s'il se tient déjà sur la marque.",
        "• Contre un objet : quand un objet à cible joueur ([[item:ndoye|Ndoye]], [[item:hollow-purple|Hollow Purple]], [[item:rope|Corde]], [[item:middle-finger|Middle Finger]], [[item:monopoly-man|Monopoly Man]]) le vise, il peut se téléporter : l'objet est annulé (consommé, énergie perdue) et le tour du lanceur continue. Contre [[item:draven|Draven]], il est seul épargné. Aucune réaction contre une Tomate.",
        "• Contre [[item:bullet-bill|Bullet Bill]] : quand la fusée va le toucher, il quitte sa case avant l'impact et arrive sur la marque comme sur toute case, puis Bullet Bill charge alors le joueur le plus proche.",
        "• À la place d'une roue qui le déplace : « Direction l'Enfer », « Retourne d'où tu viens », « Avance d'une case » ou « Va au Départ ». La roue est écartée comme par la Gomme ; la seconde roue d'un Touché (angélique ou funeste) s'appliquera ensuite.",
      ],
    },
    {
      title: "À l'arrivée",
      body: [
        "• C'est une arrivée comme une autre : roue de la case, Boue, Portail, Red Cup ramassée, glace de [[map:banquise|Banquise]] qui l'emporte si la case a gelé. Rester sur place n'est pas une arrivée.",
        `• Chaque AUTRE joueur sur la marque a ${percent(MARK_HELL_CHANCE)} de tomber en Enfer, tiré à part pour chacun. Une Boue posée sur la marque coûte au Mage ce qu'elle coûte à tout le monde et le fait tomber en Enfer avec ${percent(MARK_MUD_HELL_CHANCE)} de chances (elle disparaît).`,
        "• La marque disparaît après usage — sauf si elle a envoyé quelqu'un en Enfer : elle reste alors, prête à resservir. Le Mage tombé par sa propre Boue ne la garde pas.",
      ],
    },
    {
      title: "Élimination",
      body: [
        "• À 0 pentagramme, le Mage ne peut plus se téléporter (ni en tour, ni contre un objet ou Bullet Bill, ni à la place d'une roue), mais il continue de jouer normalement : ce n'est pas une défaite. Un pentagramme revient tous les 15 tours de table.",
        "• S'il ne reste alors qu'un joueur, celui-ci gagne par abandon.",
      ],
    },
  ],
  "half-seen": [
    {
      title: "Détail",
      body: [
        `• Cycle de ${MIST_CYCLE_TURNS} tours du joueur : visible, invisible, invisible, puis de nouveau visible. Il est visible avant son premier tour. Le cycle avance au début de chacun de ses tours, joué ou sauté ; l'invisibilité court d'un début de tour à l'autre, donc aussi pendant les tours des autres.`,
        "• La table est prévenue : « X devient invisible pour deux tours » et « X redevient visible » s'écrivent dans le journal, pour tout le monde.",
        `• À ${MIST_CUP_DISTANCE} case ou moins de la Red Cup (sur sa case ou une voisine, routes dans les deux sens, Barrières ignorées), il est visible quoi qu'il arrive. Ce n'est jamais stocké : c'est recalculé, et la Cup qui bouge le cache ou le montre.`,
      ],
    },
    {
      title: "Ce que ça change aux règles",
      body: [
        "• Il ne cible personne et personne ne le cible : objets à cible joueur, [[card:calm-down|Calme-toi]], défi de la roue de l'Enfer, copie du [[card:mime|Mime]].",
        "• [[item:draven|Draven]] l'épargne. [[item:bullet-bill|Bullet Bill]] ne le traque plus, mais l'explosion qui éclate sur sa case l'assomme comme les autres (−200 pièces, un tour sauté).",
        "• Ce qui ne vise personne l'atteint quand même : [[item:sentence|Sentence]], [[item:portal|Portails]], [[item:doomsday|Doomsday]], [[item:made-in-heaven|Made In Heaven]], le [[card:goblin|Goblin]], les cases (roues, Boue), les pingouins de [[map:banquise|Banquise]] et le fantôme de [[map:luna-park|Luna Park]].",
        "• Il compte pour [[card:hermit|L'Ermite]] : invisible ne veut pas dire loin.",
      ],
    },
    {
      title: "À l'écran",
      body: [
        "• Invisible, pendant SON tour seulement, il ne voit plus les autres pions, leurs actions (le journal ne garde que son propre tour), leurs sacs, leurs pièces, les pièges, la Red Cup ni Bullet Bill. Son propre pion est dessiné translucide, pour lui seul. Pendant le tour des autres, il suit la partie normalement : seule sa propre vue est coupée quand il joue.",
        "• Les autres ne voient plus son pion, ses actions (le journal garde « Tour de X » et les annonces d'invisibilité), son sac ni ses pièces.",
        "• Le brouillard est visuel : le jeu reste partagé entre les appareils, comme pour la Red Cup de [[card:blind-luck|Chance aveugle]]. Sur un écran partagé, il suit celui qui doit décider.",
      ],
    },
  ],
  "ghost-sister": [
    {
      title: "Détail",
      body: [
        "• Une petite fille fantôme démarre avec toi sur le Départ. À chaque PAS que tu fais, elle fait le pas OPPOSÉ si une route part dans cette direction depuis sa case (haut ↔ bas, gauche ↔ droite, diagonales, à 40° près ; la route la plus proche de l'exact opposé l'emporte) ; sinon elle reste.",
        "• Elle suit les vraies routes : flèches, sens uniques et [[item:barrier|Barrières]] la retiennent comme toi. Une marche de plusieurs pas ([[item:boot|Botte]], [[card:roller|Roller]], glissade de [[map:banquise|Banquise]]) lui donne un pas en miroir par pas.",
        "• Elle ne peut pas être ciblée et n'active rien : ni piège, ni case, ni Red Cup.",
        "• Déplacé par autre chose qu'un pas (téléportation, échange, [[item:rope|Corde]], « Va au Départ », tunnel de la [[card:mole|Taupe]], [[item:made-in-heaven|Made In Heaven]]…), tu la laisses où elle est : elle ne vient pas te chercher.",
        "• Tombé en Enfer, ta sœur retourne au Départ.",
      ],
    },
    {
      title: "Swap",
      body: [
        `• ${SISTER_SWAP_ENERGY} points d'énergie, une fois tous les ${SISTER_SWAP_COOLDOWN_ROUNDS} tours de table (Swap au tour 1, prêt à nouveau au tour ${1 + SISTER_SWAP_COOLDOWN_ROUNDS}), avant ton déplacement (ni dé lancé), hors de l'Enfer, depuis une case autre que la sienne : toi et ta sœur échangez vos places. Avec une jauge de ${BASE_ENERGY}, le Swap prend toute la marche : il ne te reste qu'à finir ton tour ; avec la Botte chaussée, il faut garder 1 point pour le déplacement.`,
        "• Elle emporte avec elle, sur la case que tu quittes, TOUT ce qui était sur la sienne : [[item:mud|Boue]], Portails du [[card:devil|diable]], [[system:cups|Red Cup]], [[item:bullet-bill|Bullet Bill]] — jamais les joueurs.",
        "• Rien ne se déclenche : ni ce qui est déposé sur ta case (pas de ramassage de la Cup, pas de coup de Bullet Bill, pas de Boue), ni ton arrivée sur la sienne (les pièges et la Cup n'y sont plus, et la case ne donne ni roue ni boutique). Ce que le plateau règle tout seul — le fantôme de Luna Park, la glace de Banquise — suit son cours.",
      ],
    },
    {
      title: "À savoir",
      body: [
        "• Le miroir se lit sur les coordonnées du plan : sur le plateau classique, petit et très fléché, elle reste souvent sur place.",
        "• Un pas à contresens payé par le [[card:corrupter|Corrupteur]] est reflété en miroir comme les autres, mais elle, elle respecte les flèches de sa propre case.",
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
        "• La roue de l'Enfer n'est pas « du malheur » au sens de ce passif : son tirage reste simple (c'est Touché funeste qui s'en occupe).",
        "• Les roues enchaînées (« Tourne la roue du malheur » depuis le bonheur) profitent du choix aussi.",
      ],
    },
  ],
  "angelic-touch": [
    {
      title: "Détail",
      body: [
        "• Roue du bonheur : deux roues tournent, les DEUX résultats s'appliquent, bons ou mauvais.",
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
  // ————— Passifs du patch 0.2.3 —————
  hermit: [
    {
      title: "Détail",
      body: [
        `• Tant qu'aucun autre joueur n'est à ${HERMIT_DISTANCE} cases ou moins de toi : +${HERMIT_ENERGY_BONUS} point d'énergie à l'ouverture de ton tour, et +${HERMIT_START_BONUS} pièces chaque fois que tu touches le bonus du Départ.`,
        "• La distance se compte en routes, dans les deux sens, flèches et Barrières ignorées, comme pour Bullet Bill ; un tunnel de la [[card:mole|Taupe]] ne rapproche personne. Un joueur invisible ([[card:half-seen|Mi-vu, Mi-vue]]) compte. Un joueur en Enfer n'est près de personne — sauf de qui y est aussi.",
        "• L'énergie se règle UNE fois, à l'ouverture de ton tour : quelqu'un qui s'approche ensuite ne te la reprend pas. Le bonus de 100 se règle au moment où le Départ paie, depuis le Départ : ce sont donc les joueurs proches du Départ qui comptent. Il vaut pour tous les bonus du Départ : entrée par la flèche, « Va au Départ », sortie d'Enfer, duel gagné, New Cup, New Me.",
      ],
    },
    {
      title: "La prime perdue",
      body: [
        "• Quand un joueur ARRIVE sur ta case — marche, Corde, replacement de Calme-toi, téléportation du Mage noir, tunnel, Made In Heaven… — tu perds la prime jusqu'à la fin de ton prochain tour (ce tour-ci s'il te reste à jouer dans le tour de table, le suivant sinon).",
        "• Seul celui qui arrive compte : l'Ermite qui rejoint quelqu'un ne perd rien (la proximité joue, elle, comme d'habitude). Ta propre Corde, qui tire quelqu'un sur ta case, te retire donc la prime.",
        `• Elle est perdue pour l'énergie comme pour le Départ. Avec [[card:red-bull|Red Bull]], un Ermite seul joue à ${BASE_ENERGY + 1 + HERMIT_ENERGY_BONUS} points d'énergie.`,
      ],
    },
  ],
  insurer: [
    {
      title: "Détail",
      body: [
        `• Chaque fois qu'un AUTRE joueur perd des pièces, la banque t'en verse ${percent(INSURER_RATE)} (arrondi à l'inférieur), au plus ${INSURER_ROUND_CAP} pièces par tour de table, tous joueurs confondus. Personne ne paie : l'argent sort de la banque.`,
        "• Comptent les pertes SUBIES : roue du malheur (Ndoye compris) ou de l'Enfer, [[item:mud|Boue]], [[item:bullet-bill|Bullet Bill]], vols du [[card:goblin|Goblin]] et de [[card:greedy|Cupide]], péage de sortie d'Enfer…",
        "• Ne comptent pas : les achats et reventes, le paiement du [[card:corrupter|Corrupteur]], l'amende du [[card:thief|Voleur]] — tout ce que Double or nothing ne peut pas miser non plus — ni le 50/50 de Double or nothing lui-même.",
        `• Chaque autre joueur qui descend en Enfer te rapporte ${INSURER_HELL_REWARD} pièces, en plus et hors plafond ; un [[item:parachute|Parachute]] qui évite la chute ne paie rien, et l'[[card:guardian-angel|Ange-Gardien]], qui n'y va jamais, non plus.`,
        "• Tes propres pertes ne te rapportent rien, et ce que la banque te verse n'est pas misé par Double or nothing : tu empoches tout.",
      ],
    },
    {
      title: "Cas limites",
      body: [
        "• La perte est comptée telle qu'elle est vraiment : un [[item:helmet|Casque]] qui ramène un solde sous zéro à zéro ne laisse compter que ce que le joueur avait ; un joueur qui tombe à −300 compte toute sa chute.",
        "• Le compte se fait AU MOMENT de la perte : si la victime tient [[card:double-or-nothing|Double or nothing]], tu es payé tout de suite, même si son 50/50 annule ensuite la perte (rien ne t'est repris) — et rien de plus si la perte est doublée.",
        `• Le plafond de ${INSURER_ROUND_CAP} se remet à zéro à chaque tour de table (le tour de table, pas le tour de jeu). Les ${INSURER_HELL_REWARD} des descentes en Enfer n'y entrent pas.`,
      ],
    },
  ],
};
