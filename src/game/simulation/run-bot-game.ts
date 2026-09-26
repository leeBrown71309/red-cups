import { PASSIVE_ORDER } from "../catalog";
import { useGameStore } from "../store";
import type { PassiveId, Player, TurnStage } from "../types";
import { createSeededRandom } from "../../utils/seeded-random";
import { chooseBotAction } from "./bot-player";
import { checkState, checkTransition, type RuleViolation } from "./rule-invariants";

/**
 * Plays complete games with bots on the real store and records every rule
 * violation. The engine's Math.random is seeded, so any failure can be
 * replayed exactly from its seed.
 */

export interface BotGameOptions {
  seed: number;
  playerCount: number;
  /** Forces passives on the first seats, e.g. to stress one passive. */
  passives?: PassiveId[];
  /** Overrides everybody's starting coins, e.g. 0 to open with a Tour de Bénédiction. */
  startingCurrency?: number;
  maxSteps?: number;
}

export interface SeededViolation extends RuleViolation {
  seed: number;
  step: number;
  action: string;
  stage: TurnStage;
}

export interface BotGameReport {
  seed: number;
  playerCount: number;
  steps: number;
  rounds: number;
  finished: boolean;
  blocked: boolean;
  violations: SeededViolation[];
  actionCounts: Record<string, number>;
  stageCounts: Record<string, number>;
}

const DEFAULT_MAX_STEPS = 4_000;
/** Consecutive actions that change nothing before the game is declared blocked. */
const MAX_IDLE_ACTIONS = 25;
/** Violations are capped per game: one engine bug usually repeats on every step. */
const MAX_VIOLATIONS_PER_GAME = 20;

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

/** Puts the forced passives on the first seats and keeps every passive unique. */
function assignPassives(players: Player[], forced: PassiveId[]): Player[] {
  const used = new Set<PassiveId>(forced);
  return players.map((player, index) => {
    const forcedPassive = forced[index];
    if (forcedPassive) return { ...player, passiveId: forcedPassive };
    const passiveId = used.has(player.passiveId)
      ? (PASSIVE_ORDER.find((candidate) => !used.has(candidate)) ?? player.passiveId)
      : player.passiveId;
    used.add(passiveId);
    return { ...player, passiveId };
  });
}

export function runBotGame(options: BotGameOptions): BotGameReport {
  const originalRandom = Math.random;
  const engineRandom = createSeededRandom(options.seed);
  const botRandom = createSeededRandom(options.seed * 7_919 + 17);
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const report: BotGameReport = {
    seed: options.seed,
    playerCount: options.playerCount,
    steps: 0,
    rounds: 0,
    finished: false,
    blocked: false,
    violations: [],
    actionCounts: {},
    stageCounts: {},
  };

  const record = (found: RuleViolation[], step: number, action: string, stage: TurnStage) => {
    for (const item of found) {
      if (report.violations.length >= MAX_VIOLATIONS_PER_GAME) return;
      report.violations.push({ ...item, seed: options.seed, step, action, stage });
    }
  };

  Math.random = engineRandom;
  try {
    const store = useGameStore;
    store.getState().resetGame();
    store.getState().startGame(Array.from({ length: options.playerCount }, (_, index) => `Bot ${index + 1}`));
    if (options.passives) store.setState((state) => ({ players: assignPassives(state.players, options.passives!) }));
    const { startingCurrency } = options;
    if (startingCurrency !== undefined) {
      store.setState((state) => ({
        players: state.players.map((player) => ({ ...player, currency: startingCurrency })),
      }));
    }

    let idle = 0;
    for (let step = 0; step < maxSteps; step += 1) {
      const before = store.getState();
      record(checkState(before), step, "state", before.turnStage);
      if (before.phase !== "playing") break;

      increment(report.stageCounts, before.turnStage);
      const action = chooseBotAction(before, botRandom);
      if (!action) {
        report.blocked = true;
        record(
          [{ rule: "no-way-forward", message: `no legal action in stage ${before.turnStage}` }],
          step,
          "none",
          before.turnStage,
        );
        break;
      }

      increment(report.actionCounts, action.label);
      action.perform(before);
      const after = store.getState();
      report.steps = step + 1;

      if (after === before) {
        idle += 1;
        if (idle >= MAX_IDLE_ACTIONS) {
          report.blocked = true;
          record(
            [{ rule: "action-refused", message: `"${action.label}" keeps being refused` }],
            step,
            action.label,
            before.turnStage,
          );
          break;
        }
        continue;
      }
      idle = 0;
      record(checkTransition(before, after, action.item), step, action.label, before.turnStage);
    }

    const final = store.getState();
    report.finished = final.phase === "finished";
    report.rounds = final.round;
    store.getState().resetGame();
  } finally {
    Math.random = originalRandom;
  }

  return report;
}

export interface CampaignOptions {
  games: number;
  firstSeed?: number;
  minPlayers?: number;
  maxPlayers?: number;
  maxSteps?: number;
}

/** Many games with varied table sizes, each on its own seed. */
export function runBotCampaign(options: CampaignOptions): BotGameReport[] {
  const firstSeed = options.firstSeed ?? 1;
  const minPlayers = options.minPlayers ?? 2;
  const maxPlayers = options.maxPlayers ?? 8;
  const span = maxPlayers - minPlayers + 1;
  return Array.from({ length: options.games }, (_, index) =>
    runBotGame({
      seed: firstSeed + index,
      playerCount: minPlayers + (index % span),
      maxSteps: options.maxSteps,
    }),
  );
}

/** Groups violations by rule with one example each, for readable test failures. */
export function summarizeViolations(reports: BotGameReport[]): string[] {
  const byRule = new Map<string, { count: number; example: SeededViolation }>();
  for (const found of reports.flatMap((report) => report.violations)) {
    const entry = byRule.get(found.rule);
    if (entry) entry.count += 1;
    else byRule.set(found.rule, { count: 1, example: found });
  }
  return [...byRule.entries()].map(
    ([rule, { count, example }]) =>
      `${rule} ×${count} — ${example.message} (seed ${example.seed}, step ${example.step}, ` +
      `stage ${example.stage}, action ${example.action})`,
  );
}

export function mergeCounts(reports: BotGameReport[], key: "actionCounts" | "stageCounts"): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const report of reports) {
    for (const [name, count] of Object.entries(report[key])) merged[name] = (merged[name] ?? 0) + count;
  }
  return merged;
}
