import { beforeAll, describe, expect, it } from "vitest";
import { ITEM_ORDER, PASSIVE_ORDER, WHEEL_RESULTS } from "../catalog";
import { MAP_ORDER } from "../maps/map-registry";
import type { MapId, TurnStage } from "../types";
import { findCoverageGaps } from "./coverage";
import {
  mergeCounts,
  runBotCampaign,
  runBotGame,
  runMapCampaign,
  summarizeViolations,
  type BotGameReport,
} from "./run-bot-game";

/**
 * Bots play hundreds of complete, seeded games on the real engine. Any rule
 * broken along the way is reported with the seed and step to replay it.
 */

const CAMPAIGN_SIZE = 400;
const GAMES_PER_PASSIVE = 30;
/** Enough tables on one map for every passive, item, wheel and mechanic of the map to come up. */
const GAMES_PER_MAP = 300;
/** Games of a map campaign played a second time, which must come out the same. */
const REPLAYED_GAMES = 12;

/** Hundreds of full games take a few seconds; slow CI machines get headroom. */
const CAMPAIGN_TIMEOUT_MS = 120_000;

describe("bot campaign", () => {
  let campaign: BotGameReport[] = [];
  beforeAll(() => {
    campaign = runBotCampaign({ games: CAMPAIGN_SIZE, firstSeed: 1 });
  }, CAMPAIGN_TIMEOUT_MS);

  it("never breaks a rule across hundreds of games", () => {
    expect(summarizeViolations(campaign)).toEqual([]);
  });

  it("never gets stuck without a legal action", () => {
    expect(campaign.filter((report) => report.blocked).map((report) => report.seed)).toEqual([]);
  });

  it("ends games with a winner", () => {
    const finished = campaign.filter((report) => report.finished).length;
    expect(finished / CAMPAIGN_SIZE).toBeGreaterThanOrEqual(0.99);
  });

  it("exercises every item, wheel outcome, duel mode and turn stage", () => {
    const actions = mergeCounts(campaign, "actionCounts");
    const stages = mergeCounts(campaign, "stageCounts");

    const unusedItems = ITEM_ORDER.filter(
      (itemId) => !actions[`use:${itemId}`] && !actions[`buy:${itemId}`] && itemId !== "helmet",
    );
    expect(unusedItems).toEqual([]);

    const outcomes = new Set(Object.values(WHEEL_RESULTS).flatMap((results) => results.map((result) => result.id)));
    expect([...outcomes].filter((outcome) => !actions[`wheel:${outcome}`])).toEqual([]);

    const modes = ["coin-flip", "rock-paper-scissors", "player-vote", "blackjack"];
    expect(modes.filter((mode) => !actions[`duel:${mode}`])).toEqual([]);
    expect(actions.abandon).toBeGreaterThan(0);
    // The Voleur's tries, caught or not; le diable leaving Hell; L'Ange-Gardien freeing their protégé.
    expect(Object.keys(actions).some((label) => label.startsWith("steal:"))).toBe(true);
    expect(actions["leave-hell"]).toBeGreaterThan(0);
    expect(actions["rescue-protege"]).toBeGreaterThan(0);

    const expectedStages: TurnStage[] = [
      "move",
      "reaction",
      "shop",
      "tile-wheel",
      "turn-end",
      "hell",
      "wheel-result",
      "duel",
      "discard",
      "target",
      "reposition",
      "advance",
      "passive-choice",
      "gamble",
      "arm-wrestle",
    ];
    expect(expectedStages.filter((stage) => !stages[stage])).toEqual([]);
  });
});

/**
 * Each map on its own, at every kind of table (see `getTableSetup`): all the
 * passives in turn, local and online play (where a second device replays
 * every action from the wire), with and without the draft. A feature that
 * forgets a map's mechanic breaks that map's campaign.
 */
