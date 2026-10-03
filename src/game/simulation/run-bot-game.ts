import { applyRemoteAction, getUserIdOfPlayer } from "../../net/room-protocol";
import { getActionActorIds } from "../action-permissions";
import { PASSIVE_ORDER } from "../catalog";
import { MAP_ORDER } from "../maps/map-registry";
import { getEnergyCapacity } from "../energy";
import { runWithSeededSource } from "../engine-random";
import { assignGuardian } from "../guardian";
import { getStartingCurrency } from "../passive-rules";
import { reduceGame, type GameAction } from "../game-actions";
import { pickGameState } from "../game-save";
import { setActionRelay, useGameStore } from "../store";
import { getClockDeadline } from "../turn-clock";
import type { GameState, MapId, PassiveId, Player, TurnStage, WinReason } from "../types";
import { EMPTY_GAME_STATE } from "../types";
import { createSeededRandom } from "../../utils/seeded-random";
import { chooseBotAction } from "./bot-player";
import { checkClockExpiry } from "./clock-invariants";
import { violation } from "./invariant-helpers";
import { countMapEvents } from "./map-events";
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
  /**
   * Plays as an online table, on the clock: every action must be one a seat
   * may send, and a second device replays it from the wire, its board going
   * through JSON like the room's snapshots, and must land on the same board.
   */
  online?: boolean;
  /** Opens on the passive draft, as every game the table plays. */
  draft?: boolean;
  maxSteps?: number;
  /** Called after every action that changed the board, to replay a failing seed step by step. */
  trace?: (step: number, label: string, before: GameState, after: GameState) => void;
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
  /** What the map's own mechanics did (see `countMapEvents`). */
  eventCounts: Record<string, number>;
  /** The passives at the table once play began, after the draft if any. */
  passives: PassiveId[];
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

/** Compares two boards key by key, whatever order their keys were written in. */
function toStableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([left], [right]) => left.localeCompare(right)))
      : inner,
  );
}

function cloneThroughJson(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
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
    eventCounts: {},
    passives: [],
  };
  const clock = options.clock === true || options.online === true;

  const record = (found: RuleViolation[], step: number, action: string, stage: TurnStage) => {
    for (const item of found) {
      if (report.violations.length >= MAX_VIOLATIONS_PER_GAME) return;
      report.violations.push({ ...item, seed: options.seed, step, action, stage });
    }
  };

  const store = useGameStore;
  // Clock games run every action through the online path, at the time on the virtual clock.
  let clockNow = 0;
  const seatOrder = Array.from({ length: options.playerCount }, (_, index) => `device-${index + 1}`);
  let secondDevice: { state: GameState; version: number } | null = null;
  const onlineIssues: RuleViolation[] = [];

  /** The action as a room sends it: from a seat allowed to, replayed by another device on its own board. */
  const sendOnline = (state: GameState, nextState: GameState, action: GameAction) => {
    const senderId = getActionActorIds(state, action)[0];
    const userId = senderId ? getUserIdOfPlayer(seatOrder, senderId) : null;
    if (!userId) {
      onlineIssues.push(violation("online-sender", `no seat may send ${action.type} at stage ${state.turnStage}`));
      return;
    }
    const device = secondDevice ?? { state: cloneThroughJson(state), version: 0 };
    const wire = { kind: "action" as const, action, fromVersion: device.version, senderId: userId, issuedAt: clockNow };
    const outcome = applyRemoteAction(device.state, device.version, seatOrder, wire);
    const issuesBefore = onlineIssues.length;
    if (outcome.kind !== "applied") {
      onlineIssues.push(violation("online-replay", `the second device could not replay ${action.type}`));
    } else if (toStableJson(outcome.state) !== toStableJson(nextState)) {
      onlineIssues.push(violation("online-divergence", `the second device drifted after ${action.type}`));
    }
    // A drifted device reloads the snapshot, like the room makes it do.
    const replayed = outcome.kind === "applied" && onlineIssues.length === issuesBefore ? outcome.state : nextState;
    secondDevice = { state: cloneThroughJson(replayed), version: device.version + 1 };
  };
  const relay = (action: GameAction) => {
    const state = pickGameState(store.getState());
    const nextState = reduceGame(state, action, { now: clockNow });
    if (nextState === state) return;
    if (options.online) sendOnline(state, nextState, action);
    store.setState(nextState);
  };
  try {
    store.getState().resetGame();
    if (clock) setActionRelay(relay);
    const botNames = Array.from({ length: options.playerCount }, (_, index) => `Bot ${index + 1}`);
    if (options.online) {
      // Like the room's kickoff: the first board is built at the server's time, the draft's clock running.
      const startAction: GameAction = {
        type: "startGame",
        playerNames: botNames,
        seed: options.seed,
        mapId,
        ...(options.draft ? { draft: true } : {}),
      };
      store.getState().adoptGame(reduceGame(EMPTY_GAME_STATE, startAction, { now: clockNow }));
    } else {
      store.getState().startGame(botNames, options.seed, mapId, options.draft);
    }
    if (options.passives) {
      // The first turn's gauge follows the passive too (Red Bull).
      store.setState((state) => {
        const players = assignPassives(state.players, options.passives!);
        return { players, energyLeft: getEnergyCapacity(players[state.activePlayerIndex]) };
      });
      // A forced Ange-Gardien draws a protégé among the passives now at the table, from the game's own
      // seed: the campaign must replay exactly.
      store.setState((current) => {
        const state = pickGameState(current);
        if (!state.seededRandom) return assignGuardian(state);
        const { result, seed } = runWithSeededSource(state.seededRandom, () => assignGuardian(state));
        return { ...result, seededRandom: seed };
      });
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
      if (before.phase !== "playing" && before.phase !== "draft") break;
      if (before.phase === "playing" && report.passives.length === 0) {
        report.passives = before.players.map((player) => player.passiveId);
      }

      increment(report.stageCounts, before.turnStage);
      const deadline = clock ? getClockDeadline(before) : null;
      if (deadline !== null && botRandom() < IDLE_CHANCE) {
        // Asleep at the table: the clock runs out and the default applies.
        clockNow = Math.max(clockNow, deadline);
        increment(report.actionCounts, "expire-clock");
        relay({ type: "expireClock" });
        const after = store.getState();
        report.steps = step + 1;
        record(onlineIssues.splice(0), step, "expire-clock", before.turnStage);
        countMapEvents(before, after, "expire-clock", report.eventCounts);
        options.trace?.(step, "expire-clock", before, after);
        // Several defaults in one action: judged by the clock checks, the state checks follow next step.
        if (after !== before) record(checkClockExpiry(before, after), step, "expire-clock", before.turnStage);
        continue;
      }
      // Only clock games draw a thinking time: the other campaigns keep their seeded games.
      if (clock) clockNow += Math.floor(botRandom() * MAX_THINKING_MS);
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
      record(onlineIssues.splice(0), step, action.label, before.turnStage);

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
      countMapEvents(before, after, action.label, report.eventCounts);
      options.trace?.(step, action.label, before, after);
    }

    const final = store.getState();
    report.finished = final.phase === "finished";
    report.winReason = final.winReason;
    report.rounds = final.round;
  } finally {
    if (clock) setActionRelay(null);
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
      // From the seed, so a campaign played in batches meets the same tables.
      playerCount: minPlayers + ((firstSeed + index - 1) % span),
      maxSteps: options.maxSteps,
    }),
  );
}

