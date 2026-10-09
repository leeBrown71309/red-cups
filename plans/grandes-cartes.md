# Grandes cartes (à partir du patch 0.3.0) — vue d'ensemble

Deux cartes de **41 cases** (40 + l'Enfer), pour **6 à 8 joueurs**, décidées avec l'auteur le 9 oct. 2026. Chacune a ses
propres mécaniques et ses propres **types de cases nouveaux** (aujourd'hui : départ, boutique, verte, rouge, neutre, Enfer ;
la glace n'est qu'un effet posé sur une case neutre). Le détail est dans :

- [`carte-archipel-des-marees.md`](carte-archipel-des-marees.md) : marées, bac, tourbillon ; cases Chaussée, Quai, Tourbillon.
- [`carte-desert-des-mirages.md`](carte-desert-des-mirages.md) : deux Red Cups dont un mirage ; cases Puits, Oasis ; caravane, tempêtes.

## Ce que l'auteur a décidé (à ne pas rediscuter)

- Cartes **moyennes-grandes : environ 40 cases** (30 était la première idée, 60 était « énorme »). Les réapparitions de
  Cup ne doivent pas être trop faciles à deviner.
- Minimum **6 joueurs** (donc un `minPlayers` sur la carte, voir plus bas).
- Au moins 2 à 3 mécaniques par carte, et **un type de case nouveau avec sa propre règle** (pas seulement un effet).
- Mirage (désert) : quand un joueur prend le mirage, **les deux Cups disparaissent et deux nouvelles apparaissent ailleurs,
  aux deux endroits changés** : sinon celle qui n'a pas bougé serait forcément la vraie (voir la carte du désert).
- Les bots doivent savoir jouer ces cartes ; campagnes sur chaque carte, en local et en ligne.

## Ordre de travail conseillé

1. **Socle commun** (une session) :
   - `BoardNode.kind` (`src/game/types.ts:303`) s'élargit : `"quay" | "causeway" | "whirlpool" | "well" | "oasis"`. Chaque
     nouvelle valeur doit être traitée partout où le type est lu (grep `kind ===` et les `switch` : scène 3D, plan 2D,
     légende, `rules.ts` `getTileWheelFor`, `opensShop`, IA, wiki, tests de cohérence de carte `maps.test.ts`).
   - `MapId` (`types.ts:164`) : `"archipel" | "desert"`. `map-registry.ts`, `map-types.ts` (`MapThemeId` : `"lagoon"`,
     `"dunes"`), le sélecteur de carte, le lobby en ligne et les sauvegardes (`GAME_SAVE_VERSION`, `upgradeSave`).
   - `BoardMap.minPlayers?: number` : le sélecteur grise la carte sous 6 joueurs ; `startGame` refuse ; le lobby en ligne
     aussi (`src/net/`). Le `getTableSetup` et `runMapCampaign` des simulations doivent tirer 6 à 8 joueurs sur ces cartes.
2. **Archipel des Marées** (moins risqué, aucun changement à la Red Cup).
3. **Désert des Mirages** (touche toutes les règles de la Red Cup : `redCupNodeId` apparaît dans 22 fichiers).

## Règles d'équilibrage communes

- Distance entre la Cup et le joueur le plus proche : 5 à 7 pas (comptés sur le graphe statique, marée ignorée).
- Boutiques : 4 (une par île / par oasis). Un seul Enfer, accessible seulement par les effets (comme aujourd'hui).
- Au moins un raccourci à risque, pour que le dernier ait toujours un coup à tenter.
- À 6 à 8 joueurs sur 40 cases, on ne se croise pas assez : chaque carte a une case qui force les rencontres (Quai /
  Oasis, une seule place).

## À faire pour chaque carte (rappel de `AGENTS.md`)

Wiki (`src/wiki/content/maps.ts`, `systems.ts`, `interactions.ts`, `cards.ts` si un Cups Power change), changelog
(`src/ui/home/changelog-data.ts`), aide, spec (`red-cups-game-spec.md`), campagnes par carte (local et en ligne) avec
invariants et labels de couverture (`coverage.ts`), `bun x tsc`, `bun run test`, `bun run format:check`, `bun run build`.

## Prompt pour la session d'implémentation

« Lis `plans/grandes-cartes.md`, `plans/carte-archipel-des-marees.md` et `plans/carte-desert-des-mirages.md` ainsi que
`CLAUDE.md`. Commence par le socle commun, puis implémente l'Archipel des Marées de bout en bout (moteur, scène 3D, bots,
invariants, campagnes, wiki, changelog), puis le Désert des Mirages. Valide chaque carte par des campagnes de 6 à 8
joueurs avant de passer à la suivante. Ne commit que si je le demande. »
