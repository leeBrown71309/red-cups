# Patch « Cups Power » (version 0.2.3)

Branche `patch_0.2.3`. Les actifs deviennent des **Cups Power (CP)** à l'écran : le code garde `actif`, `PassiveId`,
`passiveId`, `CARD_KINDS` (renommer l'identifiant casserait les sauvegardes et les salons en ligne). Le mot « carte »
ne désigne plus qu'une carte de jeu au sens du plateau (la _map_) : on ne dit plus « carte d'actif ».

Cinq nouveaux CP, deux nouveaux passifs. Les CP sont volontairement complexes : le but est de voir jusqu'où le jeu peut
aller. Tout est intégré tel que décrit dans les signalements ; les lectures que j'ai dû faire sont listées en fin de
document (« À valider »).

## Les sept éléments

| Id | Nom | Nature | Module moteur |
|---|---|---|---|
| `mime` | Mime | CP | `mime.ts` |
| `mole` | Taupe | CP | `mole.ts` |
| `black-mage` | Mage noir | CP | `black-mage.ts`, `mage-queries.ts`, `mage-luck.ts` |
| `half-seen` | Mi-vu, Mi-vue | CP | `mist.ts`, `mist-cycle.ts` |
| `ghost-sister` | Sœur Fantôme | CP | `sister.ts` |
| `hermit` | L'Ermite | passif | `passive-rules.ts` (`isHermitPrimeActive`), `hermit.ts` |
| `insurer` | L'Assureur | passif | `passive-rules.ts` (`getInsurerPayout`), `state-utils.ts` (`payInsurer`), `insurer.ts` |

## Règles (telles qu'implémentées)

### Mime

- Une fois tous les 3 tours de table (`MIME_COOLDOWN_ROUNDS`), avant son déplacement, le Mime choisit un joueur et
  copie **son CP** jusqu'à la fin de son tour. `Player.mimicId` ; `hasCard` le lit comme une carte à lui, donc tous les
  avantages **et** les défauts s'appliquent (Chance aveugle : immunité ; Cupide : pas de place de sac pour la Red Cup ;
  Red Bull : +1 énergie immédiate ; eShop : la boutique s'ouvre partout…).
- Copier ne coûte aucune énergie et ne compte pas comme une action du tour.
- Pas de copie de : Mime, Lambda, le diable, L'Ange-Gardien (rôles posés au départ), Mage noir, Sœur Fantôme,
  Mi-vu, Mi-vue (états qui vivent d'un tour à l'autre chez leur titulaire). Taupe se copie : la copie utilise le
  compteur et les cases visitées du Mime.
- On ne copie pas un joueur invisible, et un Mime invisible ne copie personne.

### Taupe

- **Creuser** : une fois tous les 3 tours, 3 énergie, depuis sa case vers une case **déjà visitée** (case où le joueur
  s'est arrêté ou qu'il a traversée). Le joueur s'y déplace aussitôt (c'est son déplacement du tour ; l'arrivée est une
  arrivée comme une autre : Boue, Red Cup, roue, boutique, glace).