describe.each<MapId>(MAP_ORDER)("mixed tables on %s", (mapId) => {
  let reports: BotGameReport[] = [];
  beforeAll(() => {
    reports = runMapCampaign({ mapId, games: GAMES_PER_MAP, firstSeed: 60_000 });
  }, CAMPAIGN_TIMEOUT_MS);

  it("never breaks a rule, locally or online", () => {
    expect(summarizeViolations(reports)).toEqual([]);
  });

  it("never gets stuck and ends its games", () => {
    expect(reports.filter((report) => report.blocked).map((report) => report.seed)).toEqual([]);
    expect(reports.filter((report) => report.finished).length / GAMES_PER_MAP).toBeGreaterThanOrEqual(0.99);
  });

  it("plays every item, wheel, stage and passive, and the map's own mechanics", () => {
    expect(findCoverageGaps(reports, mapId)).toEqual([]);
  });

  it("replays a seed exactly, so any failure can be traced back", () => {
    const replayed = runMapCampaign({ mapId, games: REPLAYED_GAMES, firstSeed: 60_000 });
    expect(replayed).toEqual(reports.slice(0, REPLAYED_GAMES));
  });
});

describe("broke table games", () => {
  it(
    "keeps the rules through Tours de Bénédiction",
    () => {
      const reports = Array.from({ length: GAMES_PER_PASSIVE }, (_, index) =>
        runBotGame({ seed: 20_000 + index, playerCount: 2 + (index % 7), startingCurrency: 0 }),
      );
      expect(summarizeViolations(reports)).toEqual([]);
      expect(reports.filter((report) => report.blocked)).toHaveLength(0);
      expect(mergeCounts(reports, "stageCounts").blessing).toBeGreaterThan(0);
    },
    CAMPAIGN_TIMEOUT_MS,
  );
});

describe("rich table games", () => {
  it(
    "keeps the rules when Cupide reaches its goal",
    () => {
      const reports = Array.from({ length: GAMES_PER_PASSIVE }, (_, index) =>
        runBotGame({
          seed: 30_000 + index,
          playerCount: 2 + (index % 7),
          passives: ["greedy"],
          startingCurrency: 4_500,
        }),
      );
      expect(summarizeViolations(reports)).toEqual([]);
      expect(reports.filter((report) => report.blocked)).toHaveLength(0);
      expect(reports.filter((report) => report.winReason === "greedy").length).toBeGreaterThan(0);
    },
    CAMPAIGN_TIMEOUT_MS,
  );
});

describe("draft games", () => {
  it(
    "deals and closes the passive draft, then keeps the rules",
    () => {
      const reports = Array.from({ length: GAMES_PER_PASSIVE }, (_, index) =>
        runBotGame({ seed: 50_000 + index, playerCount: 2 + (index % 7), draft: true }),
      );
      expect(summarizeViolations(reports)).toEqual([]);
      expect(reports.filter((report) => report.blocked)).toHaveLength(0);
      expect(mergeCounts(reports, "actionCounts")["draft:pick"]).toBeGreaterThan(0);
    },
    CAMPAIGN_TIMEOUT_MS,
  );
});

describe("online clock games", () => {
  it(
    "keeps the rules when clocks run out at every kind of decision",
    () => {
      const reports = Array.from({ length: GAMES_PER_PASSIVE * 2 }, (_, index) =>
        runBotGame({ seed: 40_000 + index, playerCount: 2 + (index % 7), clock: true, draft: index % 2 === 0 }),
      );
      expect(summarizeViolations(reports)).toEqual([]);
      expect(reports.filter((report) => report.blocked)).toHaveLength(0);
      expect(mergeCounts(reports, "actionCounts")["expire-clock"]).toBeGreaterThan(0);
    },
    CAMPAIGN_TIMEOUT_MS,
  );
});

describe("passive stress games", () => {
  it.each(PASSIVE_ORDER)(
    "keeps the rules with %s at the table",
    (passiveId) => {
      const reports = Array.from({ length: GAMES_PER_PASSIVE }, (_, index) =>
        runBotGame({ seed: 10_000 + index, playerCount: 2 + (index % 7), passives: [passiveId] }),
      );
      expect(summarizeViolations(reports)).toEqual([]);
      expect(reports.filter((report) => report.blocked)).toHaveLength(0);
    },
    CAMPAIGN_TIMEOUT_MS,
  );
});