/** A table of a mixed campaign: everything a set of tables can be, varied from one game to the next. */
export type TableSetup = Pick<BotGameOptions, "playerCount" | "passives" | "startingCurrency" | "online" | "draft">;

/**
 * Game `index` of a mixed campaign. Over a few hundred games every passive
 * sits at every table size, in local and in online play; a quarter of the
 * tables go through the draft (which deals the passives itself), and now and
 * then a table starts broke (Tour de Bénédiction) or rich (Cupide's goal).
 */
export function getTableSetup(index: number): TableSetup {
  const playerCount = 2 + (index % 7);
  const draft = index % 4 === 3;
  const first = PASSIVE_ORDER[index % PASSIVE_ORDER.length];
  const second = PASSIVE_ORDER[(index * 7 + 3) % PASSIVE_ORDER.length];
  const passives = draft ? undefined : first === second ? [first] : [first, second];
  const startingCurrency = index % 10 === 5 ? 0 : index % 10 === 9 ? 4_500 : undefined;
  return { playerCount, passives, startingCurrency, online: index % 3 === 1, draft };
}

export interface MapCampaignOptions {
  mapId: MapId;
  games: number;
  firstSeed?: number;
  maxSteps?: number;
}

/** Every kind of table (see `getTableSetup`) on a single map, each game on its own seed. */
export function runMapCampaign(options: MapCampaignOptions): BotGameReport[] {
  const firstSeed = options.firstSeed ?? 1;
  return Array.from({ length: options.games }, (_, index) =>
    runBotGame({
      seed: firstSeed + index,
      mapId: options.mapId,
      maxSteps: options.maxSteps,
      ...getTableSetup(firstSeed + index),
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

export function mergeCounts(
  reports: BotGameReport[],
  key: "actionCounts" | "stageCounts" | "eventCounts",
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const report of reports) {
    for (const [name, count] of Object.entries(report[key])) merged[name] = (merged[name] ?? 0) + count;
  }
  return merged;
}
