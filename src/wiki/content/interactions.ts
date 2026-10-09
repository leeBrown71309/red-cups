import type { Interaction } from "../types";

/**
 * TOUTES les interactions entre éléments du jeu, une par paire. Chaque ligne
 * est vérifiable dans le moteur. Les fiches des deux côtés et la page
 * « Croisements » affichent ces lignes automatiquement.
 */
export const INTERACTIONS: Interaction[] = [
  // ————— Objets ↔ Cartes —————
  {
    a: "item:rope",
    b: "card:built-like-a-tank",
    text: "Baraqué ne parcourt que la moitié du chemin tiré par la Corde (arrondi au pas supérieur).",
  },
  {
    a: "item:monopoly-man",
    b: "card:built-like-a-tank",
    text: "Contre Baraqué, le Monopoly Man ne force pas l'échange : dix secondes de bras de fer, taps de Baraqué ×1,2. Gagné par l'attaquant : échange; par Baraqué : rien; égalité : l'attaquant avance d'une case, Baraqué recule de la plus éloignée.",
  },
  {
    a: "item:mud",
    b: "card:greedy",
    text: "La Boue coûte 100 pièces à Cupide, et celui qui tombe dedans lui paie 200.",
  },
  {
    a: "item:mud",
    b: "card:trapper",
    text: "Le Piégeur paie sa Boue 100 aussi, mais ne peut en tenir qu'une seule sur le plateau à la fois.",
  },
  {
    a: "item:ndoye",
    b: "card:greedy",
    text: "Les pièces perdues par la cible du Ndoye de Cupide finissent dans la poche de Cupide (jamais s'il se vise lui-même).",
  },
  {
    a: "item:ndoye",
    b: "card:i-take-notes",
    text: "Je note peut copier un Ndoye lancé contre lui — la copie se joue APRÈS la résolution de la roue.",
  },
  {
    a: "item:hollow-purple",
    b: "card:i-take-notes",
    text: "Je note peut garder une copie de Hollow Purple reçu (1 chance sur 3).",
  },
  { a: "item:rope", b: "card:i-take-notes", text: "Je note peut garder une copie de la Corde qui l'a tiré." },
  { a: "item:middle-finger", b: "card:i-take-notes", text: "Je note peut garder une copie du Middle Finger reçu." },
  {
    a: "item:monopoly-man",
    b: "card:i-take-notes",
    text: "Je note peut garder une copie du Monopoly Man qui l'a échangé.",
  },
  {
    a: "item:tomato",
    b: "card:i-take-notes",
    text: "Chaque Tomate reçue donne une chance séparée de copie à Je note (la volée de 5 roule cinq fois).",
  },
  {
    a: "item:ndoye",
    b: "card:no-thanks",
    text: "Non merci peut annuler un Ndoye lancé contre le détenteur AVANT la roue (l'objet et l'énergie sont perdus quand même).",
  },
  {
    a: "item:hollow-purple",
    b: "card:no-thanks",
    text: "Non merci annule la descente en Enfer de Hollow Purple avant qu'elle parte.",
  },
  { a: "item:rope", b: "card:no-thanks", text: "Non merci annule la Corde avant d'être tiré." },
  { a: "item:middle-finger", b: "card:no-thanks", text: "Non merci annule le tour sauté du Middle Finger." },
  { a: "item:monopoly-man", b: "card:no-thanks", text: "Non merci annule l'échange de position avant qu'il se fasse." },
  {
    a: "item:draven",
    b: "card:no-thanks",
    text: "Non merci NE protège que son détenteur contre Draven : les autres joueurs partent en Enfer quand même.",
  },
  {
    a: "item:bullet-bill",
    b: "card:no-thanks",
    text: "La victime de Bullet Bill peut l'annuler avec Non merci au début du tour : la fusée s'écrase sans effet sur sa case.",
  },
  {
    a: "item:tomato",
    b: "card:no-thanks",
    text: "La Tomate ne demande l'avis de personne : ni Non merci, ni Bouclier ne s'y opposent.",
  },
  {
    a: "item:hollow-purple",
    b: "card:blind-luck",
    text: "Chance aveugle ne peut jamais être la cible de Hollow Purple.",
  },
  { a: "item:rope", b: "card:blind-luck", text: "Chance aveugle ne peut jamais être tiré par une Corde." },
  { a: "item:ndoye", b: "card:blind-luck", text: "Chance aveugle ne peut jamais être visé par Ndoye." },
  { a: "item:middle-finger", b: "card:blind-luck", text: "Chance aveugle ne peut pas recevoir de Middle Finger." },
  {
    a: "item:monopoly-man",
    b: "card:blind-luck",
    text: "Chance aveugle ne peut pas être échangé par le Monopoly Man.",
  },
  { a: "item:draven", b: "card:blind-luck", text: "Draven épargne Chance aveugle : les autres partent, pas lui." },
  {
    a: "item:bullet-bill",
    b: "card:blind-luck",
    text: "Bullet Bill ne poursuit jamais Chance aveugle et son explosion ne l'atteint pas.",
  },
  {
    a: "item:mud",
    b: "card:blind-luck",
    text: "Chance aveugle dans une Boue ne perd rien : il recule d'une case (ou reste s'il y a été posé).",
  },
  { a: "item:tomato", b: "card:blind-luck", text: "On ne peut pas lancer de Tomate sur Chance aveugle." },
  { a: "item:sentence", b: "card:blind-luck", text: "Chance aveugle fauché est épargné par la Sentence." },
  { a: "item:portal", b: "card:blind-luck", text: "Chance aveugle traverse les Portails sans y tomber." },
  {
    a: "item:doomsday",
    b: "card:blind-luck",
    text: "Pendant Doomsday, Chance aveugle vit dans un monde normal : ses cases gardent leurs roues.",
  },
  { a: "item:ndoye", b: "card:guardian-angel", text: "Interdit à l'Ange : acheter comme utiliser." },
  { a: "item:hollow-purple", b: "card:guardian-angel", text: "Interdit à l'Ange." },
  { a: "item:mud", b: "card:guardian-angel", text: "Interdit à l'Ange." },
  { a: "item:tomato", b: "card:guardian-angel", text: "Interdit à l'Ange." },
  { a: "item:bullet-bill", b: "card:guardian-angel", text: "Interdit à l'Ange." },
  { a: "item:middle-finger", b: "card:guardian-angel", text: "Interdit à l'Ange." },
  { a: "item:draven", b: "card:guardian-angel", text: "Interdit à l'Ange." },
  { a: "item:helmet", b: "card:guardian-angel", text: "Interdit à l'Ange." },
  { a: "item:parachute", b: "card:guardian-angel", text: "Interdit à l'Ange." },
  { a: "item:barrier", b: "card:guardian-angel", text: "Interdit à l'Ange." },
  { a: "item:mirror", b: "card:guardian-angel", text: "Interdit à l'Ange." },
  {
    a: "item:rope",
    b: "card:guardian-angel",
    text: "Autorisé : l'Ange peut tirer SON PROTÉGÉ sur sa case (seule cible possible de tous ses objets).",
  },
  {
    a: "item:monopoly-man",
    b: "card:guardian-angel",
    text: "Autorisé avec le protégé seul comme cible : l'échange peut le sortir de l'Enfer — ou l'y mettre (placeInHell : l'Ange ne descend jamais, il perdrait un tour).",
  },
  {
    a: "item:shield",
    b: "card:guardian-angel",
    text: "Son objet exclusif ; volé par le fantôme, il ne se rend qu'à un Ange (les autres le convertissent en 400 pièces).",
  },
  {
    a: "item:hollow-purple",
    b: "item:parachute",
    text: "Contre une cible qui a un Parachute : le Parachute s'ouvre, elle ne descend pas en Enfer.",
  },
  {
    a: "item:draven",
    b: "item:parachute",
    text: "Chaque victime de Draven avec un Parachute le consomme et reste sur place.",
  },
  {
    a: "item:sentence",
    b: "item:parachute",
    text: "La Sentence qui frappe un joueur à Parachute ne l'envoie pas (le Parachute saute).",
  },
  {
    a: "item:portal",
    b: "item:parachute",
    text: "S'arrêter sur un Portail avec un Parachute : le Parachute s'ouvre et saute ; les deux Portails de la paire se referment quand même.",
  },
  {
    a: "item:monopoly-man",
    b: "item:parachute",
    text: "Échangé avec l'Enfer par un Monopoly Man, le Parachute de la victime saute et la laisse chez elle.",
  },
  {
    a: "item:middle-finger",
    b: "item:wake-up",
    text: "Le tour sauté imposé par Middle Finger est annulé par le Réveil (qui se consume).",
  },
  {
    a: "item:bullet-bill",
    b: "item:wake-up",
    text: "Le tour sauté par l'explosion de Bullet Bill est annulé par le Réveil.",
  },
  { a: "item:tomato", b: "item:wake-up", text: "L'assommage d'une volée de Tomates est annulé par le Réveil." },
  {
    a: "item:tomato",
    b: "card:tomato-enjoyer",
    text: "L'Enjoyer tient une pile par emplacement du sac, lance toutes ses piles par tour, assomme à 5 % et empoche 5 pièces par Tomate reçue.",
  },
  {
    a: "item:mud",
    b: "card:double-or-nothing",
    text: "Dans la Boue subie, la récompense du poseur est LIÉE au 50/50 de la victime : doublée avec elle ou annulée avec elle.",
  },
  {
    a: "item:shield",
    b: "item:ndoye",
    text: "Le Bouclier bloque un Ndoye qui vise le protégé (consommé ; l'objet attaquant est perdu).",
  },
  { a: "item:shield", b: "item:hollow-purple", text: "Le Bouclier bloque Hollow Purple sur le protégé." },
  { a: "item:shield", b: "item:rope", text: "Le Bouclier bloque une Corde qui vise le protégé." },
  { a: "item:shield", b: "item:middle-finger", text: "Le Bouclier bloque le Middle Finger sur le protégé." },
  { a: "item:shield", b: "item:monopoly-man", text: "Le Bouclier bloque l'échange Monopoly Man qui vise le protégé." },
  {
    a: "item:shield",
    b: "item:bullet-bill",
    text: "Le Bouclier bloque la charge de Bullet Bill qui s'abat sur le protégé (au choix de l'ange, à la place du Non merci de sa victime).",
  },
  {
    a: "item:shield",
    b: "item:draven",
    text: "Pas de Bouclier contre Draven : seule la réaction Non merci existe, et elle ne protège que soi.",
  },
  {
    a: "item:mirror",
    b: "item:monopoly-man",
    text: "Le Miroir ne renvoie PAS le Monopoly Man (liste stricte : Ndoye, Hollow Purple, Corde, Middle Finger).",
  },
  { a: "item:mirror", b: "item:draven", text: "Le Miroir ne renvoie pas Draven." },
  { a: "item:mirror", b: "item:tomato", text: "Le Miroir ne renvoie pas les Tomates." },
  { a: "item:mirror", b: "item:bullet-bill", text: "Le Miroir ne renvoie pas Bullet Bill." },
  {
    a: "item:mirror",
    b: "card:no-thanks",
    text: "Le Miroir répond AVANT : si un Miroir renvoie l'objet, le Non merci ne se propose plus.",
  },
  {
    a: "item:mirror",
    b: "card:guardian-angel",
    text: "Le Miroir répond avant le Bouclier de l'ange : objet renvoyé, plus rien à bloquer.",
  },
  {
    a: "item:mirror",
    b: "card:i-take-notes",
    text: "Un objet renvoyé par le Miroir ne peut pas être copié par Je note chez la cible d'origine (épargnée).",
  },
  {
    a: "item:water-bottle",
    b: "system:hell",
    text: "Ne s'utilise QU'EN Enfer : c'est une porte de sortie qui saute le péage.",
  },
  {
    a: "item:made-in-heaven",
    b: "card:devil",
    text: "Made In Heaven renvoie AUSSI le diable au Départ si ce n'est pas lui qui l'utilise (et fait remonter une Cup qui attendait en Enfer sous une Black Cup).",
  },
  {
    a: "item:made-in-heaven",
    b: "card:goblin",
    text: "Le déplacement de la Cup par Made In Heaven n'est pas une prise : le Goblin ne vole pas.",
  },
  {
    a: "item:made-in-heaven",
    b: "card:new-cup-new-me",
    text: "Made In Heaven pose la Cup sans faire apparaître de nouvelle Cup : New Cup, New Me ne se déclenche pas.",
  },
  {
    a: "item:bullet-bill",
    b: "item:hell-touch",
    text: "L'explosion de Bullet Bill assomme sur place : si c'est sur la case du diable, le Toucher d'Enfer emporte les victimes.",
  },
  {
    a: "item:middle-finger",
    b: "item:hell-touch",
    text: "Un joueur privé de tour présent sur la case du diable déclenche le Toucher d'Enfer.",
  },
  {
    a: "item:tomato",
    b: "item:hell-touch",
    text: "Une volée de Tomates qui assomme sur la case du diable déclenche le Toucher d'Enfer.",
  },
  {
    a: "item:hell-touch",
    b: "system:turn",
    text: "patch 0.2.0 : l'assommement dure jusqu'à ce que le joueur puisse rejouer — le diable frappe même après que le tour sauté a été consommé.",
  },
  {
    a: "item:made-in-heaven",
    b: "system:cups",
    text: "La Cup est posée en case 8, pas ramassée : pas de cycle complet, et une Black Cup en cours est défaite.",
  },
  {
    a: "item:black-cup",
    b: "card:greedy",
    text: "Un Cupide arrivé en Enfer pendant la Black Cup peut la « ramasser » : +1 000 pièces, pas de place de sac.",
  },
  // ————— Objets ↔ Roues —————
  {
    a: "item:eraser",
    b: "wheel:misfortune",
    text: "La Gomme efface le résultat du malheur qui vient de s'arrêter pour vous (celui d'un Ndoye aussi).",
  },
  { a: "item:eraser", b: "wheel:fortune", text: "La Gomme efface un résultat du bonheur — même bon." },
  {
    a: "item:eraser",
    b: "wheel:hell",
    text: "La Gomme efface le résultat de la roue de l'Enfer, Libération comprise si vous la jugez mauvaise : elle se propose sur TOUS les résultats.",
  },
  {
    a: "item:eraser",
    b: "card:angelic-touch",
    text: "La Gomme (comme Non merci) n'efface QUE le premier résultat : la roue jumelle du Touché angélique s'appliquera.",
  },
  {
    a: "item:eraser",
    b: "card:devils-hand",
    text: "Idem : la seconde roue de Touché funeste passe après l'effacement de la première.",
  },
  {
    a: "item:ndoye",
    b: "wheel:misfortune",
    text: "Ndoye = roue du malheur tournée pour la cible ; ses secteurs s'appliquent tels quels (chaînage « Tourne la roue du bonheur » compris).",
  },
  {
    a: "item:doomsday",
    b: "wheel:misfortune",
    text: "Pendant Doomsday, TOUTES les cases font tourner le malheur (Départ et boutiques comprises, Enfer exceptée).",
  },
  {
    a: "item:doomsday",
    b: "hub:shop",
    text: "Pendant Doomsday, aucune boutique ne s'ouvre (sauf pour Chance aveugle).",
  },
  { a: "item:doomsday", b: "system:money", text: "Le Départ ne paie rien pendant Doomsday." },
  {
    a: "item:sentence",
    b: "system:money",
    text: "La Sentence vise les 0 pièces ET MOINS (pas besoin d'être K.O.) ; elle épargne Chance aveugle et son lanceur.",
  },
  {
    a: "item:boot",
    b: "system:turn",
    text: "Chausser la Botte immobilise 1 point pour la marche : la préparation exige 2 points d'énergie, et le déplacement de deux cases prend le reste.",
  },
  {
    a: "item:boot",
    b: "hub:shop",
    text: "Le prix courant de la Botte sert aussi aux reventes du Brocanteur ; elle figure au panier « objet gratuit » de la roue du bonheur (liste fixe des objets à 400 ou moins, verrouillée par les tests du jeu).",
  },
  {
    a: "item:bullet-bill",
    b: "system:turn",
    text: "La charge de Bullet Bill a lieu au DÉBUT d'un nouveau tour de table, avant la recherche du prochain joueur ; une victime assommée sur la case du diable peut être Touchée d'Enfer dans la foulée.",
  },
  { a: "item:bullet-bill", b: "system:hell", text: "Les joueurs en Enfer sont hors de portée de Bullet Bill." },
  { a: "item:mud", b: "system:hell", text: "Pas de Boue en Enfer : on n'y marche pas, le piège n'y a pas de sens." },
  {
    a: "item:hollow-purple",
    b: "system:hell",
    text: "Impossible de cibler un joueur DÉJÀ en Enfer : la liste des cibles le refuse, l'objet reste dans le sac.",
  },
  {
    a: "item:portal",
    b: "system:tiles",
    text: "La case avalée par un Portail ne s'active pas : ni roue de case, ni boutique. Le Parachute qui sauve laisse la case s'activer normalement.",
  },
  {
    a: "item:portal",
    b: "system:cups",
    text: "Portail sous une Red Cup : le joueur la ramasse avant de tomber en Enfer.",
  },
  {
    a: "item:tomato",
    b: "system:turn",
    text: "La Tomate est gratuite : elle ne compte pas comme « avoir agi » et ne permet pas de finir son tour sans marcher.",
  },
  // ————— Cartes ↔ Systèmes / Roues / Plateaux —————
  {
    a: "card:devil",
    b: "system:hell",
    text: "Chaque entrée d'un autre en Enfer (+1 point) et chaque tour de lui commencé là-bas (+1) rapprochent le diable de sa victoire (⌊4N − N/2⌋).",
  },
  {
    a: "card:devil",
    b: "system:hell",
    text: "Sa propre descente en Enfer le paie +100 ; il en sort à volonté pour 1 point d'énergie (Départ, sans bonus).",
  },
  {
    a: "card:devil",
    b: "system:cups",
    text: "Le diable ne ramasse jamais la Red Cup, et ses Portails ne le prennent pas.",
  },
  {
    a: "card:devil",
    b: "hub:shop",
    text: "Onglet violet sur les cases bleues : ses 5 objets à lui, et jamais deux fois le même objet dans son sac (Tomate : une seule pile).",
  },
  {
    a: "card:devil",
    b: "system:victory",
    text: "Sa victoire est vérifiée après chaque action de la table, même hors de son tour.",
  },
  {
    a: "card:guardian-angel",
    b: "wheel:misfortune",
    text: "La roue du malheur de l'Ange n'a que deux secteurs : « Passe ton prochain tour » ou « Rien du tout » (50/50).",
  },
  {
    a: "card:guardian-angel",
    b: "system:hell",
    text: "L'Ange ne va jamais en Enfer : chaque descente lui coûte un tour (le Réveil peut rattraper) — Sentence, Hollow Purple, roues comprises.",
  },
  {
    a: "card:guardian-angel",
    b: "system:cups",
    text: "Pas de Cup pour l'Ange ; il gagne avec son protégé, jamais par ses propres Cups.",
  },
  {
    a: "card:guardian-angel",
    b: "card:thief",
    text: "Jamais son protégé (criminels exclus du tirage) ; jamais son passif au draft.",
  },
  { a: "card:guardian-angel", b: "card:goblin", text: "Jamais son protégé ; jamais son passif au draft." },
  { a: "card:guardian-angel", b: "card:corrupter", text: "Jamais son protégé ; jamais son passif au draft." },
  {
    a: "card:guardian-angel",
    b: "card:trapper",
    text: "Jamais son passif au draft (l'Ange ne tend pas de pièges nuisibles).",
  },
  {
    a: "card:guardian-angel",
    b: "card:lambda",
    text: "S'il n'y a personne à protéger (tous criminels), l'Ange devient Lambda.",
  },
  {
    a: "card:guardian-angel",
    b: "item:wake-up",
    text: "Le tour perdu « à la place de l'Enfer » est un tour perdu comme les autres : le Réveil peut l'annuler.",
  },
  {
    a: "card:blind-luck",
    b: "system:cups",
    text: "Chance aveugle ne VOIT jamais la Red Cup à l'écran — il peut marcher dessus sans le savoir (et la ramasse normalement).",
  },
  { a: "card:blind-luck", b: "item:made-in-heaven", text: "Lui seul peut acheter et utiliser Made In Heaven." },
  { a: "card:blind-luck", b: "hub:duels", text: "On ne peut pas le tirer en duel depuis la roue de l'Enfer." },
  {
    a: "card:blind-luck",
    b: "item:barrier",
    text: "Une Barrière n'est pas un objet : elle le bloque comme tout le monde.",
  },
  {
    a: "card:blind-luck",
    b: "card:thief",
    text: "Combinaison possible (actif + passif) : tenter de voler la Made In Heaven à 1 300 pièces expose au risque de 100 % — coup sûr de se faire prendre.",
  },
  {
    a: "card:blind-luck",
    b: "wheel:misfortune",
    text: "Une roue n'est pas un objet : le malheur (Enfer, perte d'objet…) atteint Chance aveugle comme tout le monde.",
  },
  {
    a: "card:hell-regular",
    b: "system:hell",
    text: "+150 pièces à chaque descente, quelle que soit la porte (le Parachute qui évite la descente ne paie pas) ; sortie au bout de 3 tours de peine au lieu de 5, péage de 500.",
  },
  { a: "card:red-bull", b: "system:turn", text: "+1 point d'énergie par tour." },
  { a: "card:last-in-class", b: "system:turn", text: "+1 point d'énergie tant qu'il est le dernier en Cups." },
  {
    a: "card:last-in-class",
    b: "hub:shop",
    text: "−10 % sur chaque prix (arrondi aux 10 du dessus) tant qu'il est le dernier en Cups.",
  },
  {
    a: "card:last-in-class",
    b: "card:devil",
    text: "Le diable, l'Ange et Cupide sont hors du classement des Cups : ils ne comptent pas dans la comparaison de Dernier de la classe.",
  },
  {
    a: "card:eshop",
    b: "hub:shop",
    text: "La boutique s'ouvre après chaque déplacement, n'importe où (jamais en Enfer ni sous Doomsday) ; départ à 1 000 pièces.",
  },
  {
    a: "card:thief",
    b: "hub:shop",
    text: "Une tentative de vol par VISITE ; ratée : Enfer + amende 1,5 × le prix (objets chers rendus d'abord) ; l'amende ne se mise jamais.",
  },
  {
    a: "card:junk-dealer",
    b: "hub:shop",
    text: "Onglet Revente : un objet par visite à 60 % du prix courant, arrondi aux 5, jamais une Cup ; la vente ne se mise jamais.",
  },
  {
    a: "card:game-master",
    b: "hub:duels",
    text: "Dans ses duels : deux mini-jeux tirés, lui choisit (le premier des deux s'il manque de temps en ligne).",
  },
  {
    a: "card:corrupter",
    b: "system:move",
    text: "400 pièces pour ignorer une flèche ou un sens unique ; jamais au tour 1 depuis le Départ ; jamais contre une Barrière ; le paiement ne se mise jamais.",
  },
  { a: "card:corrupter", b: "item:barrier", text: "Le Corrupteur ne lève pas les Barrières." },
  {
    a: "card:greedy",
    b: "system:cups",
    text: "Une Cup = +1 000 pièces au lieu d'une place de sac ; la Cup suivante apparaît normalement.",
  },
  {
    a: "card:greedy",
    b: "system:move",
    text: "Marcher sur un joueur ASSOMMÉ (tour en train d'être sauté) sur la même case : 50 pièces volés à chacun.",
  },
  {
    a: "card:greedy",
    b: "system:victory",
    text: "Victoire à 6 000 pièces, vérifiée après chaque action de la table, même hors de son tour.",
  },
  { a: "card:greedy", b: "card:nepo-baby", text: "Cupide et Nepo Baby ne sont jamais distribués au même joueur." },
  {
    a: "card:goblin",
    b: "system:cups",
    text: "À chaque nouvelle Cup : −150 à chaque autre joueur, +150 au Goblin (plusieurs Goblins passent tous).",
  },
  {
    a: "card:new-cup-new-me",
    b: "system:cups",
    text: "Choix avant l'apparition de chaque nouvelle Cup : Départ (+200, sans arrivée) ou rester ; la Cup se révèle après le choix.",
  },
  {
    a: "card:new-cup-new-me",
    b: "system:hell",
    text: "La carte ne libère plus de l'Enfer (patch 0.2.0) : en peine, seule l'option « rester » reste ouverte.",
  },
  {
    a: "card:calm-down",
    b: "system:cups",
    text: "À chaque nouvelle Cup : remplace à exactement 3 cases de la Cup (case au choix) chaque joueur à 1-2 d'elle et plus proche qu'elle que lui ; un seul part.",
  },
  {
    a: "card:calm-down",
    b: "map:banquise",
    text: "Jamais remplacé sur la glace : les cases d'accueil de Calme-toi l'excluent.",
  },
  {
    a: "card:red-light-green-light",
    b: "system:move",
    text: "Toutes les cases vertes/rouges traversées comptent (marche, Botte, glissade, avance de roue) ; les poses (Corde, échange, téléport) ne traversent rien.",
  },
  {
    a: "card:red-light-green-light",
    b: "system:cups",
    text: "Le quota (2 vertes à +100, 2 rouges à −50) se remet à zéro à chaque nouvelle Cup.",
  },
  {
    a: "card:roller",
    b: "system:move",
    text: "Dé à 6 faces puis exactement ce nombre de cases, sans jamais repasser par une case foulée (sinon : les plus longs chemins possibles sont joués).",
  },
  {
    a: "card:roller",
    b: "system:cups",
    text: "Pour ramasser la Red Cup, il faut un 6 en deux essais (visibles de tous, avec bannière) ; deux ratés et elle l'attend à son prochain tour, sans déplacement demandé.",
  },
  {
    a: "card:double-or-nothing",
    b: "system:money",
    text: "Chaque gain/perte est mis en file puis jouable au repos de la table ; achats, reventes, Corrupteur et amende du voleur exclus ; un K.O. est suspendu tant que sa mise court.",
  },
  {
    a: "card:red-hand",
    b: "wheel:misfortune",
    text: "Main rouge : deux secteurs du malheur tirés, le moins mauvais est gardé.",
  },
  {
    a: "card:green-hand",
    b: "wheel:fortune",
    text: "Main verte : deux secteurs du bonheur tirés, le meilleur est gardé ; face à « Va au Départ », son choix remplace celui Départ/rien.",
  },
  {
    a: "card:angelic-touch",
    b: "wheel:fortune",
    text: "Touché angélique : les DEUX résultats du bonheur s'appliquent.",
  },
  {
    a: "card:devils-hand",
    b: "wheel:misfortune",
    text: "Touché funeste : les deux résultats du malheur s'appliquent.",
  },
  {
    a: "card:devils-hand",
    b: "wheel:hell",
    text: "Touché funeste aussi sur la roue de l'Enfer : deux résultats qui s'appliquent.",
  },
  {
    a: "card:hell-regular",
    b: "wheel:hell",
    text: "La roue de l'Enfer reste la roue de l'Enfer pour l'Habitué : seule sa peine de sortie change.",
  },
  {
    a: "item:wake-up",
    b: "wheel:misfortune",
    text: "« Passe ton prochain tour » du malheur est annulable par le Réveil.",
  },
  {
    a: "item:wake-up",
    b: "wheel:hell",
    text: "« Tu sautes ton prochain tour » de la roue de l'Enfer est annulable par le Réveil ; s'il annule, aucun tour de peine n'est consommé.",
  },
  {
    a: "item:parachute",
    b: "wheel:misfortune",
    text: "« Direction l'Enfer » tourné avec un Parachute : le Parachute s'ouvre, on reste chez soi.",
  },
  {
    a: "item:parachute",
    b: "wheel:hell",
    text: "Le défi « Choisis un joueur à affronter » de la roue de l'Enfer : la VICTIME tirée peut ouvrir son Parachute pour ne pas descendre — le duel tombe alors.",
  },
  {
    a: "card:devil",
    b: "wheel:hell",
    text: "Le défi de la roue de l'Enfer peut tirer le diable comme victime s'il est en Enfer.",
  },
  {
    a: "item:tomato",
    b: "wheel:misfortune",
    text: "« Perds un objet » sur une pile de Tomates : la PILE ENTIÈRE part (une pile compte comme un objet).",
  },
  {
    a: "wheel:fortune",
    b: "system:hell",
    text: "« Va au Départ » de la roue du bonheur libère un joueur de l'Enfer sans péage (la peine recommence à la prochaine entrée) — mais seulement s'il choisit le Départ (patch 0.2.0).",
  },
  {
    a: "wheel:fortune",
    b: "system:turn",
    text: "« Va au Départ » (patch 0.2.0) propose un choix : y aller ou « Rien ne se passe » ; le chrono expiré, le moteur départage les deux à 50/50.",
  },
  {
    a: "wheel:fortune",
    b: "hub:shop",
    text: "Le panier « objet gratuit » est une liste fixe de 8 objets publics à 400 ou moins ; sac incapable de les recevoir : +200 pièces à la place.",
  },
  {
    a: "wheel:fortune",
    b: "card:guardian-angel",
    text: "Le don gratuit de la roue filtre les objets nuisibles chez l'Ange (il ne reçoit que Botte/Gomme du panier, sinon +200 pièces).",
  },
  // ————— Duels, Portes de l'Enfer —————
  {
    a: "hub:duels",
    b: "item:parachute",
    text: "La victime du défi de la roue de l'Enfer qui garde un Parachute n'y descend pas : le duel tombe faute de combattant.",
  },
  { a: "hub:duels", b: "card:blind-luck", text: "Chance aveugle ne peut pas être appelé en Enfer pour un duel." },
  { a: "hub:duels", b: "card:guardian-angel", text: "L'Ange-Gardien ne peut pas être appelé en Enfer pour un duel." },
  {
    a: "hub:duels",
    b: "system:hell",
    text: "Deux joueurs en Enfer au repos de la table : duel automatique (le premier siège avec le suivant) ; le vainqueur part au Départ +200.",
  },
  // ————— Objets / Cartes ↔ Plateaux —————
  {
    a: "item:barrier",
    b: "map:banquise",
    text: "Une glissade qui heurte une Barrière rebondit sur sa case de glace puis repart par une autre route (elle passe outre si la route barrée est la seule sortie).",
  },
  {
    a: "item:bullet-bill",
    b: "map:luna-park",
    text: "Bullet Bill ignore le sens du carrousel et des tunnels pour trouver sa cible.",
  },
  {
    a: "item:portal",
    b: "map:banquise",
    text: "Les Portails ne s'ouvrent jamais sur la glace (personne n'y stationne), ni sur le Départ, l'Enfer ou la case de la Cup.",
  },
  { a: "item:water-bottle", b: "map:banquise", text: "La case d'atterrissage de la Bouteille exclut la glace." },
  {
    a: "item:made-in-heaven",
    b: "map:banquise",
    text: "Si la glace du blizzard gelait la case 8, elle fond sous la Red Cup.",
  },
  {
    a: "item:black-cup",
    b: "map:banquise",
    text: "Au retour de l'Enfer vers sa case d'origine, la Cup fait fondre une glace de blizzard posée dessus.",
  },
  {
    a: "item:rope",
    b: "map:banquise",
    text: "Tiré sur la glace, la glace emporte immédiatement le tiré (sans en faire une arrivée).",
  },
  {
    a: "item:monopoly-man",
    b: "map:banquise",
    text: "Échangé sur la glace, la glace l'emporte immédiatement ; une glissade en attente qui aurait dû reprendre est annulée.",
  },
  {
    a: "item:mud",
    b: "map:banquise",
    text: "La Boue posée sur une case que le blizzard gèle ensuite : la victime qui y est projetée par la glace ne la déclenche PAS (un transport de glace n'est pas une arrivée).",
  },
  {
    a: "map:luna-park",
    b: "hub:duels",
    text: "Le fantôme impose son propre duel à enjeux (butin, Enfer ou vol) quand on le croise.",
  },
  {
    a: "map:luna-park",
    b: "item:portal",
    text: "La dérive du fantôme ne déclenche pas les Portails : seule l'ARRÊT d'un joueur (marche ou roue) les fait fonctionner.",
  },
  {
    a: "map:banquise",
    b: "item:wake-up",
    text: "Gel par les boules de neige = tour sauté : le Réveil peut l'annuler, et le joueur « se réveille à temps ».",
  },
  {
    a: "map:banquise",
    b: "card:red-light-green-light",
    text: "Les cases traversées par une glissade comptent pour la carte.",
  },
  {
    a: "map:banquise",
    b: "card:new-cup-new-me",
    text: "Si le Départ est gelé au moment du choix New Cup, New Me, la glace emporte le joueur qui y file.",
  },
  {
    a: "map:banquise",
    b: "card:devil",
    text: "La peine du diable se compte aussi sur Banquise ; le Toucher d'Enfer y frappe les gelés assommés comme les autres.",
  },
  {
    a: "system:hell",
    b: "map:luna-park",
    text: "Les joueurs en Enfer sont marqués « déjà rencontrés » par le fantôme : en sortir sans bouger ne déclenche pas de duel.",
  },
  {
    a: "system:move",
    b: "map:luna-park",
    text: "Le carrousel 1-2-3-4 est à sens unique et s'inverse à chaque nouvelle Cup ; Corrupteur peut le prendre à rebrousse-poil (400 pièces).",
  },
  {
    a: "system:move",
    b: "map:classic",
    text: "Le tunnel 7 → 1 est un seul pas à sens unique : sortir du coffre par la gauche, reparaître à droite.",
  },
  {
    a: "system:money",
    b: "map:banquise",
    text: "Un Départ gelé par le blizzard ne paie pas ses 200 pièces — et la glace emporte celui qui y arrive.",
  },
];
