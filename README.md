# Red Cups

Jeu de plateau chaotique entre amis, en version web, sur [redcups.leeeight.site](https://redcups.leeeight.site). Deux
façons de jouer :

- **En local** : un hôte pilote la partie sur un seul écran (desktop ou mobile en paysage) et peut la partager sur
  Discord ou Meet.
- **En ligne** : chacun sur son appareil, dans un salon rejoint par code ou par lien. Seuls les joueurs assis
  rejoignent un salon : il n’y a pas de spectateurs. Avant de lancer, l’hôte peut mélanger l’ordre du tour ; le tirage
  est fait par la base (`shuffle_room`), donc tout le monde voit l’ordre qui sera joué.

Les règles, décisions confirmées et points ouverts sont dans [`red-cups-game-spec.md`](./red-cups-game-spec.md). Le
patch 0.1.4 est décrit lot par lot dans [`plans/patch-0.1.4-rework.md`](./plans/patch-0.1.4-rework.md), et ses choix
encore à valider dans la section 13 de la spec.

## Patch 0.1.5

- **Menu** avant la préparation de la partie, avec la version du jeu et un journal des modifications.
- **Passifs en cartes de tarot** au draft et dans l’aide.
- **En ligne** : le salon se rejoint jusqu’à la fin du premier tour de table, et l’hôte peut exclure un joueur.
  Ces deux règles demandent d’appliquer `supabase/schema.sql` à la base.
- **Actifs et passifs** : deux cartes par joueur (draft en deux étages), sac et actif cachés en ligne, Goblin passif,
  9 nouveaux passifs, 4 nouveaux objets (Réveil, Parachute, Barrière, Miroir). Plan : `plans/patch-actifs-passifs.md`.
- Les choix de ce patch encore à valider sont dans les sections 13 bis et 13 ter de la spec.

## Déroulé d’une partie (patch 0.1.4)

- **Draft** : chacun choisit son passif parmi 3 cartes (2 au-delà de 6 joueurs). En local, l’écran passe de main en
  main ; en ligne, la table a une minute. Puis un compte à rebours de 5 secondes ouvre la partie.
- **Énergie** : 3 points par tour. On utilise d’abord ses objets, chacun à son coût, puis on se déplace : le
  déplacement prend le reste et termine le tour.
- **Rôles** : le diable (annoncé à tous, sa boutique, sa victoire par les entrées en Enfer), L’Ange-Gardien (un
  protégé public, avec un halo), Cupide (victoire à 6 000 pièces) et une vingtaine de passifs.
- **Mini-jeux** : les duels tirent pile ou face, pierre-feuille-ciseaux, vote, Basket ou Blackjack ; Baraqué répond
  au Monopoly Man par un bras de fer.
- **En ligne** : 45 secondes par tour, 20 pour les décisions des autres, avec un choix par défaut à l’échéance ; un
  tour passé sans jouer coûte une chance, et la troisième est un forfait.

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

Les tests incluent une campagne de 400 parties jouées par des bots, plus 30 parties par passif, 30 parties
commencées sans le sou (pour éprouver le Tour de Bénédiction), des parties qui passent par le draft et des parties
« en ligne » sur une horloge virtuelle, où les bots laissent parfois filer le chrono. Des bots jouent toutes les places
(déplacements, objets, boutique, roues, duels, réactions Non merci, abandons) et un vérificateur contrôle les règles
après chaque action. Chaque anomalie est rapportée avec sa graine et son numéro d’action pour la rejouer.

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

Chrono (patch 0.1.4) : chaque action porte l’heure du serveur à laquelle elle a été jouée, et les autres appareils la
rejouent à cette même heure, ce qui leur donne le même chrono. Cette heure vient de `server_time()`, à appliquer avec
le schéma. Tout appareil assis peut clore un chrono échu (`expireClock`). Un salon dont la partie suit d’autres règles
(une autre version du jeu) est refusé.

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
- **Sens de circulation** : comme sur le plateau original, une case fléchée porte sa flèche sur elle : une flèche en
  relief, de la couleur de la case, sort de son bord vers la route par laquelle on doit la quitter (on peut y entrer
  par n’importe quelle route). Les routes restent nues ; seuls le tunnel 7 → 1, qui passe par des arches dans le
  rebord, et le carrousel de Luna Park portent des chevrons, car c’est la route elle-même qui a un sens.
- **Luna Park** (seconde carte) : la même boîte de jeu, la nuit. Pavés bleu nuit, cases à bord néon, guirlandes
  d’ampoules, grande roue et chapiteau au fond, lampadaires, ballons et confettis. L’Enfer est un manège maudit dont
  les chauves-souris tournent dans le sens du carrousel ; le train fantôme relie deux maisons hantées. Chaque carte
  décrit ses cases et routes dans `src/game/maps/`, sa mise en scène dans `src/scene/map-layouts.ts` et ses couleurs
  dans `src/theme/map-themes.ts`.
- **Banquise** (troisième carte) : neige, lac gelé brillant, sapins enneigés, bonhommes de neige, igloo, pingouins qui
  se dandinent, flocons et aurore boréale. Les cases de glace ont un reflet, un liseré givré et des pics de glace ; le
  pion y tourne sur lui-même puis glisse dans la direction tirée. La tombée de glace l’enferme dans un bloc au milieu de
  la route, qu’il brise au tour suivant. Le blizzard souffle des rafales de neige et un brouillard blanc, fait fondre
  l’ancienne glace et en fait pousser une nouvelle. L’Enfer est une crevasse hérissée d’éclats de glace.
- **Fantôme de Luna Park** : un drap déchiré aux orbites creuses qui rôde sur tout le plateau, surgit dans une
  brume violette, glisse de case en case par-dessus les routes ou se dissout pour ressurgir au loin, gifle ses
  victimes et les emporte en Enfer. Un clic ouvre son butin.
- **Tomate** : une volée de 1 à 5 tomates part en rafale, en cloche, d’un pion à l’autre et s’écrase en gerbes rouges ;
  un « K.O. ! » et une pirouette quand elle assomme sa cible.
- **Basket** : mini-jeu de duel de 15 secondes (jauge, zone verte, balles en vol), vu en direct par toute la table
  en ligne.
- **Musique par carte** : boucle cosy pour le coffre à jouets, valse de fête foraine pour Luna Park, boîte à musique
  en 6/8 pour Banquise ; chacune a sa version sombre quand le joueur actif est en Enfer.
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
