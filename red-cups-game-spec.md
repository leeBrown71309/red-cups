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
| Déplacement | Aucun dé (sauf pour le Roller, voir 8). Le joueur choisit une case voisine autorisée par le plateau ; le déplacement prend l'énergie restante et termine le tour (patch 0.1.4). |
| Énergie | 3 points par tour (4 avec Red Bull) ; chaque objet a son coût, le déplacement prend le reste (patch 0.1.4, voir 4). |
| Passifs | Choisis par chaque joueur avant la partie, parmi des cartes distribuées : le draft (patch 0.1.4, voir 4.0). |
| Flèches | Une case fléchée ne se quitte que par sa ou ses flèches ; on peut y entrer par n'importe quelle route. Une route sans flèche se parcourt dans les deux sens (patch 0.1.4, flèches dessinées sur les cases). |
| Boutique | Toutes les cases bleues représentent une boutique. Il faut être dans son tour et arriver sur une case bleue (eShop : n'importe quelle case ; le diable y a un second étal). |
| Achats | Plusieurs objets peuvent être achetés pendant cette visite, dans la limite du solde et des emplacements libres. Les achats se font avant la fin du tour. |
| Monnaie initiale | 2 000 pièces par joueur (Nepo Baby 3 000, eShop 1 000, Ange-Gardien 600). Les « points » du diaporama sont une monnaie, pas un score. |
| Seuil négatif | À −300 pièces ou moins, le solde revient à 0 et le prochain tour du joueur est annulé. |
| Objectif | Le premier joueur à obtenir exactement 3 Red Cups gagne immédiatement la partie. Trois passifs ont leur propre victoire (patch 0.1.4) : Cupide à 5 000 pièces, le diable quand les autres sont assez entrés en Enfer, et L'Ange-Gardien gagne avec son protégé. |
| Abandon | Un joueur peut quitter une partie en cours ; les autres continuent. S’il ne reste qu’un joueur, il gagne par abandon (patch 0.1.1). |
| Tour de Bénédiction | Si, à la fin d’un tour, tous les joueurs ont 0 pièce ou moins, chacun tourne la roue du bonheur à tour de rôle avant de reprendre la partie (patch 0.1.1). |
| Cases vertes et rouges | S’arrêter sur une case verte lance la roue du bonheur, sur une case rouge la roue du malheur (règle confirmée par l’auteur du jeu). |
| Non merci | Fenêtre de réaction : un objet utilisé contre son détenteur, ou Bullet Bill qui fonce sur lui, attend sa réponse avant de s’appliquer ; une roue tournée pour lui s’annule après son résultat (patch 0.1.4). |
| Sauvegarde | La partie en cours est sauvegardée dans le navigateur et survit au rafraîchissement ; la sauvegarde est effacée à la fin de la partie. |
| Inventaire | Quatre emplacements (deux pour L'Ange-Gardien). Chaque Red Cup occupe un emplacement. |
| Inventaire plein à la collecte d’une Cup | Le joueur choisit lui-même un objet non-Red Cup à abandonner. La Red Cup est ensuite ajoutée à l’inventaire. |
| Enfer | La case 11 représente l’Enfer. Les sorties peuvent venir d’un duel, de la roue de l’Enfer, de la Bouteille d’eau ou d’un autre effet explicitement prévu. |
| Duel en Enfer | Quand deux joueurs se trouvent en Enfer, un duel est déclenché. Le gagnant retourne en case 0 ; le perdant reste en Enfer. |
| Mode de duel | Le jeu tire au sort entre pile ou face, pierre-feuille-ciseaux, vote des autres joueurs, Basket et Blackjack (patch 0.1.4). |
| État client | React, Three.js et Zustand. Le mode en ligne passe par Supabase (salons, temps réel), sans serveur de jeu : chaque appareil fait tourner le même moteur (voir le README). En ligne, un chrono limite chaque tour (patch 0.1.4, voir 4.3). |

## 3. Plateau et déplacements

### 3.1 Cases

Le plateau illustré contient douze cases numérotées de 0 à 11 :

- Case 0 : départ.
- Cases bleues : boutiques.
- Cases vertes : s’y arrêter lance la **roue du bonheur**.
- Cases rouges : s’y arrêter lance la **roue du malheur**.
- Le passif **Red light, Green light** ajoute ±100 pièces au passage sur ces cases, deux fois de chaque par Red Cup, en plus des roues.
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
- La Botte permet de parcourir deux cases au lieu d’une et doit être utilisée avant le déplacement (1 point d’énergie, plus 1 gardé pour ce déplacement ; une seule par tour, voir 4).
- Lorsqu’un joueur **termine son déplacement** sur une case verte ou rouge, il tourne la roue correspondante (bonheur ou malheur). Simplement passer dessus avec la Botte ne déclenche pas de roue.
- Ordre de résolution à l’arrivée : Boue, puis Red Cup (avec ses passifs), puis la roue de la case.
- Être téléporté par la Bouteille d’eau déclenche aussi la roue de la case d’arrivée. Depuis le patch 0.1.4, être replacé par Calme-toi ne donne rien.
- **Patch 0.1.4** : être déplacé par une roue (« Avance d’une case », « Retourne d’où tu viens », « Va au Départ ») compte comme une arrivée complète. On tourne la roue de la case, on prend sa Boue et sa Red Cup, on affronte le fantôme, et la boutique s’ouvre si c’est la fin du tour du joueur actif. « Avance d’une case » est un pas à pied, flèches comprises : il compte pour Red light, Green light et le bonus du départ. « Retourne d’où tu viens » ramène sur la case occupée avant le dernier déplacement subi ou joué, jamais en Enfer ni hors de l’Enfer.
- **Patch 0.1.1** : être tiré par la Corde, échangé par le Monopoly Man, envoyé au Départ par New Cup, New Me ou replacé par Calme-toi (patch 0.1.4) ne donne ni roue ni boutique, ni à la cible ni à l’utilisateur. Une roue déjà due sur la case quittée est perdue, même si le joueur y revient ensuite ; celui qui reste sur sa case garde ce qu’il avait gagné en y arrivant.
- Si plusieurs joueurs doivent une roue en même temps, chacun tourne la sienne, dans l’ordre d’arrivée. Un joueur ne tourne qu’une roue : celle de la case où il se trouve au final.
- Le passif **Red light, Green light** modifie le solde sur les cases vertes ou rouges traversées : depuis le patch 0.1.4, deux cases vertes et deux rouges au plus par Red Cup.
- Entrer dans la case 0 **depuis la case 8** (dans le sens de sa flèche, en bouclant le circuit) donne 200 pièces. Revenir de 4 vers 0 est permis mais ne rapporte rien : sinon un joueur pourrait faire 4 → 0 → 4 → 0 pour empiler les bonus (règle confirmée par l’auteur). Sortir de l’Enfer vers le départ donne toujours le bonus, duel gagné compris (patch 0.1.3). Sur Luna Park, seule l’entrée 8 → 0 paie.
- Corrupteur (Délinquant avant le patch 0.1.4 ; 400 pièces depuis le patch 0.1.1) permet de sortir d’une case fléchée par une autre route, ou de prendre le tunnel à l’envers. Il ne paie que si la destination choisie l’exige réellement. Au premier tour de table, il ne peut pas quitter le départ à contresens : 0 → 8 lui donnerait la première Red Cup avant que quiconque ait joué.

### 3.2 bis Seconde carte : Luna Park (patch 0.1.3)

Une fête foraine de nuit, pensée pour jouer autrement que la boucle d’origine. Le départ reste la case 0 et l’Enfer la case 11 sur toutes les cartes.

- **Cases** : 0 départ ; carrousel 1 verte, 2 rouge, 3 verte, 4 rouge autour de l’Enfer (11, au centre) ; 8 boutique (SO, première Red Cup), 6 verte (O), 7 rouge (NO), 5 boutique (N), 9 neutre (NE), 10 verte (E), 12 boutique (SE).
- **Carrousel** : 1 → 2 → 3 → 4 → 1 à sens unique ; **le sens s’inverse à chaque nouvelle Red Cup** (pas pour la Cup gagnante).
- **Rayons** libres : 0–1, 2–10, 3–5, 4–7. **Tour extérieur** : 0–12, 12–10, 10–9, 9–5, 5–7, 7–6, 6–8, 8–0.
- **Flèches** : 0 → 1 ou 12 ; 8 → 0 (seule entrée qui paie les 200 du départ) ; 5 → 3.
- **Train fantôme** : tunnel à sens unique 7 → 12, un seul pas. Entrer en 0 depuis 12 ne rapporte rien.
- **Corrupteur** ignore aussi le sens du carrousel et prend le train fantôme à l’envers.
- **Le fantôme** (patch 0.1.3) hante **tout le plateau**, sauf l’Enfer, sans respecter les routes :
  - il apparaît au tour de table 2 ou 3, sur une case libre si possible ;
  - à chaque changement de tour, trois fois sur quatre il **glisse de 1 à 3 cases** le long des routes, dans n’importe quel sens (flèches, sens uniques, carrousel et train fantôme ne le retiennent pas), en choisissant sa route au hasard à chaque carrefour et sans revenir en arrière sauf en cul-de-sac ; sa glissade **s’arrête sur la première case occupée** par un joueur (patch 0.1.4) ; une fois sur quatre il **se téléporte** : il disparaît et réapparaît sur une case éloignée, à 3 routes au moins quand c’est possible ;
  - s’il arrive sur un joueur, ou si un joueur s’arrête sur sa case (en marchant, téléporté ou tiré), un **duel contre le fantôme** commence avant la roue de la case. Il affronte chaque joueur de sa case une fois par arrêt, le joueur actif d’abord. Il **n’affronte jamais un joueur en Enfer**, et il épargne celui qui en sort pour atterrir sur sa case (Bouteille d’eau, Monopoly Man, New Cup, New Me…) jusqu’à son prochain déplacement ;
  - le mini-jeu est tiré au sort comme un duel ordinaire (pile ou face, pierre-feuille-ciseaux, vote de la table, Basket). Le moteur tire la main du fantôme, ses tirs au Basket et, dès le début du duel, la pénalité et la récompense : tout est identique sur chaque appareil en ligne ;
  - **fantôme vainqueur** : une pénalité parmi celles qui s’appliquent, au hasard : il **gifle le joueur et l’emporte en Enfer**, il **vole 300 pièces** (au plus ce que le joueur possède) ou il **vole un objet** au hasard (jamais une Red Cup). Pièces et objets volés vont dans son **butin**. Il reste sur sa case jusqu’à son prochain déplacement ;
  - **joueur vainqueur** : il reprend **un seul** morceau du butin, tiré au hasard : un objet, ou **200 pièces** du tas de pièces (le reste attend le suivant). Butin vide : **+300 pièces**. Un objet repris dans un sac plein oblige à jeter un objet ; un objet qu’il ne pourrait pas garder (troisième exemplaire, seconde Gomme) n’est pas tiré. Le fantôme **disparaît 3 tours de table**, puis réapparaît et reprend son cycle ;
  - un clic sur le fantôme ouvre son butin. Le butin survit à ses disparitions.
- Intérêt de jeu : un tour complet fait 6 pas dans un sens du manège, 8 dans l’autre ; la première Cup est sur la case la plus éloignée du départ, à 7 pas (5 une fois le manège inversé), et la case 8 n’est accessible que par 6 (goulet pour la Boue) ; chaque case du carrousel est un carrefour.

| Case | Sorties (sens 1 → 2) | Sorties (sens inversé) |
| ---- | -------------------- | ---------------------- |
| 0    | 1, 12                | 1, 12                  |
| 1    | 0, 2                 | 0, 4                   |
| 2    | 3, 10                | 1, 10                  |
| 3    | 4, 5                 | 2, 5                   |
| 4    | 1, 7                 | 3, 7                   |
| 5    | 3                    | 3                      |
| 6    | 7, 8                 | 7, 8                   |
| 7    | 4, 5, 6, 12 (train)  | 4, 5, 6, 12 (train)    |
| 8    | 0                    | 0                      |
| 9    | 5, 10                | 5, 10                  |
| 10   | 2, 9, 12             | 2, 9, 12               |
| 12   | 0, 10                | 0, 10                  |

### 3.2 ter Troisième carte : Banquise (patch 0.1.3)

Un lac gelé du Grand Nord. Les deux moitiés du plateau sont en miroir : aucun côté n’est « le côté sûr », le choix se fait entre une longue route certaine et un pari court sur la glace.

- **Cases** : rangée avant 5 boutique, 1 verte, 0 départ, 2 verte, 12 boutique ; rangée du lac 6 rouge, **3 glace**, 4 verte, **7 glace**, 10 rouge ; rangée du fond 13 neutre, 8 boutique (première Red Cup), 9 neutre ; l’Enfer (11) est une crevasse juste derrière le lac.
- **Routes** : 0 → 1 ou 2 (flèches) ; 4 → 0 (flèche, seule entrée qui paie les 200) ; tour extérieur 1–5–6–13–8–9–10–12–2 ; lac 6–3–4–7–10 ; 1–3, 2–7, 3–8, 7–8.
- **Tour extérieur** : la Red Cup en 8 est à 5 déplacements, d’un côté comme de l’autre, avec une case rouge en chemin. **Par la glace** : 2 déplacements, puis le hasard.
- **Glissade** : un déplacement (normal, Botte, Corrupteur, Roller, ou « Avance d’une case » de la roue du bonheur) qui s’arrête sur une case de glace continue vers l’une des autres routes réelles de cette case (flèches et sens uniques respectés, jamais en arrière). S’il n’y a qu’une route, elle est imposée ; sinon elle est tirée au hasard, et la glissade continue tant qu’elle arrive sur de la glace. Si toutes les routes ont déjà été parcourues pendant ce déplacement, la glissade s’arrête sur la première sans glace ; dans un cul-de-sac (une flèche qui renvoie d’où l’on vient), elle repart en arrière. Seule la dernière case de la Botte glisse. Les cases glissées comptent comme traversées (Red light, Green light, bonus du départ) ; seule la case d’arrivée compte pour la roue, la boutique, la Boue et la Red Cup.
- **Personne ne reste sur la glace** (patch 0.1.4, règle de l’auteur), quel que soit ce qui l’y amène :
  - « Va au Départ » et « Retourne d’où tu viens » vers une case gelée : le joueur glisse, puis arrive là où la glissade s’arrête (roue, boutique, Boue, Red Cup) ;
  - tout autre déplacement qui pose un joueur sur la glace (le blizzard qui gèle sa case, une sortie d’Enfer, un duel gagné ou New Cup, New Me vers un départ gelé, Made In Heaven, un échange ou un bras de fer avec un joueur pris dans la glace, la demi-Corde de Baraqué, le recul de Chance aveugle dans la Boue) : la glace l’emporte aussitôt jusqu’à la première case sans glace. Ce n’est pas une arrivée : ni roue, ni boutique, ni Boue, ni Red Cup ;
  - aucune case de glace n’est proposée à Calme-toi, ni tirée pour un Portail ou pour la Bouteille d’eau.
- **Tombée de glace** : si la glissade d’un déplacement file vers la case de la Red Cup, la glace a 80 % de chances de tomber sur le joueur. Il reste alors pris au milieu de la route, sans rien atteindre, et son tour se termine. Au début de son tour suivant, il brise la glace et arrive sur la case visée (Red Cup, Boue, roue ; pas de boutique), puis joue normalement ; si le blizzard a gelé cette case entre-temps, il glisse plus loin. Déplacé entre-temps (Corde, échange, Enfer…), sa glissade est perdue, même s’il revient ensuite sur la case. Un joueur posé sur la glace ou emporté par elle n’est jamais pris par la tombée de glace.
- **Boules de neige** : dès qu’une Red Cup a été ramassée, les pingouins lancent une boule de neige à chaque changement de tour, sur un joueur tiré au hasard, jamais en Enfer ni déjà pris dans la glace. Une sur trois rate. À la 3ᵉ boule reçue, le joueur gèle sur place (bloc de glace) et passe son prochain tour ; son compteur repart à zéro. La barre des joueurs affiche le compteur (❄ 1/3, 2/3).
- **Blizzard** : une troisième case glissante est tirée au lancement, puis déplacée au début de chaque tour de table impair (3, 5, 7…). Elle peut tomber sur n’importe quelle case qui a au moins deux routes, départ compris, sauf l’Enfer, les glaces 3 et 7, la case de la Red Cup et la glace qu’elle remplace ; au lancement, jamais sur le départ, où se trouve toute la table. Si elle gèle la case d’un joueur, la glace l’emporte aussitôt, avant que la partie continue. Un départ gelé ne paie pas les 200 pièces. Une Red Cup n’apparaît jamais sur la glace.

**Choix de la carte** : après la liste des joueurs, une seconde étape du salon présente les cartes en carrousel (flèches, balayage ou touches ←/→) : « Aléatoire » (toujours en tête, la carte est tirée au lancement) puis chaque carte avec son plan. La carte affichée est la carte choisie. La **revanche** rouvre ce carrousel, positionné sur la carte qui vient d’être jouée : on peut rejouer au même endroit ou changer de carte. En ligne, seul l’hôte choisit la carte et lance la revanche ; les autres attendent sur l’écran de victoire et découvrent la carte au lancement. Rejouent tous ceux encore dans le salon, dans le même ordre de tour : qui l’a quitté, ou ne donne plus signe de vie depuis 75 secondes, est laissé de côté (fonction `rematch_room`, réservée à l’hôte d’un salon terminé). L’aide « Comment jouer » montre uniquement la carte jouée et sa légende. Chaque carte a sa propre musique : dans le carrousel, on entend celle de la carte affichée ; sur « Aléatoire » et dans tous les autres menus, on entend la musique de base du jeu.

### 3.3 Red Cups

- La première Red Cup apparaît en case 8.
- Après une collecte, une nouvelle Red Cup apparaît aléatoirement sur une autre case que la précédente et que la case de départ.
- Si elle apparaît sous un joueur, celui-ci doit quitter la case puis y revenir pour la collecter.
- Une Red Cup utilise un emplacement d’inventaire et ne peut pas être abandonnée pour libérer de la place.
- Si l’inventaire est plein à la collecte, le joueur choisit quel objet ordinaire abandonner.
- La collecte de la troisième Red Cup déclenche immédiatement la victoire ; aucune nouvelle Cup n’est générée après cette victoire.
- **Cupide** (patch 0.1.4) ne garde pas les Red Cups : chacune lui rapporte 1 000 pièces, sans prendre de place, et la suivante apparaît normalement. Il gagne dès que son solde atteint 5 000 pièces, quel que soit le tour et quelle que soit l’origine des pièces.
- Le diaporama ne précise pas si la case 11 peut recevoir une Red Cup. Pour le MVP, le tirage doit éviter l’Enfer tant que ce point n’est pas confirmé.

## 4. Tours, actions et boutique

Depuis le patch 0.1.4, le tour repose sur l’**énergie**. Il suit ces phases :

1. Le joueur actif commence son tour avec **3 points d’énergie** : la jauge se remplit à chaque tour.
2. Il utilise d’abord ses objets, autant qu’il veut tant que l’énergie suffit : chaque objet coûte sa propre énergie (tableau en 6). Un objet utilisé contre un détenteur de **Non merci** attend d’abord sa réponse.
3. Puis il se déplace. Il faut au moins 1 point ; le déplacement prend toute l’énergie restante et met fin à ses actions. Ensuite : passage sur les cases colorées, Boue, Red Cup, puis roue de la case verte ou rouge.
4. Si le joueur est arrivé sur une case bleue, la phase boutique s’ouvre. Il peut acheter un ou plusieurs objets tant qu’il possède les pièces et les emplacements nécessaires.
5. Le joueur termine son tour. Si tous les joueurs ont alors 0 pièce ou moins, le **Tour de Bénédiction** a lieu d’abord (voir 4.1). Les joueurs étourdis ou dont le tour est annulé sont ensuite sautés conformément à leurs statuts.

Les objets ne terminent plus le tour : on en enchaîne plusieurs, puis on se déplace. On peut finir son tour sans bouger après avoir utilisé au moins un objet, quand il reste moins d’1 point d’énergie, ou quand aucune route n’est possible ; sinon il faut se déplacer (réponse de l’auteur ; en ligne, un tour passé sans rien faire coûtera aussi une chance, voir le chrono). La Botte coûte 1 point et en garde 1 pour le déplacement de deux cases : il faut donc 2 points pour la préparer, et une seule Botte par tour. Une seule Boue par tour. La Tomate, la Gomme et le Casque ne coûtent rien. Acheter ne coûte pas d’énergie : un objet acheté sert à partir du tour suivant. En Enfer, la roue de l’Enfer remplace le déplacement (voir 9.1). La Gomme est une réaction à un effet de roue.

Le passif **Non merci** (refait au patch 0.1.4, réponses de l’auteur) annule ce qui devait affecter son détenteur, puis se recharge 5 tours de table : utilisé au tour N, il revient au tour N + 5, quelles que soient les Red Cups.

- **Objet utilisé contre lui** : un objet à cible unique qui le vise (Ndoye, Hollow Purple, Corde, Middle Finger, Monopoly Man) attend sa réponse avant de s’appliquer. L’objet annulé est perdu avec son énergie (règle confirmée), mais l’acteur continue son tour. Contre **Draven**, il ne protège que lui : le reste de la table part quand même en Enfer. La Tomate, pour rire, ne s’annule pas.
- **Roue tournée pour lui** (case, Ndoye, Enfer, Bénédiction…) : après le résultat, comme la Gomme, un bouton « Non merci ! » l’efface.
- **Bullet Bill qui fonce sur lui** : au début du tour de table, le changement de tour attend sa réponse. Avec Non merci, Bullet Bill s’écrase sans le toucher ; sinon il frappe comme d’habitude. Le passif est alors compté comme utilisé dans le nouveau tour de table.
- Les **déplacements** ne s’annulent plus. En local, c’est l’hôte qui valide la réaction au nom du joueur concerné ; sans réponse sous 15 secondes, l’action passe. En ligne, chaque détenteur décidera depuis son propre appareil.

### 4.1 Tour de Bénédiction (patch 0.1.1)

- Il se déclenche quand un tour se termine alors que **tous** les joueurs ont 0 pièce ou moins.
- Chaque joueur tourne la roue du bonheur, dans l’ordre du tour, en commençant par celui qui devait jouer ensuite ; celui dont le tour vient de finir tourne en dernier.
- Les résultats s’appliquent normalement, y compris « Tourner la roue du malheur » et la Gomme.
- Le tour passe ensuite comme d’habitude (tours sautés, peine de l’Enfer, Bullet Bill).

### 4.2 Abandon (patch 0.1.1)

- Depuis le menu pause, l’hôte choisit le joueur qui quitte la partie, puis confirme.
- L’abandon attend que la table soit au repos : pas pendant une roue, un duel ou une décision.
- Le joueur quitte la table avec ses Red Cups et ses objets ; sa Boue reste sur le plateau mais ne lui rapporte plus rien.
- Si c’était son tour, la main passe au joueur suivant. S’il ne reste qu’un joueur, celui-ci gagne par abandon.
- Les joueurs partis figurent en bas du classement final.

### 4.0 Choix des passifs avant la partie (patch 0.1.4)

- Chaque partie commence par un **draft** : chaque joueur reçoit des cartes de passif et en choisit une. Jusqu'à 6 joueurs, 3 cartes chacun ; au-delà, 2. Aucune carte n'est distribuée deux fois à la table. L'Ange-Gardien n'est distribué qu'à partir de 4 joueurs.
- Un choix peut changer tant que la table n'a pas fini ; dès que tout le monde a choisi, le draft se termine.
- **En ligne** : chacun voit ses cartes sur son appareil, et les autres seulement « a choisi ✓ ». La table a une minute ; à la fin, qui n'a pas choisi reçoit une de ses cartes au hasard.
- **En local** : l'écran passe d'un joueur à l'autre (« Passe l'écran à X », puis « Je suis X »), cartes cachées, sans chrono (réponse Q15).
- Ensuite, les passifs prennent effet comme au lancement (pièces de départ, jauge du premier joueur, protégé de l'Ange, annonce du diable), puis un compte à rebours de 5 secondes, « La partie commence dans 5… », ouvre la partie ; en ligne, le chrono du premier tour attend sa fin.

### 4.3 Chrono de tour en ligne (patch 0.1.4)

Seulement en ligne : une partie locale n'a pas de chrono.

- **Le tour** : le joueur actif a **45 secondes** pour ses propres décisions (objets, déplacement, roue de sa case, boutique…). Le chrono part après chaque action avec 3 secondes de grâce, le temps des animations, et se met en pause quand c'est à un autre joueur de décider.
- **Les décisions des autres** (réaction à Non merci ou au Bouclier, vote, pierre-feuille-ciseaux, Calme-toi, Double or nothing, roue tournée pour un autre, objet à jeter…) ont **20 secondes**, 45 pour un Basket ; le délai repart après chaque action pendant cette décision (chaque vote, par exemple).
- **Temps écoulé** : n'importe quel appareil de la table le constate (celui du joueur concerné d'abord, les autres 2 secondes plus tard s'il est parti) et le choix par défaut s'applique :
  - le tour du joueur actif se termine ; ses décisions encore ouvertes prennent leur défaut ;
  - défauts : la réaction laisse passer, New Cup reste, Calme-toi laisse en place, Double or nothing garde la somme, la roue s'applique, « Avance d'une case » prend une case au hasard, l'objet à jeter est tiré au hasard, le défi de l'Enfer vise un joueur au hasard, le duel tire la pièce, une main ou un vote manquant au hasard, et un tireur de Basket absent marque 0.
- **Chances** : un tour qui se termine au chrono sans que le joueur ait rien fait (ni objet, ni Botte, ni déplacement, ni roue de l'Enfer) lui coûte une chance (réponse Q1). À 2 chances perdues, une bannière l'avertit au début de son tour suivant ; à la **3ᵉ, il déclare forfait** et quitte la partie comme un abandon (voir 4.2), dès que la table est au repos ; si c'était le protégé d'un Ange-Gardien, l'Ange prend sa place. La barre des joueurs affiche « ⚠ 1/3 ».
- **Horloge commune** : chaque action porte l'heure du serveur à laquelle elle a été jouée, si bien que tous les appareils calculent le même chrono. Une fonction `server_time()` du schéma Supabase donne cette heure ; sans elle, chaque appareil se fie à sa propre horloge.
- **Versions** : un salon dont la partie suit d'autres règles (une autre version du jeu) est refusé, pour que tous les appareils jouent les mêmes règles.

## 5. Monnaie et inventaire

- Solde de départ : 2 000 pièces.
- Les effets de déplacement, objets, roues et passifs modifient ce solde.
- Un solde peut devenir négatif. À −300 ou moins, il est remis à 0 et le joueur passe son prochain tour.
- Le Casque prévient automatiquement le passage en solde négatif ; sa consommation et son interaction avec le seuil de −300 sont définies avec l’effet de l’objet.
- Capacité de base : quatre emplacements au total, Red Cups comprises.
- Deux exemplaires au plus de chaque objet. Seule la Tomate s'empile : jusqu'à 5 par place, chaque pile comptant comme un exemplaire (Tomato Enjoyer : une pile par place).
- Une seule Gomme et un seul Made In Heaven à la fois ; le diable ne garde jamais deux fois le même objet.
- Si un effet impose un objet à un joueur dont l’inventaire est plein, celui-ci sacrifie un objet non-Red Cup de son choix.

## 6. Boutique et prix de départ

Prix rééquilibrés et coûts en énergie fixés par l’auteur au patch 0.1.4. Ils sont configurés séparément pour pouvoir être ajustés.

| Objet | Prix | Énergie |
| --- | ---: | ---: |
| Ndoye | 250 | 2 |
| Hollow Purple | 600 | 3 |
| Corde | 400 | 2 |
| Botte | de 100 à 400 | 1 (+1 gardé) |
| Boue | 200 | 1 |
| Tomate | 10 | 0 |
| Gomme | 200 | 0 |
| Bullet Bill | 550 | 2 |
| Middle Finger | 400 | 2 |
| Monopoly Man | 600 | 3 |
| Bouteille d’eau | 600 | 3 |
| Casque | 200 | 0 |
| Draven | 700 | 3 |
| Made In Heaven (Chance aveugle seulement) | 1 200 | 3 |
| Bouclier (L'Ange-Gardien seulement) | 500 | 0 (hors tour) |
| Portail (boutique du diable) | 300 | 2 |
| Toucher d'Enfer (boutique du diable) | 400 | 0 (automatique) |
| Black Cup (boutique du diable) | 400 | 3 |
| Sentence (boutique du diable) | 400 | 2 |
| Doomsday (boutique du diable) | 666 | 3 |
| Déplacement | — | tout ce qui reste |

Le prix de la Botte augmente de 50 pièces à la fin de chaque tour de table après son premier achat, jusqu’au plafond de 400 pièces (500 avant le patch 0.1.4). L’affichage et le moment exact de cette hausse sont configurés dans les règles de partie.

## 7. Objets

| Objet | Effet de référence |
| --- | --- |
| Ndoye | Fait tourner la roue du malheur pour une cible, soi-même compris. |
| Hollow Purple | Envoie un joueur en Enfer ; peut cibler son utilisateur. |
| Corde | Rapproche un autre joueur de l’utilisateur, jusqu’à sa position. Baraqué réduit la distance de déplacement imposée de moitié. Ni roue ni boutique pour ce déplacement. |
| Botte | Permet de se déplacer de deux cases au lieu d’une ; à préparer avant le déplacement, pour 1 point d’énergie, en gardant 1 point pour ce déplacement. Une seule par tour. Son prix augmente comme décrit plus haut. |
| Boue | Se pose sur la case de l’utilisateur, avant son déplacement, pour 1 point d’énergie. Une seule Boue par tour. Le prochain joueur qui y entre perd 200 pièces et 100 pièces reviennent au poseur, sauf si c’est le poseur lui-même qui marche dedans. |
| Gomme | Annule l’effet d’une roue après son résultat. Une seule Gomme peut être détenue à la fois. |
| Bullet Bill | S’achète comme un objet et se lance depuis le sac pendant son tour, pour 2 points d’énergie, s’il n’y en a pas déjà un sur le plateau (patch 0.1.4 ; avant, il partait dès l’achat). Lancé, il n’appartient à personne et attend au départ, bien visible. Au début du tour de table suivant, il s’active et fonce vers le joueur le plus proche (hors Enfer) sans tenir compte du sens des flèches, puis recommence à chaque début de tour de table. Il avance d’une seule case par charge (patch 0.1.4) : seule une cible sur la case voisine, ou sur sa propre case, est touchée. Il retire 200 pièces à sa victime, l’étourdit pendant un tour, puis disparaît. Son arrivée, chaque charge et l’impact (explosion) sont annoncés à toute la table. |
| Middle Finger | Empêche une cible de jouer son prochain tour ; peut cibler son utilisateur. |
| Monopoly Man | Échange la position de l’utilisateur avec celle d’un autre joueur. Contre Baraqué, un bras de fer décide de l'échange (voir 9.2 bis). Ni roue ni boutique pour ce déplacement, pour aucun des deux. |
| Bouteille d’eau | Permet de sortir de l’Enfer et de rejoindre une case aléatoire autre que l’Enfer. |
| Tomate | Objet pour rire, accessible à tous (patch 0.1.3). Se lance sur n’importe quel autre joueur, même en Enfer et même depuis l’Enfer, avant son déplacement et sans énergie : on peut en lancer autant qu’on en a. On choisit la Tomate, la cible, puis combien en lancer d’un coup (toute la pile au plus) : la volée part en rafale. Chaque Tomate a 2 chances sur 100 d’assommer la cible, qui passe alors son prochain tour (un seul tour, même si plusieurs l’assomment) ; sinon, rien qu’une tomate écrasée. Jusqu’à 5 Tomates s’empilent dans une place du sac. Depuis le patch 0.1.4, une pile compte comme un exemplaire : deux piles au plus (comme deux exemplaires de tout objet), et on ne lance que d’**une seule pile par tour**, soit 5 Tomates au plus. Une Tomate gratuite de la roue arrive en nouvelle pile de 5 quand le sac a la place. Non merci ne peut pas l’annuler. Je note en reçoit une à chaque tomate reçue. Une roue « perds un objet » ou le fantôme n’en prennent qu’une à la pile. |
| Casque | S’active automatiquement pour éviter un solde négatif. |
| Draven | Envoie tous les joueurs, utilisateur compris, en Enfer. Chance aveugle est épargné. |
| Bouclier | Objet de L'Ange-Gardien (patch 0.1.4). Quand un autre joueur utilise un objet à cible unique sur son protégé, une fenêtre de réaction s'ouvre pour l'Ange, comme celle de Non merci : il bloque l'objet (perdu avec son énergie) ou le laisse passer (Q14). Le Bouclier est alors consommé. Ni Draven ni Bullet Bill. |
| Portail | Boutique du diable. S'ouvre sur une case au hasard, ni l'Enfer, ni le Départ, ni la Red Cup. Le premier joueur qui s'y arrête, le diable compris (Q18), tombe en Enfer et le referme. Sinon il se referme après 2 tours de table, au tour du diable. Chance aveugle s'y arrête sans tomber. |
| Toucher d'Enfer | Boutique du diable, agit tout seul. Dès que le diable se trouve sur la case d'un joueur assommé ou qui doit passer son tour, ce joueur part en Enfer, tous ceux de la case d'un coup ; l'objet est alors consommé. |
| Black Cup | Boutique du diable. La Red Cup plonge en Enfer pour 2 tours de table, puis revient sur sa case (la glace du blizzard y fond). Le premier joueur qui arrive en Enfer entre-temps la ramasse ; ceux qui y étaient déjà ne la ramassent pas (Q16). |
| Sentence | Boutique du diable. Tous les autres joueurs à 0 pièce ou moins partent en Enfer. |
| Doomsday | Boutique du diable. Jusqu'au prochain tour du diable, toutes les cases sans exception, Départ et boutiques compris, font tourner la roue du malheur à qui s'y arrête, le diable compris. Le Départ ne paie pas les 200 pièces et la boutique ne s'ouvre pas (Q17). Chance aveugle n'est pas touché. |
| Made In Heaven | Objet de Chance aveugle (patch 0.1.4), lui seul le voit en boutique. Un seul à la fois, en vente tant que la Red Cup n’est pas en case 8 (le joueur n’en apprend pas plus). Renvoie tous les autres joueurs au Départ, Enfer compris, sans bonus de départ ni effet de case, et pose la Red Cup en case 8 (la case de la première Cup sur les trois cartes). À Banquise, la glace du blizzard sur cette case fond alors. |

Les objets consommables sont retirés de l’inventaire quand ils sont utilisés, sauf si un passif impose un effet différent. Les effets déclenchés, cibles autorisées et éventuelles résistances sont modélisés explicitement.

## 8. Passifs

Une carte passive est attribuée aléatoirement à chaque joueur en début de partie. Pour le MVP, les cartes sont distribuées sans doublon tant qu’il y a assez de cartes disponibles.

| Passif | Effet |
| --- | --- |
| Baraqué | La Corde ne fait reculer le joueur que de la moitié de la distance. Contre le Monopoly Man, un bras de fer décide de l'échange, et ses coups comptent 1,2 fois (patch 0.1.4, voir 9.2 bis). |
| New Cup, New Me | À chaque nouvelle Red Cup, avant qu’elle apparaisse, le joueur choisit : filer au Départ et toucher 200 pièces (même depuis l’Enfer), ou rester où il est (patch 0.1.4). Aller au Départ ne donne ni roue ni boutique. |
| Red light, Green light | Par Red Cup, ses deux premières cases vertes traversées rapportent 100 pièces et ses deux premières rouges en coûtent 100 (patch 0.1.4, « deux de chaque »). |
| Non merci | Une fois tous les 5 tours de table, annule un objet utilisé contre lui, une roue tournée pour lui ou Bullet Bill qui fonce sur lui (voir 4). |
| Corrupteur | Délinquant renommé (patch 0.1.4). Peut ignorer le sens d’une flèche, au prix de 400 pièces à chaque utilisation. Pas pour quitter le départ au premier tour de table. |
| Goblin | Troll renommé (patch 0.1.4). À chaque apparition d’une nouvelle Red Cup, vole 100 pièces à deux adversaires choisis au hasard. S’il n’y a qu’un adversaire disponible, il n’en choisit qu’un. |
| Je note | Quand un objet à cible unique (Ndoye, Hollow Purple, Corde, Middle Finger, Monopoly Man, Tomate) est utilisé contre lui par un autre joueur, il a une chance sur trois d’en garder une copie (patch 0.1.4). Plus de copie de Draven ni de la Boue. Si son inventaire est plein, il choisit un objet ordinaire à sacrifier ; une Red Cup ne peut pas être sacrifiée. Jamais de troisième exemplaire. |
| Calme-toi | Quand une nouvelle Red Cup apparaît, chaque autre joueur à une ou deux cases d’elle, et plus proche d’elle que le détenteur, peut être replacé par celui-ci sur n’importe quelle case à exactement trois cases de la Cup, un joueur après l’autre (patch 0.1.4). Le joueur replacé ne tire rien de cette case : ni roue, ni boutique, ni Boue. Le détenteur peut aussi le laisser où il est. |
| Lambda | Rien de spécial (patch 0.1.4). |
| Nepo Baby | Commence la partie avec 3 000 pièces (patch 0.1.4). |
| Red Bull | A 4 points d’énergie à chaque tour (patch 0.1.4). |
| eShop | Après chaque déplacement, la boutique s’ouvre où qu’il soit (y compris après « Avance d’une case » ou « Retourne d’où tu viens » quand son tour est fini). Commence avec 1 000 pièces (patch 0.1.4). |
| Tomato Enjoyer | Chaque place du sac peut tenir une pile de 5 Tomates (20 au plus). Ses Tomates assomment 5 fois sur 100 au lieu de 2, et chaque Tomate qu’on lui lance lui rapporte 5 pièces (patch 0.1.4). |
| Roller | Pour se déplacer, il lance d’abord un dé à 6 faces ; après le lancer, plus d’objet, seulement le déplacement. Il parcourt exactement ce nombre de cases, flèches respectées, sans jamais repasser par une case (celle de départ comprise). Si aucun chemin n’est assez long, il va le plus loin possible (réponse de l’auteur). Les cases traversées comptent (bonus du départ, Red light) ; la glace ne fait glisser qu’à l’arrivée. Il ne peut ni acheter ni chausser la Botte (patch 0.1.4). |
| Double or nothing | Après chaque gain ou perte de pièces, dès que la table est au repos (pas au milieu d’une roue ou d’un duel), il peut tenter un 50/50 : la somme se produit une seconde fois, ou elle est annulée. Sinon, il la garde. Chaque somme est proposée à part, même pendant le tour d’un autre joueur. Ses achats, et le résultat du 50/50 lui-même, ne se rejouent pas (réponse de l’auteur, Q7) (patch 0.1.4). |
| Chance aveugle | Ne voit jamais la Red Cup : en ligne sur son appareil, sur l’écran partagé quand c’est à lui de décider. Aucun objet ne peut lui nuire : il n’apparaît jamais dans les cibles (Q19), Draven et Bullet Bill l’épargnent. La Boue ne lui coûte rien et ne rapporte rien à son poseur : il recule sur la case d’où il est entré, sans effet de case (il reste sur place s’il a été téléporté). Lui seul peut acheter Made In Heaven (voir 7) (patch 0.1.4). |
| Voleur | Une fois par visite à la boutique, il peut tenter de voler un objet au lieu de l’acheter, avec 1 % de risque par tranche de 10 pièces de son prix (Botte : son prix du moment). Réussi, l’objet est gratuit (règles du sac respectées). Pris, il part en Enfer, ce qui finit son tour, et doit 1,5 fois le prix : ses objets les plus chers partent d’abord, jusqu’à couvrir la somme, sans rendu de monnaie ; s’ils ne suffisent pas, le reste est pris sur ses pièces (Q8, Q9) (patch 0.1.4). |
| Le diable | Annoncé à toute la table au lancement. Gagne dès que les autres joueurs sont entrés en Enfer ⌊4N − N/2⌋ fois, N étant le nombre de joueurs au lancement (2 → 7, 4 → 14, 8 → 28) ; chaque entrée compte, quelle qu'en soit la cause. Ne ramasse pas la Red Cup. Sort de l'Enfer quand il veut pendant son tour : retour en case 0, sans les 200 pièces (Q10), et son tour continue. Ne détient jamais deux fois le même objet (une seule pile de Tomates). Sur les cases bleues, sa boutique a un second onglet avec ses 5 objets (Q11, voir 7). La barre des joueurs affiche son compteur, par exemple « Enfer 5/14 » (patch 0.1.4). |
| L'Ange-Gardien | Seulement à 4 joueurs ou plus. Au lancement, un protégé est tiré parmi les joueurs qui ne sont pas des malfaiteurs (le diable, le Voleur, le Goblin, le Corrupteur) ; sans protégé possible, l'Ange devient Lambda. Le protégé est public et porte un halo (Q13). L'Ange gagne avec son protégé. Il commence avec 600 pièces et 2 places, ne ramasse pas la Red Cup et ne va jamais en Enfer : à la place, il perd son prochain tour (Hollow Purple, Draven, roues, Portail ; le fantôme lui prend des pièces ou un objet ; la Corde ou le Monopoly Man d'un joueur en Enfer le laissent sur place ; on ne peut pas le défier). La Boue lui fait perdre son prochain tour au lieu de 200 pièces. Sa roue du malheur n'a que 2 issues : passer son tour ou rien. Il ne vise que son protégé et n'utilise jamais Ndoye, Hollow Purple, Boue, Tomate, Bullet Bill, Middle Finger, Draven ni Casque (ni achat, ni usage). Pendant son tour, il peut sacrifier ses 2 prochains tours pour tirer son protégé de l'Enfer : le protégé arrive sur sa case, sans effet de case. Si le protégé abandonne, l'Ange prend sa place (passif, sac, Red Cups et pièces) mais en Enfer (patch 0.1.4). |
| Cupide | Gagne à 5 000 pièces (voir 3.3). Une Red Cup lui rapporte 1 000 pièces au lieu d’une place. En s’arrêtant sur la case d’un joueur assommé (qui doit passer son tour), il lui prend 50 pièces. Sa Boue lui coûte 100 pièces et lui rapporte 200 quand un autre joueur marche dedans. Les pièces que son Ndoye fait perdre à sa cible lui reviennent (patch 0.1.4). |

## 9. Enfer, roues et duels

### 9.1 Enfer

- La case 11 représente l’Enfer.
- Un joueur en Enfer ne suit pas le déplacement normal. À son tour, il tourne la roue de l’Enfer jusqu’à sa libération. Depuis le patch 0.1.4, cette roue remplace le déplacement : il faut au moins 1 point d’énergie, elle prend le reste, et ses objets passent avant. Envoyé en Enfer pendant son propre tour, un joueur à qui il reste de l’énergie peut tourner la roue tout de suite ; ce tour compte alors dans sa peine.
- Deux joueurs en Enfer déclenchent un duel. Le gagnant revient en case 0 avec le bonus de 200 pièces du départ (patch 0.1.3) ; le perdant y reste.
- Certains effets spéciaux peuvent aussi faire sortir de l’Enfer. La Bouteille d’eau en est un exemple ; une roue positive peut en devenir un autre.
- Quand un effet appelle un joueur pour un duel depuis le plateau, ce joueur rejoint l’Enfer pour le duel. Le vainqueur va en case 0 avec le bonus du départ et le perdant reste en Enfer.
- **Peine maximale (règle confirmée par l’auteur)** : un joueur ne reste jamais plus de **5 de ses tours** en Enfer. Si, à la fin de son 5ᵉ tour, il ne s’est pas échappé (roue, objet, passif, duel), il sort en case 0 et paie **500 pièces**. Comme toute sortie de l’Enfer, il touche le bonus de 200 pièces du départ : la roue de l’Enfer peut lui avoir coûté bien plus. Le bonus est versé avant le dû, soit −300 pièces au total. Il rejoue normalement au tour suivant.
  - Les tours sautés en Enfer comptent dans les 5 tours.
  - Le compteur repart à zéro à chaque nouvel envoi en Enfer. Un joueur déjà en Enfer (Draven, par exemple) garde son compteur.
  - Les règles habituelles de l’argent s’appliquent ensuite au dû : le Casque évite de passer sous zéro ; à −300 pièces, le solde repart à 0 et le joueur saute son prochain tour.
  - Le dock affiche le décompte (« Tour 3/5 ») et la fiche joueur indique les tours déjà passés en Enfer.

### 9.2 Sélection et résolution des duels

Le système tire uniformément un mode disponible :

1. **Pile ou face** : vainqueur tiré à 50/50.
2. **Pierre-feuille-ciseaux** : choix des deux duellistes, égalité rejouée.
3. **Vote** : les duellistes ne votent pas ; les autres joueurs choisissent un vainqueur. Une égalité est départagée par pile ou face.
4. **Basket** (patch 0.1.3, sur toutes les cartes) : un panier, une balle, 15 secondes pour marquer le plus de paniers. Le chrono ne part qu’après « Commencer le mini-jeu ». On tire quand le curseur de la jauge passe dans la zone verte ; la jauge accélère vers la fin. Entre deux joueurs, chacun a ses 15 secondes, l’un après l’autre ; contre le fantôme, il tire en même temps. Égalité : pile ou face. En ligne, les autres regardent les tirs en direct ; seul le score final, envoyé par l’appareil du tireur, compte (plafonné à 30).
   - Le fantôme n’est pas une machine : sa forme du jour (40 à 70 % de réussite), ses séries chaudes ou froides, ses hésitations et son excès de confiance après 4 paniers d’affilée lui font marquer environ 6 paniers, de 0 à 12 selon les manches.
5. **Blackjack** (patch 0.1.4, dans tous les duels) : un paquet de 52 cartes mélangé par le moteur, deux cartes chacun, visibles. Le premier duelliste tire ou reste, puis le second ; dépasser 21 fait perdre la main, et 21 l'arrête aussitôt. L'as vaut 11 ou 1, les figures 10. Le plus proche de 21 sans le dépasser gagne ; égalité (y compris deux mains sautées) : pile ou face. Le fantôme joue comme un croupier : il tire tant qu'il a moins de 17.

Si aucun joueur extérieur n’est disponible pour voter, le mode vote est retiré du tirage. Dans le MVP sur un seul écran, l’hôte entre les choix et votes. Les entrées de pierre-feuille-ciseaux sont masquées successivement avant révélation.

### 9.2 bis Bras de fer (patch 0.1.4)

- Un Monopoly Man utilisé sur Baraqué ouvre un bras de fer au lieu de l'échange. Chacun a 10 secondes pour taper le plus vite possible, après un décompte de 3 secondes : en local sur le même écran (moitié gauche ou touche A pour l'attaquant, moitié droite ou touche L pour Baraqué), en ligne chacun sur son appareil (bouton ou barre d'espace), la barre bougeant en direct. Le compte de chacun est plafonné à 150.
- Les coups de Baraqué comptent 1,2 fois. L'attaquant plus fort : l'échange a lieu. Baraqué plus fort : pas d'échange, le Monopoly Man est perdu quand même.
- **Égalité** (réponse Q20) : s'il y a au moins une case entre eux, l'attaquant avance d'une case vers Baraqué et Baraqué recule d'une case ; côte à côte, seul Baraqué recule. Reculer veut dire aller sur la case voisine la plus éloignée de l'attaquant ; sans case plus éloignée, Baraqué reste. Personne ne bouge depuis ou vers l'Enfer. Aucun de ces déplacements n'est une arrivée (ni roue ni boutique).

### 9.3 Roues (patch 0.1.4)

Les roues du bonheur et du malheur suivent la liste de l’auteur, en huit secteurs de poids égal. Les valeurs et poids restent configurables sans modifier le moteur de jeu (`WHEEL_RESULTS`).

**Roue du malheur :**

1. −200 pièces.
2. −300 pièces.
3. −400 pièces.
4. Retourner d’où l’on vient (voir 3.2).
5. Tourner la roue du bonheur.
6. Perdre un objet au hasard, jamais une Red Cup ; un sac sans objet coûte 200 pièces à la place.
7. Être envoyé en Enfer.
8. Passer le prochain tour.

**Roue du bonheur :**

1. +100 pièces.
2. +200 pièces.
3. +300 pièces.
4. +400 pièces.
5. Avancer d’une case, au choix du joueur (voir 3.2).
6. Tourner la roue du malheur.
7. Objet gratuit tiré parmi ceux qui coûtent 400 pièces ou moins (Ndoye, Corde, Botte, Boue, Tomate, Gomme, Middle Finger, Casque). La Tomate arrive en pile de 5. Sac plein : 200 pièces à la place.
8. Aller au Départ et gagner 200 pièces, même depuis l’Enfer.

Les déplacements donnés par une roue peuvent mener à une autre roue : c’est voulu (réponse de l’auteur, patch 0.1.4).

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
- Attribution de 2 000 pièces et d’un passif par joueur ; départ en case 0 (depuis 0.1.4, le passif est choisi au draft et certains changent le solde de départ).
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
- Le mode en ligne n'a pas de serveur de jeu : la base Supabase arbitre l'ordre des actions (compare-and-set sur la version) et donne l'heure commune du chrono (`server_time()`). Chaque action porte l'heure à laquelle elle a été jouée, si bien que tous les appareils calculent le même état, chrono compris.

## 12. Points à revisiter

- Vérifier les prix objet par objet avec les éléments source de meilleure qualité.
- Rééquilibrer les roues et remplacer les résultats provisoires si les anciennes règles sont retrouvées.
- Confirmer si une Red Cup peut apparaître en Enfer ; le MVP exclut la case 11 du tirage initial pour éviter un objectif inaccessible.
- Préciser l’effet de la Bouteille d’eau lorsqu’elle est utilisée : la slide indique une destination aléatoire hors Enfer.
- Patch 0.1.4 : relire avec l'auteur tous les **choix à valider**, lot par lot (section 13).
- Appliquer `supabase/schema.sql` sur le projet Supabase partagé (ajout de `server_time()`) avant de publier le chrono en ligne ; sans lui, chaque appareil suit sa propre horloge.
- Préciser le comportement des effets touchant simultanément tous les joueurs, notamment Draven et Bullet Bill.
- Les images de la présentation sont des références. Le MVP utilise des éléments graphiques originaux ; les assets tiers devront être vérifiés avant une publication publique.

## 13. Choix à valider du patch 0.1.4

Pendant le rework, chaque lot a demandé des choix que le document de l'auteur ne tranchait pas. Ils sont appliqués dans le jeu tel quel, mais restent à confirmer avec l'auteur. Chaque ligne dit ce que fait le jeu aujourd'hui. Les choix déjà tranchés sont marqués **Validé** ; les questions Q1 à Q20 et leurs réponses sont dans la cartographie (`plans/patch-0.1.4-rework.md`).

### Lot 1 — Corrections rapides

1. **À valider** — **Boue** : posée dans le quart avant droit de la case, avec la pastille du numéro de la case affichée par-dessus.
2. **À valider** — **Fantôme** : un joueur qui sort de l'Enfer reste protégé du fantôme jusqu'au prochain déplacement du fantôme, pas jusqu'au sien (lecture de la spec, rien n'a changé).
3. **À valider** — **Descriptions** des objets et des passifs : réécrites en une phrase générale chacune ; l'auteur avait proposé d'écrire les siennes.
4. **À valider** — **Son d'achat** : une caisse enregistreuse synthétisée (clac, tiroir, « ka-ching »).

### Lot 2 — Flèches attachées aux cases

1. **À valider** — **Forme des flèches** : en relief, de la couleur de la case, avec un contour encre et une petite poussée animée vers la sortie ; leur taille est un choix visuel.

### Lot 3 — Boutique et roues

1. **À valider** — La boutique de la case d'arrivée (après « Avance d'une case » ou « Retourne d'où tu viens ») ne s'ouvre que pour le joueur dont c'est le tour, et seulement si son tour était fini. Un joueur visé par un Ndoye qui atterrit sur une boutique n'achète pas.
2. **À valider** — « Avance d'une case » compte comme un pas à pied : bonus du départ et Red light s'appliquent. « Retourne d'où tu viens » est un retour en arrière, sans bonus.
3. **À valider** — Les roues peuvent s'enchaîner : roue du bonheur, une case, puis la roue de la nouvelle case (conséquence de la réponse Q2).

### Lot 4 — Énergie

1. **Validé** — **Bullet Bill va dans le sac** à l'achat et se lance pendant son tour pour 2 points.
2. **Validé** — Envoyé en Enfer pendant son propre tour avec de l'énergie, un joueur peut tourner la roue de l'Enfer tout de suite ; ce tour compte dans sa peine.
3. **Validé** — **Tomates** (retour de l'auteur) : une pile compte comme un objet, plusieurs piles possibles, une seule pile lancée par tour.
4. **À valider** — Lancer une Tomate ou poser une Boue compte comme « utiliser un objet » : cela suffit pour finir son tour sans bouger.

### Lot 5 — Passifs existants

1. **À valider** — **Lambda** est arrivé dès le lot 5 (au lieu du lot 6) et se tire au sort comme les autres passifs.
2. **À valider** — **New Cup, New Me** : aller au Départ marche aussi depuis l'Enfer, c'est donc une sortie d'Enfer à chaque nouvelle Cup.
3. **À valider** — **Non merci** ne peut pas annuler la Tomate, objet « pour rire ».
4. **À valider** — Contre **Bullet Bill**, Non merci compte comme utilisé dans le tour de table qui commence ; il revient 5 tours après celui-là.
5. **À valider** — **Calme-toi** peut replacer un joueur sur n'importe quelle case à 3 de la Cup, Départ et boutiques compris ; il n'en tire rien (ni roue, ni boutique, ni Boue, ni bonus).

### Lot 6 — Passifs simples et victoire de Cupide

1. **À valider** — **Cupide** ne vole les 50 pièces que s'il s'arrête sur la case d'un joueur assommé (en marchant ou avec « Avance d'une case ») ; passer dessus ne suffit pas.
2. **À valider** — **Cupide** n'accumule pas de Red Cups : il ne gagne qu'à 5 000 pièces.
3. **À valider** — **eShop** a aussi la boutique après « Avance d'une case » ou « Retourne d'où tu viens », quand son tour est fini.
4. **À valider** — **Roller** : une fois le dé lancé, il ne peut plus utiliser d'objet ; il ne peut pas chausser une Botte reçue gratuitement.

### Lot 7 — Passifs avancés

1. **À valider** — **Double or nothing** propose chaque somme à part : un passage au Départ avec une case verte donne deux invites. L'invite vient dès que la table est au repos, même pendant le tour d'un autre.
2. **À valider** — **Chance aveugle et la Boue** : le poseur ne touche rien ; si Chance aveugle a été téléporté sur la Boue, il reste sur place au lieu de reculer.
3. **À valider** — **Chance aveugle** est protégé de ses propres objets aussi : son Draven l'épargne, et il ne peut pas se viser lui-même.
4. **À valider** — **Made In Heaven** déjà acheté reste utilisable même si la Cup est arrivée en case 8 entre-temps ; la boutique dit seulement « Pas en vente pour l'instant », sans révéler où est la Cup.
5. **À valider** — **Voleur pris** : ses objets les plus chers partent d'abord, sans rendu de monnaie ; un vol de Tomate raté (1 % de risque) peut lui coûter un Draven.
6. **À valider** — Une **Botte volée** ne lance pas la hausse de son prix, réservée au premier achat.

### Lot 8 — Le diable et L'Ange-Gardien

1. **À valider** — **Doomsday** touche tout le monde, le diable compris (seul Chance aveugle y échappe), et dure jusqu'au prochain tour du diable.
2. **À valider** — Les **2 tours de table** du Portail et de la Black Cup se terminent au tour du diable.
3. **À valider** — **Sortir de l'Enfer** ne coûte pas d'énergie au diable, et son tour continue depuis la case 0.
4. **À valider** — **Boue de l'Ange** : il perd son prochain tour, et le poseur touche quand même ses 100 pièces.
5. **À valider** — Le **Bouclier** ne bloque que les objets à cible unique visant le protégé, ni Draven ni Bullet Bill.
6. **À valider** — **Libérer le protégé** ne coûte pas d'énergie à l'Ange, et son tour continue.
7. **À valider** — La **Black Cup** reste rouge sur le plateau pendant son séjour en Enfer (pas de modèle noir).
8. **À valider** — Le **protégé** est tiré dès la fin du draft (lot 10), parmi les passifs choisis, et annoncé tout de suite à la table.
9. **À valider** — L'Ange ne peut pas être **défié** depuis l'Enfer ; à 2 joueurs avec l'Ange, la roue « Choisis un joueur à affronter » ne fait rien. Le **fantôme** lui prend des pièces ou un objet au lieu de l'emporter en Enfer.
10. **À valider** — Le **Toucher d'Enfer** agit dès que le diable et un joueur assommé se retrouvent sur la même case, quel que soit celui qui bouge.

### Lot 9 — Chrono de tour en ligne

1. **À valider** — Les 45 secondes ne comptent que les décisions du joueur actif, et chaque action lui rend 3 secondes de grâce pour les animations : un joueur qui enchaîne les objets dispose donc d'un peu plus de 45 secondes en tout.
2. **À valider** — Les décisions des autres ont 20 secondes (45 pour un Basket), et ce délai repart après chaque action pendant la décision (chaque vote).
3. **À valider** — Les choix par défaut à l'échéance : laisser passer, rester, garder, appliquer la roue ; tirage au hasard pour la case où avancer, l'objet à jeter, l'adversaire du défi, la main ou le vote manquant ; 0 panier pour un tireur absent.
4. **À valider** — **Une chance perdue** seulement quand le chrono termine un tour sans aucune action ; finir soi-même son tour, coincé ou sans énergie, ne coûte rien (lecture de Q1).
5. **À valider** — Les chances perdues ne se regagnent jamais pendant la partie ; le forfait tombe à la 3ᵉ, une fois la table au repos.
6. **À valider** — Un joueur qui quitte le salon pendant une décision (roue, duel) n'abandonne pas tout de suite : le chrono ferme ses décisions et ses tours, et il déclare forfait au bout de 3 tours.
7. **À valider** — La fonction `server_time()` est dans `supabase/schema.sql` mais n'est pas encore appliquée sur le projet Supabase partagé : tant qu'elle ne l'est pas, chaque appareil se fie à sa propre horloge, et un appareil mal réglé peut fermer un tour un peu trop tôt ou trop tard.

### Lot 10 — Draft des passifs

1. **À valider** — En **local**, chaque joueur choisit à son tour et ne peut plus changer d'avis ensuite : le dernier choix ferme le draft. En ligne, on peut changer jusqu'à la clôture.
2. **À valider** — Les cartes sont tirées au hasard dans tous les passifs : un même draft peut proposer plusieurs malfaiteurs ; l'Ange-Gardien choisi sans protégé possible devient Lambda (Q13).
3. **À valider** — En ligne, les cartes des autres ne sont cachées que par l'écran : l'état du jeu est partagé par tous les appareils.
4. **À valider** — Une revanche repasse par le draft, en local comme en ligne.
5. **À valider** — Le compte à rebours de 5 secondes passe aussi en local ; pendant ce temps, le dock du premier joueur est déjà affiché derrière.

### Lot 11 — Mini-jeux

1. **À valider** — **Blackjack** : les cartes des deux joueurs sont visibles (pas de carte cachée) ; le premier duelliste joue toute sa main avant le second ; deux mains sautées comptent comme une égalité, tranchée à pile ou face.
2. **À valider** — Le **fantôme** au Blackjack tire tant qu'il a moins de 17, sans regarder la main de son adversaire.
3. **À valider** — **Bras de fer** : 3 secondes de décompte, puis 10 secondes ; en ligne, chaque appareil lance ses 10 secondes quand son joueur appuie sur « C'est parti ! », les deux ne sont donc pas forcément simultanés. Un côté qui n'envoie rien dans les délais du chrono compte 0.
4. **À valider** — **Égalité au bras de fer** : « reculer » envoie Baraqué sur la case voisine la plus éloignée de l'attaquant, flèches ignorées ; s'il n'y en a pas, il reste. Ces pas ne déclenchent ni roue, ni boutique, ni Boue.
5. **À valider** — Baraqué qui gagne le bras de fer garde sa case, et le Monopoly Man est perdu avec son énergie, comme un objet annulé.

### Lot 12 — Docs et finitions

1. **À valider** — Le numéro de version passe à 0.1.4 dans `package.json` ; le jeu n'affiche son numéro nulle part.
2. **À valider** — Les descriptions des objets et des passifs restent les miennes (lot 1) : celles de l'auteur pourront les remplacer dans `src/game/catalog.ts`, où elles sont toutes rassemblées.

### Tests par carte (après les 12 lots)

Les bots jouent maintenant chaque carte à part, à toutes les tables possibles (voir la cartographie). Les règles de la glace ci-dessous viennent de deux demandes de l’auteur (« Avance d’une case » qui glisse, le blizzard qui tombe sur un joueur) ; le reste est à relire.

1. **Validé** — « Avance d’une case » vers une case glissante : le joueur glisse, comme au bout d’une marche (cases glissées comptées, tombée de glace possible) et arrive là où la glissade s’arrête.
2. **Validé** — Le blizzard peut geler la case d’un joueur : la glace l’emporte aussitôt, avant que la partie continue.
3. **À valider** — Le joueur emporté par la glace (blizzard, départ gelé, échange…) n’« arrive » pas sur la case où elle le laisse : ni roue, ni boutique, ni Boue, ni Red Cup, même s’il s’arrête sur la case de la Cup. Il n’est jamais pris par la tombée de glace.
4. **À valider** — « Va au Départ » et « Retourne d’où tu viens » vers une case gelée : le joueur glisse sans tombée de glace, puis arrive normalement là où il s’arrête (roue, boutique, Boue, Red Cup). « Va au Départ » paie toujours ses 200 pièces, même départ gelé ; les sorties d’Enfer aussi.
5. **À valider** — Au lancement, le blizzard ne gèle jamais le départ (sinon toute la table glisserait avant de jouer).
6. **À valider** — Calme-toi ne propose jamais une case de glace ; le Portail ne s’ouvre jamais sur la glace (personne ne s’y arrête) ; la Bouteille d’eau n’y atterrit jamais.
7. **À valider** — Une glissade dont toutes les routes ont déjà été parcourues (long trajet du Roller, Botte) s’arrête sur la première sans glace ; dans un cul-de-sac (Corrupteur qui entre en 4 contre la flèche 4 → 0, gelée), elle repart en arrière, et la flèche 4 → 0 paie alors le départ.
8. **À valider** — Un joueur pris dans la glace et déplacé (Corde, échange, Enfer) perd sa glissade aussitôt, même s’il revient plus tard sur la case où il était pris.
9. **À valider** — Pris par la tombée de glace pendant son propre tour après « Avance d’une case », un joueur termine son tour, comme après une marche.
10. **À valider** — Les bots achètent d’abord les objets de leur rôle (boutique du diable, Made In Heaven, Bouclier), pour que ces objets soient bien testés ; cela ne change que les bots, pas les règles.

## 14. Historique des versions

### 0.1.4 — en préparation

Rework demandé par l’auteur du jeu, livré en 12 lots ; le plan, les réponses de l'auteur et le bilan de chaque lot sont dans `plans/patch-0.1.4-rework.md`, et les choix qui restent à valider dans la section 13.

- **Fantôme** : sa glissade s’arrête sur la première case occupée par un joueur ; il ne passe plus sur un pion sans l’affronter.
- **Luna Park** : les cases 5 et 8 sont échangées. La première Red Cup (case 8) est sur la case la plus éloignée du départ, dans le goulet accessible seulement par 6 ; seule l’entrée 8 → 0 paie le bonus du départ.
- **Boue** : plus épaisse, cernée d’encre, posée sur le dessus de la case (elle monte avec la case surlignée) ; la pastille du numéro s’affiche sur une case boueuse.
- **Son d’achat** : une caisse enregistreuse, sans le son de perte d’argent.
- **Flèches** : elles sont dessinées sur les cases, comme sur le plateau original : une flèche en relief de la couleur de la case sort de son bord vers la route imposée, sur le plateau 3D comme sur le plan de l’aide. Les routes fléchées perdent leurs chevrons ; le tunnel et le carrousel gardent les leurs.
- **Énergie** : 3 points par tour. Les objets coûtent de 0 à 3 points et ne terminent plus le tour ; le déplacement (ou la roue de l’Enfer) demande au moins 1 point et prend le reste. La Botte coûte 1 point et en garde 1 pour bouger. Jauge dans le dock et sur la fiche de chaque joueur, bleue pleine, orange à 2 points, rouge au dernier ; coûts affichés dans la boutique, le sac et l’aide (voir 4).
- **Tomates** : une pile compte comme un exemplaire, deux piles au plus, une seule pile lancée par tour.
- **Nouveaux passifs** (voir 8) : Nepo Baby, Red Bull, eShop, Tomato Enjoyer, Roller et Cupide, avec sa victoire à 5 000 pièces ; Double or nothing, Chance aveugle avec son objet Made In Heaven, et le Voleur ; le diable, avec sa victoire et sa boutique, et L'Ange-Gardien, avec son Bouclier.
- **Passifs** (voir 8) : Penta et Je suis Cups disparaissent, Lambda arrive. Délinquant devient Corrupteur et Troll devient Goblin. New Cup, New Me choisit entre le Départ (+200) et rester ; Red light, Green light compte deux cases de chaque par Red Cup ; Non merci ne vise plus que ce qui l’affecte (objet, roue, Bullet Bill) et se recharge en 5 tours de table ; Je note garde une copie une fois sur trois ; Calme-toi replace les joueurs trop proches à trois cases de la Cup.
- **Boutique** : nouveaux prix (Ndoye 250, Corde 400, Gomme 200, Bullet Bill 550, Monopoly Man 600, Casque 200) ; la Botte plafonne à 400.
- **Bullet Bill** : une seule case par charge. Il va dans le sac à l’achat et se lance pendant son tour, pour 2 points d’énergie.
- **Roues** : roues du bonheur et du malheur refaites en huit secteurs (voir 9.3), avec « Avance d’une case », « Retourne d’où tu viens », « Va au Départ » et −300 ; ces déplacements donnent la roue et la boutique de la case d’arrivée.
- **Draft des passifs** (voir 4.0) : 3 cartes par joueur (2 au-delà de 6), une minute en ligne, à tour de rôle sans chrono en local, puis un compte à rebours de 5 secondes.
- **Mini-jeux** (voir 9.2 et 9.2 bis) : le Blackjack rejoint les duels ; Baraqué affronte le Monopoly Man au bras de fer.
- **Chrono en ligne** (voir 4.3) : 45 secondes par tour, 20 pour les décisions des autres, choix par défaut à l'échéance, une chance perdue par tour passé sans jouer et forfait à la troisième ; heure du serveur commune ; un salon d'une autre version est refusé.
- **Interface** : le carrousel de détails (zone orange) disparaît de la fiche joueur, de la boutique et de l’aide ; chaque objet et chaque passif garde une description générale.
- **Banquise** (voir 3.2 ter) : personne ne reste sur la glace. « Avance d’une case » glisse comme une marche ; le blizzard peut geler la case d’un joueur, que la glace emporte aussitôt ; tout autre déplacement vers la glace (départ gelé, échange, recul dans la Boue…) se fait emporter jusqu’à la première case sans glace ; une glissade sans route libre ne reste plus sur la glace ; un joueur pris dans la glace puis déplacé perd sa glissade pour de bon.
- **Changement de tour** : sur toutes les cartes, le plateau est réglé dès le début du tour (Toucher d’Enfer du diable sur un joueur assommé par une boule de neige ou Bullet Bill, duel en Enfer). Seul Luna Park le faisait, à cause du fantôme.

### 0.1.3 — septembre 2026

- **Nouvelle carte Luna Park** : fête foraine de nuit avec un carrousel à sens unique autour de l’Enfer, qui s’inverse à chaque nouvelle Red Cup, et un train fantôme 7 → 12 (voir 3.2 bis). Une bannière annonce le changement de sens ; boutique et roues attendent sa fin.
- **Nouvelle carte Banquise** : lac gelé en miroir où l’on glisse au hasard sur la glace, tombée de glace sur la route de la Red Cup, blizzard qui déplace une troisième glace tous les deux tours, crevasse de l’Enfer, neige et aurore boréale (voir 3.2 ter).
- **Fantôme de Luna Park** : il rôde sur tout le plateau, glisse de case en case ou se téléporte, défie les joueurs qu’il croise, vole de l’argent ou des objets qu’il garde en butin, ou emporte sa victime en Enfer ; le battre rend un morceau du butin ou 300 pièces (voir 3.2 bis).
- **Revanche en ligne** : l’hôte relance une partie, sur la carte de son choix, avec tous ceux encore dans le salon.
- **Banquise, boules de neige** : après la première Red Cup, les pingouins bombardent les joueurs ; trois boules et on gèle un tour (voir 3.2 ter).
- **Nouvel objet Tomate** (10 pièces) : à lancer sur les autres pour rire, avant son action, en volée de 1 à 5 ; jusqu’à 5 par place du sac ; 2 chances sur 100 par Tomate d’assommer la cible un tour (voir 7).
- **Chat vocal** : activer ou couper son micro n’affiche plus « X s’est déconnecté » chez les autres joueurs.
- **Nouveau mini-jeu Basket** : 15 secondes pour marquer le plus de paniers, dans tous les duels et sur toutes les cartes (voir 9.2).
- **Musique** : une ambiance par carte (valse de fête foraine pour Luna Park, boîte à musique polaire pour Banquise), chacune avec sa version sombre quand le joueur actif est en Enfer ou pendant un duel ; celle du coffre à jouets est plus sombre qu’avant.
- **Choix de la carte** : une étape du salon après la liste des joueurs, en carrousel, avec un aperçu de chaque carte ou un tirage aléatoire ; en ligne, l’hôte choisit. La revanche propose le même carrousel, sur la carte qui vient d’être jouée.
- **Comment jouer** : l’onglet Plateau montre la carte jouée, seule la légende défile ; les objets et les passifs détaillent toutes leurs conditions, une par une, avec des flèches.
- **Je note** : plus de copie d’un objet utilisé sur soi-même, ni de sa propre Boue.
- **Calme-toi** : jamais proposé à son détenteur contre lui-même.
- **Duel** : le gagnant reçoit les 200 pièces du départ, comme toute sortie de l’Enfer.
- **Bullet Bill** : une cible à deux cases est touchée d’une seule charge.

### 0.1.1 — septembre 2026

- **Délinquant** : ignorer une flèche coûte 400 pièces (au lieu de 200) ; au premier tour de table, il ne peut plus quitter le départ à contresens pour prendre directement la Red Cup de la case 8.
- **Corde et Monopoly Man** : la cible et l’utilisateur ne tournent aucune roue et n’ouvrent aucune boutique grâce à ce déplacement.
- **New Cup, New Me** : le repositionnement ne donne ni roue ni boutique.
- **Bullet Bill** : visible au départ dès l’achat, il s’active au tour de table suivant. Bannière d’alerte, puce d’état dans la barre du haut, charge animée avec traînée de fumée et explosion à l’impact.
- **Roue du bonheur** : nouveau secteur « Tourner la roue du malheur ».
- **Abandon** : un joueur peut quitter la partie sans l’arrêter pour les autres.
- **Numéros des cases** : une pastille rappelle le numéro d’une case occupée par des pions ou par la Red Cup.
- **Boue** : se pose avant de se déplacer dans le même tour ; 100 pièces reviennent au poseur quand un autre joueur marche dedans.
- **Non merci** : utilisable une fois tous les 3 tours de table au lieu d’une fois par cycle de Red Cup.
- **Tour de Bénédiction** : si tous les joueurs ont 0 pièce ou moins, chacun tourne la roue du bonheur à tour de rôle.
- **Interface** : la boutique ne se ferme plus un instant après chaque achat ; la fenêtre Non merci laisse 15 secondes pour réagir (au lieu de 8).
