# Red Cups — spécification du jeu

> Document de référence pour le MVP et les futurs contributeurs. Les règles issues du diaporama sont distinguées des décisions prises pendant le cadrage. Les roues et certains détails de déplacement sont provisoires et pourront être rééquilibrés.

## 1. Vision

Red Cups est un jeu de plateau chaotique, compétitif et multijoueur. Les joueurs se déplacent sur un petit réseau de cases, collectent des Red Cups, achètent et utilisent des objets, subissent des effets aléatoires et peuvent être envoyés en Enfer.

Le MVP est conçu pour une partie locale sur un seul écran : un hôte gère l’interface et partage son écran via Discord, Google Meet ou un outil similaire. Une partie en ligne où chaque joueur utilise son propre appareil est une évolution future, pas un objectif du MVP.

## 2. Décisions de cadrage confirmées

| Sujet | Décision |
| --- | --- |
| Nombre de joueurs | De 2 à 8 joueurs. Huit est la limite du MVP. |
| Départ | Tous les joueurs commencent sur la case 0. |
| Déplacement | Aucun dé. Le joueur choisit une case voisine autorisée par le plateau. |
| Flèches | Une arête fléchée ne peut être empruntée que dans le sens de la flèche. Une arête sans flèche est bidirectionnelle. |
| Boutique | Toutes les cases bleues représentent une boutique. Il faut être dans son tour et arriver sur une case bleue. |
| Achats | Plusieurs objets peuvent être achetés pendant cette visite, dans la limite du solde et des emplacements libres. Les achats se font avant la fin du tour. |
| Monnaie initiale | 2 000 pièces par joueur. Les « points » du diaporama sont une monnaie, pas un score. |
| Seuil négatif | À −300 pièces ou moins, le solde revient à 0 et le prochain tour du joueur est annulé. |
| Objectif | Le premier joueur à obtenir exactement 3 Red Cups gagne immédiatement la partie. Nombre fixe pour l’instant ; un autre mode pourra le changer plus tard. |
| Cases vertes et rouges | S’arrêter sur une case verte lance la roue du bonheur, sur une case rouge la roue du malheur (règle confirmée par l’auteur du jeu). |
| Non merci | Fenêtre de réaction : quand un joueur annonce son action, les détenteurs du passif peuvent l’annuler avant qu’elle s’applique. |
| Sauvegarde | La partie en cours est sauvegardée dans le navigateur et survit au rafraîchissement ; la sauvegarde est effacée à la fin de la partie. |
| Inventaire | Quatre emplacements de base. Chaque Red Cup occupe un emplacement. Le passif Penta ajoute un emplacement. |
| Inventaire plein à la collecte d’une Cup | Le joueur choisit lui-même un objet non-Red Cup à abandonner. La Red Cup est ensuite ajoutée à l’inventaire. |
| Enfer | La case 11 représente l’Enfer. Les sorties peuvent venir d’un duel, de la roue de l’Enfer, de la Bouteille d’eau ou d’un autre effet explicitement prévu. |
| Duel en Enfer | Quand deux joueurs se trouvent en Enfer, un duel est déclenché. Le gagnant retourne en case 0 ; le perdant reste en Enfer. |
| Mode de duel | Le jeu tire au sort entre pile ou face, pierre-feuille-ciseaux et vote des autres joueurs. |
| État client | React, Three.js et Zustand. Pas de serveur multijoueur dans le MVP. |

## 3. Plateau et déplacements

### 3.1 Cases

Le plateau illustré contient douze cases numérotées de 0 à 11 :

- Case 0 : départ.
- Cases bleues : boutiques.
- Cases vertes : s’y arrêter lance la **roue du bonheur**.
- Cases rouges : s’y arrêter lance la **roue du malheur**.
- Le passif **Red light, Green light** ajoute ±100 pièces à chaque passage sur ces cases, en plus des roues.
- Case 11, violette : Enfer. Elle n’est pas parcourue comme une case normale ; des effets y téléportent les joueurs.
- Case 8 : emplacement initial de la première Red Cup.

