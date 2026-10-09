import {
  BULLET_BILL_DAMAGE,
  GOBLIN_THEFT,
  HELL_EXIT_TOLL,
  HERMIT_DISTANCE,
  HERMIT_ENERGY_BONUS,
  HERMIT_START_BONUS,
  INSURER_HELL_REWARD,
  INSURER_RATE,
  INSURER_ROUND_CAP,
  MAGE_MAX_LUCK,
  MARK_HELL_CHANCE,
  MARK_MUD_HELL_CHANCE,
  MIME_COOLDOWN_ROUNDS,
  MIST_CUP_DISTANCE,
  MOLE_COOLDOWN_ROUNDS,
  MOLE_DIG_ENERGY,
  MOLE_OWN_CROSSING_ENERGY,
  MUD_PENALTY,
  SISTER_SWAP_ENERGY,
  START_BONUS,
} from "../../game/types";
import { percent } from "../format";
import type { Interaction } from "../types";

/** What the bank pays L'Assureur for a loss of `lost` coins, as the engine rounds it. */
const payout = (lost: number): number => Math.floor(lost * INSURER_RATE);

/**
 * Les interactions des sept éléments du patch 0.2.3 : Mime, Taupe, Mage noir, Mi-vu, Mi-vue et Sœur Fantôme (Cups
 * Power), L'Ermite et L'Assureur (passifs). Assemblées dans `interactions.ts` ; chaque ligne est vérifiable dans
 * `mime.ts`, `mole.ts`, `black-mage.ts`, `mist.ts`, `sister.ts`, `hermit.ts`, `insurer.ts` ou
 * `src/game/cups-power.test.ts`. Les nombres viennent des constantes de `types.ts`.
 */
