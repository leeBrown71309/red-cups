/**
 * The important changes of every version, newest first. Players read this
 * page: it lists what changes the game, not every fix.
 */

export interface ChangelogEntry {
  version: string;
  /** ISO date of the release. */
  date: string;
  title: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.2.2",
    date: "2026-10-08",
    title: "La préparation passe en plein écran",
    highlights: [
      "Fini le petit panneau flottant : préparer une partie se fait désormais sur des pages entières, sur une scène de soirée qui ne cache plus rien. Trois chapitres — les joueurs, la carte, la distribution — reliés par un bandeau en forme de petit plateau, où le gobelet rouge avance de case en case.",
      "La table est dessinée vue du dessus : les pions s’assoient autour, dans l’ordre de jeu. Glisse un joueur par sa poignée (ou utilise les flèches du clavier) et les pions se déplacent autour de la table en même temps ; « Mélanger l’ordre » les rassoit tous au hasard.",
      "Les huit places sont toujours visibles : celles qui sont libres t’attendent en pointillés, et le pion de chaque joueur garde sa couleur d’un bout à l’autre.",
      "Le choix de la carte devient un sélecteur de niveau : la liste à gauche, le plan en grand à droite avec ses spécialités. Un balayage du doigt ou les flèches du clavier changent de carte.",
      "Le draft des actifs occupe tout l’écran : la carte se tient à gauche — on peut l’incliner, la retourner et voir son dos, l’autre carte reste en retrait derrière — et sa règle complète s’écrit en grand à droite, avec son icône, son nom et sa famille.",
      "Les passifs tirés au sort gardent leur talisman à gauche et gagnent la même fiche détaillée à droite ; l’écran de passation en local est une page entière, avec la progression de la table en haut.",
      "Le mode en ligne adopte les mêmes pages : accueil, salon (la table et ses places, avec le code bien en vue) puis choix de la carte pour l’hôte.",
      "Le lancement vient en dernier : la carte mène à la distribution des cartes, et la partie démarre quand le dernier joueur a validé son passif.",
      "Moins de lenteurs : le plateau 3D n’est plus dessiné derrière les pages de préparation, et le flou plein écran qui alourdissait chaque image est remplacé par un simple dégradé.",
      "Roller : la Red Cup se mérite. En arrivant dessus, il faut un 6 au dé, avec deux essais, montrés à toute la table puis annoncés sur une bannière. Raté deux fois, la Red Cup l’attend et il n’a pas à bouger à son prochain tour : il utilise ses objets s’il le souhaite, puis retente ses deux lancers.",
      "Chance aveugle dans la Boue : on voit enfin le pion monter sur la case, patiner et être projeté en arrière avant que la Boue ne disparaisse.",
      "Le diable n’est plus annoncé à la table : ni toast, ni ligne dans l’historique de la partie. C’est un actif comme les autres.",
      "Tout est pensé pour le téléphone en paysage comme pour l’ordinateur.",
      "Le menu principal affiche désormais les repères de la partie (2 à 8 joueurs, 3 Red Cups pour gagner, 2 000 pièces au départ).",
    ],
  },
  {
    version: "0.2.1",
    date: "2026-10-08",
    title: "Des passifs tirés au sort, et un look bien à eux",
    highlights: [
      "Avant la partie, tu choisis toujours ton actif, mais ton passif est tiré au sort : plus de passif identique d’une partie à l’autre, et deux joueurs n’ont jamais le même passif.",
      "Les passifs quittent le format carte : ce sont des talismans, de grosses pièces en 3D qui flottent, brillent et se penchent vers ton doigt ou ta souris. Les actifs gardent leurs cartes de tarot.",
      "Touché angélique agit uniquement sur la roue du bonheur : la « roue de l’Ange » n’existait pas, la description la mentionnait à tort.",
      "Main du diable devient Touché funeste, pour aller de pair avec Touché angélique.",
      "Baraqué a enfin une icône qui lui ressemble : un bras de costaud qui gonfle son biceps.",
      "Un Portail qui avale un joueur n’active pas sa case : ni roue, ni boutique — et si une Red Cup trônait dessus, elle est ramassée avant la chute.",
      "Hollow Purple ne vise plus un joueur déjà en Enfer : impossible à cibler, l’objet reste dans le sac.",
      "Pendant Doomsday, toute l’ambiance bascule : un ciel et une lumière rouge sang, une brume cramoisie, et chaque case (l’Enfer exceptée) devient rouge braise, quelle que soit sa couleur. Tout revient doucement à la normale quand le sort s’éteint.",
      "Le diable n’est plus annoncé par une bannière en début de partie : le journal, les toasts et la flamme au-dessus de sa tête le disent déjà.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-10-07",
    title: "On ne joue plus qu’en ligne, et le jeu vous écoute",
    highlights: [
      "Sur le site public, le jeu en local disparaît du menu : « Jouer en ligne » devient l’unique grand bouton rouge pour commencer. Le local reste réservé aux tests.",
      "Nouvelle page « Signaler un bug, une idée », ouverte depuis le menu du jeu et depuis le wiki : un objet capricieux, une carte tordue, une idée de règle ? Écrivez-la, avec l’élément du jeu concerné.",
      "Chaque signalement est lu et trié par l’équipe : nouveau, en cours, corrigé ou rejeté.",
      "Premier tri de vos signalements — New Cup, New Me ne sort plus de l’Enfer : en peine, seule l’option « rester » reste ouverte.",
      "Être assommé est un vrai statut : il dure jusqu’à ce que tu puisses rejouer. Le Toucher d’Enfer et les vols du Cupide peuvent encore te viser après ton tour sauté — et ton pion affiche les zzz tant que tu n’as pas rejoué.",
      "« Va au Départ » de la roue du bonheur devient un choix : y aller pour les 200 pièces… ou que rien ne se passe. Faute de réponse, le chrono et le moteur tranchent à 50/50. En Enfer, le choix du Départ libère toujours, « rien » jamais.",
      "Les Portails se jouent à l’écran : ton pion marche jusqu’à la case, le portail s’élargit sur toute la case et t’avale, puis un portail s’ouvre au-dessus de l’Enfer pour te laisser tomber. Plus jamais une conséquence sans la voir.",
      "Double or nothing troque ses deux dés contre une pièce taillée en 50/50 ; Roller montre désormais un dé, fidèle à sa règle.",
      "Nepo Baby l’annonce enfin comme il joue : 1 000 pièces de plus que les autres au départ (et non 3 000 quoi qu’il arrive).",
    ],
  },
  {
    version: "0.1.5",
    date: "2026-10-05",
    title: "Menu, cartes de tarot et salons ouverts",
    highlights: [
      "Nouveau menu d’accueil avec la version du jeu, les paramètres et ce journal des modifications.",
      "Les passifs prennent la forme de cartes de tarot, au choix du passif comme dans l’aide.",
      "En ligne, un salon reste ouvert jusqu’à la fin du premier tour de table : on peut le rejoindre pendant le choix des passifs et la première manche.",
      "L’hôte peut exclure un joueur du salon, avant ou pendant la partie.",
      "Un joueur endormi (zzz) au début de son tour ne joue plus : son tour est sauté.",
      "La fiche d’un joueur ne se ferme plus en touchant le plateau : une croix la ferme, et son texte défile sans faire bouger la carte.",
      "L’aide s’ouvre sur les règles de base, classées par sujet ; ses onglets restent fixes et seule la page défile, sur mobile comme sur ordinateur.",
      "Les passifs ont leurs propres icônes dessinées, et des cartes toutes de la même hauteur, au texte défilant.",
      "Du décor vivant autour de chaque carte (moulin, grande roue, aurore boréale…), avec un cadre flou sur ordinateur.",
      "Le journal a son propre bouton à côté du menu et note chaque action : achats, déplacements, objets, cases.",
      "Pendant un mini-jeu, les joueurs qui n’y participent pas n’ont plus aucun bouton.",
      "Le diable : chaque descente d’un autre joueur en Enfer lui rapporte 50 pièces et un point, la sienne 100 pièces. Son objet devient les Portails (400 pièces) : deux portails cachés qui se dévoilent au deuxième et au troisième tour.",
      "Un joueur exclu peut demander à revenir : l’hôte reçoit la demande et l’accepte ou la refuse (la base de données doit être mise à jour).",
      "Deux cartes par joueur : un actif (le moteur de ta victoire) et un passif (un avantage ciblé), choisis en deux étapes. En ligne, les autres ne voient plus ton sac ni ton actif.",
      "Goblin devient un passif : il vole 150 pièces à chaque joueur à chaque nouvelle Red Cup.",
      "Neuf nouveaux passifs : Dernier de la classe, Habitué de l’Enfer, Main verte, Main rouge, Touché angélique, Touché funeste, Meneur de jeu, Brocanteur et Piégeur.",
      "Quatre nouveaux objets : Réveil, Parachute, Miroir et Barrière (on touche une route du plateau : elle est fermée pendant 1 tour de table).",
      "Équilibrage : Cupide gagne à 6 000 pièces, Made In Heaven coûte 1 300, l’Ange-Gardien démarre avec 800 pièces, et les cases rouges de Red light, Green light coûtent 50.",
      "Main verte et Main rouge font tourner deux roues côte à côte : tu gardes le résultat de ton choix. Touché angélique et Touché funeste lancent aussi deux roues en parallèle, et les deux résultats s’appliquent l’un après l’autre.",
      "Double or nothing : le résultat du pile ou face s’affiche en grand au centre de l’écran pour toute la table, une perte qui t’assommerait peut être jouée avant l’assommoir, et le poseur d’une Boue touchée reçoit le double ou rien selon le résultat.",
      "Barrière à 400 pièces et pour un seul tour de table ; la Botte la saute d’une seule case. Parachute à 650, Doomsday à 555.",
      "Bullet Bill atteint tous les joueurs de la case où il explose. Calme-toi ne déplace plus qu’un seul joueur, au choix. Les Portails n’affectent pas le diable.",
      "La Botte doit être suivie d’un déplacement, et ne se chausse pas sans route libre. L’Ange-Gardien n’a ni le Piégeur ni d’objet nuisible en cadeau, Cupide n’a pas Nepo Baby.",
      "Les objets et les cartes de l’aide s’affichent comme la boutique : liste à gauche avec recherche, détail fixe à droite, carte de tarot en 3D. La boutique est redessinée.",
    ],
  },
  {
    version: "0.1.4",
    date: "2026-10-03",
    title: "La grande refonte",
    highlights: [
      "L’énergie remplace l’action unique : chaque objet a son coût, le déplacement prend le reste.",
      "Choix des passifs avant la partie (draft), puis 20 passifs dont 12 nouveaux et 3 victoires propres.",
      "Le diable et sa boutique, L’Ange-Gardien et son protégé.",
      "Nouveaux objets, nouvelles roues, Tomate, Bouclier, Bullet Bill rééquilibré.",
      "Deux nouveaux mini-jeux : le bras de fer et le Blackjack.",
      "En ligne : chrono de tour partagé de 45 secondes, trois chances avant forfait, pause pour toute la table.",
      "Flèches dessinées sur les cases, légende et plan 2D revus.",
    ],
  },
  {
    version: "0.1.3",
    date: "2026-09-27",
    title: "Luna Park et Banquise",
    highlights: [
      "Deux nouvelles cartes : Luna Park, hanté par un fantôme voleur, et Banquise, où les pions glissent sur la glace.",
      "Choix de la carte au lancement, en local comme pour une revanche.",
      "Les pingouins de la Banquise lancent des boules de neige.",
      "Duel de Basket et revanche proposée à l’hôte en ligne.",
    ],
  },
  {
    version: "0.1.2",
    date: "2026-09-27",
    title: "Le jeu en ligne",
    highlights: [
      "Salons en ligne : un code ou un lien, chacun sur son appareil.",
      "Connexion invité ou Google, historique des parties pour les comptes.",
      "L’hôte peut mélanger l’ordre du tour avant le lancement.",
      "Salon vocal entre les joueurs (masqué en attendant sa version mobile).",
    ],
  },
  {
    version: "0.1.1",
    date: "2026-09-26",
    title: "Équilibrage et événements de table",
    highlights: [
      "Nouveaux réglages d’équilibre des objets et des roues.",
      "Événements de table, comme le Tour de Bénédiction quand tout le monde est fauché.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-09-25",
    title: "Première version jouable",
    highlights: [
      "Plateau en 3D, musique et effets sonores.",
      "Jeu en local pour 2 à 8 joueurs, avec bots de test, sur ordinateur et mobile en paysage.",
    ],
  },
];
