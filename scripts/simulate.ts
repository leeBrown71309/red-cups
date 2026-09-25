/**
 * Plays many bot games and prints a rule-violation report.
 * Usage: bun run simulate -- --games 500 --seed 1 --min 2 --max 8
 */
import { mergeCounts, runBotCampaign, summarizeViolations } from "../src/game/simulation/run-bot-game";

function readArgument(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
  return Number.isFinite(value) ? value : fallback;
}

const games = readArgument("games", 300);
const startedAt = performance.now();
const reports = runBotCampaign({
  games,
  firstSeed: readArgument("seed", 1),
  minPlayers: readArgument("min", 2),
  maxPlayers: readArgument("max", 8),
  maxSteps: readArgument("steps", 4_000),
});
const elapsed = ((performance.now() - startedAt) / 1_000).toFixed(1);

const finished = reports.filter((report) => report.finished);
const blocked = reports.filter((report) => report.blocked);
const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

console.log(`\n${games} parties jouées en ${elapsed}s`);
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

process.exitCode = violations.length > 0 || blocked.length > 0 ? 1 : 0;