La représentation en données reste configurable (`src/game/board.ts`), sans coder les règles de déplacement dans la scène Three.js.

Transcription vérifiée sur la slide 1 de la présentation (septembre 2026). Sur l’original, les flèches sont dessinées **sur les cases** 0, 1, 2, 3, 8 et 9 et pointent vers l’une de leurs routes. La case 0 porte deux flèches (vers 2 et vers 4).

- Routes : 9–5, 2–5, 0–2, 8–0, 9–4, 0–4, 4–7, 4–3, 7–3, 3–6, 6–1, 1–10 et 10–8.
- Flèches (sortie imposée) : 0→2 et 0→4, 1→10, 2→5, 3→6, 8→0, 9→4.
- Tunnel à sens unique 7→1 : la route grise quitte la case 7 par le bord gauche du plateau et revient par le bord droit dans la case 1. Il compte comme un seul pas.
- Il n’existe pas de lien 5–0 (erreur de la première transcription).
- Les cases bleues de boutique sont 3, 8 et 9 ; la Red Cup initiale en case 8 peut être ramassée juste avant l’arrêt boutique au même emplacement.

**Lecture des flèches (règle confirmée par l’auteur)** : une flèche contraint la case sur laquelle elle est dessinée. Un joueur posé sur une case fléchée doit en sortir par sa flèche. Toutes les routes restent connectées : on peut donc entrer dans une case fléchée par n’importe quelle route, y compris à contresens de sa flèche.

- Exemple : de 6, on peut aller en 3 ; mais une fois en 3, on doit repartir vers 6 (pas vers 4 ni 7).
- De 10, on peut revenir en 1 ou aller en 8 ; une fois en 8, on doit aller en 0.
- De 4, on peut aller en 3, 7, 9 ou 0 ; une fois en 9, on doit redescendre en 4 (pas vers 5).

| Case | Sorties possibles |
| ---- | ----------------- |
| 0    | 2, 4              |
| 1    | 10                |
| 2    | 5                 |
| 3    | 6                 |
| 4    | 0, 3, 7, 9        |
| 5    | 2, 9              |
| 6    | 1, 3              |
| 7    | 1 (tunnel), 3, 4  |
| 8    | 0                 |
| 9    | 4                 |
| 10   | 1, 8              |

### 3.2 Règles de déplacement

- Un déplacement normal va vers une case adjacente autorisée.
- Sur une case fléchée, on sort uniquement par sa flèche ; ailleurs, toute route connectée se prend dans les deux sens (voir 3.1).
- Les bifurcations laissent le choix au joueur entre les routes légales.
- La Botte permet de parcourir deux cases au lieu d’une et doit être utilisée avant le déplacement.
- Lorsqu’un joueur **termine son déplacement** sur une case verte ou rouge, il tourne la roue correspondante (bonheur ou malheur). Simplement passer dessus avec la Botte ne déclenche pas de roue.
- Ordre de résolution à l’arrivée : Boue, puis Red Cup (avec ses passifs), puis la roue de la case.
- Les déplacements subis déclenchent aussi la roue (règle confirmée) : tiré par la Corde, échangé par le Monopoly Man, téléporté par la Bouteille d’eau, reculé par Calme-toi ou repositionné par New Cup, New Me. C’est tout l’intérêt de pousser un adversaire sur une case rouge.
- Si plusieurs joueurs arrivent sur une case colorée en même temps (Monopoly Man), chacun tourne sa roue, dans l’ordre d’arrivée. Un joueur ne tourne qu’une roue : celle de la case où il se trouve au final.
- Le passif **Red light, Green light** modifie le solde à chaque case verte ou rouge traversée.
- Entrer dans la case 0 **depuis la case 8** (dans le sens de sa flèche, en bouclant le circuit) donne 200 pièces, sauf avec le passif **Je suis Cups**. Revenir de 4 vers 0 est permis mais ne rapporte rien : sinon un joueur pourrait faire 4 → 0 → 4 → 0 pour empiler les bonus (règle confirmée par l’auteur). Sortir de l’Enfer vers le départ donne toujours le bonus.
- Délinquant (200 pièces) permet de sortir d’une case fléchée par une autre route, ou de prendre le tunnel à l’envers. Il ne paie que si la destination choisie l’exige réellement.

