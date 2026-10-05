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
      "Deux cartes par joueur : un actif (le moteur de ta victoire) et un passif (un avantage ciblé), choisis en deux étapes. En ligne, les autres ne voient plus ton sac ni ton actif.",
      "Goblin devient un passif : il vole 150 pièces à chaque joueur à chaque nouvelle Red Cup.",
      "Neuf nouveaux passifs : Dernier de la classe, Habitué de l’Enfer, Main verte, Main rouge, Touché angélique, Main du diable, Meneur de jeu, Brocanteur et Piégeur.",
      "Quatre nouveaux objets : Réveil, Parachute, Miroir et Barrière (une route fermée jusqu’à ton prochain tour).",
      "Équilibrage : Cupide gagne à 6 000 pièces, Made In Heaven coûte 1 300, l’Ange-Gardien démarre avec 800 pièces, et les cases rouges de Red light, Green light coûtent 50.",
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
