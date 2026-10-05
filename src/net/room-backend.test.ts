import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import type { GameAction } from "../game/game-actions";
import { pickGameState } from "../game/game-save";
import { chooseBotAction } from "../game/simulation/bot-player";
import { setActionRelay, useGameStore } from "../game/store";
import type { GameState } from "../game/types";
import { playBotsFrom } from "../game/simulation/play-bots";
import { createSeededRandom } from "../utils/seeded-random";
import { getOutcome, getWinnerName, parseHistoryGame, type HistoryGame } from "./history";
import { parseRoom, type RoomSnapshot } from "./room-api";
import { applyRemoteAction, buildOnlineGame, getPlayerIdOfUser, prepareLocalAction } from "./room-protocol";

/**
 * The real `supabase/schema.sql`, run in PGlite (Postgres inside the test
 * process) behind a stand-in for what Supabase provides: `auth.users`,
 * `auth.uid()` answering whoever the test says is calling, and the Realtime
 * messages table its channel policies are written against.
 */

const SCHEMA = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");

let db: PGlite;

async function as<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.query(`select set_config('request.uid', $1, false)`, [uid]);
  return (await db.query<T>(sql, params)).rows;
}

async function refusal(uid: string, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await as(uid, sql, params);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

let personCount = 0;
async function person(kind: "google" | "guest" = "guest"): Promise<string> {
  personCount += 1;
  const id = `00000000-0000-4000-8000-${String(personCount).padStart(12, "0")}`;
  await db.query(`insert into auth.users (id, is_anonymous) values ($1, $2)`, [id, kind === "guest"]);
  return id;
}

let roomCount = 0;
function nextCode(): string {
  roomCount += 1;
  return `ROOM${String(roomCount).padStart(2, "0")}`;
}

async function room(code: string, uid: string): Promise<RoomSnapshot | null> {
  const [row] = await as<{ r: Parameters<typeof parseRoom>[0] | null }>(uid, `select get_room($1) r`, [code]);
  return row?.r ? parseRoom(row.r) : null;
}

async function lobby(hostName: string, guestNames: string[]): Promise<{ code: string; ids: string[] }> {
  const code = nextCode();
  const host = await person();
  await as(host, `select create_room($1)`, [code]);
  await as(host, `select claim_seat($1, $2, 0::smallint)`, [code, hostName]);
  const ids = [host];
  for (const [index, name] of guestNames.entries()) {
    const guest = await person();
    await as(guest, `select claim_seat($1, $2, $3::smallint)`, [code, name, index + 1]);
    ids.push(guest);
  }
  return { code, ids };
}

async function kickoff(code: string, hostId: string, seed = 11): Promise<GameState> {
  const snapshot = await room(code, hostId);
  const { state, seatOrder } = buildOnlineGame(snapshot!.players, seed, "luna-park");
  await as(hostId, `select open_room($1, $2::jsonb, $3::jsonb)`, [
    code,
    JSON.stringify(state),
    JSON.stringify(seatOrder),
  ]);
  return state;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, is_anonymous boolean not null default false);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
    create schema realtime;
    create table realtime.messages (id serial primary key, topic text not null, extension text not null);
    create function realtime.topic() returns text language sql stable as
      $$ select nullif(current_setting('realtime.topic', true), '') $$;
    alter table realtime.messages enable row level security;
    grant usage on schema auth, realtime, public to authenticated;
    grant select, insert on realtime.messages to authenticated;
    grant usage on sequence realtime.messages_id_seq to authenticated;
  `);
  await db.exec(SCHEMA);
  // Running it twice proves the file is idempotent.
  await db.exec(SCHEMA);
}, 60_000);

describe("server clock", () => {
  it("tells every device the same time, in milliseconds", async () => {
    const before = Date.now();
    const [row] = await as<{ t: number }>(await person(), `select server_time() t`);
    expect(Math.abs(Number(row.t) - before)).toBeLessThan(60_000);
  });
});

describe("lobby", () => {
  it("seats players with their avatar and shows the roster to a newcomer", async () => {
    const { code, ids } = await lobby("Léa", ["Malik"]);
    const outsider = await person();
    const preview = await room(code, outsider);
    expect(preview?.isPlayer).toBe(false);
    expect(preview?.players.map((player) => [player.name, player.avatar])).toEqual([
      ["Léa", 0],
      ["Malik", 1],
    ]);
    expect((await room(code, ids[0]))?.isPlayer).toBe(true);
  });

  it("refuses an avatar somebody already took", async () => {
    const { code } = await lobby("Léa", []);
    const late = await person();
    expect(await refusal(late, `select claim_seat($1, 'Tom', 0::smallint)`, [code])).toMatch(/avatar vient/);
  });

  it("refuses a ninth player", async () => {
    const { code } = await lobby("A", ["B", "C", "D", "E", "F", "G", "H"]);
    const ninth = await person();
    expect(await refusal(ninth, `select claim_seat($1, 'I', 0::smallint)`, [code])).toMatch(/complet/);
  });

  it("closes the lobby when its host leaves", async () => {
    const { code, ids } = await lobby("Léa", ["Malik"]);
    await as(ids[0], `select leave_room($1)`, [code]);
    expect(await room(code, ids[1])).toBeNull();
  });
});

describe("shuffle_room", () => {
  it("is for the host only, and shows everybody the drawn order", async () => {
    const { code, ids } = await lobby("Léa", ["Malik", "Inès", "Tom"]);
    expect(await refusal(ids[1], `select shuffle_room($1)`, [code])).toMatch(/hôte peut mélanger/);

    await as(ids[0], `select shuffle_room($1)`, [code]);
    const hostView = await room(code, ids[0]);
    const drawn = hostView!.seatOrder;
    expect([...drawn].sort()).toEqual([...ids].sort());
    expect(hostView?.players.map((player) => player.userId)).toEqual(drawn);

    const guestView = await room(code, ids[2]);
    const newcomerView = await room(code, await person());
    expect(guestView?.players.map((player) => player.userId)).toEqual(drawn);
    expect(newcomerView?.players.map((player) => player.name)).toEqual(hostView?.players.map((player) => player.name));
  });

  it("seats a player who arrives after the draw at the end of the order", async () => {
    const { code, ids } = await lobby("Léa", ["Malik", "Inès"]);
    await as(ids[0], `select shuffle_room($1)`, [code]);
    const drawn = (await room(code, ids[0]))!.seatOrder;

    const late = await person();
    await as(late, `select claim_seat($1, 'Tom', 5::smallint)`, [code]);
    expect((await room(code, late))?.players.map((player) => player.userId)).toEqual([...drawn, late]);
  });

  it("starts the game in the drawn order, then refuses to draw again", async () => {
    const { code, ids } = await lobby("Léa", ["Malik", "Inès", "Tom"]);
    await as(ids[0], `select shuffle_room($1)`, [code]);
    const lobbyView = await room(code, ids[0]);

    const state = await kickoff(code, ids[0]);
    const started = await room(code, ids[0]);
    expect(started?.seatOrder).toEqual(lobbyView?.seatOrder);
    expect(state.players.map((player) => player.name)).toEqual(lobbyView?.players.map((player) => player.name));
    expect(await refusal(ids[0], `select shuffle_room($1)`, [code])).toMatch(/hôte peut mélanger/);
  });
});

describe("kickoff", () => {
  it("is for the host only", async () => {
    const { code, ids } = await lobby("Léa", ["Malik"]);
    const snapshot = await room(code, ids[1]);
    const { state, seatOrder } = buildOnlineGame(snapshot!.players, 3, "classic");
    expect(
      await refusal(ids[1], `select open_room($1, $2::jsonb, $3::jsonb)`, [
        code,
        JSON.stringify(state),
        JSON.stringify(seatOrder),
      ]),
    ).toMatch(/hôte/);
  });

  it("refuses a seat order that does not match the lobby", async () => {
    const { code, ids } = await lobby("Léa", ["Malik"]);
    const snapshot = await room(code, ids[0]);
    const { state } = buildOnlineGame(snapshot!.players, 3, "classic");
    expect(
      await refusal(ids[0], `select open_room($1, $2::jsonb, $3::jsonb)`, [
        code,
        JSON.stringify(state),
        JSON.stringify([ids[0]]),
      ]),
    ).toMatch(/liste des joueurs/);
  });

  it("freezes the seats and hides the board from anybody who is not playing", async () => {
    const { code, ids } = await lobby("Léa", ["Malik"]);
    const state = await kickoff(code, ids[0]);
    const seated = await room(code, ids[1]);
    expect(seated?.status).toBe("playing");
    expect(seated?.version).toBe(1);
    expect(seated?.state).toEqual(state);
    expect(seated?.players.map((player) => player.seat)).toEqual([0, 1]);

    const outsider = await person();
    const peek = await room(code, outsider);
    expect(peek?.state).toBeNull();
    expect(peek?.seatOrder).toEqual([]);
  });

  it("lets a newcomer sit down until the first round is over, at the end of the order", async () => {
    const { code, ids } = await lobby("Léa", ["Malik"]);
    const state = await kickoff(code, ids[0]);
    const late = await person();
    const peek = await room(code, late);
    expect(peek?.joinable).toBe(true);
    expect(peek?.players.map((player) => player.name)).toEqual(["Léa", "Malik"]);

    await as(late, `select claim_seat($1, 'Tom', 5::smallint)`, [code]);
    const seated = await room(code, late);
    expect(seated?.isPlayer).toBe(true);
    expect(seated?.seatOrder).toEqual([...ids, late]);
    expect(getPlayerIdOfUser(seated!.seatOrder, late)).toBe("p3");
    // Somebody already seated cannot change their avatar once the game runs.
    expect(await refusal(ids[1], `select claim_seat($1, 'Malik', 6::smallint)`, [code])).toMatch(/déjà commencé/);

    // The newcomer's device tells the engine, like any action.
    const action: GameAction = { type: "joinLatePlayer", playerId: "p3", name: "Tom", color: "#fff" as never };
    const joined = prepareLocalAction(state, action, "p3");
    expect(joined?.players.map((player) => player.id)).toEqual(["p1", "p2", "p3"]);
    await as(late, `select advance_room($1, $2::jsonb, 1)`, [code, JSON.stringify(joined)]);

    // From the second round on, the doors close.
    const second = { ...joined!, phase: "playing", round: 2 };
    await as(ids[0], `select advance_room($1, $2::jsonb, 2)`, [code, JSON.stringify(second)]);
    const tooLate = await person();
    expect((await room(code, tooLate))?.joinable).toBe(false);
    expect(await refusal(tooLate, `select claim_seat($1, 'Zoé', 7::smallint)`, [code])).toMatch(/déjà commencé/);
  });
});

describe("advance_room", () => {
  it("accepts one write per version and refuses anybody not playing", async () => {
    const { code, ids } = await lobby("Léa", ["Malik"]);
    const state = await kickoff(code, ids[0]);
    const write = (uid: string, from: number) =>
      as<{ ok: boolean }>(uid, `select advance_room($1, $2::jsonb, $3) ok`, [code, JSON.stringify(state), from]);

    expect((await write(ids[0], 1))[0].ok).toBe(true);
    // Both duellists picked at once: the second write, from the same version, loses.
    expect((await write(ids[1], 1))[0].ok).toBe(false);
    expect((await as<{ v: number }>(ids[1], `select touch_seat($1) v`, [code]))[0].v).toBe(2);

    const outsider = await person();
    expect(await refusal(outsider, `select advance_room($1, $2::jsonb, 2)`, [code, JSON.stringify(state)])).toMatch(
      /ne joues pas/,
    );
  });
});

describe("realtime channel", () => {
  it("lets only the room's players listen and speak", async () => {
    const { code, ids } = await lobby("Léa", ["Malik"]);
    const outsider = await person();
    const topic = `room:${code}`;
    await db.query(`insert into realtime.messages (topic, extension) values ($1, 'broadcast')`, [topic]);

    const visibleTo = async (uid: string) => {
      await db.query(`select set_config('request.uid', $1, false), set_config('realtime.topic', $2, false)`, [
        uid,
        topic,
      ]);
      await db.exec(`set role authenticated`);
      try {
        const { rows } = await db.query<{ n: number }>(`select count(*)::int n from realtime.messages`);
        return rows[0].n;
      } finally {
        await db.exec(`reset role`);
      }
    };

    expect(await visibleTo(ids[1])).toBe(1);
    expect(await visibleTo(outsider)).toBe(0);
  });
});

describe("profiles", () => {
  it("are for Google accounts, and name the account at the table", async () => {
    const guest = await person("guest");
    expect(await refusal(guest, `select save_profile('Invité')`)).toMatch(/Google/);

    const account = await person("google");
    expect(await refusal(account, `select save_profile('A')`)).toMatch(/2 et 16/);
    await as(account, `select save_profile('Moussa')`);
    expect((await as<{ p: { display_name: string } }>(account, `select get_my_profile() p`))[0].p).toEqual({
      display_name: "Moussa",
    });

    const code = nextCode();
    await as(account, `select create_room($1)`, [code]);
    await as(account, `select claim_seat($1, 'Autre nom', 3::smallint)`, [code]);
    expect((await room(code, account))?.players[0].name).toBe("Moussa");
  });
});

describe("a whole online game", () => {
  it("keeps every device on the stored board, move after move", async () => {
    const { code, ids } = await lobby("Bot 1", ["Bot 2", "Bot 3"]);
    await kickoff(code, ids[0], 2026);
    const start = (await room(code, ids[0]))!;
    const devices = ids.map(() => ({ state: start.state!, version: start.version }));
    const botRandom = createSeededRandom(99);

    // The bots choose through the real store; each choice is captured instead of applied.
    let chosen: GameAction | null = null;
    setActionRelay((action) => {
      chosen = action;
    });
    try {
      const live = () => devices[0].state.phase === "playing" || devices[0].state.phase === "draft";
      for (let step = 0; step < 250 && live(); step += 1) {
        useGameStore.getState().adoptGame(devices[0].state);
        chosen = null;
        chooseBotAction(useGameStore.getState(), botRandom)?.perform(useGameStore.getState());
        const action = chosen as GameAction | null;
        if (!action) break;

        // The bot plays for whoever may act: that seat's device writes, then everybody replays.
        const senderIndex = ids.findIndex(
          (userId) => prepareLocalAction(devices[0].state, action, getPlayerIdOfUser(start.seatOrder, userId)) !== null,
        );
        if (senderIndex < 0) continue;
        const sender = devices[senderIndex];
        const nextState = prepareLocalAction(
          sender.state,
          action,
          getPlayerIdOfUser(start.seatOrder, ids[senderIndex]),
        )!;
        const [{ ok }] = await as<{ ok: boolean }>(ids[senderIndex], `select advance_room($1, $2::jsonb, $3) ok`, [
          code,
          JSON.stringify(nextState),
          sender.version,
        ]);
        expect(ok).toBe(true);
        const wire = { kind: "action" as const, action, fromVersion: sender.version, senderId: ids[senderIndex] };
        sender.state = nextState;
        sender.version += 1;
        devices.forEach((device, index) => {
          if (index === senderIndex) return;
          const outcome = applyRemoteAction(device.state, device.version, start.seatOrder, wire);
          expect(outcome.kind).toBe("applied");
          if (outcome.kind === "applied") Object.assign(device, { state: outcome.state, version: outcome.version });
        });
      }
    } finally {
      setActionRelay(null);
      useGameStore.getState().resetGame();
    }

    const stored = (await room(code, ids[2]))!;
    expect(stored.version).toBeGreaterThan(50);
    for (const device of devices) {
      expect(device.version).toBe(stored.version);
      expect(pickGameState(device.state)).toEqual(stored.state);
    }
  });
});

describe("history", () => {
  interface RawHistoryGame {
    status: string;
    ended_at: string | null;
    final: GameState | null;
    my_seat: number;
    seats: { seat: number; name: string; avatar: number }[];
  }

  async function tableWithAccount(): Promise<{ code: string; account: string; guest: string }> {
    const code = nextCode();
    const account = await person("google");
    const guest = await person("guest");
    await as(account, `select create_room($1)`, [code]);
    await as(account, `select claim_seat($1, 'Moussa', 0::smallint)`, [code]);
    await as(guest, `select claim_seat($1, 'Awa', 1::smallint)`, [code]);
    return { code, account, guest };
  }

  async function myGames(uid: string): Promise<RawHistoryGame[]> {
    const [row] = await as<{ games: RawHistoryGame[] }>(uid, `select get_my_games() games`);
    return row.games;
  }

  async function finish(code: string, uid: string, state: GameState): Promise<void> {
    const finished: GameState = { ...state, phase: "finished", winnerId: state.players[1].id, winReason: "forfeit" };
    const [{ ok }] = await as<{ ok: boolean }>(uid, `select advance_room($1, $2::jsonb, 1) ok`, [
      code,
      JSON.stringify(finished),
    ]);
    expect(ok).toBe(true);
  }

  async function gamesOfRoom(code: string): Promise<number> {
    const { rows } = await db.query<{ n: number }>(`select count(*)::int n from games where room_code = $1`, [code]);
    return rows[0].n;
  }

  it("records the game of a table with an account, for the account only", async () => {
    const { code, account, guest } = await tableWithAccount();
    const state = await kickoff(code, account);
    expect((await myGames(account)).map((game) => game.status)).toEqual(["playing"]);

    await finish(code, guest, state);
    const [game] = await myGames(account);
    expect(game.status).toBe("finished");
    expect(game.ended_at).not.toBeNull();
    expect(game.final?.winnerId).toBe(state.players[1].id);
    expect(game.final).not.toHaveProperty("log");
    expect(game.my_seat).toBe(0);
    expect(game.seats).toEqual([
      { seat: 0, name: "Moussa", avatar: 0 },
      { seat: 1, name: "Awa", avatar: 1 },
    ]);
    expect(await myGames(guest)).toEqual([]);
  });

  it("keeps nothing of a table where only guests sat", async () => {
    const { code, ids } = await lobby("Léa", ["Malik"]);
    await kickoff(code, ids[0]);
    expect(await gamesOfRoom(code)).toBe(0);
  });

  it("marks the game unfinished when its room expires during play", async () => {
    const { code, account } = await tableWithAccount();
    await kickoff(code, account);
    await db.query(`delete from rooms where code = $1`, [code]);
    const [game] = await myGames(account);
    expect(game.status).toBe("unfinished");
    // Expired before anybody played: the board kept is the one of the passive draft.
    expect(game.final?.phase).toBe("draft");
  });

  it("closes a finished room with its last player, and keeps the game finished", async () => {
    const { code, account, guest } = await tableWithAccount();
    const state = await kickoff(code, account);
    await finish(code, account, state);

    await as(guest, `select leave_room($1)`, [code]);
    expect((await room(code, account))?.status).toBe("over");
    await as(account, `select leave_room($1)`, [code]);
    expect(await room(code, account)).toBeNull();
    expect((await myGames(account))[0].status).toBe("finished");
  });

  it("cannot be closed by hand", async () => {
    const { code, account } = await tableWithAccount();
    await kickoff(code, account);
    const { rows } = await db.query<{ id: string }>(`select id from games where room_code = $1`, [code]);
    await db.query(`select set_config('request.uid', $1, false)`, [account]);
    await db.exec(`set role authenticated`);
    try {
      await expect(
        db.query(`select close_game($1::uuid, '{}'::jsonb, 'finished', now())`, [rows[0].id]),
      ).rejects.toThrow(/permission denied for function close_game/);
    } finally {
      await db.exec(`reset role`);
    }
  });
});

describe("history of simulated accounts, with bots playing whole games", () => {
  interface SimulatedTable {
    code: string;
    ids: string[];
    final: GameState;
  }

  /** Seats the given people in order, starts the game, lets the bots play and writes the last board. */
  async function playTable(
    people: { id: string; name: string }[],
    options: { seed: number; maxSteps?: number; abandonSeat?: number },
  ): Promise<SimulatedTable> {
    const code = nextCode();
    const ids = people.map((seated) => seated.id);
    await as(ids[0], `select create_room($1)`, [code]);
    for (const [index, seated] of people.entries()) {
      await as(seated.id, `select claim_seat($1, $2, $3::smallint)`, [code, seated.name, index]);
    }
    const state = await kickoff(code, ids[0], options.seed);
    const final = playBotsFrom(state, {
      seed: options.seed,
      maxSteps: options.maxSteps,
      abandon:
        options.abandonSeat === undefined ? undefined : { playerId: `p${options.abandonSeat + 1}`, afterStep: 30 },
    });
    const [{ ok }] = await as<{ ok: boolean }>(ids[0], `select advance_room($1, $2::jsonb, 1) ok`, [
      code,
      JSON.stringify(final),
    ]);
    expect(ok).toBe(true);
    return { code, ids, final };
  }

  async function historyOf(uid: string): Promise<HistoryGame[]> {
    const [row] = await as<{ games: Parameters<typeof parseHistoryGame>[0][] }>(uid, `select get_my_games() games`);
    return row.games.map(parseHistoryGame);
  }

  const withoutLog = ({ log: _log, ...state }: GameState) => state;
  const winnerOf = (final: GameState) => final.players.find((player) => player.id === final.winnerId)?.name;

  it("shows each account its own recent games, with who won and where it finished", async () => {
    const moussa = { id: await person("google"), name: "Moussa" };
    const awa = { id: await person("google"), name: "Awa" };
    const guest = async (name: string) => ({ id: await person("guest"), name });

    const first = await playTable([moussa, await guest("Léa"), await guest("Tom")], { seed: 11 });
    const second = await playTable([awa, moussa, await guest("Inès")], { seed: 23 });
    const left = await playTable([moussa, await guest("Malik")], { seed: 37, abandonSeat: 0 });
    const cut = await playTable([moussa, await guest("Zoé"), await guest("Noé")], { seed: 41, maxSteps: 40 });
    await db.query(`delete from rooms where code = $1`, [cut.code]);
    const guestsOnly = await playTable([await guest("Ana"), await guest("Ben")], { seed: 53 });

    for (const table of [first, second, guestsOnly]) expect(table.final.phase).toBe("finished");
    expect(left.final).toMatchObject({ phase: "finished", winReason: "forfeit" });
    expect(cut.final.phase).toBe("playing");

    // Moussa: four games, newest first; the guests-only table is nowhere.
    const history = await historyOf(moussa.id);
    expect(history.map((game) => game.status)).toEqual(["unfinished", "finished", "finished", "finished"]);
    const [cutGame, leftGame, secondGame, firstGame] = history;
    expect(await gamesOfRoomCount(guestsOnly.code)).toBe(0);

    // The stored board is the engine's last board, without its log.
    expect(firstGame.final).toEqual(withoutLog(first.final));
    expect(secondGame.final).toEqual(withoutLog(second.final));

    // Seats, and the account's own seat in each game.
    expect(firstGame.seats.map((seat) => seat.name)).toEqual(["Moussa", "Léa", "Tom"]);
    expect(secondGame.seats.map((seat) => seat.name)).toEqual(["Awa", "Moussa", "Inès"]);
    expect([firstGame.mySeat, secondGame.mySeat, leftGame.mySeat]).toEqual([0, 1, 0]);

    // Who won, and how it went for Moussa, as the engine decided it.
    for (const [game, table, seat] of [
      [firstGame, first, 0],
      [secondGame, second, 1],
    ] as const) {
      expect(getWinnerName(game)).toBe(winnerOf(table.final));
      const playerId = `p${seat + 1}`;
      const won = table.final.winnerId === playerId;
      // Bots sometimes leave a table on their own, so the outcome is read from the board they ended on.
      const left = table.final.abandonedPlayers.some((player) => player.id === playerId);
      expect(getOutcome(game).kind).toBe(won ? "won" : left ? "abandoned" : "placed");
    }
    expect(getOutcome(leftGame)).toEqual({ kind: "abandoned" });
    expect(getWinnerName(leftGame)).toBe("Malik");
    expect(getOutcome(cutGame)).toEqual({ kind: "unfinished" });
    expect(history.every((game) => game.endedAt !== null)).toBe(true);

    // Awa only sat at the second table, at the first seat.
    const awaHistory = await historyOf(awa.id);
    expect(awaHistory.map((game) => game.id)).toEqual([secondGame.id]);
    expect(awaHistory[0].mySeat).toBe(0);
  }, 60_000);

  async function gamesOfRoomCount(code: string): Promise<number> {
    const { rows } = await db.query<{ n: number }>(`select count(*)::int n from games where room_code = $1`, [code]);
    return rows[0].n;
  }
});
