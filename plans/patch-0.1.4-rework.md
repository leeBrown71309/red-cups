# Patch 0.1.4 — Cartographie du rework Red Cups

## Contexte

L'auteur du jeu a rédigé `docs/Updates Red Cups-1.docx`, un grand rework :
- draft de passifs avant la partie et chrono de tour en ligne ;
- système d'énergie qui remplace « une action par tour » ;
- nouveaux prix et nouvelles roues ;
- 20 passifs : 2 retirés, 8 ajustés ou renommés, 12 nouveaux, dont 3 avec leur propre victoire ;
- boutique du diable, nouveaux objets, 2 mini-jeux ;
- corrections (fantôme, Boue, flèches, carte Luna Park) et interface (son d'achat, zone orange).

Le patch 0.1.3 est mergé dans `origin/pre-prod` et `origin/main` (5531f78). Décisions prises avec l'utilisateur :
- tout part dans **0.1.4**, en **lots** livrables, un commit atomique par lot ;
- en local, le draft se fait **tour par tour, cartes cachées** ;
- la cartographie est livrée dans **`plans/patch-0.1.4-rework.md`**.

## État

- Branche `patch_0.1.4`, créée depuis `origin/main` (5531f78).
- Les lots se font dans l'ordre ci-dessous, un commit par lot, fait après ta validation.
- L'auteur a répondu aux 20 questions (voir « Réponses de l'auteur » à la fin). Les lots ci-dessous en tiennent compte.
- [x] **Lot 1** fait et commité (voir le bilan dans sa section).
- [x] **Lot 2** fait et commité.
- [x] **Lot 3** fait et commité.
- Source : `docs/Updates Red Cups-1.docx` (non suivi par Git).

---

## Vue d'ensemble

| # | Lot | Contenu | Taille |
|---|---|---|---|
| 1 | Corrections rapides | Fantôme, Boue, son d'achat, zone orange, Luna Park 5↔8 | M |
| 2 | Flèches attachées aux cases | 3D, plan 2D, légende | M |
| 3 | Boutique et roues | Prix, Botte ≤ 400, Bullet Bill à 1 case, nouvelles roues | M |
| 4 | Énergie | Refonte du tour | L |
| 5 | Passifs existants | Retraits, renommages, ajustements | L |
| 6 | Socle passifs et passifs simples | Nouvelles victoires, Lambda, Nepo Baby, Red Bull, eShop, Tomato Enjoyer, Roller, Cupide | L |
| 7 | Passifs avancés | Double or nothing, Chance aveugle avec Made In Heaven, Voleur | L |
| 8 | Rôles | Le diable et sa boutique (5 objets), L'Ange-Gardien avec le Bouclier | XL |
| 9 | Chrono en ligne | Horloge partagée, 45 s, 3 chances, forfait | L |
| 10 | Draft des passifs | Local et en ligne, compte à rebours de 5 s | L |
| 11 | Mini-jeux | Bras de fer (Baraqué contre Monopoly Man), Blackjack | L |
| 12 | Docs et finitions | Spec, README, aide, textes, version | M |

**Ordre** : les lots 1 à 3 sont indépendants et peu risqués. Le lot 4 change la structure du tour, dont dépendent les passifs (Red Bull, Roller…). Le lot 9 apporte l'horloge partagée qu'utilise le lot 10. Le lot 10 vient après les passifs : avec 20 cartes, les offres sont uniques sur toute la table (6 × 3 = 18, 8 × 2 = 16).

---

## Socle transversal (concerne tous les lots du moteur)

- **Nouveaux champs d'état** :
  - Chaque nouveau champ de `GameState` doit figurer dans `EMPTY_GAME_STATE` (`src/game/types.ts:493`). Sinon `pickGameState` (`game-save.ts:13`) le perd en silence : sauvegarde, `adoptGame` et écriture du salon.
  - Passer `GAME_SAVE_VERSION` de 11 à 12 et **invalider les anciennes sauvegardes** : les règles changent trop.
- **Unions qui grandissent** : `ItemId`, `PassiveId`, `WheelOutcomeId`, `TurnStage`, `WinReason`, `DuelMode` et `GameAction`. Le compilateur signale chaque `Record` ou `switch` à compléter :
  - `ITEM_CATALOG`, `PASSIVE_CATALOG`, `ITEM_ARTWORK` (`ui/icons/item-icon.tsx:29`) ;
  - `OUTCOME_SHORT_LABELS` (`ui/display/game-display.ts:26`) ;
  - `dispatchGameAction` (`game-actions.ts:489`), `getActionActorIds` (`action-permissions.ts:14`) ;
  - l'interface `GameActions` (`store.ts:8`).
- **Bots et vérificateur** : chaque lot du moteur met à jour `simulation/bot-player.ts` (`chooseBotAction`), `rule-invariants.ts` et `event-invariants.ts`, plus les attentes de `simulation.test.ts`. Celles-ci exigent que chaque objet soit utilisé, chaque issue de roue vue et chaque étape visitée. Objectif : **0 violation**.
- **Règle d'inventaire en double (DRY)** : elle existe en 5 endroits :
  - `canAddItem` (`rules.ts:37`) ;
  - `itemCopyForPassive` (`game-effects.ts:365`) ;
  - `canTakeLootItem` (`ghost.ts:180`) ;
  - `getPurchaseStatus` (`ui/display/item-availability.ts:96`) ;
  - `checkPlayer` (`rule-invariants.ts:71`).

  À regrouper dans `canAddItem` avant Tomato Enjoyer, Diable et Ange.
