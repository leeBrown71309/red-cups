import { beforeAll, describe, expect, it } from "vitest";
import type { MapId } from "../types";
import { findCoverageGaps } from "./coverage";
import { runMapCampaign, summarizeViolations, type BotGameReport } from "./run-bot-game";

/**
 * Test helpers for the bot campaigns. Each map's campaign lives in its own
 * test file, so Vitest spreads them over its workers instead of keeping one
 * busy for minutes.
 */

/** Hundreds of full games take a few seconds; slow CI machines get headroom. */
export const CAMPAIGN_TIMEOUT_MS = 300_000;
/** Enough tables on one map for every passive, item, wheel and mechanic of the map to come up. */
const GAMES_PER_MAP = 300;
/** Games of a map campaign played a second time, which must come out the same. */
const REPLAYED_GAMES = 12;
/** Games played in one go before the test worker gets the hand back. */
const BATCH_SIZE = 5;

/**
 * Plays a long campaign in batches, giving the event loop back between them:
 * a worker busy for minutes misses Vitest's calls and fails the run.
 */
export async function runInBatches(
  games: number,
  play: (games: number, firstSeed: number) => BotGameReport[],
  firstSeed: number,
): Promise<BotGameReport[]> {
  const reports: BotGameReport[] = [];
  for (let done = 0; done < games; done += BATCH_SIZE) {
    reports.push(...play(Math.min(BATCH_SIZE, games - done), firstSeed + done));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return reports;
}

/**
 * One map on its own, at every kind of table (see `getTableSetup`): all the
 * passives in turn, local and online play (where a second device replays
 * every action from the wire), with and without the draft. A feature that
 * forgets a map's mechanic breaks that map's campaign.
 */
export function describeMapCampaign(mapId: MapId): void {
  describe(`mixed tables on ${mapId}`, () => {
    let reports: BotGameReport[] = [];
    beforeAll(async () => {
      reports = await runInBatches(
        GAMES_PER_MAP,
        (games, firstSeed) => runMapCampaign({ mapId, games, firstSeed }),
        60_000,
      );
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

    it(
      "replays a seed exactly, so any failure can be traced back",
      () => {
        const replayed = runMapCampaign({ mapId, games: REPLAYED_GAMES, firstSeed: 60_000 });
        expect(replayed).toEqual(reports.slice(0, REPLAYED_GAMES));
      },
      CAMPAIGN_TIMEOUT_MS,
    );
  });
}
