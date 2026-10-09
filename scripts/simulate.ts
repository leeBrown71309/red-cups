/**
 * Plays many bot games and prints a rule-violation report.
 * Usage: bun run simulate -- --games 500 --seed 1 --min 2 --max 8
 *
 * With `--map classic` (or `luna-park`, `banquise`), every game is played on
 * that map, at every kind of table: all passives in turn, local and online,
 * with and without the draft. The report then lists anything the campaign
 * never played, items, wheels, stages or the map's own mechanics.
 */
import { MAP_ORDER } from "../src/game/maps/map-registry";
import type { MapId } from "../src/game/types";
import { findCoverageGaps } from "../src/game/simulation/coverage";
import { mergeCounts, runBotCampaign, runMapCampaign, summarizeViolations } from "../src/game/simulation/run-bot-game";

function readArgument(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
  return Number.isFinite(value) ? value : fallback;
}

function readMap(): MapId | null {
  const index = process.argv.indexOf("--map");
  if (index < 0) return null;
  const mapId = process.argv[index + 1] as MapId;
  if (!MAP_ORDER.includes(mapId)) {
    console.error(`Carte inconnue : ${mapId} (cartes : ${MAP_ORDER.join(", ")})`);
    process.exit(2);
  }
  return mapId;
}

const games = readArgument("games", 300);
const firstSeed = readArgument("seed", 1);
const maxSteps = process.argv.includes("--steps") ? readArgument("steps", 4_000) : undefined;
const mapId = readMap();
const startedAt = performance.now();
const reports = mapId
  ? runMapCampaign({ mapId, games, firstSeed, maxSteps })
  : runBotCampaign({
      games,
      firstSeed,
      minPlayers: readArgument("min", 2),
      maxPlayers: readArgument("max", 8),
      maxSteps,
    });
const elapsed = ((performance.now() - startedAt) / 1_000).toFixed(1);

const finished = reports.filter((report) => report.finished);
const blocked = reports.filter((report) => report.blocked);
const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

console.log(`\n${games} parties jouées en ${elapsed}s${mapId ? ` sur la carte ${mapId}` : ""}`);
console.log(`Terminées : ${finished.length}/${games} · bloquées : ${blocked.length}`);
console.log(`Tours de table moyens (parties terminées) : ${average(finished.map((r) => r.rounds)).toFixed(1)}`);
console.log(`Actions moyennes par partie : ${average(reports.map((r) => r.steps)).toFixed(0)}`);

const violations = summarizeViolations(reports);
console.log(`\nViolations de règles : ${violations.length === 0 ? "aucune" : ""}`);
for (const line of violations) console.log(`  • ${line}`);

const actions = Object.entries(mergeCounts(reports, "actionCounts")).sort((a, b) => b[1] - a[1]);
console.log("\nCouverture des actions :");
console.log(actions.map(([name, count]) => `${name}=${count}`).join("  "));
const stages = Object.entries(mergeCounts(reports, "stageCounts")).sort((a, b) => b[1] - a[1]);
console.log("\nÉtapes visitées :");
console.log(stages.map(([name, count]) => `${name}=${count}`).join("  "));
const events = Object.entries(mergeCounts(reports, "eventCounts")).sort((a, b) => b[1] - a[1]);
console.log("\nMécaniques des cartes :");
console.log(events.map(([name, count]) => `${name}=${count}`).join("  "));

const gaps = mapId ? findCoverageGaps(reports, mapId) : [];
if (mapId) console.log(`\nJamais joué : ${gaps.length === 0 ? "rien" : gaps.join(", ")}`);

process.exitCode = violations.length > 0 || blocked.length > 0 || gaps.length > 0 ? 1 : 0;