export const CUPS_POWER_INTERACTIONS: Interaction[] = [
  // ————— Mime —————
  {
    a: "card:mime",
    b: "card:greedy",
    text: "Copié, Cupide donne +1 000 pièces par Red Cup à la place d'une place de sac, vole 50 pièces aux assommés et se paie la Boue 100 : le temps du tour. Sa victoire à 6 000 pièces se vérifie aussi : un Mime qui a déjà ces pièces gagne dès qu'il le copie.",
  },
  {
    a: "card:mime",
    b: "card:red-bull",
    text: "Red Bull copié ajoute son point d'énergie tout de suite : le Mime joue à 4 points ce tour-là, sans avoir payé la copie.",
  },
  {
    a: "card:mime",
    b: "card:eshop",
    text: "eShop copié ouvre la boutique après le déplacement du Mime, où qu'il s'arrête, jusqu'à la fin de son tour.",
  },
  {
    a: "card:mime",
    b: "card:tomato-enjoyer",
    text: "Tomato Enjoyer copié : une pile de Tomates par place du sac, plusieurs piles lancées dans le même tour, des Tomates qui assomment à 5 %.",
  },
  {
    a: "card:mime",
    b: "card:roller",
    text: "Roller copié : le Mime lance le dé avant de bouger (plus d'objet ensuite), doit réussir un 6 pour la Red Cup, et ne peut ni chausser ni acheter la Botte jusqu'à la fin de son tour.",
  },
  {
    a: "card:mime",
    b: "card:blind-luck",
    text: "Chance aveugle copié : aucun objet ne peut nuire au Mime (jamais une cible, Draven et Bullet Bill l'épargnent, la Boue le fait seulement reculer), mais la Red Cup disparaît de son écran jusqu'à la fin du tour.",
  },
  {
    a: "card:mime",
    b: "card:double-or-nothing",
    text: "Double or nothing copié : les gains et pertes de pièces du tour se mettent en file pour un 50/50, comme chez son titulaire.",
  },
  {
    a: "card:mime",
    b: "card:mole",
    text: `Taupe copiée : le Mime creuse avec son propre compteur de ${MOLE_COOLDOWN_ROUNDS} tours et ses propres cases visitées (il les note depuis le début de la partie) ; le tunnel est le sien : traversée à ${MOLE_OWN_CROSSING_ENERGY} énergie.`,
  },
  {
    a: "card:mime",
    b: "card:devil",
    text: "Refusé : le diable est un rôle posé au départ (victoire par l'Enfer, boutique, compteur de peines) ; il ne se copie pas.",
  },
  {
    a: "card:mime",
    b: "card:guardian-angel",
    text: "Refusé : L'Ange-Gardien est un rôle posé au départ, lié à un protégé tiré au sort.",
  },
  {
    a: "card:mime",
    b: "card:black-mage",
    text: "Refusé : le pentagramme et les chances du Mage noir vivent d'un tour à l'autre chez leur titulaire, pas le temps d'un seul tour.",
  },
  {
    a: "card:mime",
    b: "card:ghost-sister",
    text: "Refusé : la petite sœur est un état qui vit d'un tour à l'autre chez son titulaire.",
  },
  {
    a: "card:mime",
    b: "card:half-seen",
    text: "Refusé : le cycle d'invisibilité est celui de son titulaire. Un joueur invisible ne peut d'ailleurs pas être copié, et un Mime invisible ne copie personne.",
  },
  { a: "card:mime", b: "card:lambda", text: "Refusé : il n'y a rien à copier." },
  {
    a: "item:boot",
    b: "card:mime",
    text: "La copie se fait avant tout déplacement : impossible une fois la Botte chaussée (ou le dé du Roller lancé).",
  },
  {
    a: "card:mime",
    b: "system:turn",
    text: `Copier ne coûte aucune énergie et n'est pas une action : seule, elle ne permet pas de finir son tour sur place. Une copie tous les ${MIME_COOLDOWN_ROUNDS} tours de table, jusqu'à la fin du tour.`,
  },
  {
    a: "card:mime",
    b: "system:hell",
    text: "Un Mime en Enfer peut copier avant de tourner la roue de l'Enfer.",
  },
  {
    a: "card:mime",
    b: "system:online",
    text: "Ce que le Mime copie est un secret : la table lit seulement « X copie le Cups Power de Y », comme elle ne lit pas le contenu d'un sac.",
  },

  // ————— Taupe —————
  {
    a: "item:barrier",
    b: "card:mole",
    text: "Un tunnel n'est pas une route : la Barrière ne le ferme pas et ne gêne pas sa traversée.",
  },
  {
    a: "item:mud",
    b: "card:mole",
    text: "On ne creuse ni depuis ni vers une case de Boue. Une Boue posée plus tard sur l'extrémité d'un tunnel se déclenche à l'arrivée de qui le traverse.",
  },
  {
    a: "item:portal",
    b: "card:mole",
    text: "On ne creuse ni depuis ni vers une case où un Portail est ouvert ; un Portail ouvert plus tard sur l'extrémité d'un tunnel avale qui y arrive.",
  },
  {
    a: "item:boot",
    b: "card:mole",
    text: "Creuser et traverser tiennent lieu de déplacement : impossibles une fois la Botte chaussée.",
  },
  {
    a: "card:mole",
    b: "card:roller",
    text: "Le tunnel tient lieu de marche, donc avant le dé du Roller (impossible après). Un Roller qui arrive sur la Red Cup par un tunnel doit réussir son 6 comme à pied.",
  },
  {
    a: "card:mole",
    b: "card:corrupter",
    text: "Un tunnel ignore flèches et sens uniques sans rien payer : le Corrupteur n'a pas à sortir ses 400 pièces.",
  },
  {
    a: "card:mole",
    b: "card:red-light-green-light",
    text: "Seule la case d'arrivée d'un tunnel compte pour Red light, Green light : aucune case n'est « traversée ».",
  },
  {
    a: "card:mole",
    b: "item:bullet-bill",
    text: "Bullet Bill suit les routes, pas les tunnels de la Taupe : un tunnel ne rapproche personne de lui.",
  },
  {
    a: "card:mole",
    b: "card:calm-down",
    text: "Les distances de Calme-toi se comptent sur les routes : un tunnel ne raccourcit rien.",
  },
  {
    a: "card:mole",
    b: "card:ghost-sister",
    text: "Un tunnel n'est pas un pas : la sœur reste où elle est quand son joueur le prend.",
  },
  {
    a: "card:mole",
    b: "card:hermit",
    text: `Un tunnel ne rapproche personne de l'Ermite : sa distance de ${HERMIT_DISTANCE} cases se compte sur les routes. Qui arrive sur sa case par un tunnel lui retire sa prime.`,
  },
  {
    a: "card:mole",
    b: "system:turn",
    text: `Creuser demande ${MOLE_DIG_ENERGY} points d'énergie ; traverser, ${MOLE_DIG_ENERGY} (${MOLE_OWN_CROSSING_ENERGY} pour celui qui l'a creusé). Les deux sont un déplacement : toute l'énergie qui reste part avec.`,
  },
  {
    a: "card:mole",
    b: "system:move",
    text: "Un tunnel est un déplacement à part entière : ouvert dans les deux sens, visible de tous, refermé après une traversée de plus (la creuse est sa première utilisation). Pas de bonus du Départ, même vers la case 0 par sa flèche.",
  },
  {
    a: "card:mole",
    b: "system:tiles",
    text: "Arriver par un tunnel est une vraie arrivée : roue de la case, Boue, Portail, Red Cup, boutique à la fin du déplacement, glace de Banquise.",
  },
  {
    a: "card:mole",
    b: "system:cups",
    text: "On ne creuse ni depuis ni vers la case de la Red Cup ; apparue ensuite au bout d'un tunnel, elle est ramassée par qui y arrive.",
  },
  {
    a: "card:mole",
    b: "system:hell",
    text: "Jamais de tunnel depuis ni vers l'Enfer, aucune traversée depuis l'Enfer, et l'Enfer n'est jamais une case « visitée ».",
  },
  {
    a: "card:mole",
    b: "map:banquise",
    text: "On ne creuse ni depuis ni vers une case de glace. Si le blizzard gèle ensuite l'extrémité d'un tunnel, la glace emporte à son tour qui y arrive.",
  },
  {
    a: "card:mole",
    b: "map:luna-park",
    text: "Le Train fantôme est une route du plateau, sans rapport avec les tunnels de la Taupe. Le fantôme de Luna Park affronte qui arrive sur sa case, par tunnel aussi.",
  },

  // ————— Mage noir —————
  {
    a: "item:ndoye",
    b: "card:black-mage",
    text: "Visé par un Ndoye, le Mage noir peut se téléporter : l'objet est annulé (consommé, énergie perdue) et la roue ne tourne pas. S'il laisse faire, il peut encore se téléporter à la place d'un secteur qui le déplace.",
  },
  {
    a: "item:hollow-purple",
    b: "card:black-mage",
    text: "Visé par Hollow Purple, le Mage noir peut se téléporter sur sa marque : l'objet est annulé (consommé, énergie perdue) et personne ne descend en Enfer.",
  },
  {
    a: "item:rope",
    b: "card:black-mage",
    text: "La Corde visant le Mage noir peut être esquivée en se téléportant : l'objet est annulé et le Mage atterrit sur sa marque.",
  },
  {
    a: "item:middle-finger",
    b: "card:black-mage",
    text: "Le Middle Finger visant le Mage noir peut être esquivé en se téléportant : l'objet est annulé, pas de tour sauté.",
  },
  {
    a: "item:monopoly-man",
    b: "card:black-mage",
    text: "Le Monopoly Man visant le Mage noir peut être esquivé en se téléportant : pas d'échange, l'objet est perdu.",
  },
  {
    a: "item:draven",
    b: "card:black-mage",
    text: "Contre Draven, le Mage peut se téléporter : seul épargné (comme avec Non merci), il atterrit sur sa marque, et le reste de la table part quand même en Enfer.",
  },
  {
    a: "item:bullet-bill",
    b: "card:black-mage",
    text: "Quand la charge va toucher le Mage, il peut se téléporter avant l'impact, sans arriver (la case n'agit pas) : Bullet Bill choisit alors sa cible à nouveau, le joueur le plus proche, Mage compris.",
  },
  {
    a: "item:tomato",
    b: "card:black-mage",
    text: "Aucune réaction contre une Tomate : le Mage ne peut pas l'esquiver.",
  },
  {
    a: "item:mirror",
    b: "card:black-mage",
    text: "Un Miroir prêt répond avant tout : l'objet reflétable (Ndoye, Hollow Purple, Corde, Middle Finger) repart sur son lanceur, la fenêtre de réaction ne s'ouvre pas et le Mage garde sa chance.",
  },
  {
    a: "item:parachute",
    b: "card:black-mage",
    text: "Un « Direction l'Enfer » remplacé par la téléportation n'ouvre pas le Parachute : le Mage ne descend pas, il le garde.",
  },
  {
    a: "item:mud",
    b: "card:black-mage",
    text: `Pas de pentagramme sur une case de Boue. Une Boue posée sur la marque coûte au Mage ${MUD_PENALTY} pièces à l'arrivée, comme à tout le monde, et le fait tomber en Enfer avec ${percent(MARK_MUD_HELL_CHANCE)} de chances ; elle disparaît.`,
  },
  {
    a: "item:portal",
    b: "card:black-mage",
    text: "Un Portail du diable ouvert sur la marque avale le Mage qui s'y téléporte, comme tout joueur qui y arrive (sauf pour esquiver Bullet Bill, où la case n'agit pas).",
  },
  {
    a: "item:barrier",
    b: "card:black-mage",
    text: "Les Barrières ne gênent pas la téléportation : le Mage ignore routes, Barrières et flèches.",
  },
  {
    a: "card:no-thanks",
    b: "card:black-mage",
    text: "Deux réponses à un objet ou à Bullet Bill : Non merci (rechargé en 5 tours de table) ou la téléportation (1 chance) ; la fenêtre s'ouvre dès que l'une des deux est possible. Sur une roue, Non merci l'efface, la téléportation déplace le Mage.",
  },
  {
    a: "card:angelic-touch",
    b: "card:black-mage",
    text: "Si le premier résultat du couple est « Avance d'une case » ou « Va au Départ », le Mage peut se téléporter à la place ; la roue jumelle s'applique ensuite.",
  },
  {
    a: "card:devils-hand",
    b: "card:black-mage",
    text: "Si le premier résultat du couple est « Direction l'Enfer » ou « Retourne d'où tu viens », le Mage peut se téléporter à la place ; la roue jumelle s'applique ensuite.",
  },
  {
    a: "card:black-mage",
    b: "card:hermit",
    text: "Un Mage qui se téléporte sur la case de l'Ermite y ARRIVE : l'Ermite perd sa prime jusqu'à la fin de son prochain tour.",
  },
  {
    a: "card:black-mage",
    b: "wheel:misfortune",
    text: "« Direction l'Enfer » et « Retourne d'où tu viens » peuvent être remplacés par la téléportation sur la marque (1 chance) : la roue est écartée comme par la Gomme.",
  },
  {
    a: "card:black-mage",
    b: "wheel:fortune",
    text: "« Avance d'une case » et « Va au Départ » aussi : le Mage se téléporte à la place (et renonce aux 200 pièces du Départ).",
  },
  {
    a: "card:black-mage",
    b: "wheel:hell",
    text: "La roue de l'Enfer n'a aucun secteur remplaçable, mais le Mage peut se téléporter AVANT de la tourner (à son tour), ce qui le sort de l'Enfer.",
  },
  {
    a: "card:black-mage",
    b: "map:banquise",
    text: "Une marque posée sur une case que le blizzard gèle ensuite emporte le Mage : il arrive là où la glissade s'arrête.",
  },
  {
    a: "card:black-mage",
    b: "system:move",
    text: "La téléportation n'est pas un pas : routes, Barrières et flèches ignorées. Aucune énergie, et le tour continue (le Mage peut encore se déplacer).",
  },
  {
    a: "card:black-mage",
    b: "system:tiles",
    text: "Se téléporter EST une arrivée (roue de la case, Boue, Portail, Red Cup) — sauf pour esquiver Bullet Bill, ou quand la marque est déjà sous ses pieds.",
  },
  {
    a: "card:black-mage",
    b: "system:cups",
    text: "Arrivé sur une marque où se trouve la Red Cup, le Mage la ramasse.",
  },
  {
    a: "card:black-mage",
    b: "system:hell",
    text: `En tour, la téléportation sort le Mage de l'Enfer (sans bonus du Départ ni péage, compteur de peine remis à zéro). Esquiver (Hollow Purple, Draven, « Direction l'Enfer ») évite l'entrée : ni point du diable, ni +150 de l'Habitué, ni +${INSURER_HELL_REWARD} de l'Assureur. À l'inverse, chaque autre joueur sur la marque a ${percent(MARK_HELL_CHANCE)} d'y tomber quand le Mage s'y pose, et la marque reste alors sur le plateau.`,
  },
  {
    a: "card:black-mage",
    b: "system:victory",
    text: `Sans chance (il en a ${MAGE_MAX_LUCK} au départ), le Mage est éliminé comme s'il abandonnait : s'il ne reste qu'un joueur, celui-ci gagne par abandon.`,
  },

  // ————— Mi-vu, Mi-vue —————
  {
    a: "item:ndoye",
    b: "card:half-seen",
    text: "Invisible, il n'est pas dans la liste des cibles de Ndoye, et il ne peut viser personne.",
  },
  {
    a: "item:hollow-purple",
    b: "card:half-seen",
    text: "Invisible, il ne peut être visé par Hollow Purple, ni en lancer un.",
  },
  {
    a: "item:rope",
    b: "card:half-seen",
    text: "Invisible, il ne peut être tiré par une Corde, ni tirer quelqu'un.",
  },
  {
    a: "item:middle-finger",
    b: "card:half-seen",
    text: "Invisible, il ne reçoit pas de Middle Finger et n'en lance pas.",
  },
  {
    a: "item:monopoly-man",
    b: "card:half-seen",
    text: "Invisible, il ne peut être échangé par un Monopoly Man, ni échanger sa place.",
  },
  {
    a: "item:tomato",
    b: "card:half-seen",
    text: "On ne lance pas de Tomate sur un joueur invisible, et lui n'en lance sur personne.",
  },
  {
    a: "item:draven",
    b: "card:half-seen",
    text: "Draven épargne le joueur invisible, comme Chance aveugle : les autres partent, pas lui.",
  },
  {
    a: "item:bullet-bill",
    b: "card:half-seen",
    text: `Bullet Bill ne traque pas un joueur invisible ; mais l'explosion qui éclate sur sa case l'assomme comme les autres (−${BULLET_BILL_DAMAGE} pièces, un tour sauté).`,
  },
  {
    a: "item:sentence",
    b: "card:half-seen",
    text: "La Sentence ne cible personne : elle frappe un joueur invisible à 0 pièce ou moins comme n'importe qui.",
  },
  {
    a: "item:portal",
    b: "card:half-seen",
    text: "Un Portail n'a pas d'yeux : l'invisible qui s'arrête dessus tombe en Enfer comme un autre.",
  },
  {
    a: "item:made-in-heaven",
    b: "card:half-seen",
    text: "Made In Heaven renvoie aussi les joueurs invisibles au Départ.",
  },
  {
    a: "card:half-seen",
    b: "card:calm-down",
    text: "Calme-toi ne propose jamais un joueur invisible, et un détenteur invisible ne replace personne.",
  },
  {
    a: "card:half-seen",
    b: "card:hermit",
    text: `Un joueur invisible compte pour la distance de l'Ermite (${HERMIT_DISTANCE} cases) : invisible ne veut pas dire loin.`,
  },
  {
    a: "card:half-seen",
    b: "wheel:hell",
    text: "Le défi « Choisis un joueur à affronter » ne tire jamais un joueur invisible, et un invisible qui tourne la roue ne défie personne : sans adversaire possible, le duel n'a pas lieu.",
  },
  {
    a: "card:half-seen",
    b: "map:luna-park",
    text: "Le fantôme n'est pas un ciblage : il affronte un joueur invisible qui s'arrête sur sa case, ou qu'il rattrape.",
  },
  {
    a: "card:half-seen",
    b: "map:banquise",
    text: "Les pingouins ne choisissent pas leurs cibles par la vue : une boule de neige peut viser un joueur invisible.",
  },
  {
    a: "card:half-seen",
    b: "system:cups",
    text: `À ${MIST_CUP_DISTANCE} case ou moins de la Red Cup, il redevient visible : l'invisibilité se calcule à chaque instant, avec la position de la Cup.`,
  },
  {
    a: "card:half-seen",
    b: "system:turn",
    text: "Le cycle avance au début de chaque tour du joueur, même un tour sauté (K.O., Middle Finger…) : visible, invisible, invisible.",
  },
  {
    a: "card:half-seen",
    b: "system:online",
    text: "En ligne, le brouillard est visuel : l'invisible ne voit plus les autres (pions, actions, sacs, pièces, pièges, Red Cup, Bullet Bill) et les autres ne voient plus son pion, ses actions, son sac ni ses pièces. Le jeu, lui, reste partagé.",
  },

  // ————— Sœur Fantôme —————
  {
    a: "item:boot",
    b: "card:ghost-sister",
    text: "Chaque case de la Botte est un pas : la sœur en fait deux, en miroir. Chaussée, la Botte oblige le Swap à garder 1 point pour le déplacement.",
  },
  {
    a: "item:mud",
    b: "card:ghost-sister",
    text: "Elle ne tombe pas dans la Boue ; le Swap emporte toute la Boue de sa case sur la case que le joueur quitte, sans la déclencher.",
  },
  {
    a: "item:portal",
    b: "card:ghost-sister",
    text: "Elle ne tombe pas dans un Portail du diable ; le Swap emporte ceux de sa case sur la case que le joueur quitte.",
  },
  {
    a: "item:bullet-bill",
    b: "card:ghost-sister",
    text: "Bullet Bill ne la prend jamais pour cible ; s'il se trouve sur sa case, le Swap l'emporte sur la case que le joueur quitte.",
  },
  {
    a: "item:barrier",
    b: "card:ghost-sister",
    text: "Une Barrière la retient comme son joueur : si son pas miroir est barré, elle reste sur place.",
  },
  {
    a: "item:rope",
    b: "card:ghost-sister",
    text: "Tiré par une Corde, le joueur laisse sa sœur où elle est.",
  },
  {
    a: "item:monopoly-man",
    b: "card:ghost-sister",
    text: "Échangé par un Monopoly Man, le joueur laisse sa sœur où elle est.",
  },
  {
    a: "item:made-in-heaven",
    b: "card:ghost-sister",
    text: "Renvoyé au Départ par Made In Heaven, le joueur laisse sa sœur où elle est.",
  },
  {
    a: "card:ghost-sister",
    b: "card:roller",
    text: "Chaque case du parcours du dé est un pas : la sœur en fait autant, en miroir.",
  },
  {
    a: "card:ghost-sister",
    b: "card:corrupter",
    text: "Un pas à contresens payé 400 pièces est reflété comme les autres ; mais la sœur, elle, respecte les flèches de sa propre case.",
  },
  {
    a: "card:ghost-sister",
    b: "wheel:fortune",
    text: "« Avance d'une case » est un pas à pied : la sœur le reflète. « Va au Départ » téléporte le joueur : elle reste où elle est.",
  },
  {
    a: "card:ghost-sister",
    b: "map:banquise",
    text: "Chaque case d'une glissade est un pas pour la sœur, qui peut se retrouver sur la glace sans y être emportée ; le Swap qui y pose le joueur le fait emporter aussitôt par la glace.",
  },
  {
    a: "card:ghost-sister",
    b: "map:classic",
    text: "Sur le plateau classique, petit et très fléché, la sœur reste souvent sur place : peu de routes partent dans la direction opposée à celle du joueur.",
  },
  {
    a: "card:ghost-sister",
    b: "system:cups",
    text: "Elle ne ramasse jamais la Red Cup ; le Swap peut l'emporter avec elle sur la case que le joueur quitte.",
  },
  {
    a: "card:ghost-sister",
    b: "system:hell",
    text: "Tombé en Enfer, le joueur voit sa sœur retourner au Départ ; pas de Swap depuis l'Enfer, et en sortir n'est pas un pas : elle reste au Départ.",
  },
  {
    a: "card:ghost-sister",
    b: "system:move",
    text: "Le miroir suit les vraies routes (flèches et sens uniques compris) ; sans route dans la direction opposée, à 40° près, elle reste.",
  },
  {
    a: "card:ghost-sister",
    b: "system:tiles",
    text: `Le Swap (${SISTER_SWAP_ENERGY} énergie) n'est pas une arrivée : la case de la sœur ne donne ni roue ni boutique, et ce qu'elle emporte ne se déclenche pas.`,
  },

  // ————— L'Ermite —————
  {
    a: "item:rope",
    b: "card:hermit",
    text: "Une Corde qui tire quelqu'un sur la case de l'Ermite lui retire sa prime, même si c'est la sienne ; tiré par la Corde d'un autre, c'est lui qui arrive : pas d'intrusion (mais le voilà à côté de son lanceur).",
  },
  {
    a: "item:monopoly-man",
    b: "card:hermit",
    text: "Un échange n'est pas une arrivée sur la case de l'Ermite : il change de place et personne n'arrive sur la sienne ; seule la proximité compte ensuite.",
  },
  {
    a: "item:made-in-heaven",
    b: "card:hermit",
    text: `Tout le monde revient au Départ : un Ermite qui s'y trouve voit tous les autres arriver sur sa case (prime perdue) ; ailleurs, toute la table est au Départ, et la prime ne tient que s'il en est à plus de ${HERMIT_DISTANCE} cases.`,
  },
  {
    a: "card:hermit",
    b: "card:red-bull",
    text: "Cumulables : Red Bull +1 et L'Ermite +1 quand il est seul, soit 5 points d'énergie.",
  },
  {
    a: "card:hermit",
    b: "card:calm-down",
    text: "Un joueur que Calme-toi pose sur la case de l'Ermite y ARRIVE : il lui retire sa prime (jusqu'à la fin de son prochain tour).",
  },
  {
    a: "card:hermit",
    b: "wheel:fortune",
    text: `« Va au Départ et gagne 200 pièces » rapporte ${START_BONUS + HERMIT_START_BONUS} pièces à un Ermite seul (personne à ${HERMIT_DISTANCE} cases ou moins du Départ).`,
  },
  {
    a: "card:hermit",
    b: "system:turn",
    text: `+${HERMIT_ENERGY_BONUS} point d'énergie à l'ouverture du tour s'il est seul à ${HERMIT_DISTANCE} cases ou moins ; réglé une seule fois, à l'ouverture.`,
  },
  {
    a: "card:hermit",
    b: "system:tiles",
    text: `+${HERMIT_START_BONUS} pièces à chaque bonus du Départ (flèche, « Va au Départ », sortie d'Enfer, duel gagné, New Cup, New Me), s'il est seul au moment du paiement.`,
  },
  {
    a: "card:hermit",
    b: "system:hell",
    text: "Un joueur en Enfer n'est près de personne (sauf de qui y est aussi) : il ne gêne jamais la prime de l'Ermite.",
  },

  // ————— L'Assureur —————
  {
    a: "card:insurer",
    b: "card:double-or-nothing",
    text: "Une perte de pièces que la victime peut miser est payée à l'Assureur au moment où elle se produit, même si son 50/50 l'annule ensuite (rien n'est repris) ; et rien de plus si elle est doublée. Les gains de l'Assureur ne sont jamais misés.",
  },
  {
    a: "card:insurer",
    b: "card:goblin",
    text: `Le vol du Goblin est une perte de ${GOBLIN_THEFT} pièces pour chacune de ses victimes : ${payout(GOBLIN_THEFT)} pièces par victime pour l'Assureur, à chaque nouvelle Red Cup (sauf s'il est lui-même volé).`,
  },
  {
    a: "card:insurer",
    b: "card:hell-regular",
    text: `À chaque descente de l'Habitué de l'Enfer : +150 pour lui et +${INSURER_HELL_REWARD} pour l'Assureur, payés par la banque. Son péage de sortie (${HELL_EXIT_TOLL} pièces) est une perte comme une autre : ${payout(HELL_EXIT_TOLL)} pour l'Assureur.`,
  },
  {
    a: "card:insurer",
    b: "card:devil",
    text: `Chaque entrée d'un autre joueur en Enfer rapporte 50 pièces au diable (et un point) ET ${INSURER_HELL_REWARD} à l'Assureur ; celle du diable lui-même lui rapporte 100, et ${INSURER_HELL_REWARD} à l'Assureur.`,
  },
  {
    a: "card:insurer",
    b: "card:corrupter",
    text: "Les 400 pièces du Corrupteur sont une dépense voulue : rien pour l'Assureur.",
  },
  {
    a: "card:insurer",
    b: "card:thief",
    text: "L'amende du Voleur pris est une dépense forcée que Double or nothing ne mise pas non plus : rien pour l'Assureur.",
  },
  {
    a: "card:insurer",
    b: "card:guardian-angel",
    text: "L'Ange-Gardien ne descend jamais en Enfer : le tour qu'il perd à la place ne rapporte pas les 50 pièces à l'Assureur.",
  },
  {
    a: "item:mud",
    b: "card:insurer",
    text: `Tomber dans la Boue coûte ${MUD_PENALTY} pièces : ${payout(MUD_PENALTY)} pour l'Assureur. Les 100 du poseur sont un gain, pas une perte.`,
  },
  {
    a: "item:ndoye",
    b: "card:insurer",
    text: "La perte d'une roue du malheur tournée par un Ndoye compte pour l'Assureur, sauf si la cible est l'Assureur lui-même.",
  },
  {
    a: "item:helmet",
    b: "card:insurer",
    text: "La perte est comptée telle qu'elle est vraiment : un Casque qui ramène un solde sous zéro à zéro ne laisse compter que ce que le joueur avait.",
  },
  {
    a: "item:parachute",
    b: "card:insurer",
    text: "Un Parachute qui évite la descente en Enfer annule aussi les 50 pièces de l'Assureur.",
  },
  {
    a: "item:bullet-bill",
    b: "card:insurer",
    text: `L'impact de Bullet Bill coûte ${BULLET_BILL_DAMAGE} pièces à sa victime : ${payout(BULLET_BILL_DAMAGE)} pour l'Assureur, par joueur touché.`,
  },
  {
    a: "card:insurer",
    b: "wheel:misfortune",
    text: `Les secteurs −200, −300 et −400 rapportent ${payout(200)}, ${payout(300)} et ${payout(400)} pièces à l'Assureur quand un autre les tourne ; « Direction l'Enfer » lui en rapporte ${INSURER_HELL_REWARD}.`,
  },
  {
    a: "card:insurer",
    b: "wheel:hell",
    text: `Les secteurs −100, −200 et −400 de la roue de l'Enfer rapportent ${payout(100)}, ${payout(200)} et ${payout(400)} pièces à l'Assureur.`,
  },
  {
    a: "card:insurer",
    b: "hub:shop",
    text: "Les achats et les reventes ne sont pas des pertes subies : rien pour l'Assureur.",
  },
  {
    a: "card:insurer",
    b: "system:money",
    text: `${percent(INSURER_RATE)} de chaque perte subie par un autre (arrondi à l'inférieur), versés par la banque, au plus ${INSURER_ROUND_CAP} pièces par tour de table ; les ${INSURER_HELL_REWARD} des descentes en Enfer sont hors plafond.`,
  },
  {
    a: "card:insurer",
    b: "system:hell",
    text: `Chaque autre joueur qui entre en Enfer rapporte ${INSURER_HELL_REWARD} pièces à l'Assureur, quelle que soit la porte (roue, Hollow Purple, Draven, Sentence, Portail, duel…).`,
  },
];
