import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import type { GameAction } from "../game/game-actions";
import { pickGameState } from "../game/game-save";
import { chooseBotAction } from "../game/simulation/bot-player";
import { setActionRelay, useGameStore } from "../game/store";
import type { GameState } from "../game/types";
import { createSeededRandom } from "../utils/seeded-random";
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
  const { state, seatOrder } = buildOnlineGame(snapshot!.players, seed);
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

describe("kickoff", () => {
  it("is for the host only", async () => {
    const { code, ids } = await lobby("Léa", ["Malik"]);
    const snapshot = await room(code, ids[1]);
    const { state, seatOrder } = buildOnlineGame(snapshot!.players, 3);
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
    const { state } = buildOnlineGame(snapshot!.players, 3);
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
    expect(peek?.players).toEqual([]);
    expect(await refusal(outsider, `select claim_seat($1, 'Tom', 5::smallint)`, [code])).toMatch(/déjà commencé/);
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
      for (let step = 0; step < 250 && devices[0].state.phase === "playing"; step += 1) {
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