### 3.3 Red Cups

- La première Red Cup apparaît en case 8.
- Après une collecte, une nouvelle Red Cup apparaît aléatoirement sur une autre case que la précédente et que la case de départ.
- Si elle apparaît sous un joueur, celui-ci doit quitter la case puis y revenir pour la collecter.
- Une Red Cup utilise un emplacement d’inventaire et ne peut pas être abandonnée pour libérer de la place.
- Si l’inventaire est plein à la collecte, le joueur choisit quel objet ordinaire abandonner.
- La collecte de la troisième Red Cup déclenche immédiatement la victoire ; aucune nouvelle Cup n’est générée après cette victoire.
- Le diaporama ne précise pas si la case 11 peut recevoir une Red Cup. Pour le MVP, le tirage doit éviter l’Enfer tant que ce point n’est pas confirmé.

## 4. Tours, actions et boutique

Un tour suit ces phases :

1. Le joueur actif annonce son action : se déplacer ou utiliser un objet.
2. Si un autre joueur possède **Non merci** (non utilisé depuis la dernière Red Cup), une fenêtre de réaction s’ouvre : il peut annuler l’action ou la laisser passer.
3. L’action s’applique. Pour un déplacement : passage sur les cases colorées, Boue, Red Cup, puis roue de la case verte ou rouge.
4. Si le joueur est arrivé sur une case bleue, la phase boutique s’ouvre. Il peut acheter un ou plusieurs objets tant qu’il possède les pièces et les emplacements nécessaires.
5. Le joueur termine son tour. Les joueurs étourdis ou dont le tour est annulé sont ensuite sautés conformément à leurs statuts.

Utiliser un objet est une action. Une seule action principale est faite par tour. L’achat est une phase spéciale autorisée après l’arrivée en boutique et ne remplace pas le déplacement. La Botte est l’exception préparatoire au déplacement ; la Gomme est une réaction à un effet de roue.

Le passif **Non merci** ouvre une fenêtre de réaction après l’annonce de l’action d’un adversaire et avant son application. Il peut l’annuler une fois par cycle de Red Cup (jusqu’à la prochaine apparition d’une Red Cup). Une action annulée met fin au tour de l’acteur ; un objet annulé est perdu (règle confirmée). En local, c’est l’hôte qui valide la réaction au nom du joueur concerné ; sans réponse sous 8 secondes, l’action passe. En ligne, chaque détenteur décidera depuis son propre appareil.

## 5. Monnaie et inventaire

- Solde de départ : 2 000 pièces.
- Les effets de déplacement, objets, roues et passifs modifient ce solde.
- Un solde peut devenir négatif. À −300 ou moins, il est remis à 0 et le joueur passe son prochain tour.
- Le Casque prévient automatiquement le passage en solde négatif ; sa consommation et son interaction avec le seuil de −300 sont définies avec l’effet de l’objet.
- Capacité de base : quatre emplacements au total, Red Cups comprises.
- Penta ajoute un emplacement.
- Les objets ne se stackent pas. Un joueur ne peut pas avoir trois copies du même objet ; l’interprétation par défaut est donc un maximum de deux copies.
- Un joueur ne peut avoir qu’une Gomme à la fois.
- Si un effet impose un objet à un joueur dont l’inventaire est plein, celui-ci sacrifie un objet non-Red Cup de son choix.

## 6. Boutique et prix de départ

Les prix ci-dessous sont relevés visuellement sur la slide de la boutique. Ils sont configurés séparément pour pouvoir être ajustés.

