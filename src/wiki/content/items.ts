import type { ContentSection } from "../types";

/**
 * Le détail de chaque objet, fiche par fiche, rédigé d'après le moteur :
 * `src/game/turn-actions.ts` (usage), `game-effects.ts` et `game-actions.ts`
 * (effets), `passive-rules.ts` (limites), `bullet-bill.ts`, `devil.ts`.
 * Les interactions entre éléments vivent dans `interactions.ts`.
 */
export const ITEM_SECTIONS: Record<string, ContentSection[]> = {
  ndoye: [
    {
      title: "Utilisation",
      body: [
        "De ton vivant, à ton tour, avant de bouger : 2 points d'énergie, une cible joueur (toi compris).",
        "L'annonce passe d'abord en réaction : un Non merci prêt ou le Bouclier de l'Ange peuvent l'annuler; un Miroir prêt renvoie l'objet sur toi.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• La roue du malheur tourne pour la cible, pas pour toi.",
        "• Le résultat s'applique à sa case actuelle; la roue est rattachée à l'objet (sourceItemId), donc Je note peut en copier l'effet après résolution.",
        "• « Tourne la roue du bonheur » : la roue enchaîne directement sur l'autre.",
        "• C'est une roue comme les autres : Gomme, Non merci, Mains verte/rouge et Touchés s'y appliquent.",
      ],
    },
  ],
  "hollow-purple": [
    {
      title: "Utilisation",
      body: [
        "3 points d'énergie, 600 pièces, cible un joueur (toi compris), avant de bouger.",
        "Un joueur DÉJÀ en Enfer ne peut pas être visé : l'objet reste dans le sac.",
        "Réaction possible : Non merci ou Bouclier de l'Ange avant que ça parte en Enfer.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• La cible est envoyée en Enfer, comme avec la roue du malheur (voyage normal : le compteur de peine repart à zéro, le Parachute peut s'ouvrir, l'Ange perd un tour à la place).",
        "• Entrer en Enfer déclenche ce qui s'y déclenche : point du diable, 150 pièces de l'Habitué, récompense du Voleur… jamais une roue de case.",
      ],
    },
  ],
  rope: [
    {
      title: "Utilisation",
      body: [
        "2 points d'énergie, cible un autre joueur (jamais toi).",
        "Réaction possible : Non merci, Bouclier, Miroir.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• La cible est posée sur TA case. Personne ne bouge ailleurs, pas de roue pour elle : un tirage de Corde n'est pas une arrivée (ni roue, ni boutique, ni Boue, ni Cup à la clef).",
        "• Si tu es en Enfer, tu la fais donc venir en Enfer — un vrai voyage là-bas pour elle.",
        "• Tirée sur la glace, la glace l'emporte aussitôt.",
      ],
    },
  ],
  boot: [
    {
      title: "Utilisation",
      body: [
        "« Chausser » au début de ton tour de marche : 1 point pris, 1 point gardé pour le déplacement — il faut donc 2 points d'énergie.",
        "La Botte se consomme à chaque saut : un achat, un passage de deux cases. Elle ne sert jamais en Enfer.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• Ton déplacement de ce tour fait exactement deux cases (les deux étapes doivent être légales, flèches comprises).",
        "• Par-dessus une Barrière : si la route juste devant toi est barrée, la Botte te fait sauter directement sur la case derrière — un seul pas, et la Botte est usée par le saut.",
        "• À Banquise, une glissade tirée depuis la seconde case compte normalement.",
      ],
    },
    {
      title: "Prix",
      body: [
        "100 pièces à l'ouverture de la boutique, +50 à chaque nouveau tour de table après le tout premier achat, plafonné à 400. Le prix monte pour tout le monde, acheteur compris.",
      ],
    },
  ],
  mud: [
    {
      title: "Utilisation",
      body: [
        "1 point d'énergie, posée sur TA case avant de bouger. Une seule Boue posée par tour, et jamais en Enfer.",
        "Le piège attend sur la case jusqu'à ce que quelqu'un s'y arrête — y compris toi.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• Qui s'arrête sur la case (en marchant, téléporté, reculé…) perd 200 pièces, et le poseur gagne 100 — sauf si c'est lui-même, ça ne paie personne.",
        "• Le piège disparaît après un déclenchement.",
        "• Si le poseur est Double or nothing, la perte et la récompense liées se jouent ensemble sur le même 50/50.",
        "• Tomber dans la Boue passe sous zéro ? Le Casque peut absorber.",
      ],
    },
  ],
  eraser: [
    {
      title: "Utilisation",
      body: [
        "Jamais de bouton : quand une roue vient de s'arrêter pour toi, la Gomme te propose d'effacer CE résultat, bon ou mauvais. Gratuit, un seul exemplaire par sac.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• La roue est annulée et le jeu reprend là où il s'était arrêté, avant son résultat.",
        "• Elle n'efface que le résultat en cours : la deuxième roue de Touché angélique ou Touché funeste s'appliquera quand même.",
        "• Non merci peut annuler la même chose sans la Gomme — mais se recharge 5 tours.",
      ],
    },
  ],
  "bullet-bill": [
    {
      title: "Utilisation",
      body: [
        "2 points d'énergie, lancé du sac (pas de cible). Un seul Bullet Bill sur le plateau à la fois. Il vous tombe dessus au tour suivant : rien ne sert de l'acheter pour soi, il frappe aussi son lanceur.",
      ],
    },
    {
      title: "Comportement",
      body: [
        "• Il attend au Départ le tour de son achat, puis à chaque NOUVEAU tour de table il avance d'une case vers le joueur vivant le plus proche (chemin le plus court, flèches et sens uniques ne le gênent pas, Barrières non plus).",
        "• En Enfer, personne n'est à sa portée; Chance aveugle n'est jamais poursuivi, ni un joueur que [[card:half-seen|Mi-vu, Mi-vue]] rend invisible (qu'il assomme pourtant s'il explose sur sa case).",
        "• Il explose sur la case de sa cible : −200 pièces et un tour sauté pour elle, et pour tous les autres joueurs présents sur la case (immunisés exceptés).",
        "• Non merci (sa victime) ou Bouclier (son ange) peuvent l'annuler au début du tour : il s'écrase sans effet sur la case. Un [[card:black-mage|Mage noir]] qui a une marque peut aussi se téléporter avant l'impact : Bullet Bill choisit alors sa cible à nouveau.",
        "• Le tour sauté peut être annulé par un Réveil.",
      ],
    },
  ],
  "middle-finger": [
    {
      title: "Utilisation",
      body: ["2 points d'énergie, cible un joueur (toi compris), réaction possible (Non merci, Bouclier, Miroir)."],
    },
    {
      title: "Effet",
      body: [
        "• La cible saute son prochain tour (cumulable : deux doigts = deux tours).",
        "• En Enfer aussi ça compte, et le tour sauté là-bas compte dans la peine — et rapporte son point au diable.",
        "• Le Réveil peut annuler le tour perdu.",
      ],
    },
  ],
  "monopoly-man": [
    {
      title: "Utilisation",
      body: [
        "3 points d'énergie, cible un autre joueur (pas toi). Réaction possible (Non merci, Bouclier). Le Miroir ne renvoie pas cet objet.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• Vous échangez vos cases. Ni l'un ni l'autre ne déclenchez rien sur la nouvelle case (ni roue, ni boutique, ni Boue, ni Cup) : un échange n'est pas une arrivée.",
        "• Échangé avec l'Enfer, le joueur qui y va y fait un vrai voyage (l'Ange y perd un tour); son compteur de peine repart à zéro.",
        "• Posé sur la glace, la glace emporte aussitôt.",
        "• Contre Baraqué : pas d'échange direct, bras de fer (10 secondes de taps chacun, les siens comptent 1,2 fois). L'attaquant gagne → échange; Baraqué gagne → personne ne bouge; égalité → l'attaquant avance d'une case vers lui, Baraqué recule d'une.",
      ],
    },
  ],
  "water-bottle": [
    {
      title: "Utilisation",
      body: ["3 points d'énergie, et seulement quand TU es en Enfer, au début de ton tour (avant la roue)."],
    },
    {
      title: "Effet",
      body: [
        "• Tu sors de l'Enfer et atterris sur une case au hasard du plateau — jamais la glace (personne n'y stationne), ni l'Enfer.",
        "• Tu es reposé ailleurs : la roue de la case (verte/rouge) tourne et la Red Cup est ramassée si tu tombes dessus — mais pas de Boue ni de Portail déclenchés par la chute.",
        "• Ton tour bascule en marche normale : il te reste à dépenser l'énergie restante en objets ou à avancer.",
        "• Sortir comme ça ne paie ni le bonus du Départ, ni les 500 du péage — et ton compteur de peine repart de zéro au prochain passage de tour.",
      ],
    },
  ],
  helmet: [
    {
      title: "Utilisation",
      body: ["Aucun bouton, aucune énergie : le Casque attend dans le sac et se consume de lui-même."],
    },
    {
      title: "Effet",
      body: [
        "• La première fois qu'une perte ferait passer ton solde sous zéro, le Casque l'absorbe : solde maintenu à 0, objet consommé, aucune ligne de K.O.",
        "• Il n'empêche pas les pertes qui vous laissent positif, ni les descents en Enfer.",
        "• Un Casque par exemplaire ; deux exemplaires = deux absolutions.",
      ],
    },
  ],
  draven: [
    {
      title: "Utilisation",
      body: [
        "3 points d'énergie, posé sur toi : toute la table (toi excepté) part en Enfer d'un coup. Pas de réaction possible pour les victimes… sauf le Miroir : lui ne renvoie pas Draven.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• Chaque victime y va par un vrai voyage : Parachute possible pour chacune, l'Ange perd un tour à la place, Chance aveugle et tout joueur invisible ([[card:half-seen|Mi-vu, Mi-vue]]) sont épargnés.",
        "• Non merci ne protège QUE son détenteur : épargné, lui, les autres y vont quand même. Un [[card:black-mage|Mage noir]] peut de même se téléporter sur sa marque (1 chance) et rester seul épargné.",
        "• À l'arrivée de tout ce beau monde, la table se règle : duels en Enfer s'il y a de la place, point du diable, récompense de l'Habitué, Toucher d'Enfer…",
      ],
    },
  ],
  "made-in-heaven": [
    {
      title: "Utilisation",
      body: [
        "1 300 pièces, 3 points d'énergie — et un seul exemplaire en vente, pour Chance aveugle uniquement, tant que la Red Cup n'est pas déjà posée en case 8.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• Le temps rembobine : tous les autres joueurs (Enfer compris) sont renvoyés au Départ — sans bonus de Départ et sans arrivée sur la case.",
        "• La Red Cup se pose en case 8. Si elle attendait en Enfer sous une Black Cup, elle remonte aussi et le sort est défait.",
        "• À Banquise, la glace du blizzard posée en case 8 fond : une Cup ne stationne jamais sur la glace.",
        "• Toi, tu ne bouges pas (tu ne vois jamais la Cup, rappel).",
      ],
    },
  ],
  portal: [
    {
      title: "Utilisation",
      body: ["Le diable seulement : 400 pièces, 2 points d'énergie, dans sa boutique à lui, posé depuis son sac."],
    },
    {
      title: "Effet",
      body: [
        "• Deux Portails s'ouvrent sur des cases au hasard — ni le Départ, ni l'Enfer, ni la Red Cup, jamais la glace, jamais une case déjà occupée par un Portail.",
        "• Cachés le tour de leur ouverture : le premier se montre au tour suivant, les deux au tour d'après. Ils tiennent 3 tours de table, sinon se referment.",
        "• Un joueur qui s'ARRÊTE sur un Portail part en Enfer, et les deux Portails de la paire se referment d'un coup.",
        "• La case avalée ne s'active pas : ni roue de case, ni boutique ne s'ouvrent pour le tombé. Une Red Cup qui trônait sur la case est ramassée avant la chute.",
        "• Le Parachute qui sauve du Portail laisse la case s'activer normalement : roue et boutique comprises.",
        "• Sur le plateau (patch 0.2.0), la marche est toujours jouée d'abord : le pion atteint la case, le Portail s'élargit sur toute la case et l'avale, puis un Portail s'ouvre au-dessus de l'Enfer pour le laisser tomber.",
        "• Le diable n'est jamais pris par ses Portails; Chance aveugle est épargné; le Parachute s'ouvre normalement.",
      ],
    },
  ],
  "hell-touch": [
    {
      title: "Utilisation",
      body: ["Le diable seulement : 400 pièces, gratuit, agit tout seul depuis son sac."],
    },
    {
      title: "Effet",
      body: [
        "• Dès qu'un joueur ASSOMMÉ (en train de perdre un tour) se trouve sur la case du diable, le Toucher d'Enfer s'active : tous partent en Enfer d'un coup, puis l'objet est consommé.",
        "• Depuis le patch 0.2.0, l'assommement reste affiché tant que le joueur n'a pas pu rejouer : le tour sauté passé, la victime est encore une proie jusqu'à son tour suivant.",
        "• Ça se vérifie à chaque moment où le plateau se calme (déplacements, roues, tirages) et au passage des tours.",
        "• Le diable ne déclenche pas ça sur lui-même en Enfer; Chance aveugle et l'Ange-Gardien ne sont pas des proies.",
      ],
    },
  ],
  "black-cup": [
    {
      title: "Utilisation",
      body: [
        "Le diable seulement : 400 pièces, 3 points d'énergie, tant que une Red Cup est sur le plateau et qu'aucune Black Cup ne tourne déjà.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• La Red Cup plonge en Enfer pendant 2 tours de table et retourne ensuite sur sa case.",
        "• Pendant ce temps, le premier joueur qui ARRIVE en Enfer la ramasse (voyageurs uniquement : ceux qui y étaient déjà au moment du sort ne peuvent pas).",
        "• Si elle est ramassée, une nouvelle Cup apparaît normalement ailleurs.",
        "• Un K.O. en Enfer pendant le sort peut quand même ramasser : la Cup attend dans la crevasse.",
        "• Si la glace du blizzard avait gelé la case d'attente entre-temps, la Cup la fait fondre en remontant.",
      ],
    },
  ],
  sentence: [
    {
      title: "Utilisation",
      body: ["Le diable seulement : 400 pièces, 2 points d'énergie."],
    },
    {
      title: "Effet",
      body: [
        "• Tous les autres joueurs à 0 pièce OU MOINS partent en Enfer sur-le-champ (chacun avec son droit au Parachute).",
        "• Chance aveugle est épargné, le diable aussi.",
        "• 0 n'est pas encore le K.O. (−300) : le diable frappe avant même que la banque sonne.",
      ],
    },
  ],
  doomsday: [
    {
      title: "Utilisation",
      body: ["Le diable seulement : 555 pièces, 3 points d'énergie, un seul Doomsday à la fois."],
    },
    {
      title: "Effet",
      body: [
        "• Jusqu'au tour du diable suivant (1 tour de table) : TOUTES les cases font tourner la roue du malheur, y compris le Départ et les boutiques — l'Enfer exceptée (c'est déjà sa roue).",
        "• Le Départ ne paie plus rien aux non-immunis et les boutiques ne s'ouvrent pas.",
        "• Chance aveugle vit le monde normal pendant ce temps-là.",
        "• À l'écran, toutes les cases (l'Enfer exceptée) se couvrent d'un voile rouge pulsant tant que le sort court.",
      ],
    },
  ],
  shield: [
    {
      title: "Utilisation",
      body: [
        "L'Ange-Gardien seulement (objet exclusif, 400 pièces, gratuit, automatique) : quand un objet à cible unique vise son protégé, ou que Bullet Bill s'apprête à l'écraser, l'ange peut LEVER LE BOUCLIER, même hors de son tour.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• Le Bouclier se consume, l'objet adverse est annulé (objet et énergie tout de même perdus par le lanceur).",
        "• Contre Draven : pas de Bouclier — c'est Non merci qui joue, et il ne protège que lui.",
        "• Contre la Tomate : rien ne se propose (elle ne demande jamais l'avis de personne).",
      ],
    },
  ],
  "wake-up": [
    { title: "Utilisation", body: ["250 pièces, gratuit, automatique : ne se « joue » pas, il attend dans le sac."] },
    {
      title: "Effet",
      body: [
        "• Annule le prochain tour que tu perds, QUELLE QUE SOIT la cause : Middle Finger, roue du malheur, roue de l'Enfer, explosion de Bullet Bill, boule de neige de pingouin, K.O. à −300, voire la place de l'Enfer que l'Ange-Gardien paie d'un tour.",
        "• Un seul usage puis consommé.",
        "• Attention aux comptes : si la cause donne plusieurs tours perdus, le Réveil n'en annule qu'un.",
      ],
    },
  ],
  parachute: [
    { title: "Utilisation", body: ["650 pièces, gratuit, automatique depuis le sac."] },
    {
      title: "Effet",
      body: [
        "• S'ouvre à la première descente en Enfer de n'importe quelle origine : Hollow Purple, Draven, roue du malheur, roue de l'Enfer, Sentence, Portail, Monopoly Man, échange… Le joueur reste où il est.",
        "• Un seul usage.",
        "• Ne protège PAS de la règle de l'Ange-Gardien (qui ne « descend » jamais en Enfer : il perd un tour), ni des effets non-Enfer.",
      ],
    },
  ],
  barrier: [
    {
      title: "Utilisation",
      body: [
        "400 pièces, 2 points d'énergie : tu choisis UNE ROUTE du plateau (n'importe laquelle, ouverte, jamais un tunnel ni la route de l'Enfer) et tu la fermes.",
        "Une seule Barrière par joueur, deux sur le plateau au grand maximum.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• La route est impraticable pour TOUT LE MONDE pendant 1 tour de la table du poseur (puis la Barrière tombe; elle tombe aussi si le poseur quitte la partie).",
        "• La Botte posée juste devant peut sauter par-dessus (un seul pas).",
        "• Ne bloque pas : Bullet Bill, les tirages au hasard (Corde, Portails, Cup…), les calculs de distance (Calme-toi, givre) — mais arrête une glissade de Banquise : elle rebondit et prend une autre route.",
        "• La route barrée ne se paie pas par Corrupteur : lui ignore les flèches et sens uniques, pas les Barrières.",
      ],
    },
  ],
  mirror: [
    {
      title: "Utilisation",
      body: ["700 pièces, gratuit, automatique. Un seul achat par joueur pour toute la partie, qu'il serve ou non."],
    },
    {
      title: "Effet",
      body: [
        "• Le prochain de ces objets qui te vise revient sur SON lanceur : Ndoye, Hollow Purple, Corde, Middle Finger. La Corde reflectée attire le lanceur sur TA case; Hollow Purple reflecté l'envoie en Enfer.",
        "• Le Miroir répond AVANT Non merci et le Bouclier : si Miroir il y a, la réaction ne se propose même pas.",
        "• Consommé à l'usage, Miroir comme objet lancé. Je note ne copie pas un objet renvoyé.",
        "• Échappe au renvoi : Monopoly Man, Draven, Boue, Bullet Bill, Tomate, Barrière.",
      ],
    },
  ],
  tomato: [
    {
      title: "Utilisation",
      body: [
        "10 pièces la pièce, sans énergie : les Tomates s'achètent en quantité (les piles montent à 5 par emplacement, deux piles maximum dans le sac).",
        "Tu lances UNE pile par tour, autant de projectiles que la pile en tient — sauf Tomato Enjoyer, qui lance toutes ses piles.",
      ],
    },
    {
      title: "Effet",
      body: [
        "• Chaque Tomate a 2 % de chance d'assommer (5 % pour Tomato Enjoyer); une volée ratée reste une volée ratée, une volée assommée ne saute qu'UN tour, peu importe le nombre de touches.",
        "• Jamais d'annonce, jamais de réaction : pas de Non merci, pas de Bouclier, pas de Miroir.",
        "• Tomate reçue = 5 pièces pour un Tomato Enjoyer (à chaque tomate).",
        "• Un lancer de Tomate ne « fait rien » ce tour : seul, il ne permet pas de finir son tour sans bouger.",
        "• Chance aveugle ne peut pas être arrosé.",
      ],
    },
  ],
};
