# Red Cups

Jeu de plateau chaotique entre amis, en version web. La version actuelle se joue en local : un hôte pilote la partie
sur un seul écran (desktop ou mobile en paysage) et peut la partager sur Discord ou Meet. Le jeu en ligne, chacun sur
son appareil, viendra ensuite.

Les règles, décisions confirmées et points ouverts sont dans [`red-cups-game-spec.md`](./red-cups-game-spec.md).

## Démarrage

Prérequis : [Bun](https://bun.sh).

```sh
bun install
bun run dev
```

## Vérifications

```sh
bun run test
bun x tsc -p tsconfig.json --noEmit
bun run build
bun run format:check
```

### Tests par bots

Les tests incluent une campagne de 400 parties jouées par des bots, plus 30 parties par passif. Des bots jouent
toutes les places (déplacements, objets, boutique, roues, duels, réactions Non merci) et un vérificateur contrôle les
règles après chaque action. Chaque anomalie est rapportée avec sa graine et son numéro d’action pour la rejouer.

```sh
bun run simulate -- --games 1000 --min 2 --max 8
```

Le script affiche le taux de parties terminées, les règles violées et la couverture (actions et étapes visitées).

## Direction artistique — « toy box party »

- **Plateau** : diorama low poly posé dans un plateau-jouet crème, comme un vrai jeu de société. Cases facettées aux
  couleurs du jeu original (bleu boutique, rouge, vert, gris, départ doré), chemins en pas japonais, arbres et buissons
  en icosaèdres, étang, Enfer en cratère violet qui sourit (clin d’œil au smiley de la case 11).
- **Sens de circulation** : la sortie imposée d’une case fléchée porte des chevrons orange animés, sur la moitié de
  route qui part de cette case (on peut y entrer par cette route, mais on doit en sortir par là). Les routes libres
  n’en ont pas. Le tunnel 7 → 1 passe par des arches dans le rebord, avec des chevrons bleus.
- **Personnages** : petits blobs chibi aux grands yeux, une couleur et un accessoire par siège (chapeau de fête, pousse,
  nœud, antenne, cornes, oreilles de chat, bonnet, auréole) pour rester reconnaissables même sans les couleurs.
- **Interface** : papier crème, contours encre prune épais, boutons « bonbon » qui s’enfoncent, typographies Fredoka
  (titres) et Nunito (texte). Le rouge Red Cup est la couleur signature.
- **Son** : musique et effets entièrement synthétisés en WebAudio (aucun fichier audio). La musique passe en mode tendu
  quand le joueur actif est en Enfer ou pendant un duel.

## Ergonomie

- Barre des joueurs en haut (pièces, Red Cups, statut ; un tap ouvre passif et sac).
- Dock d’action en bas qui dit en clair quoi faire à chaque étape du tour.
- Sac d’objets en bas à gauche : chaque objet explique ce qu’il fait et pourquoi il est indisponible.
- Déplacement : clic sur une case surlignée (la souris prévisualise le chemin) ; au doigt, premier tap = aperçu,
  second tap ou « Confirmer » = déplacement.
- Caméra : glisser pour déplacer, molette ou pincement pour zoomer, clic droit ou deux doigts pour pivoter, boutons de
  zoom, vue d’ensemble et suivi du joueur actif.
- Les fenêtres (boutique, roue, duel…) attendent la fin des animations des pions.
- Sur téléphone, un écran d’accueil passe le jeu en plein écran et en paysage. Sur iPhone, le jeu explique comment
  l’ajouter à l’écran d’accueil pour masquer les barres de Safari.
- La partie en cours survit à un rafraîchissement de la page et s’efface à la fin de la partie.

## Architecture

```
src/
  game/       moteur de règles pur, store Zustand sauvegardé, bots de simulation (simulation/)
  theme/      palette, looks des joueurs, timings partagés entre 3D et interface
  scene/      scène Three.js : plateau, modèles low poly, caméra, pions animés, effets
  feedback/   traduit les changements d’état en évènements de présentation (sons, textes, confettis)
  audio/      moteur WebAudio, effets, musique, réglages persistés
  ui/         interface React : lobby, HUD, fenêtres, icônes SVG originales
  styles/     jetons de design et feuilles de style
```

- **React + TypeScript** pour l’interface, **Three.js** pour le plateau, **Zustand** pour l’état, **Vite** pour le
  build.
- Le store ne contient jamais d’objets Three.js. La scène reçoit une vue sérialisable (`BoardView`) et rejoue les
  déplacements à partir de `lastMovement`.
- Les règles s’appliquent instantanément ; la couche `feedback` retarde sons, notifications et fenêtres jusqu’à
  l’atterrissage du pion.
- Les illustrations des objets sont originales : aucune image tierce de la présentation n’est embarquée.