| Objet | Prix initial |
| --- | ---: |
| Ndoye | 300 |
| Hollow Purple | 600 |
| Corde | 500 |
| Botte | 100 |
| Boue | 200 |
| Gomme | 350 |
| Bullet Bill | 500 |
| Middle Finger | 400 |
| Monopoly Man | 550 |
| Bouteille d’eau | 600 |
| Casque | 400 |
| Draven | 700 |

Le prix de la Botte augmente de 50 pièces à la fin de chaque tour de table après son premier achat, jusqu’au plafond de 500 pièces. L’affichage et le moment exact de cette hausse sont configurés dans les règles de partie.

## 7. Objets

| Objet | Effet de référence |
| --- | --- |
| Ndoye | Fait tourner la roue du malheur pour une cible, soi-même compris. |
| Hollow Purple | Envoie un joueur en Enfer ; peut cibler son utilisateur. |
| Corde | Rapproche un autre joueur de l’utilisateur, jusqu’à sa position. Baraqué réduit la distance de déplacement imposée de moitié. |
| Botte | Permet de se déplacer de deux cases au lieu d’une ; à utiliser avant le déplacement. Son prix augmente comme décrit plus haut. |
| Boue | Se pose sur la case de l’utilisateur. Le prochain joueur qui y entre perd 200 pièces. Le poseur peut aussi déclencher la boue. |
| Gomme | Annule l’effet d’une roue après son résultat. Une seule Gomme peut être détenue à la fois. |
| Bullet Bill | N’appartient à personne. Après l’achat, il apparaît au départ au début du prochain tour de table, puis se dirige vers le joueur le plus proche sans tenir compte du sens des flèches. Il avance de deux cases, sauf lorsqu’une cible est proche. Il retire 200 pièces à sa victime et l’étourdit pendant un tour. |
| Middle Finger | Empêche une cible de jouer son prochain tour ; peut cibler son utilisateur. |
| Monopoly Man | Échange la position de l’utilisateur avec celle d’un autre joueur. Baraqué n’est pas affecté par cet échange. |
| Bouteille d’eau | Permet de sortir de l’Enfer et de rejoindre une case aléatoire autre que l’Enfer. |
| Casque | S’active automatiquement pour éviter un solde négatif. |
| Draven | Envoie tous les joueurs, utilisateur compris, en Enfer. |

Les objets consommables sont retirés de l’inventaire quand ils sont utilisés, sauf si un passif impose un effet différent. Les effets déclenchés, cibles autorisées et éventuelles résistances sont modélisés explicitement.

## 8. Passifs

Une carte passive est attribuée aléatoirement à chaque joueur en début de partie. Pour le MVP, les cartes sont distribuées sans doublon tant qu’il y a assez de cartes disponibles.

| Passif | Effet |
| --- | --- |
| Baraqué | La Corde ne fait reculer le joueur que de la moitié de la distance. Le Monopoly Man n’a aucun effet sur lui. |
| New Cup, New Me | À chaque apparition d’une nouvelle Red Cup, le joueur peut se repositionner avant que sa destination ne soit révélée. |
| Red light, Green light | Gagne 100 pièces en passant sur une case verte et perd 100 pièces en passant sur une case rouge. |
| Non merci | Une fois par cycle de Red Cup, le joueur peut annuler l’action d’un autre joueur. |
| Délinquant | Peut ignorer le sens d’une flèche, au prix de 200 pièces à chaque utilisation. |
| Penta | Ajoute un emplacement à l’inventaire. |
| Troll | À chaque apparition d’une nouvelle Red Cup, vole 100 pièces à deux adversaires choisis au hasard. S’il n’y a qu’un adversaire disponible, il n’en choisit qu’un. |
| Je suis Cups | Le joueur ne reçoit pas le bonus de 200 pièces lié au départ. |
| Je note | Quand le joueur subit l’effet d’un objet, il reçoit une copie de cet objet, **sauf Draven** (sinon son utilisateur le récupérerait à l’infini). Si son inventaire est plein, il choisit un objet ordinaire à sacrifier ; une Red Cup ne peut pas être sacrifiée. Jamais de troisième exemplaire. |
| Calme-toi | Quand un joueur obtient une Red Cup à moins de trois cases de la nouvelle, son détenteur peut choisir de le faire reculer de trois cases. Le MVP affiche cette décision avant de poursuivre le tour. |

