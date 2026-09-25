# Plan — Refonte visuelle et ergonomique

## Objectif

Passer d’une interface « site web » à un vrai jeu : plateau 3D low poly chibi fidèle au plateau original, HUD de jeu
lisible sur desktop et sur mobile en paysage, sons et musique, et une direction artistique reconnaissable.

## Réalisé

1. [x] **Plateau fidèle à la présentation** (`src/game/board.ts`)
   - Sens corrigés : 2→5 (inversé auparavant), 0→2, 8→0 ; lien fantôme 5–0 supprimé ; tunnel 7→1 ajouté.
   - Tests de déplacement mis à jour et complétés (tunnel, entrées/sorties du départ, Enfer jamais accessible).
2. [x] **Scène 3D** (`src/scene/`)
   - Plateau-jouet, cases facettées numérotées, chemins en pas japonais, chevrons animés sur les routes à sens unique.
   - Boutiques, drapeau du départ, cratère de l’Enfer souriant, arches du tunnel, étang, décor composé à la main.
   - Pions chibi animés (sauts, clignements, passage dans le tunnel), Red Cup flottante avec faisceau.
   - Caméra : pan, zoom, rotation limitée, vue d’ensemble, suivi du joueur actif, mode vitrine dans le lobby.
3. [x] **Interface** (`src/ui/`, `src/styles/`)
   - Lobby, barre des joueurs, dock d’action contextuel, sac d’objets, boutique, roues animées, duels (pièce,
     pierre-feuille-ciseaux, vote), sac plein, cibles, Calme-toi, victoire, pause, aide avec plan du plateau, journal.
   - Mise en page compacte pour les téléphones en paysage, message « tourne ton téléphone » en portrait.
4. [x] **Audio** (`src/audio/`) : effets et musique synthétisés, deux ambiances, réglages persistés.
5. [x] **Feedback** (`src/feedback/`) : évènements de présentation synchronisés avec les animations.
6. [x] **Qualité** : Prettier (120 colonnes), 31 tests, vérification TypeScript et build.

## Axes d’amélioration proposés

### Règles à trancher

- **Lecture des flèches** : route fléchée seule (appliqué) ou sortie imposée depuis la case fléchée (voir la spec 3.1).
- **Objectif de Red Cups** : la présentation dit que le nombre est « fixé par les joueurs » ; ajouter un réglage 1–5
  dans le lobby.
- **Non merci** : aujourd’hui il annule le tour avant l’action. Une vraie fenêtre de réaction après l’annonce d’un objet
  serait plus fidèle.
- **Botte** : autoriser ou non l’aller-retour (A → B → A) en deux pas.
- **Apparition de la Red Cup** : la présentation parle d’une roue ; une petite roulette des cases rendrait le moment
  plus fort.
- **Cas limites** : Corde ou Monopoly Man visant un joueur en Enfer, Draven suivi de duels en chaîne.

### Jeu et expérience

- Sauvegarde automatique de la partie en cours (reprise après un rechargement).
- Choix de la couleur et de l’accessoire dans le lobby, émotes et réactions des pions (joie, larmes, colère).
- Effets 3D dédiés par objet : corde qui tire, rayon Hollow Purple, haches de Draven, échange du Monopoly Man.
- Navigation clavier sur le plateau (tabulation entre cases légales) pour l’accessibilité.

### Technique et en ligne

- Transformer les actions du store en commandes sérialisables (réducteur pur) pour un serveur autoritaire.
- Salons en ligne, spectateurs, reconnexion ; vocal via WebRTC (LiveKit ou équivalent).
- Qualité graphique adaptative (ombres, densité d’herbe) sur les mobiles modestes.
- Si le jeu doit être traduit : installer Lingui et externaliser les textes.
