# Carte : L'Archipel des Marées

*6 à 8 joueurs · 41 cases (40 + l'Enfer) · thème « lagune » (`themeId: "lagoon"`).*

Cinq îles reliées par des chaussées que la marée noie, un bac qui fait le tour, des tourbillons.

## Topologie (à poser en coordonnées dans `archipel-map.ts`)

Cinq îles de 6 cases en cercle, séparées par cinq chaussées de 2 cases : 30 + 10 = 40, plus l'Enfer (le Maelström, au centre
du cercle, `kind: "hell"`, atteint seulement par les effets).

| Île | Ids | Contenu |
|---|---|---|
| Île du Port | 0–5 | `0` Départ ; `5` Quai + boutique |
| Île aux Perles | 6–11 | `6` Quai ; `9` boutique ; une verte, une rouge |
| Île du Phare | 12–17 | `12` Quai ; `15` boutique ; une verte, une rouge |
| Île des Épaves | 18–23 | `18` Quai ; pas de boutique (c'est l'île du raccourci) ; deux vertes, deux rouges |
| Île Corail | 24–29 | `24` Quai ; `27` boutique ; une verte, une rouge |
| Chaussées | 30–39 | deux cases par lien, dans l'ordre Port→Perles→Phare→Épaves→Corail→Port |
| Enfer | 40 | Maelström |

- Sur chaque île : une boucle courte de 6 cases (route à double sens, quelques flèches pour imposer la sortie), un Quai
  qui touche sa chaussée entrante, et la sortie vers la chaussée suivante à l'autre bout.
- **Tourbillons** : deux cases de type `whirlpool` (par exemple `3` et `20`).
- **4 boutiques** : `5`, `9`, `15`, `27`. Le reste en verte, rouge, neutre à parts à peu près égales.
- **Raccourci à risque** : une chaussée « basse » directe entre Port et Épaves (ids 38–39 inversés), ouverte seulement à
  marée basse.

## Nouveaux types de cases

- **Chaussée** (`causeway`) : se noie à marée haute (impassable). Un joueur qui s'y trouve quand elle se noie est déposé sur
  le Quai de l'île vers laquelle il allait (sinon le plus proche). Arrivée normale à l'arrivée, sans roue ni boutique.
- **Quai** (`quay`) : un seul joueur à la fois (un second qui arrive est repoussé sur la case d'où il venait, et l'occupant
  gagne 50 pièces). C'est aussi là que le bac s'amarre. Compte comme une case normale pour la roue / la boutique.
- **Tourbillon** (`whirlpool`) : arriver dessus aspire vers le Quai d'une île tirée au hasard (jamais la sienne), sans
  roue ni boutique là-bas. Compte comme une arrivée sur le tourbillon (Boue, Portail, Cup éventuelle y sont traitées avant).

## Mécaniques

1. **Marées.** L'état de marée alterne tous les 2 tours de table (`tide: "low" | "high"`, tours 1-2 bas, 3-4 haut…). Cinq
   chaussées : trois « basses » (ouvertes à marée basse), deux « hautes » (ouvertes à marée haute). Le HUD annonce
   la marée suivante un tour à l'avance. Moteur : une route fermée comme une Barrière (`isBlockedRoad`), calculée depuis
   la marée ; le moteur de déplacement et l'IA doivent lire l'état.
2. **Le bac.** Un bateau se tient à un Quai et avance au Quai suivant (ordre Port→Perles→Phare→Épaves→Corail→Port) au
   début de chaque tour de table. Un joueur sur le Quai où est le bac peut « Prendre le bac » (1 énergie, à la place de sa
   marche) : il est déposé au Quai suivant du circuit (arrivée normale). Une seule action de la part du joueur, déterministe.
3. **Les tourbillons**, voir plus haut.

## Équilibrage

- La Cup réapparaît sur une île autre que celle du dernier gagnant, à 5 à 8 pas du joueur le plus proche (graphe statique,
  marée ignorée) ; jamais sur une chaussée, un Quai ou un tourbillon.
- Le dernier de la table (le moins de Red Cups) peut décider du sens du bac une fois par manche (optionnel, à tester).
- 6 joueurs à 8 : le Quai à une place crée des rencontres sans bloquer (le repoussé garde son tour).
- Aucune marée ne ferme les trois routes d'une île à la fois ; vérifier par test de graphe : à toute marée, chaque île a
  au moins deux sorties (chaussée, bac, ou autre).

## Moteur et interface

- État : `tide` (calculé depuis `round`, donc rien à stocker si la marée est une pure fonction du tour), `ferryQuayId`
  (stocké, avance au début du tour : voir `seatNextPlayer` dans `game-effects.ts`, à côté du blizzard). Actions :
  `boardFerry` (permissions dans `action-permissions.ts`, chrono dans `clock-defaults.ts`, méthode du store).
- `rules.ts` : le Quai occupé, le tourbillon ; `game-effects.ts` : arrivée sur un tourbillon ; `ice.ts` n'est pas concerné.
- Scène 3D : eau, îles, chaussées qui disparaissent sous l'eau, bateau, remous des tourbillons (`src/scene/`).
- Feedback : `lastPowerEvent`-like (événement `ferry`, `tide`, `whirlpool`) pour l'animation et le son.
- Bots : prennent le bac quand il rapproche de la Cup ; évitent les chaussées sur le point de se noyer.
- Invariants (`src/game/simulation/`) : jamais deux joueurs sur un Quai ; personne sur une chaussée noyée ; le bac suit
  son circuit ; tourbillon = arrivée sur un Quai étranger.
- Wiki : `maps.ts` (une section par carte), `systems.ts` (marées, bac), `interactions.ts` (Barrière, Taupe qui creuse
  vers une chaussée noyée, Mage noir qui se téléporte sur une chaussée noyée…).

## Points ouverts (à trancher à l'implémentation)

- Un tunnel de la Taupe vers une chaussée noyée ; le pentagramme du Mage noir posé sur une chaussée qui se noie ; la Sœur
  Fantôme sur une chaussée noyée.
- Banquise-like : Made In Heaven rapatrie la Cup sur quelle case de cette carte ? (à définir : le Quai du Port.)