## 9. Enfer, roues et duels

### 9.1 Enfer

- La case 11 représente l’Enfer.
- Un joueur en Enfer ne suit pas le déplacement normal. À son tour, il tourne la roue de l’Enfer jusqu’à sa libération.
- Deux joueurs en Enfer déclenchent un duel. Le gagnant revient en case 0 ; le perdant y reste.
- Certains effets spéciaux peuvent aussi faire sortir de l’Enfer. La Bouteille d’eau en est un exemple ; une roue positive peut en devenir un autre.
- Quand un effet appelle un joueur pour un duel depuis le plateau, ce joueur rejoint l’Enfer pour le duel. Le vainqueur va en case 0 et le perdant reste en Enfer.
- **Peine maximale (règle confirmée par l’auteur)** : un joueur ne reste jamais plus de **5 de ses tours** en Enfer. Si, à la fin de son 5ᵉ tour, il ne s’est pas échappé (roue, objet, passif, duel), il sort en case 0 et paie **500 pièces**. Comme toute sortie de l’Enfer, il touche le bonus de 200 pièces du départ (sauf **Je suis Cups**) : la roue de l’Enfer peut lui avoir coûté bien plus. Le bonus est versé avant le dû, soit −300 pièces au total. Il rejoue normalement au tour suivant.
  - Les tours sautés en Enfer comptent dans les 5 tours.
  - Le compteur repart à zéro à chaque nouvel envoi en Enfer. Un joueur déjà en Enfer (Draven, par exemple) garde son compteur.
  - Les règles habituelles de l’argent s’appliquent ensuite au dû : le Casque évite de passer sous zéro ; à −300 pièces, le solde repart à 0 et le joueur saute son prochain tour.
  - Le dock affiche le décompte (« Tour 3/5 ») et la fiche joueur indique les tours déjà passés en Enfer.

### 9.2 Sélection et résolution des duels

Le système tire uniformément un mode disponible :

1. **Pile ou face** : vainqueur tiré à 50/50.
2. **Pierre-feuille-ciseaux** : choix des deux duellistes, égalité rejouée.
3. **Vote** : les duellistes ne votent pas ; les autres joueurs choisissent un vainqueur. Une égalité est départagée par pile ou face.

Si aucun joueur extérieur n’est disponible pour voter, le mode vote est retiré du tirage. Dans le MVP sur un seul écran, l’hôte entre les choix et votes. Les entrées de pierre-feuille-ciseaux sont masquées successivement avant révélation.

### 9.3 Roues provisoires pour le MVP

Ces résultats servent de configuration initiale et ne prétendent pas reproduire la roue d’origine. Les valeurs et poids pourront être remplacés sans modifier le moteur de jeu.

**Roue du malheur — huit secteurs de poids égal :**

1. −100 pièces.
2. −200 pièces.
3. −400 pièces.
4. Abandonner un objet ordinaire aléatoire ; s’il n’y en a aucun, perdre 100 pièces.
5. Passer le prochain tour.
6. Être envoyé en Enfer.
7. Tourner la roue du bonheur.
8. Aucun effet.

**Roue du bonheur / paradis — nom provisoire, neuf secteurs pondérés :**

1–2. +100 pièces.
3–4. +200 pièces.
5. +300 pièces.
6. +400 pièces.
7. +500 pièces.
8. Objet gratuit tiré parmi ceux coûtant au plus 300 pièces. Si l’inventaire est plein, gagner 200 pièces à la place.
9. Libération de l’Enfer vers la case 0 si le joueur y est ; sinon +500 pièces.

Ce tableau initial garde une sortie rare de l’Enfer sur une roue positive. Les résultats restent configurables.

**Roue de l’Enfer — neuf secteurs provisoires :**