- **Supabase partagé entre recette et production** (projet jcwhllttnzbndxyhrhpp) :
  - Uniquement des changements de schéma **additifs**.
  - Un client 0.1.3 (prod) et un client 0.1.4 (recette) peuvent tomber sur le même salon. Ajouter une **version du moteur** dans l'état du salon et refuser de rejoindre ou rejouer une autre version (`net/room-store.ts` `applySnapshot`).
- **Textes** :
  - Le français est en dur dans les composants ; Lingui n'est pas installé, donc pas d'externalisation imposée. Le code reste en anglais.
  - Attention aux tests sur les lignes du journal (`feedback/game-feedback.ts:195` « utilise Non merci », `ui/hud/event-toasts.tsx:10`, plusieurs tests).

---

## Lot 1 — Corrections rapides

### 1.1 Fantôme qui ne s'arrête pas (bug)

- **Cause** : `advanceGhost` (`src/game/ghost.ts:143-146`) tire tout le chemin de 1 à 3 cases (`drawGhostDrift`, 90-105), puis ne cherche un adversaire que sur la **dernière case** (`findGhostOpponent`, 168-177). La scène anime pourtant chaque case du chemin (`scene/ghost-actor.ts` `playMove` 399-415).
- **Correction** : couper le chemin à la première case où se trouve un joueur qu'il peut affronter (hors Enfer et pas épargné). Utiliser la liste `metPlayerIds` d'avant le mouvement, car elle est vidée au déplacement.
- **Écart secondaire avec la spec** : la protection d'un joueur sortant de l'Enfer (`spareHellPlayers`, 155-162) dure jusqu'au prochain mouvement du **fantôme**, alors que la spec dit jusqu'au prochain déplacement du **joueur**. À aligner.
- **Tests** : `ghost.test.ts` (joueur sur la 1ʳᵉ case d'une glissade de 3). L'invariant `checkGhostMove` reste valide.

### 1.2 Boue peu visible

- **Pourquoi elle paraît enfoncée** (`scene/models/props-model.ts:91-119`, `scene/board-world.ts:377-391` `syncMud`) :
  - elle ne dépasse que de 0,03 à 0,08 au-dessus du dessus de la case (`TILE_HEIGHT = 0.34`) ;
  - elle ne suit pas le groupe `lift` : la case monte de 0,05 en surbrillance et de 0,16 au survol, et la Boue disparaît ;
  - elle déborde du plateau supérieur (rayon 0,99) ;
  - elle n'a pas de contour encre et sa couleur contraste peu, surtout la nuit ;
  - elle est dans le même coin que la pastille du numéro.
- **Correction** :
  - poser la Boue au-dessus de la case et dans son `lift` (exposer `lift` sur `TileVisual`, `scene/models/tile-model.ts`) ;
  - réduire son décalage pour rester sur la case ;
  - ajouter un contour encre (`addOutline`), un ombrage plat et une couleur plus contrastée par thème (`theme/palette.ts`, `theme/map-themes.ts`) ;
  - ajouter une petite gerbe à la pose.

### 1.3 Son d'achat négatif

- **Cause** : à chaque achat, `coinLoss()` et `purchase()` jouent ensemble :
  - `game-feedback.ts` `collectEvents` émet un évènement `currency` négatif (157-162) puis `purchase` (185-193) ;
  - `audio/audio-feedback.ts:73-89` les traduit en sons.
- **Correction** :
  - marquer la baisse de solde due à un achat et ne pas jouer `coinLoss` ;
  - remplacer `purchase()` (`audio/sound-effects.ts:169-173`) par une **caisse enregistreuse** synthétisée avec `tone`/`noise` : clac mécanique, tiroir, clochette « ka-ching » ;
  - garder le texte flottant « −prix » (`board-world.ts:543`).

### 1.4 Retirer la zone orange (carrousel de détails)

- Retirer `DetailCarousel` de ses 4 usages :
  - `ui/hud/players-bar.tsx:196` (fiche joueur) ;
  - `ui/modals/shop-modal.tsx:87` ;
  - `ui/modals/help-modal.tsx:213` et `:228`.
- Supprimer `ui/components/detail-carousel.tsx`, son CSS (`styles/modals.css:962-1047`) et les champs `details` de `game/catalog.ts`.
- Réécrire chaque `description` en description générale qui se suffit à elle-même. Elles sont centralisées dans `catalog.ts`, donc l'auteur peut les fournir.
- Garder l'état « Prêt à servir » de Non merci.

### 1.5 Luna Park : échanger les cases 5 et 8

- **Carte** (`game/maps/luna-park-map.ts:33-69`) : échanger les identifiants des deux boutiques, positions inchangées.
  - Routes après l'échange : 5→3 fléchée, 9–5, 5–7, 6–8, **8→0 fléchée** (le bonus du départ passe sur 8→0).
  - `initialCupNodeId` reste 8. Commentaires 9-15 à jour.
- **Effet** : la 1ʳᵉ Cup passe de 4 pas à **7 pas** (5 quand le carrousel est inversé), dans le goulet accessible seulement par 6.
- **Autres fichiers** :
  - `scene/map-layouts.ts` : `LUNA_PARK_LAYOUT.shopStalls`, clés 5 et 8 à échanger ;
  - tests `maps/maps.test.ts` (65-115, 217-218) et `ghost.test.ts` (82-105) ;
  - spec (l. 92, 99-128), commentaire `game/board.ts:129`.
- À noter : comme sur la carte classique, le Corrupteur pourra faire 0→8 dès le 2ᵉ tour de table.

### Bilan du lot 1

- Les 5 points sont faits.
- **Boue** : en plus, la pastille du numéro s'affiche sur une case boueuse. La Boue est posée dans le quart avant droit de la case.
- **Fantôme** : l'« écart » de protection en sortie d'Enfer n'en est pas un. Dans la spec, « jusqu'à son prochain déplacement » désigne celui du fantôme. Rien n'est changé.
- **Bug trouvé par la campagne de 1000 parties** (il existait déjà sur `main`) : Je note pouvait recevoir une 6ᵉ Tomate quand son sac était plein. Corrigé avec une règle commune, `canReceiveItem` (`rules.ts`), qu'utilisent Je note et le butin du fantôme.
- **Test** `room-backend.test.ts` : le résultat attendu est lu sur la fin de partie, car les bots abandonnent parfois d'eux-mêmes.

## Lot 2 — Flèches attachées aux cases

- **Aujourd'hui** : des chevrons orange animés courent sur la moitié de route qui part de la case. Voir `scene/road-network.ts` `addChevrons` (144-171) et `scene/board-layout.ts` `getRoadSegments` (107-125).
- **Cible** : une flèche en relief qui **sort de la case** vers la sortie imposée, comme sur le plateau original.
  - Nouveau modèle `scene/models/tile-arrow-model.ts`.
  - Les sorties sont calculées dans `board-world.ts` `buildBoard` (305-342), à partir des routes `arrow && from === case`.
  - La flèche est placée dans le `lift` de la case, avec contour encre et couleur du thème.
  - Elle gère **plusieurs flèches** : la case 0 en a 2 sur chaque carte.
  - Elle évite les stands de boutique, le drapeau du départ, la pastille et la Boue (décalages par carte dans `map-layouts.ts` si besoin).
- Retirer les chevrons des routes fléchées, mais les **garder** pour le tunnel 7→1, le train fantôme et le carrousel : là, c'est la route qui a un sens.
- **Plan 2D** (`ui/components/board-map.tsx:20-38, 160-177`, utilisé par l'aide et le carrousel des cartes) : remplacer les `ArrowHead` le long de la route par une flèche accrochée au bord du cercle de la case, dessinée après les cases.
- **Légende** : `help-modal.tsx` `ROAD_SWATCH_CLASSES` (35-41) et la pastille « ››› » (172) ; textes `roadLegend` des 3 cartes (`maps/*.ts`).

### Bilan du lot 2

- **3D** : flèche en relief de la couleur de la case, avec contour encre (`scene/models/tile-arrow-model.ts`). Elle a une légère poussée animée vers sa sortie et monte avec la case. Sa longueur s'adapte à la route, pour ne jamais toucher la case suivante.
- **Plan 2D** : dans l'aide et le choix de carte, la flèche sort du cercle de la case.
- **Légende** : l'entrée s'appelle « Case fléchée », avec une pastille dessinée.
- **Chevrons** : retirés des routes fléchées ; le tunnel, le train fantôme et le carrousel gardent les leurs.
- La couleur `roads.arrow` des thèmes, devenue inutile, est supprimée.

## Lot 3 — Boutique et roues (données)

- **Prix** (`ITEM_CATALOG`, `catalog.ts:19-200`) :
  - changent : Ndoye 250, Corde 400, Gomme 200, Bullet Bill 550, Monopoly Man 600, Casque 200 ;
  - inchangés : Hollow Purple 600, Botte 100, Boue 200, Tomate 10, Middle Finger 400, Bouteille 600, Draven 700.
- **Botte** : plafond `MAXIMUM_BOOT_PRICE` 500 → **400** (`game-effects.ts:425`), et invariant `boot-price` (`rule-invariants.ts:189`).
- **Bullet Bill** : `CHARGE_STEPS` 2 → **1** (`bullet-bill.ts:13`), invariant `bullet-range` (`event-invariants.ts:35`) et tests.
- **Roues** (`WHEEL_RESULTS`, `catalog.ts:362-392`), 8 secteurs de même poids :
  - **Bonheur** :
    - gardés : +100, +200, +300, +400, `spin-misfortune` ;
    - **`advance-one`** (nouveau) : le joueur choisit une case voisine légale ; la case d'arrivée donne sa roue et sa boutique (Q2) ;
    - `free-item` : objet ≤ 400, 5 Tomates si c'est la Tomate ;
    - **`go-to-start`** (nouveau) : case 0 et +200, sort aussi de l'Enfer ;
    - retirés : +500 et `escape`.
  - **Malheur** :
    - gardés : −200, −400, `spin-fortune`, `go-to-hell`, `skip-turn` ;
    - **−300** (nouveau) ;
    - **`go-back`** (nouveau) : retour à la case d'où l'on vient, qui donne sa roue et sa boutique (Q2) ;
    - `lose-item` : jamais une Red Cup ; sac sans objet : −200 pièces (Q3) ;
    - retirés : −100 et `nothing`.
  - **Enfer** : inchangée.
- **Moteur** :
  - `WheelOutcomeId` (`types.ts:163`) et `applyWheelOutcome` (`game-actions.ts:179-231`).
  - Pool d'objets gratuits : remplacer le filtre par prix (`game-actions.ts:219-227`) par une **liste explicite**. Sinon les nouveaux prix changent le pool sans prévenir ; il contient déjà la Tomate alors que le libellé dit « Ndoye, Botte ou Boue ».
  - Nouveau champ **`Player.previousNodeId`** pour `go-back`. `lastMovement` est global et sert à l'animation.
  - `advance-one` : étape de choix de case, sur le modèle du repositionnement.
- **UI** : `OUTCOME_SHORT_LABELS`, `POSITIVE_OUTCOMES` et `getWheelSegments` (`game-display.ts:26-100`), `CHAINED_WHEEL_ACTIONS` (`wheel-modal.tsx:28`), `display.test.ts`.

### Bilan du lot 3

- **Prix** : Ndoye 250, Corde 400, Gomme 200, Bullet Bill 550, Monopoly Man 600, Casque 200. La Botte plafonne à 400.
- **Constantes** : elles sont maintenant partagées dans `types.ts` (`MAXIMUM_BOOT_PRICE`, `BOOT_PRICE_STEP`, `BULLET_BILL_CHARGE_STEPS`, `FREE_TOMATOES`), et le vérificateur les utilise au lieu de valeurs écrites en dur.
- **Bullet Bill** : une case par charge.
- **Roues du bonheur et du malheur** : refaites en 8 secteurs égaux ; la roue de l'Enfer ne change pas (un sac vide y coûte toujours 100 pièces). Les nouvelles issues :
  - **Avance d'une case** : nouvelle étape `advance` et action `advanceOneTile`. C'est le joueur de la roue qui choisit, actif ou non. C'est un pas à pied : Red light et bonus du départ comptent, et la roue, la boutique, la Boue et la Red Cup de la case d'arrivée s'appliquent.
  - **Retourne d'où tu viens** : grâce au nouveau champ `Player.previousNodeId`, enregistré après chaque action qui déplace un joueur. Jamais d'aller-retour en Enfer.
  - **Va au Départ** : +200, même depuis l'Enfer.
  - **−300**.
  - **Objet gratuit** : liste explicite `FREE_ITEM_POOL` ; la Tomate arrive en pile de 5.
- **Boutique** : elle s'ouvre seulement pour le joueur actif dont le tour était fini (`getWheelArrivalStage`).
- **Sauvegardes** : version 12. Les anciennes parties sont mises à niveau, car le changement est additif.
- **Vérificateur** : 4 faux positifs mis au jour par les nouvelles trajectoires sont corrigés :
  - victime de la Boue identifiée par le journal ;
  - roue de case pendant une Bénédiction ;
  - roue suivie d'un changement de tour ;
  - Bullet Bill qui charge deux fois quand tous les joueurs passent leur tour.
- **Tests** : nouveau fichier `wheel-outcomes.test.ts` (18 tests).
- **Aide** : textes à jour (roues, Bullet Bill, et le fantôme qui s'arrête sur le premier joueur).

## Lot 4 — Système d'énergie (refonte du tour)

- **Données** :
  - `energyCost` sur chaque objet : 0 pour Tomate, Gomme et Casque ; 1 pour Botte et Boue ; 2 pour Ndoye, Bullet Bill, Corde et Middle Finger ; 3 pour Hollow Purple, Monopoly Man, Bouteille et Draven.
  - `BASE_ENERGY = 3`.
  - Dans l'état : `energyLeft`, plus un drapeau **`turnActed`** (« a fait au moins une action », y compris achat, Botte, Boue ou Tomate). Le chrono en aura besoin, et `turnActionTaken` n'est vérifié nulle part aujourd'hui.
- **Règles** :
  - `passTurnFrom` (`game-effects.ts:492-557`) remet l'énergie au maximum : 3, ou 4 avec Red Bull.
  - `planItemUse` (`turn-actions.ts:183`) vérifie l'énergie.
  - `applyItemUse` **ne termine plus le tour** (ligne 225 : reste en `move` ou `hell`). La roue du Ndoye reprend en `move` (232). Une annulation par Non merci ne termine plus le tour (412).
  - **Déplacement** : il faut au moins 1 point ; il consomme tout et termine le tour.
  - **Botte** : coûte 1 et réserve 1 pour le déplacement, donc il faut 2 points. Une seule par tour (garde existante `moveDistance === 1`).
  - **Enfer** : la roue de l'Enfer tient lieu de déplacement (au moins 1 point, consomme tout).
  - **`endTurn`** (`game-actions.ts:302`) est permis depuis `move`/`hell` quand l'énergie ne suffit plus, ou après avoir utilisé au moins un objet (Q1). En ligne, un tour qui expire sans aucune action coûte une chance (lot 9).
  - `NON_ACTION_ITEMS` et `PREPARATION_ITEMS` (`turn-actions.ts:158-173`) sont remplacés par l'énergie. On garde « une Boue par tour ».
  - La boutique ne coûte rien. Un objet acheté s'utilise au tour suivant.
- **UI** :
  - jauge d'énergie dans `ui/hud/action-dock.tsx` (`MoveContent`) ;
  - coût affiché dans la boutique, le sac (`inventory-tray.tsx`) et l'aide ;
  - motif « Pas assez d'énergie » (`item-availability.ts:34`) et bouton « Terminer le tour » ;
  - étapes du tour dans l'aide (`help-modal.tsx` `getTurnSteps`).
- **Bots et invariants** : les bots utilisent d'abord leurs objets, puis se déplacent. Mettre à jour `checkItemEffect`, `checkMovement` et `skipped-player-plays`. Nouveau test `energy.test.ts`.

## Lot 5 — Passifs existants

- **Retirés : Penta, Je suis Cups**. À mettre à jour : union, catalogue, `getInventoryCapacity` (`rules.ts:9`), `addStartBonus` (`game-effects.ts:385`), tests (Penta dans `rules.test.ts`) et spec.
- **Renommés** (les identifiants anglais changent aussi, logique inchangée) : Délinquant → **Corrupteur** (`corrupter`), Troll → **Goblin** (`goblin`).
- **Baraqué** : la demi-Corde reste. Contre le Monopoly Man, il garde son immunité jusqu'au bras de fer du lot 11.
- **New Cup, New Me** : à chaque nouvelle Cup, avant son apparition, choix entre « Départ +200 » et « Rester ». Réutilise l'étape `reposition` (`finishCupCollection`, `game-effects.ts:304-318` ; `repositionBeforeCup`, `game-actions.ts:424-458`).
- **Red light, Green light** : **deux de chaque** par cycle de Red Cup (Q5) : au plus 2 gains de 100 sur les cases vertes et 2 pertes de 100 sur les rouges. Deux compteurs par joueur, remis à zéro à chaque nouvelle Cup, dans `addRedGreenBonuses` (`game-effects.ts`).
- **Non merci** : refonte du flux (`openReactionWindow` et `getNoThanksReactors`, `turn-actions.ts:370-412`).
  - Il ne se déclenche que si l'action **vise son détenteur** : objet à cible unique, roue qui doit l'affecter (tuile, Ndoye…), impact de Bullet Bill.
  - Il n'annule plus les déplacements.
  - Recharge : `NO_THANKS_COOLDOWN_ROUNDS` passe de 3 à **5**.
  - Pour les roues : bouton dans la fenêtre de roue, comme la Gomme (Q6).
  - Pour Bullet Bill : fenêtre avant l'impact dans `chargeNearestPlayer`.
- **Je note** : **1 chance sur 3** (tirage seedé), objets à cible unique seulement : Hollow Purple, Corde, Middle Finger, Monopoly Man, Ndoye, Tomate. Plus de Boue. Voir `itemCopyForPassive` (`game-effects.ts:347-383`) et l'appel ligne 422.
- **Calme-toi** : au placement de la nouvelle Cup, chaque joueur à 1 ou 2 cases de la Cup et plus proche qu'elle que le détenteur est placé par celui-ci sur une case **à exactement 3 cases**, sans effet de case.
  - À réécrire : `addCupCycleEffects` (`game-effects.ts:248-277`) et `resolveCalmDown` avec une case cible.
  - Choix de case à l'écran : réutiliser les surbrillances du repositionnement (`ui/game-hooks.ts:31`).

## Lot 6 — Socle passifs, passifs simples, nouvelles victoires

- **Nouveau module `src/game/passives/passive-rules.ts`**, pour ne pas disperser des `passiveId === …` partout. Il regroupe :
  - `getStartingCurrency` (2000 ; eShop 1000 ; Nepo Baby 3000 ; Ange 600) ;
  - `getEnergyCapacity` (Red Bull 4) ;
  - `getInventoryCapacity` (Ange 2) ;
  - `canCollectRedCup` (Diable et Ange : non) ;
  - `canShopHere` (eShop) ;
  - `getShopItems` (Roller sans Botte ; Ange restreint ; objet exclusif de Chance aveugle ; boutique du diable) ;
  - `canTarget` (Ange, immunité de Chance aveugle).
- **Victoires** : nouveau module `src/game/victory.ts`.
  - `WinReason` gagne `greedy`, `devil` et `guardian`.
  - `checkVictory` est appelé après chaque collecte de Cup, gain de pièces et entrée en Enfer.
  - Co-vainqueur pour l'Ange : `winnerIds`.
  - À mettre à jour : `standings.ts`, `victory-modal.tsx:84`, `net/history.ts` `getOutcome`, et l'invariant de fin de partie (`rule-invariants.ts:181-186`).
- **Lambda / Nepo Baby / Red Bull** : passent par les helpers.
- **eShop** : boutique après tout déplacement (`getArrivalStage`, `turn-actions.ts:65`) ; 1000 pièces au départ.
- **Tomato Enjoyer** : les 4 places peuvent tenir 5 Tomates chacune (20 au plus). Ses Tomates assomment à **5 %** (`throwTomatoes`, `turn-actions.ts:325-348`). Il gagne +5 pièces par Tomate reçue.
- **Roller** :
  - action `rollDice` (dé tiré par le moteur), puis choix d'une destination à exactement N cases par un **chemin simple** ;
  - nouvel helper dans `board.ts`, car `getPathsOfLength` (146) autorise A→B→A ;
  - sans chemin de N cases, il va le plus loin possible (Q12) ;
  - pas de Botte en boutique ;
  - les cases traversées comptent (bonus du départ, Red light) ; la glissade sur la glace se fait à la fin.
- **Cupide** :
  - gagne à **5000 pièces** ;
  - une Red Cup lui donne **+1000** sans prendre de place, et la Cup réapparaît normalement ;
  - marcher sur la case d'un joueur assommé lui vole 50 pièces (`skippedTurns > 0`) ;
  - la Boue lui coûte 100 et lui rapporte 200 : il faut un prix par acheteur (`getItemPrice`, `rules.ts:110`) ;
  - après son Ndoye, les pièces perdues par la cible lui reviennent (`pendingWheel.sourceItemId`).

## Lot 7 — Passifs avancés

- **Double or nothing** :
  - après chaque gain ou perte de X pièces, une offre est mise en file : `pendingGambles`, traitée par `settleBoard` comme `pendingTileWheels` ;
  - si le joueur accepte, un 50/50 seedé donne +X de plus ou annule X ;
  - il faut un **motif** dans `applyCurrencyChange` (`state-utils.ts:101`) pour exclure les dépenses volontaires : achats, Corrupteur (Q7) ;
  - nouvelle étape `gamble`, permission au détenteur, refus par défaut au chrono.
- **Chance aveugle** :
  - **Red Cup cachée pour ce joueur**. En ligne, sur son appareil (`scene/board-stage.tsx`, `board-world`, indices de la fiche joueur). En local, sur l'écran partagé, cachée seulement pendant ses décisions : « au mieux ».
  - **Immunité** : il n'est pas ciblable par les objets néfastes des autres (`canTarget`). Draven et Bullet Bill l'épargnent (`findNearestTarget`), ainsi que les objets du diable.
  - **Boue** : il recule sur `previousNodeId`, sans perdre de pièces.
  - **Made In Heaven** (exclusif ; 1200 pièces ; 3 d'énergie ; un exemplaire ; seulement si la Cup n'est pas en 8) : tous les autres vont en case 0, Enfer compris, sans bonus. La Cup va en 8.
- **Voleur** :
  - action `stealItem` en boutique, une tentative par visite (Q9) ;
  - risque de 1 % par tranche de 10 pièces, tirage seedé ;
  - réussite : l'objet est gratuit, règles d'inventaire respectées ;
  - échec : il part en Enfer et perd des objets valant au moins 1,5 × le prix ; le reste est pris sur ses pièces (Q8) ;
  - bouton « Voler (X % de risque) » dans `shop-modal.tsx`.

## Lot 8 — Rôles : Le diable et L'Ange-Gardien

- **Le diable** :
  - annoncé à tous au lancement (journal et bannière) ;
  - compteur `devilHellEntries` incrémenté dans `sendPlayerToHell`/`placeInHell` (`game-effects.ts:204`, `state-utils.ts:49`) pour chaque autre joueur : Draven compte par joueur, et un défi compte aussi ;
  - objectif **⌊4N − N/2⌋**, avec N = nombre de joueurs au lancement (2 → 7, 4 → 14, 8 → 28) ; victoire `devil` ;
  - ne ramasse pas la Cup ;
  - action « Sortir de l'Enfer » à volonté (Q10) ;
  - un seul exemplaire de chaque objet ;
  - **sa boutique** : 2ᵉ onglet sur les cases bleues (Q11).
- **Objets du diable** :
  - **Portail** (300 pièces, 2 d'énergie) :
    - nouvel état `hellPortals` ;
    - case aléatoire, ni l'Enfer, ni le départ, ni la Cup ;
    - dure 2 tours de table ou jusqu'à ce qu'un joueur s'y arrête, **le diable compris** (Q18) ;
    - nouveau modèle 3D.
  - **Toucher d'Enfer** (400, automatique) : dans le sac. Vérifié dans `settleBoard` : tout joueur assommé ou privé de tour sur la case du diable part en Enfer. Consommé à l'usage.
  - **Black Cup** (400, 3 d'énergie) :
    - la Cup passe 2 tours de table en Enfer puis revient sur sa case ;
    - nouvel état `blackCup` ;
    - un autre joueur qui arrive en Enfer la ramasse.
  - **Sentence** (400, 2 d'énergie) : tous les autres joueurs à 0 pièce ou moins partent en Enfer.
  - **Doomsday** (666, 3 d'énergie) : pendant 1 tour de table, **toutes les cases sans exception** (départ et boutiques compris) deviennent des roues du malheur. Le départ ne paie pas les 200 pièces et la boutique ne s'ouvre pas (Q17). Nouvel état `doomsdayUntilRound`, pris en compte par `getTileWheel` (`rules.ts:103`), `earnsStartBonus` et l'étape d'arrivée.
- **L'Ange-Gardien** :
  - **Disponibilité** : seulement à 4 joueurs ou plus.
  - **Protégé** : tiré après le draft parmi les non-malfaiteurs ; les malfaiteurs sont le Diable, le Voleur, le Goblin et le Corrupteur. S'il n'y en a aucun, l'Ange devient Lambda (Q13).
  - **Public** : tout le monde sait qui est le protégé, qui porte un **halo** au-dessus de son pion (modèle 3D, Q13).
  - **Protégé qui abandonne ou déclare forfait** : l'Ange prend sa place et récupère son passif, son sac, ses Red Cups et ses pièces, mais il commence **en Enfer** (Q13). La sortie de jeu générale (`removePlayer`, lot 9) appelle cette règle.
  - **Victoire** : co-victoire avec son protégé.
  - **Interdits** : ne ramasse pas la Cup.
  - **Enfer** : il n'y va jamais ; à la place, il saute son prochain tour.
  - **Départ** : 600 pièces et 2 places dans le sac.
  - **Roue du malheur** : 2 issues seulement, passer son tour ou rien (`getWheelResults` par joueur).
  - **Libération** : action `rescueProtege` ; le protégé sort de l'Enfer vers sa case, et l'Ange perd 2 tours.
  - **Ciblage** : il ne peut viser que son protégé.
  - **Boue** : il perd son prochain tour.
  - **Boutique restreinte** : ni Ndoye, ni Hollow Purple, ni Boue, ni Tomate, ni Bullet Bill, ni Middle Finger, ni Draven, ni Casque.
  - **Bouclier** (500, hors tour) : **au choix de l'Ange** (Q14). Quand un objet néfaste vise le protégé, une fenêtre de réaction s'ouvre pour l'Ange, comme celle de Non merci : il bloque ou laisse passer.
- **Barre des joueurs** : lien Ange → protégé et compteur du diable (« Enfer 5/14 »).

## Lot 9 — Chrono de tour en ligne (45 s, 3 chances, forfait)

- **Horloge partagée** :
  - aucune RPC ne donne l'heure du serveur aujourd'hui. `touch_seat` renverra `now()` (ou une RPC `server_time()`), changement additif dans `supabase/schema.sql` ;
  - `room-store` estime le décalage à chaque battement (20 s) et expose `getServerNow()`.
- **Horodatage des actions** :
  - le message `action` de `RoomWire` (`net/room-protocol.ts`) porte un `issuedAt` ;
  - `reduceGame` reçoit un contexte `{ now }` (`Date.now()` en local), ce qui reste déterministe puisque l'heure vient de l'action ;
  - l'état garde `turnClock` (temps restant, en cours depuis…), mis à jour centralement dans `applyGameAction` ;
  - le chrono ne tourne que pendant les décisions du joueur actif. Il est en pause pendant les décisions des autres (réaction, duel, votes, Calme-toi, roues des autres) et pendant les animations (marge de grâce).
- **Expiration** : action `expireTurn`, que tout joueur assis peut envoyer (même modèle que `resolveReaction(null)`).
  - Le réducteur vérifie `issuedAt ≥ échéance`.
  - Les autres appareils attendent 2 s de plus, et le compare-and-set (`advance_room`) ne laisse passer qu'une écriture.
- **Effets** :
  - si `turnActed` : fin du tour ; les décisions en cours du joueur sont fermées par défaut (roue tournée, boutique fermée, objet à jeter tiré au hasard) ;
  - sinon : une chance perdue (`idleStrikes`) et fin du tour. Un tour passé sans rien faire compte de la même façon (Q1) ;
  - à 2 chances perdues : bannière d'alerte au début de son tour suivant ;
  - à 3 : **forfait**.
- **Forfait** : `removePlayer(state, id, "forfeit")`, généralisé depuis `abandon.ts`. Il accepte toutes les étapes, vide toutes les décisions en attente (y compris `pendingDuel`), révèle une Cup cachée par New Cup et nettoie Boue, fantôme et neige. Si le joueur qui part était protégé par un Ange-Gardien, l'Ange reprend sa place (Q13, lot 8).
  - Corrige aussi un trou existant : quitter pendant une décision bloque la partie (`room-store.leave`).
- **Décisions des autres** : une échéance avec choix par défaut (réaction, vote, pierre-feuille-ciseaux, Basket, Calme-toi, objet à jeter, pari), pour qu'un appareil parti ne bloque plus la partie.
- **UI** : anneau de chrono (`top-bar.tsx` / dock), chances perdues dans `players-bar.tsx`, alerte dans `alert-banner.tsx`. **Rien en local** (le doc ne parle que du jeu en ligne).
- **Tests** :
  - `online-engine.test.ts` : déterminisme avec horodatage ;
  - `room-backend.test.ts` : PGlite et heure du serveur ;
  - nouveau `turn-clock.test.ts`.

## Lot 10 — Draft des passifs avant la partie

- **Phase** : nouvelle phase **`draft`** (`GameState.phase`, `types.ts:429`). L'état `draft` contient `offers`, `picks` et le début du chrono.
- **Option** : le draft est activé par une option de `startGame`, pour que les tests et bots existants démarrent directement.
- **Offres** : tirées et seedées dans `startGame` `build()` (`game-actions.ts:137-170`) :
  - **uniques sur toute la table** : 3 par joueur jusqu'à 6 joueurs, 2 au-delà ;
  - l'Ange seulement à 4 joueurs ou plus.
- **Actions** :
  - `pickPassive`, modifiable jusqu'à la clôture ;
  - `closeDraft` à l'échéance de 60 s : choix aléatoire parmi les offres pour qui n'a pas choisi ; en ligne, n'importe quel appareil peut l'envoyer.
- **Clôture automatique** : dès que tout le monde a choisi.
- **Ensuite** : `createPlayers` applique les effets des passifs (pièces, places, énergie), tire le protégé de l'Ange et annonce le Diable.
- **Compte à rebours de 5 s** : purement visuel, via `boardBusyUntil` (`feedback/ui-store.ts:101`) sur le modèle de l'intro de 950 ms (`game-feedback.ts:54`). Écran « La partie commence dans 5… ».
- **Local** : passage de l'écran, « Passe l'écran à X » puis « Je suis X » (modèle de `duel-modal.tsx:300-316`), cartes cachées, **sans chrono** : chacun choisit à son rythme (Q15).
- **En ligne** : chacun voit ses cartes sur son appareil, les autres voient « X a choisi ✓ ». Le chrono de 60 s ne vaut qu'en ligne ; son échéance vient de l'horloge partagée du lot 9.
- **À brancher** :
  - `App.tsx:51-62` ;
  - garde `phase !== "playing"` (`action-permissions.ts:15`) ;
  - `game-save.ts`, qui doit accepter la phase `draft` ;
  - bots (`run-bot-game.ts:104`) ;
  - textes « passifs tirés au hasard » (`lobby-screen.tsx:167`, `online-screen.tsx:332`).

## Lot 11 — Mini-jeux

- **Bras de fer (Baraqué contre Monopoly Man)** :
  - déclenché dans la branche Monopoly Man (`turn-actions.ts:264-280`) ;
  - nouvel état `pendingArmWrestle` : **10 s au plus** d'appuis simultanés ; la partie s'arrête plus tôt si la barre atteint un bout (Q20) ;
  - **égalité** (Q20) : s'il y a au moins une case entre eux, l'attaquant avance d'une case vers le Baraqué et le Baraqué recule d'une case ; sur deux cases voisines, seul le Baraqué recule d'une case. Ces pas suivent le plus court chemin entre eux ;
  - chaque appareil envoie `submitArmTaps` (plafonné) ; le moteur compare les appuis × multiplicateur (Baraqué ×1,2) ;
  - barre en direct via un nouvel évènement de canal `arm`, sur le modèle de `net/basket-live.ts` ;
  - en local : deux zones d'appui (gauche et droite) ou les touches A et L ;
  - si le Baraqué gagne, pas d'échange et le Monopoly Man est perdu ;
  - bots : nombre d'appuis aléatoire.
- **Blackjack** :
  - nouveau mode de duel dans `getDuelModes` (`duel-setup.ts:14`) et dans le duel du fantôme (`ghost.ts:212`) ;
  - paquet seedé dans `PendingDuel` ; actions `blackjackHit` et `blackjackStand` ; chaque duelliste joue à son tour ;
  - le plus proche de 21 sans dépasser gagne ; en cas d'égalité, pile ou face ;
  - le fantôme joue comme un croupier (il tire sous 17) ;
  - à mettre à jour : arène dans `duel-modal.tsx`, `DUEL_MODE_LABELS`/`LOG_NAMES`, bots et `simulation.test.ts:47`.

## Lot 12 — Docs et finitions

- `red-cups-game-spec.md` :
  - sections 2 à 9 réécrites (énergie, roues, prix, passifs, Luna Park) ;
  - historique **0.1.4**.
- `README.md` : flèches, énergie, chrono, draft.
- Textes de l'aide.
- Descriptions finales (celles de l'auteur si elles arrivent).
- `package.json` : version 0.1.1 → 0.1.4.
- Campagne `bun run simulate -- --games 1000 --min 2 --max 8`.

---

## Réponses de l'auteur aux 20 questions

Les réponses sont reçues. Le « Lot » indique où chacune s'applique.

| # | Sujet | Réponse | Lot |
|---|---|---|---|
| 1 | Passer son tour | Choix par défaut : pas de fin de tour sans déplacement ni objet, sauf énergie insuffisante. En plus, un tour joué sans rien faire est pénalisé comme l'inactivité : une chance perdue. | 4, 9 |
| 2 | Avance d'une case / Retourne d'où tu viens | La roue **et** la boutique de la case d'arrivée se déclenchent. | 3 ✔ |
| 3 | « Perds un objet » avec un sac vide | −200 pièces. | 3 ✔ |
| 4 | Poids des roues | Par défaut : 8 secteurs égaux. | 3 ✔ |
| 5 | Red light, Green light | **Deux de chaque** par cycle de Red Cup : 2 gains sur cases vertes et 2 pertes sur cases rouges au plus. | 5 |
| 6 | Non merci sur une roue | Par défaut : après le résultat, comme la Gomme. Contre Draven, il ne protège que son détenteur. Recharge de 5 tours de table. | 5 |
| 7 | Double or nothing | Par défaut : tous les gains et pertes, sauf les dépenses volontaires (achats, Corrupteur, vol). | 7 |
| 8 | Voleur pris | Par défaut : il perd ses objets les plus chers d'abord, jusqu'à 1,5 × la valeur, puis le reste en pièces, sans remboursement de l'excédent. | 7 |
| 9 | Voleur | Par défaut : une tentative par visite de boutique. | 7 |
| 10 | Diable qui sort de l'Enfer | Par défaut : vers la case 0, sans les 200 pièces. | 8 |
| 11 | Boutique du diable | Par défaut : sur les cases bleues, en plus de la boutique normale. Aucun de ses objets en double. | 8 |
| 12 | Roller sans chemin de N cases | Par défaut : il va le plus loin possible. | 6 |
| 13 | Ange-Gardien | Sans protégé possible : il devient Lambda. Le protégé est **public**, avec un **halo** au-dessus de lui. Si le protégé abandonne, l'Ange **prend sa place** : passif, sac, Red Cups et pièces, mais il commence **en Enfer**. | 8, 9 |
| 14 | Bouclier | **Au choix de l'Ange**, dans une fenêtre de réaction. | 8 |
| 15 | Draft en local | **Pas de chrono en local.** | 10 |
| 16 | Black Cup | Par défaut : seul un joueur qui arrive en Enfer après coup la ramasse. | 8 |
| 17 | Doomsday | Toutes les cases **sans exception** deviennent des roues du malheur. Le départ ne donne pas les 200 pièces et la boutique ne s'ouvre pas. | 8 |
| 18 | Portail | Il se déclenche quand on s'y arrête, **le diable compris**. | 8 |
| 19 | Chance aveugle | Par défaut : il n'apparaît pas dans les cibles. | 7 |
| 20 | Bras de fer | 10 secondes au plus. Égalité : s'il y a au moins une case entre eux, l'attaquant avance d'une case et le Baraqué recule d'une case ; sur deux cases voisines, seul le Baraqué recule d'une case. | 11 |

---

## Vérification

- **Après chaque lot** : `bun x tsc -p tsconfig.json --noEmit`, `bun run test` (dont les 400 parties de bots) et `bun run format:check`.
- **Lots du moteur** : en plus, `bun run simulate -- --games 1000 --min 2 --max 8`, avec 0 violation.
- **Lots majeurs** : en plus, `bun run build`.
- **Lots visuels** (1, 2, 10, 11) :
  - aperçu `red-cups-dev` (port 5190) via les outils de preview ;
  - les 3 cartes, téléphone en paysage (redimensionnement), capture d'écran ;
  - le son d'achat s'écoute dans la boutique.
- **Lots en ligne** (9, 10, 11) :
  - `room-backend.test.ts` (PGlite) ;
  - test manuel à 2 onglets sur Supabase (`.env.local`) : chrono qui expire, chance perdue, alerte, forfait à la 3ᵉ, draft à 2 appareils, bras de fer en direct.
