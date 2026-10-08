# Patch « Actifs et passifs » (version 0.1.5)

Branche `patch_0.1.5`, un commit par lot, rien n'est poussé. Les choix à valider sont en section 13 ter de
`red-cups-game-spec.md`.

| # | Lot | Contenu |
|---|---|---|
| 1 | Deux cartes | `Player.passiveId` (actif) et `passifId` (passif), `cards.ts`, `hasCard`, sauvegarde version 23 |
| 2 | Draft en deux étages | `PassiveDraft.stage`, offres sans doublon, retardataire et exclusion suivent l'étage |
| 3 | Vie privée | Sac et actif cachés en ligne, journal à texte public, `ui/visibility.ts` |
| 4 | Passifs | Goblin 150 à tous, Dernier de la classe, Habitué de l'Enfer, Piégeur |
| 5 | Roues | Main verte, Main rouge, Touché angélique, Touché funeste |
| 6 | Duel et boutique | Meneur de jeu (`duel-choice`), Brocanteur (`sellItem`) |
| 7 | Objets | Réveil, Parachute, Miroir, Barrière (état `barrier`, 3D, choix de la route) |
| 8 | Documents | Spec, aide, journal des modifications, README |

Aucun changement de `supabase/schema.sql`. Vérifications : `bun x tsc -p tsconfig.json --noEmit`, `bun run test`
(campagnes de bots sur les trois cartes), `bun run build`, `bun x prettier --check --end-of-line auto src`.
