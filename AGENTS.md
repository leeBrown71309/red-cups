# Red Cups — Project Instructions

## Keeping the two reference interfaces in sync (MANDATORY)

Two interfaces document the game for players and developers. Whenever you add,
remove, rename, or rebalance **any game element** (item, card actif/passif, map,
wheel wedge, shop rule, duel rule, turn/hell/cup/money rule, devil spell…), you
MUST update both of them in the same change:

1. **The wiki** (`src/wiki/`, page `wiki.html`):
   - `src/wiki/content/interactions.ts` — the `INTERACTIONS` list is the heart of
     the wiki. Add/remove/edit one line per element pair whose behavior changed
     (e.g. a new item vs `no-thanks`, a balance change to an existing pair).
   - `src/wiki/content/items.ts`, `cards.ts`, `maps.ts`, `wheels.ts`, `hubs.ts`,
     `systems.ts` — the detailed behavior sections, keyed by the game's own id
     (`ItemId`, `PassiveId`, `MapId`, `WheelId`). A new element needs a new entry
     there (title/summary auto-come from the catalogs; the sections do not).
   - Cross-references inside text use `[[kind:id]]` or `[[kind:id|label]]`
     (`item:rope`, `card:devil`, `map:banquise`, `wheel:hell`, `hub:shop`,
     `system:hell`). Unknown refs are surfaced by `assertContentIntegrity()` in
     `src/wiki/registry.ts`.
   - Prices, descriptions, board graphs, wheel weights and rule constants are
     **imported live** from `src/game/catalog.ts`, `src/game/types.ts` and
     `src/game/maps/` — they update themselves when the engine changes; do not
     duplicate them in wiki text unless explaining the behavior behind them.
2. **The changelog page** ("Journal des modifications", in-game menu):
   - `src/ui/home/changelog-data.ts` — add a `ChangelogEntry` for the new
     version (or extend the current one): `version`, ISO `date`, `title`, and
     player-facing `highlights` covering every new element, removal and balance
     change. The wiki stats chip reads the game version; the changelog prose is
     hand-written, so it never updates itself.

Also worth touching with the same change, when relevant: `src/game/patch-notes
.test.ts` (pinning new prices/rules), the in-game help modal
(`src/ui/modals/help-modal.tsx`, "Comment jouer"), and `docs/Updates Red Cups-
*.docx` (design source notes).

### Verification before finishing

- `bun x tsc -p tsconfig.json --noEmit`
- `bun run test`
- `bun run format:check`
- `bun run build` (builds both the game and `wiki.html`)
- If wiki content changed, load `wiki.html` (dev: `/wiki.html`) and check the
  affected pages plus the `#/matrix` filter.

## Wiki access

The wiki is a second entry of the same Vite build (`wiki.html`), linked from the
main menu button « Wiki du jeu » (opens in a new tab at
`${import.meta.env.BASE_URL}wiki.html`). No password: it is a public reference.
GitHub Pages pre-prod: `/red-cups/wiki.html`; production: `/wiki.html`.