- −100 pièces, deux secteurs.
- −200 pièces, un secteur.
- −400 pièces, un secteur.
- Abandonner un objet ordinaire, un secteur.
- Sauter le prochain tour, un secteur.
- Choisir un adversaire qui rejoint l’Enfer pour un duel, un secteur.
- Être libéré vers la case 0, deux secteurs.

Les deux secteurs de libération directe sont une première mesure anti-blocage. Ils restent ajustables après quelques parties de test.

### 9.4 Gomme et annulation

Après la révélation d’un effet de roue, un joueur qui détient une Gomme peut annuler cet effet. La Gomme est consommée. Le timing exact de cette réaction et son application aux roues spéciales sont centralisés dans le moteur de jeu.

## 10. Fonctionnalités du MVP

- Écran de préparation d’une partie de 2 à 8 joueurs : nom et couleur par joueur.
- Attribution de 2 000 pièces et d’un passif par joueur ; départ en case 0.
- Affichage du plateau interactif en 3D, des flèches, des joueurs, de la Red Cup et des cases de boutique.
- Choix des destinations légales en cliquant sur une case du plateau.
- Déplacement à une ou deux cases avec la Botte.
- Collecte et apparition des Red Cups, gestion de l’inventaire plein et écran de victoire à trois Cups.
- Boutique accessible à l’arrivée sur une case bleue, achats multiples et déduction des pièces.
- Utilisation des objets, choix des cibles et résolution des effets connus.
- Roues animées avec résultat visible, journal des événements et annulation par la Gomme.
- Gestion de l’Enfer, des duels et des tours sautés.
- Tableau de tous les joueurs avec monnaies, inventaire, Cups et passifs.
- L’interface et le journal de partie sont en français ; les noms d’objets et de passifs restent fidèles au jeu.

## 11. Architecture

- **Tests par bots** : `src/game/simulation/` fait jouer des centaines de parties complètes par des bots sur le vrai moteur, avec des graines fixes. Après chaque action, un vérificateur contrôle les règles (déplacements légaux, bonus du départ, roues des cases, Non merci, inventaire, Enfer, victoire…). Lancer `bun run simulate -- --games 1000` pour une campagne plus longue.
- **React + TypeScript** : interface de jeu, lobby local, panneaux et dialogues.
- **Three.js** : scène 3D du plateau, pions, cases, Red Cup et interactions de sélection.
- **Zustand** : état partagé côté client et actions de partie.
- **Moteur de règles séparé** : fonctions déterministes pour valider les déplacements et résoudre les effets. Il peut être réutilisé par un futur serveur de partie.
- Les meshes, matériaux, rendus et autres objets Three.js ne sont jamais placés dans le store Zustand ; le store conserve des données de jeu sérialisables.
- Le MVP local n’a pas de comptes, lobby réseau ni synchronisation distante. Une couche de transport et une autorité serveur seront étudiées pour le multijoueur en ligne futur.

## 12. Points à revisiter

- Vérifier les prix objet par objet avec les éléments source de meilleure qualité.
- Rééquilibrer les roues et remplacer les résultats provisoires si les anciennes règles sont retrouvées.
- Confirmer si une Red Cup peut apparaître en Enfer ; le MVP exclut la case 11 du tirage initial pour éviter un objectif inaccessible.
- Préciser l’effet de la Bouteille d’eau lorsqu’elle est utilisée : la slide indique une destination aléatoire hors Enfer.
- Lecture des flèches : un nouveau comportement, plus permissif mais contrôlé, est en préparation par l’auteur.
- Mode en ligne : les réactions (Non merci, Calme-toi, votes, pierre-feuille-ciseaux) devront être prises par chaque joueur sur son appareil, sans maître du jeu.
- Préciser le comportement des effets touchant simultanément tous les joueurs, notamment Draven et Bullet Bill.
- Les images de la présentation sont des références. Le MVP utilise des éléments graphiques originaux ; les assets tiers devront être vérifiés avant une publication publique.
