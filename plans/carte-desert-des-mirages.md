# Carte : Le Désert des Mirages

*6 à 8 joueurs · 41 cases (40 + l'Enfer) · thème « dunes » (`themeId: "dunes"`) · en ligne seulement (voir « Information cachée »).*

Une grande boucle de caravane autour d'un massif de dunes. **Deux Red Cups sont sur la carte en permanence : une vraie, un
mirage.** Personne ne sait laquelle est laquelle.

## Topologie (à poser en coordonnées dans `desert-map.ts`)

| Zone | Ids | Contenu |
|---|---|---|
| Boucle extérieure (caravane) | 0–23 | `0` Départ au sud ; oasis (boutiques) en `3`, `9`, `15`, `21` |
| Boucle intérieure (dunes) | 24–35 | deux Puits en `26` et `32` |
| Passes | 36–39 | une case entre la boucle extérieure et l'intérieure : `36` : 5 ↔ 25 ; `37` : 11 ↔ 28 ; `38` : 17 ↔ 31 ; `39` : 23 ↔ 34 |
| Enfer | 40 | le Sable mouvant, au centre, par les effets seulement |

- Boucle extérieure : routes à double sens, flèches sur les oasis pour imposer la sortie dans le sens horaire (le bonus du
  Départ se paie en entrant en `0` par sa flèche, depuis `23`).
- Boucle intérieure : double sens ; plus courte, mais ses passes se ferment pendant les tempêtes.
- Couleurs : 4 oasis (boutiques), 2 puits, le reste réparti en verte, rouge, neutre.

## Nouveaux types de cases

- **Puits** (`well`) : arriver dessus permet de payer 150 pièces pour apprendre **en secret** laquelle des deux Cups est la
  vraie (une fois par joueur et par paire de Cups). Le journal dit seulement « X puise au puits » (texte identique pour tous).
- **Oasis** (`oasis`, aussi boutique) : un seul joueur à la fois ; tant qu'il y reste, aucun objet ne peut le cibler et il
  regagne 1 point d'énergie au tour suivant ; un second joueur qui arrive est repoussé sur sa case d'origine.
- **Sable mouvant** : l'Enfer de la carte (apparence propre, règles d'Enfer inchangées).

## Mécanique centrale : les mirages (règles validées par l'auteur)

1. **Deux Cups en permanence.** À chaque apparition, un couple (`real`, `mirage`) est tiré avec l'aléa du moteur
   (`drawEngineRandom`), donc identique sur tous les appareils.
2. **Arriver sur le mirage.** Il se dissipe (« Ce n'était qu'un mirage »), le joueur finit son tour et subit la **Soif** :
   1 point d'énergie de moins à son prochain tour. Pas de perte de pièces.
3. **Quand un mirage est pris, les DEUX Cups disparaissent et DEUX nouvelles apparaissent ailleurs, aux deux endroits
   différents de tous les précédents** (la vraie Cup aussi change de place). Sinon, voir quelle Cup n'a pas bougé
   trahirait la vraie. Même chose quand la vraie est prise : un nouveau couple.
4. **Aucune corrélation** entre l'ancien couple et le nouveau : les tirages ne dépendent que des positions des joueurs et
   excluent symétriquement les deux anciennes cases (jamais une seule des deux).
5. **Placement du couple** : la vraie Cup à 5 à 7 pas du joueur le plus proche, le mirage à 4 à 8 pas, les deux à au moins
   6 pas l'une de l'autre, jamais sur une oasis, un puits, une passe, l'Enfer ou une case occupée ; la paire ne se pose pas
   près du joueur qui vient de ramasser la vraie Cup (anti-boule de neige : à au moins 6 pas de lui).
6. **New Cup, New Me** : ne se déclenche qu'à la prise de la vraie Cup (la dissipation d'un mirage n'est pas une « nouvelle
   Cup » pour ce passif). À valider par l'auteur.

### Information cachée : tout ce qui doit être identique pour la vraie Cup et le mirage

Si une règle se comporte différemment sur la vraie Cup et sur le mirage avant que l'issue soit révélée, elle trahit la
vraie. À l'arrivée sur une case de Cup, la séquence est donc **la même pour les deux** jusqu'à la révélation finale :

- **Roller** : le dé pour la Red Cup (il faut un 6) est lancé aussi sur le mirage ; l'issue (ramasse / se dissipe) vient ensuite.
- **Sac plein** : la même question « Défausser quel objet pour ramasser la Cup ? » est posée pour les deux ; l'objet n'est
  perdu que si la Cup est vraie.
