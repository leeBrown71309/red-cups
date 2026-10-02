import { PASSIVE_ORDER } from "../catalog";
import { MAP_ORDER } from "../maps/map-registry";
import { getEnergyCapacity } from "../energy";
import { assignGuardian } from "../guardian";
import { getStartingCurrency } from "../passive-rules";
import { reduceGame, type GameAction } from "../game-actions";
import { pickGameState } from "../game-save";
import { setActionRelay, useGameStore } from "../store";
import { getClockDeadline } from "../turn-clock";
import type { MapId, PassiveId, Player, TurnStage, WinReason } from "../types";
import { createSeededRandom } from "../../utils/seeded-random";
import { chooseBotAction } from "./bot-player";
import { checkClockExpiry } from "./clock-invariants";
import { checkState, checkTransition, type RuleViolation } from "./rule-invariants";

/**
 * Plays complete games with bots on the real store and records every rule
 * violation. Games start from a seed, like an online game, so any failure can
 * be replayed exactly from its seed and the seeded path is covered too.
 */

export interface BotGameOptions {
  seed: number;
  playerCount: number;
  /** Board to play on; by default the seed picks one, so campaigns cover every map. */
  mapId?: MapId;
  /** Forces passives on the first seats, e.g. to stress one passive. */
  passives?: PassiveId[];
  /** Overrides everybody's starting coins, e.g. 0 to open with a Tour de Bénédiction. */
  startingCurrency?: number;
  /**
   * Plays as online, on a virtual clock: every action carries its time, and
   * now and then a bot lets the clock run out instead of playing.
   */
  clock?: boolean;
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
  mapId: MapId;
  steps: number;
  rounds: number;
  finished: boolean;
  /** How the game was won, when it was. */
  winReason: WinReason | null;
  blocked: boolean;
  violations: SeededViolation[];
  actionCounts: Record<string, number>;
  stageCounts: Record<string, number>;
}

const DEFAULT_MAX_STEPS = 4_000;
/** Clock games: how often a bot lets the clock run out rather than play. */
const IDLE_CHANCE = 0.12;
/** Clock games: the most a bot thinks before an action. */
const MAX_THINKING_MS = 8_000;
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
    // The starting balance follows the passive (Nepo Baby, eShop).
    const forcedPassive = forced[index];
    if (forcedPassive) return { ...player, passiveId: forcedPassive, currency: getStartingCurrency(forcedPassive) };
    const passiveId = used.has(player.passiveId)
      ? (PASSIVE_ORDER.find((candidate) => !used.has(candidate)) ?? player.passiveId)
      : player.passiveId;
    used.add(passiveId);
    return { ...player, passiveId, currency: getStartingCurrency(passiveId) };
  });
}

/** Seeds alternate between the maps, so every campaign plays all of them. */
function mapForSeed(seed: number): MapId {
  return MAP_ORDER[Math.abs(seed) % MAP_ORDER.length];
}

export function runBotGame(options: BotGameOptions): BotGameReport {
  const botRandom = createSeededRandom(options.seed * 7_919 + 17);
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const mapId = options.mapId ?? mapForSeed(options.seed);
  const report: BotGameReport = {
    seed: options.seed,
    playerCount: options.playerCount,
    mapId,
    steps: 0,
    rounds: 0,
    finished: false,
    winReason: null,
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

  const store = useGameStore;
  // Clock games run every action through the online path, at the time on the virtual clock.
  let clockNow = 0;
  const relay = (action: GameAction) => {
    const state = pickGameState(store.getState());
    const nextState = reduceGame(state, action, { now: clockNow });
    if (nextState !== state) store.setState(nextState);
  };
  try {
    store.getState().resetGame();
    if (options.clock) setActionRelay(relay);
    const botNames = Array.from({ length: options.playerCount }, (_, index) => `Bot ${index + 1}`);
    store.getState().startGame(botNames, options.seed, mapId);
    if (options.passives) {
      // The first turn's gauge follows the passive too (Red Bull).
      store.setState((state) => {
        const players = assignPassives(state.players, options.passives!);
        return { players, energyLeft: getEnergyCapacity(players[state.activePlayerIndex]) };
      });
      // A forced Ange-Gardien draws a protégé among the passives now at the table.
      store.setState((state) => assignGuardian(state));
    }
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
      const deadline = options.clock ? getClockDeadline(before) : null;
      if (deadline !== null && botRandom() < IDLE_CHANCE) {
        // Asleep at the table: the clock runs out and the default applies.
        clockNow = Math.max(clockNow, deadline);
        increment(report.actionCounts, "expire-clock");
        relay({ type: "expireClock" });
        const after = store.getState();
        report.steps = step + 1;
        // Several defaults in one action: judged by the clock checks, the state checks follow next step.
        if (after !== before) record(checkClockExpiry(before, after), step, "expire-clock", before.turnStage);
        continue;
      }
      // Only clock games draw a thinking time: the other campaigns keep their seeded games.
      if (options.clock) clockNow += Math.floor(botRandom() * MAX_THINKING_MS);
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
    report.winReason = final.winReason;
    report.rounds = final.round;
  } finally {
    if (options.clock) setActionRelay(null);
    store.getState().resetGame();
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
