# Plan — Red Cups MVP

## Objectif

Livrer une première partie locale jouable à 2–8 joueurs sur un écran partagé par un hôte, avec un plateau Three.js, une interface React, un store Zustand et les règles initiales décrites dans `red-cups-game-spec.md`.

## Architecture

- React + TypeScript + Vite pour l’application web.
- Three.js pour la scène interactive et la sélection des cases.
- Zustand pour l’état sérialisable de la partie.
- Module de règles pur, indépendant de React et Three.js.
- Aucun serveur réseau dans le MVP ; les actions de jeu restent sérialisables pour faciliter une future synchronisation serveur.

## Étapes

1. [x] **Scaffold et documentation**
   - Fichiers : `package.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `README.md`, `red-cups-game-spec.md`, `plans/red-cups-mvp.md`, `.gitignore`.
   - Vérifier que l’application démarre et que les dépendances React, Three.js et Zustand sont installées.

2. [x] **Modèle de jeu et graphe de plateau**
   - Fichiers : `src/game/model.ts`, `src/game/board.ts`, `src/game/catalog.ts`, `src/game/rules.ts`.
   - Décrire les joueurs, inventaires, cases, liens dirigés, objets, passifs, monnaie, Cup et phases de tour.
   - Tester les déplacements autorisés, les règles de monnaie et les limites d’inventaire.

3. [x] **Store et flux de partie**
   - Fichier : `src/game/store.ts`.
   - Implémenter préparation, déplacements, actions, shop, fin de tour, effets différés, roues, duels et victoire.
   - Couvrir les transitions critiques par des tests unitaires.

4. [x] **Scène Three.js**
   - Fichier : `src/components/board-scene.tsx`.
   - Construire un plateau stylisé avec cases, liens, marqueurs de direction, pions et Cup.
   - Sélectionner seulement les destinations légales via picking Three.js.
   - Nettoyer renderer, géométries, matériaux, écouteurs et boucle d’animation au démontage React.

5. [x] **Interface React**
   - Fichiers : `src/App.tsx`, `src/components/setup-screen.tsx`, `src/components/game-screen.tsx`, `src/components/shop-panel.tsx`, `src/components/wheel-dialog.tsx`, `src/components/duel-dialog.tsx`, `src/index.css`.
   - Implémenter setup, tableau des joueurs, inventaire, achats, objets ciblés, événements, roues, votes et état de victoire.
   - Assurer une mise en page adaptée au partage d’écran et aux tailles de fenêtre usuelles.

6. [x] **Vérification**
   - Exécuter les tests unitaires.
   - Exécuter `bun x tsc -p tsconfig.json --noEmit`.
   - Exécuter `bun run build`.
   - Lancer l’application et vérifier les flux setup, déplacement, collecte de Cup, boutique, roues, inventaire plein et Enfer.
   - Contrôles passés : 16 tests unitaires, vérification TypeScript et build de production.
