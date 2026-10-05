# Patch 0.1.5 — retours de l'auteur

Branche `patch_0.1.5`, créée depuis `patch_0.1.4`. Cinq lots, un commit par lot. Rien n'est poussé.
Les choix laissés à ma main sont listés dans la section 13 bis de `red-cups-game-spec.md`.

## Lots

| # | Lot | Contenu |
|---|---|---|
| 1 | Règles et équilibrage | Diable (entrées des autres : 1 point et 50 pièces), Portails (deux portails cachés, 400 pièces, 3 tours), Cupide 6 000, Made In Heaven 1 300, Ange-Gardien 800, Red light 50 |
| 2 | Tours et salons | Joueur endormi au début de son tour : tour sauté. Salon joignable jusqu'à la fin du premier tour de table (`joinLatePlayer`, schéma SQL) |
| 3 | Interface | Fiche joueur (croix, défilement), aide mobile à un seul défilement, cartes de tarot, boutons des mini-jeux, bouton et contenu du journal |
| 4 | Exclusion | L'hôte exclut un joueur (`kick_player`, `kickPlayer`, `touch_seat` renvoie −1 à l'exclu) |
| 5 | Menu, version, docs | Page de menu, journal des modifications, version 0.1.5 (`package.json`, `RULES_VERSION`), spec, README |

## À faire côté base

`supabase/schema.sql` a changé : `claim_seat`, `get_room`, `touch_seat`, `kick_player`, `is_late_joinable` et la table
`room_kicks`. Le fichier est idempotent : il suffit de le rejouer sur le projet Supabase avant de déployer le front.
Sans lui, le salon reste fermé après le lancement et le bouton d'exclusion échoue.

## Vérifications

`bun x tsc -p tsconfig.json --noEmit`, `bun run test` (campagnes de bots comprises), `bun run build`.
