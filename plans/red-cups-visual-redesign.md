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

## Deuxième passe (règles, bots, mobile)

7. [x] Roues sur les cases vertes (bonheur) et rouges (malheur) quand on s’y arrête.
8. [x] Non merci en fenêtre de réaction entre l’annonce et l’application d’une action.
9. [x] Sauvegarde de la partie dans le navigateur, effacée en fin de partie.
10. [x] Tests par bots : 400 parties + 30 par passif dans `bun run test`, script `bun run simulate`.
    Bugs trouvés et corrigés : 3ᵉ exemplaire d’un objet via Je note ; Bullet Bill qui ne touchait jamais un joueur
    posté sur sa case.
11. [x] Plein écran forcé sur téléphone (un tap, verrouillage paysage), manifeste d’application web et aide iPhone.
12. [x] Fiche joueur sans saut à l’ouverture, avec Red Cups et argent.

## Règles confirmées par l’auteur

13. [x] Non merci : l’objet annulé est perdu.
14. [x] Roues aussi après un déplacement subi (Corde, Monopoly Man, Bouteille d’eau, Calme-toi, New Cup, New Me).
15. [x] Je note ne copie jamais Draven.
16. [x] Flèches : une case fléchée impose sa sortie, on peut y entrer par n’importe quelle route. Bonus du départ
    seulement en arrivant par 8 (pas de 4 → 0 à répétition).
17. [x] Enfer : peine maximale de 5 tours (tours sautés compris), puis sortie en case 0 avec le bonus de 200 et un dû de
    500 pièces.

## Axes d’amélioration proposés

### Règles à trancher

- **Botte** : autoriser ou non l’aller-retour (A → B → A) en deux pas.
- **Apparition de la Red Cup** : la présentation parle d’une roue ; une roulette des cases rendrait le moment plus fort.

### Jeu et expérience

- Choix de la couleur et de l’accessoire dans le lobby, émotes et réactions des pions.
- Effets 3D dédiés par objet : corde qui tire, rayon Hollow Purple, haches de Draven, échange du Monopoly Man.
- Navigation clavier sur le plateau (tabulation entre cases légales) pour l’accessibilité.

### Technique et en ligne

- Les actions du store sont déjà des fonctions pures (plan / apply) : les exécuter côté serveur autoritaire.
- Réactions prises par chaque joueur sur son appareil (Non merci, Calme-toi, duels) au lieu du maître du jeu.
- Salons en ligne, spectateurs, reconnexion ; vocal via WebRTC (LiveKit ou équivalent).
- Qualité graphique adaptative (ombres, densité d’herbe) sur les mobiles modestes.
