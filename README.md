# Red Cups

Jeu de plateau chaotique entre amis, en version web, sur [redcups.leeeight.site](https://redcups.leeeight.site). Deux
façons de jouer :

- **En local** : un hôte pilote la partie sur un seul écran (desktop ou mobile en paysage) et peut la partager sur
  Discord ou Meet.
- **En ligne** : chacun sur son appareil, dans un salon rejoint par code ou par lien. Seuls les joueurs assis
  rejoignent un salon : il n’y a pas de spectateurs.

Les règles, décisions confirmées et points ouverts sont dans [`red-cups-game-spec.md`](./red-cups-game-spec.md).

## Démarrage

Prérequis : [Bun](https://bun.sh).

```sh
bun install
bun run dev
```

Sans configuration, seul le mode local est proposé. Pour le mode en ligne, copier `.env.example` en `.env.local` et
renseigner l’URL et la clé publique du projet Supabase (voir « Mode en ligne »).

## Vérifications

```sh
bun run test
bun x tsc -p tsconfig.json --noEmit
bun run build
bun run format:check
```

### Tests par bots

Les tests incluent une campagne de 400 parties jouées par des bots, plus 30 parties par passif et 30 parties
commencées sans le sou (pour éprouver le Tour de Bénédiction). Des bots jouent toutes les places (déplacements,
objets, boutique, roues, duels, réactions Non merci, abandons) et un vérificateur contrôle les règles après chaque
action. Chaque anomalie est rapportée avec sa graine et son numéro d’action pour la rejouer.

```sh
bun run simulate -- --games 1000 --min 2 --max 8
```

Le script affiche le taux de parties terminées, les règles violées et la couverture (actions et étapes visitées).

## Mode en ligne

Il n’y a pas de serveur de jeu. Chaque appareil fait tourner le même moteur sur les mêmes actions, à partir de la même
graine (le hasard d’une partie en ligne est stocké dans l’état). Supabase fournit le reste :

- **Auth** : invité (connexion anonyme) ou compte Google. Un compte garde un nom de profil ; l’historique des parties
  viendra plus tard.
- **Base** : [`supabase/schema.sql`](./supabase/schema.sql) contient tout le backend (tables fermées, fonctions
  `security definer`). Un salon garde le dernier état de la partie et un numéro de version.
- **Temps réel** : un canal privé `room:<CODE>` par salon, réservé par une policy aux joueurs assis.

Ordre des actions : l’appareil qui joue calcule le nouvel état, l’écrit avec un compare-and-set sur la version
(`advance_room`), puis diffuse l’action ; les autres la rejouent. Deux actions simultanées (deux duellistes qui
choisissent en même temps) ne peuvent donc pas diverger : une seule écriture passe, l’autre appareil recharge et
réessaie. Un battement toutes les 20 secondes rattrape un message perdu.

Mise en place d’un projet Supabase :

1. Créer une organisation gratuite dédiée, puis un projet (les quotas Realtime et d’egress sont par organisation).
2. Exécuter `supabase/schema.sql` dans l’éditeur SQL (le fichier peut être rejoué sans risque).
3. Authentication › Providers : activer **Anonymous** et **Google** (identifiants OAuth de Google Cloud Console, avec
   l’URL de rappel indiquée par Supabase).
4. Authentication › URL Configuration : _Site URL_ `https://redcups.leeeight.site`, redirections
   `https://redcups.leeeight.site/**`, `https://leebrown71309.github.io/red-cups/**` (recette) et
   `http://localhost:5173/**`.
5. Realtime › Settings : désactiver l’accès public aux canaux, pour n’accepter que les canaux privés.

## Déploiement

Deux environnements, alimentés par le même flux de branches (branche de travail → PR vers `pre-prod` → PR vers
`main`) :

| Branche    | Environnement | Adresse                                                                                      |
| ---------- | ------------- | -------------------------------------------------------------------------------------------- |
| `pre-prod` | recette       | [leebrown71309.github.io/red-cups](https://leebrown71309.github.io/red-cups/) (GitHub Pages) |
| `main`     | production    | [redcups.leeeight.site](https://redcups.leeeight.site) (VPS, Nginx)                          |

Les deux déploiements appellent le même workflow réutilisable,
[`build-site.yml`](./.github/workflows/build-site.yml) : formatage, tests (dont la campagne de bots et les tests du
schéma), puis build. Seul le chemin de base change (`BASE_PATH` : `/red-cups/` sur Pages, `/` sur le VPS). Ce qui a
été essayé en recette est donc exactement ce qui part en production.

- [`deploy-preview.yml`](./.github/workflows/deploy-preview.yml) publie `pre-prod` sur GitHub Pages. L’environnement
  `github-pages` du dépôt doit autoriser la branche `pre-prod`.
- [`deploy-production.yml`](./.github/workflows/deploy-production.yml) envoie `main` par `rsync` dans
  `/var/www/red-cups` sur le VPS, où Nginx sert les fichiers statiques. La clé publique du serveur est épinglée dans le
  workflow.

Secrets GitHub : `VITE_SUPABASE_URL` et `VITE_SUPABASE_KEY` (les deux environnements), `SSH_HOST`, `SSH_USER` et
`SSH_PRIVATE_KEY` (production). La recette et la production partagent le même projet Supabase : l’offre gratuite est
limitée à deux projets par compte.

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
- Les fenêtres (boutique, roue, duel…) attendent la fin des animations des pions et de Bullet Bill.
- Une pastille rappelle le numéro d’une case quand des pions ou la Red Cup le cachent.
- Les grands évènements de table (arrivée, charge et explosion de Bullet Bill, Tour de Bénédiction) s’affichent dans
  une bannière ; une puce dans la barre du haut suit Bullet Bill tant qu’il est sur le plateau.
- Menu pause › « Abandonner » : un joueur quitte la partie, les autres continuent. En ligne, on n’abandonne que pour
  soi, et quitter la partie revient à abandonner.
- En ligne, seul l’appareil du joueur qui doit décider voit les boutons ; les autres voient « En attente de… ».
- Sur téléphone, un écran d’accueil passe le jeu en plein écran et en paysage. Sur iPhone, le jeu explique comment
  l’ajouter à l’écran d’accueil pour masquer les barres de Safari.
- La partie en cours survit à un rafraîchissement de la page et s’efface à la fin de la partie.

## Architecture

```
src/
  game/       moteur de règles pur (reduceGame), permissions en ligne, store Zustand, bots (simulation/)
  net/        mode en ligne : client Supabase, compte, salons, protocole d’ordre des actions
  theme/      palette, looks des joueurs, timings partagés entre 3D et interface
  scene/      scène Three.js : plateau, modèles low poly, caméra, pions animés, effets
  feedback/   traduit les changements d’état en évènements de présentation (sons, textes, confettis)
  audio/      moteur WebAudio, effets, musique, réglages persistés
  ui/         interface React : lobby, HUD, fenêtres, icônes SVG originales
  styles/     jetons de design et feuilles de style
```

- **React + TypeScript** pour l’interface, **Three.js** pour le plateau, **Zustand** pour l’état, **Vite** pour le
  build.
- Toute modification de partie est une action sérialisable (`GameAction`) passée à `reduceGame`. Le store
  l’applique en local, ou la confie au salon en ligne.
- Le store ne contient jamais d’objets Three.js. La scène reçoit une vue sérialisable (`BoardView`) et rejoue les
  déplacements à partir de `lastMovement`.
- Les règles s’appliquent instantanément ; la couche `feedback` retarde sons, notifications et fenêtres jusqu’à
  l’atterrissage du pion.
- Les illustrations des objets sont originales : aucune image tierce de la présentation n’est embarquée.
