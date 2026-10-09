# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Red Cups is a chaotic board game for 2 to 8 players, as a web app (React 19, Three.js board, Zustand, Supabase for the online mode). Code is in English; everything the player reads is in French. `AGENTS.md` holds the mandatory sync rule below, `README.md` the product overview, `red-cups-game-spec.md` the rules and the "choix à valider" sections (13, 13 bis, 13 ter, 13 quater).

## Commands

Bun is the package manager and script runner.

```sh
bun run dev                              # Vite dev server (the game, plus /wiki.html)
bun x tsc -p tsconfig.json --noEmit      # typecheck (the build runs it too)
bun run test                             # vitest run: unit tests and the bot campaigns (several minutes)
bun x vitest run src/game/patch-notes.test.ts          # one test file
bun x vitest run src/game/new-cards.test.ts -t "Main verte"   # one test by name
bun run format:check                     # prettier --check (bun run format to fix)
bun run build                            # tsc --noEmit && vite build (game + wiki.html)
bun run simulate -- --games 300 --seed 7                 # bot games, rule-violation report
bun run simulate -- --map banquise --games 150 --seed 11 # one map: every card, local and online
```

Before finishing a change: tsc, `bun run test`, `bun run format:check`, `bun run build` (see `AGENTS.md`). Prettier on Windows checkouts needs `--end-of-line auto` (`bun x prettier --write --end-of-line auto src`).

## Mandatory sync (from AGENTS.md)

Any change to a game element (item, actif/passif card, map, wheel wedge, shop/duel/hell/cup/money rule) must also update, in the same change:
- the wiki: `src/wiki/content/interactions.ts` (one line per element pair whose behaviour changed) and the detail files `items.ts`, `cards.ts`, `maps.ts`, `wheels.ts`, `hubs.ts`, `systems.ts`. Prices, descriptions and constants are imported live from `src/game/catalog.ts` / `types.ts`, so do not duplicate them. Cross-refs are `[[kind:id]]`; `assertContentIntegrity()` in `src/wiki/registry.ts` reports unknown ones.
- the changelog: `src/ui/home/changelog-data.ts` (hand-written, player-facing).
- when relevant: `src/game/patch-notes.test.ts`, the help modal, the spec.

## Architecture

**The engine is a pure reducer shared by every device.** `src/game/game-actions.ts` defines `GameAction` and `reduceGame(state, action, { now })`. State is one `GameState` (`types.ts`, `EMPTY_GAME_STATE`). An action goes through `applyGameAction` → `dispatchGameAction`, then a fixed post-processing chain (ice sliding, Hell rewards, forfeits, benched turns, queued wheels, victory, Double-or-nothing offers, clocks). A refused action must return the very same state object. Rules live in many small modules around it (`game-effects.ts`, `turn-actions.ts`, `rules.ts`, `passive-rules.ts`, `shopping.ts`, `ice.ts`, `bullet-bill.ts`, `devil.ts`, `gamble.ts`, `kick.ts`, `late-join.ts`…).

**Online play has no game server.** `src/game/store.ts` (Zustand) sends actions through `setActionRelay` when a room is attached, otherwise applies them with `applyLocally`. Online, every device replays the same actions from the same stored seed: `reduceGame` runs the action inside `runWithSeededSource` (`engine-random.ts`), so all randomness and ids must come from `drawEngineRandom()` / `createEngineId()`, never `Math.random()` or `crypto.randomUUID()` directly inside the engine. `action-permissions.ts` (`getActionActorIds`) says which seat may send each action; every device refuses the rest, so a new action needs an entry there, an entry in `clock-defaults.ts` (what happens when the online clock runs out), and a store method. `src/net/` (room-store, room-protocol, room-api, Supabase client) carries the actions; `supabase/schema.sql` is idempotent and must be replayed on the database when it changes.

**Saves and snapshots.** `game-save.ts` (`GAME_SAVE_VERSION`, `upgradeSave`, `pickGameState`) persists state. Adding a field to `GameState` means: `EMPTY_GAME_STATE`, the upgrade defaults, and the key list in `game-save.test.ts`.

**Presentation is derived from state diffs, not from the reducer.** `src/feedback/game-feedback.ts` subscribes to the store, compares state and previous state, and emits `FeedbackEvent`s on `event-bus.ts`; the 3D scene (`src/scene/`, `board-world.ts`), audio (`src/audio/`) and HUD toasts/banners react to them. `ui-store.ts` holds presentation-only state (board-busy timers, the post-draft countdown). Modals wait for `useBoardSettled()` so they never open over a moving pawn. Visibility rules online (bags and actifs hidden from others, public vs secret journal text) are in `src/ui/visibility.ts`.

**Content is data-driven.** `catalog.ts` (items, cards, wheel wedges, prices), `cards.ts` (a player has an actif in `passiveId` and a passif in `passifId`; always test with `hasCard`), `maps/` (classic, luna-park, banquise, each with boards and mechanics). Wheels: `startWheel` draws results up front; Main verte/rouge keep `choices`, Touché angélique/Main du diable queue the second result in `queuedWheels`.

**Bot tests are the safety net.** `src/game/simulation/` plays hundreds of seeded games with bots (`bot-player.ts`) and checks rules after every action (`*-invariants.ts`). A rule change often needs the matching invariant updated, or the campaigns fail with a seed and step to replay (`runBotGame({ seed, mapId, trace })`). `getTableSetup` in `run-bot-game.ts` defines the table mix of a seed.

**Wiki and reporting are second and third Vite entries** (`wiki.html` in `src/wiki/`, `feedback.html` in `src/report/`), both linked from the main menu. `feedback.html` is the bugs-and-ideas page: visitors call `submit_report`, and the admin (an email+password Supabase account listed in `report_admins`) sorts the `reports` table from the same page. The admin's auth account is provisioned by the untracked local tool `scripts/create-admin.ts` (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; the project's SMTP cannot send confirmation emails, so sign-up is deliberately not offered on the page).

**Production plays online only.** `src/env.ts` (`localPlayAvailable`) hides the local game outside dev and the `/red-cups/` pre-prod preview — cards and bags cannot be hidden on one shared screen — and turns « Jouer en ligne » into the big cup button.

## Conventions worth knowing

- UI text is French and hard-coded (Lingui is not installed); identifiers and comments are English.
- Commit format `<type>(<scope>): message`, no AI attribution in commits, PRs or any Git artifact.
- Release flow: working branch `patch_<version>` → PR into `pre-prod` (GitHub Pages staging, `BASE_PATH=/red-cups/`) → PR `pre-prod` into `main` (VPS production). Never delete `pre-prod`. Only commit or push when asked.