- Le tunnel est ouvert dans les deux sens, visible de tous, et se referme après **une** traversée (la creuse est sa
  première utilisation, la traversée suivante, par n'importe qui, sa seconde).
- Traverser : tout joueur sur une extrémité, pour 3 énergie ; le creuseur, pour 2. Une traversée est un déplacement.
- Interdit de creuser depuis ou vers : l'Enfer, une case de glace, une case avec la Red Cup, un piège (Boue, Portail),
  un tunnel déjà ouvert.

### Mage noir

- Commence avec **3 chances** (`luck`), en regagne une tous les 15 tours (`luckReturnRound`), jamais plus de 3.
- **Poser une marque** (pentagramme) : sur sa case, un seul à la fois, pas sur une Boue, pas en Enfer, pendant son tour
  (avant ou après son déplacement). Visible de tous. Aucune énergie.
- **Se téléporter** sur sa marque coûte 1 chance : pendant son tour (même depuis l'Enfer), quand un objet le vise
  (l'objet est annulé), quand Bullet Bill va le toucher, ou à la place d'une roue qui le déplacerait (Direction
  l'Enfer, Retourne d'où tu viens, Avance d'une case, Va au Départ). Ignore routes, Barrières et flèches.
- À l'arrivée : chaque autre joueur sur la marque a 20 % de tomber en Enfer ; une Boue sur la marque fait tomber le
  mage lui-même en Enfer avec 20 % de chances (et la Boue disparaît). La marque disparaît après usage, **sauf** si elle a
  envoyé quelqu'un en Enfer.
- À 0 chance, le mage est éliminé (dès que la table est au repos).

### Mi-vu, Mi-vue

- Cycle de 3 tours **du joueur** : visible, invisible, invisible (`mistTurns`). Avant son premier tour : visible.
- Invisible = personne ne le voit, il ne voit personne ; il ne cible personne et nul ne le cible (objets, Calme-toi,
  défi de la roue de l'Enfer, copie du Mime) ; Draven l'épargne ; Bullet Bill ne le traque plus (mais l'assomme s'il
  explose sur sa case).
- À une case ou moins de la Red Cup, il est visible (calcul dérivé, jamais stocké).
- Côté écran (en ligne) : l'invisible ne voit plus les pions, les actions, l'inventaire, les pièces, les pièges, la Red
  Cup ni Bullet Bill ; les autres ne voient plus son pion (il devient transparent pour lui), ses actions (le journal
  garde « tour de X »), son sac, ses pièces.

### Sœur Fantôme

- Une petite fille fantôme (`sisterNodeId`) démarre avec le joueur sur le Départ. Pour chaque pas du joueur, elle fait le
  pas **opposé** (haut ↔ bas, gauche ↔ droite, diagonales) si une route part dans cette direction (à 40° près), en
  respectant flèches et Barrières ; sinon elle reste.
- Elle ne peut être ciblée, n'active ni piège ni case. Déplacé par autre chose qu'un pas (téléportation, échange, corde…),
  le joueur la laisse où elle est. Joueur en Enfer : elle retourne au Départ.
- **Swap** (3 énergie, hors Enfer, pas sur la même case) : le joueur et la sœur échangent leur place ; la sœur emporte
  avec elle, sur la case que le joueur quitte, ce qui était sur sa case : Boue, Portail, Red Cup, Bullet Bill (pas les
  joueurs). Rien n'est déclenché, ramassé ni touché, ni sur l'arrivée du joueur, ni sur le départ de la sœur.

### L'Ermite

- Tant qu'aucun autre joueur n'est à 2 cases ou moins (routes, flèches et Barrières ignorées ; un joueur en Enfer n'est
  près de personne) : +1 énergie à l'ouverture du tour, +100 pièces en passant par le Départ.
- Quand un joueur **arrive** sur sa case, la prime est perdue jusqu'à la fin de son prochain tour
  (`hermitLostUntilRound`).

### L'Assureur

- Toute perte de pièces d'un autre joueur lui rapporte 20 % (arrondi à l'inférieur), payés par la banque, au plus 150
  par tour de table. Seules les pertes subies comptent (pas les achats ni le Corrupteur : comme pour Double or nothing).
- Chaque autre joueur qui descend en Enfer lui rapporte 50 pièces (hors plafond).

## Contrat entre le moteur et l'écran

- `GameState.lastPowerEvent` (`PowerEvent`, `seq`) : dernier fait d'un CP ; `game-feedback.ts` l'émet en
  `{ type: "power", event }`. `estimatePowerEventMs` (`theme/timing.ts`) retient les dialogues pendant l'animation.
- `PlayerMovement.tunnel` (plongée dans un tunnel) et `PlayerMovement.sister` (pas en miroir de la sœur, un par pas du
  joueur, qui répète la case où elle reste) enrichissent la marche ; `estimateMovementMs` en tient compte.
- `GameState.moleTunnels`, `GameState.blackMarks`, `Player.sisterNodeId` (`getSisterNode`) sont ce que la scène dessine.
- `isInvisible(state, player)` (`mist.ts`) est la seule source de vérité de l'invisibilité ; `{ type: "invisibility" }`
  annonce chaque changement.
- `GameLogEntry.by` (tour de qui) et `open` (jamais masquée) servent au brouillard du journal.

## À valider (lectures que j'ai dû faire)

1. **Mime et ses interdits** : copier le diable, l'Ange-Gardien, le Mage noir, la Sœur Fantôme ou Mi-vu, Mi-vue est
   refusé (rôle posé au départ, ou état qui vit d'un tour à l'autre). À rediscuter si on veut tout permettre.
2. **« Tour »** = tour de table (round), comme pour Non merci (« tous les 3 tours » = prêt 3 tours de table plus tard).
3. **Taupe, « case visitée »** : case où le joueur s'est arrêté **ou qu'il a traversée** ; le départ compte.
4. **Taupe, énergie** : creuser ou traverser prend le déplacement (le reste de l'énergie est perdu), comme une marche.
5. **Taupe, tunnel** : « 2 utilisations » = la creuse + une traversée ; le tunnel ne fait pas partie du réseau de routes
   (Bullet Bill, Calme-toi, la Sœur Fantôme l'ignorent).
6. **Mage noir, la phrase coupée** (« la marque disparaît si le propriétaire s'est téléporté… mais si un joueur a été
   envoyé en Enfer via cette marque… ») : lue comme « elle reste ». À confirmer.
7. **Mage noir, la Boue sur la marque** : le texte dit « il peut se retrouver en Enfer » sans chiffre : 20 %, comme pour
   les joueurs. La Boue disparaît.
8. **Mage noir, 3 chances et 15 tours** : 15 tours de table, c'est plus long qu'une partie classique ; l'élimination à
   0 chance est radicale, surtout contre Draven ou un Hollow Purple.
9. **Mi-vu, Mi-vue** : cycle « visible, invisible, invisible » ; les cartes de la roue et les pièges de la carte restent
   tels quels (les pingouins de Banquise et le fantôme de Luna Park ne sont pas des « ciblages » : ils l'atteignent).
10. **Sœur Fantôme, le miroir** : direction à 40° près sur les coordonnées du plan ; elle obéit aux flèches. Sur le
    plateau classique (petit, très fléché) elle restera souvent sur place.
11. **L'Assureur, « par tour »** : 150 pièces par tour de table ; ses 20 % comptent les pertes réelles (Casque compris).
12. **L'Ermite, « arrive sur toi »** : seul le joueur qui arrive sur sa case compte, pas l'Ermite qui rejoint quelqu'un.