- **Cupide** (pas de place de sac pour la Red Cup), **Chance aveugle** (ne voit jamais la Red Cup : ne voit ni l'une ni l'autre),
  **Mi-vu, Mi-vue** (visible à une case de la Red Cup : à une case de l'une ou l'autre), **Mime** : même traitement des deux.
- Journal : « X arrive sur une Red Cup… » identique ; la phrase finale seule distingue (« Il ramasse la Red Cup » /
  « Ce n'était qu'un mirage »).
- Rien n'est stocké dans l'état qui ne soit pas identique chez tous les joueurs ; l'interface n'affiche `real` que pour le
  joueur qui a puisé au puits (même niveau de protection que les sacs : un joueur qui ouvre les outils de développement
  pourrait lire l'état, comme pour les sacs).
- **Local** : impossible de garder un secret sur un écran partagé ; la carte n'est jouable qu'en ligne (ou en dev), comme
  le fait déjà `localPlayAvailable` en production.

## Autres mécaniques

1. **La caravane.** Un chariot fait le tour de la boucle extérieure de 2 cases par tour de table (dans le sens horaire). Un
   joueur sur sa case peut y monter (1 énergie, à la place de sa marche) : il avance de 4 cases avec elle (arrivée
   normale, sans bonus du Départ). C'est le rattrapage naturel du dernier.
2. **Les tempêtes de sable.** Toutes les 4 manches, une tempête ferme les deux passes de la moitié « active » (par exemple
   `36` et `38`) et ouvre les deux autres jusqu'à la tempête suivante (calculé depuis `round`). Les Cups ne sont pas
   touchées : aucune information ne se perd ni ne s'ajoute.
3. **Longue-vue** (objet optionnel, vendu seulement sur cette carte) : révèle la vraie Cup au lanceur, une fois. À décider.

## Équilibrage

- Soif = 1 point d'énergie (≈ le coût d'un déplacement), du même ordre que le prix du puits (150 pièces) : le choix
  « tenter » ou « puiser » est ouvert.
- La Cup (la vraie) ne réapparaît jamais deux fois de suite du même côté de la boucle.
- Le nouveau couple est tiré « équitable » : la distance moyenne entre le joueur le plus proche et le plus lointain ne
  doit pas varier de plus de 2 pas d'un tirage à l'autre (à vérifier en campagne).
- Si une partie dure plus que les cartes existantes (≥ 40 tours), revoir la distance de la Cup à 4–6.

## Moteur et interface

- `redCupNodeId` est lu à 77 endroits dans 22 fichiers. Ne pas le dupliquer : introduire `state.cups: { nodeId, real }[]`
  (au plus 2, vide hors de cette carte), garder `redCupNodeId` comme « la Cup vraie » pour les autres cartes, et passer par
  des fonctions (`getCupAt(state, nodeId)`, `spawnCupPair`) dans `game-effects.ts` (`placeNextCup` actuel). Parcourir tous
  les usages (réapparition, Roller `roller-cup.test.ts`, Cupide, Made In Heaven, New Cup New Me, Black Cup, fog de Chance
  aveugle / Mi-vu, scène 3D, bots, invariants, sauvegardes : `GAME_SAVE_VERSION`, `EMPTY_GAME_STATE`, `upgradeSave`).
- Actions : `drinkAtWell` (puits), `boardCaravan` ; permissions et chrono comme les autres ; le journal public ne nomme
  jamais la Cup révélée.
- Bots : tirent entre les deux Cups avec un biais vers la plus proche ; utilisent le puits quand ils ont les pièces ;
  prennent la caravane si elle rapproche.
- Invariants : exactement deux Cups, une réelle, sur cette carte ; jamais le mirage ramassé ; après une prise, aucune des
  anciennes cases ne porte une Cup ; le couple respecte les distances ; jamais de Cup sur une oasis, un puits, une passe.
- Scène 3D : deux Cups identiques avec un scintillement de chaleur, la caravane, le sable qui souffle, le puits ; son et
  animation de dissipation du mirage.
- Wiki : `maps.ts`, `systems.ts` (mirages, tempêtes), `interactions.ts` (Roller, Cupide, Chance aveugle, Mi-vu Mi-vue, Mime,
  New Cup New Me, Black Cup, Made In Heaven sur cette carte).

## Points ouverts

- Made In Heaven : où pose-t-il la Cup ? (proposition : un nouveau couple tiré normalement.)
- Black Cup du diable : prend-elle la vraie, les deux, ou celle visée ? (proposition : la Cup qui est au point visé, et si
  c'est le mirage, elle se dissipe.)
- Le Puits peut-il être utilisé deux fois par le même joueur sur une même paire ? (non, par défaut.)
