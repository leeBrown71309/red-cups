import { beforeAll, describe, expect, it } from "vitest";
import { ITEM_ORDER, PASSIVE_ORDER, WHEEL_RESULTS } from "../catalog";
import type { TurnStage } from "../types";
import { mergeCounts, runBotCampaign, runBotGame, summarizeViolations, type BotGameReport } from "./run-bot-game";

/**
 * Bots play hundreds of complete, seeded games on the real engine. Any rule
 * broken along the way is reported with the seed and step to replay it.
 */

const CAMPAIGN_SIZE = 400;
const GAMES_PER_PASSIVE = 30;
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

    expect(["coin-flip", "rock-paper-scissors", "player-vote"].filter((mode) => !actions[`duel:${mode}`])).toEqual([]);
    expect(actions.abandon).toBeGreaterThan(0);

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
      "passive-choice",
    ];
    expect(expectedStages.filter((stage) => !stages[stage])).toEqual([]);
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
