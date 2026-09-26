import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "./room-api";

/**
 * The lobby steps of the room store, with the Supabase calls replaced: what
 * is checked here is the order of the steps, the schema has its own tests.
 */

const HOST_ID = "host-user";
const GUEST_ID = "guest-user";
const ROOM_CODE = "ABC234";

const api = vi.hoisted(() => ({
  createRoom: vi.fn(),
  claimSeat: vi.fn(),
  fetchRoom: vi.fn(),
  leaveRoom: vi.fn(),
  openRoom: vi.fn(),
  shuffleRoom: vi.fn(),
  advanceRoom: vi.fn(),
  touchSeat: vi.fn(),
}));

const session = vi.hoisted(() => ({ ensureSession: vi.fn() }));

vi.mock("./room-api", () => api);

vi.mock("./supabase-client", () => {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    send: () => Promise.resolve("ok"),
    track: () => Promise.resolve("ok"),
    presenceState: () => ({}),
  };
  return {
    ensureSession: session.ensureSession,
    getSupabase: () => ({
      realtime: { setAuth: () => Promise.resolve() },
      channel: () => channel,
      removeChannel: () => Promise.resolve("ok"),
    }),
  };
});

const { useRoomStore } = await import("./room-store");

function lobbySnapshot(playerIds: string[]): RoomSnapshot {
  return {
    code: ROOM_CODE,
    status: "lobby",
    hostId: HOST_ID,
    isPlayer: true,
    state: null,
    version: 0,
    seatOrder: [],
    players: playerIds.map((userId, index) => ({
      userId,
      seat: null,
      name: `P${index}`,
      avatar: index,
      absent: false,
    })),
  };
}

describe("room store lobby", () => {
  const initialState = useRoomStore.getState();

  beforeEach(() => {
    const stored = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => void stored.set(key, value),
        removeItem: (key: string) => void stored.delete(key),
      },
      setInterval: () => 1,
      clearInterval: () => undefined,
    });
    api.claimSeat.mockResolvedValue(undefined);
  });

  afterEach(() => {
    useRoomStore.setState(initialState, true);
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("opens the lobby of the room its host just created", async () => {
    session.ensureSession.mockResolvedValue(HOST_ID);
    api.createRoom.mockResolvedValue(ROOM_CODE);
    api.fetchRoom.mockResolvedValue(lobbySnapshot([HOST_ID]));

    await useRoomStore.getState().createAndJoin("Hote", 0);

    const room = useRoomStore.getState();
    expect(room.error).toBeNull();
    expect(api.fetchRoom).toHaveBeenCalledWith(ROOM_CODE);
    expect(room).toMatchObject({ view: "lobby", code: ROOM_CODE, hostId: HOST_ID, myUserId: HOST_ID });
    expect(room.players.map((player) => player.userId)).toEqual([HOST_ID]);
  });

  it("opens the lobby of the room a guest joins by code", async () => {
    session.ensureSession.mockResolvedValue(GUEST_ID);
    api.fetchRoom.mockResolvedValue(lobbySnapshot([HOST_ID, GUEST_ID]));

    await useRoomStore.getState().join(ROOM_CODE, "Invite", 1);

    const room = useRoomStore.getState();
    expect(room.error).toBeNull();
    expect(api.claimSeat).toHaveBeenCalledWith(ROOM_CODE, "Invite", 1);
    expect(room).toMatchObject({ view: "lobby", code: ROOM_CODE, myUserId: GUEST_ID });
    expect(room.players).toHaveLength(2);
  });

  it("lets the host draw the turn order again and shows the order the database returns", async () => {
    session.ensureSession.mockResolvedValue(HOST_ID);
    api.createRoom.mockResolvedValue(ROOM_CODE);
    api.fetchRoom.mockResolvedValue(lobbySnapshot([HOST_ID, GUEST_ID]));
    await useRoomStore.getState().createAndJoin("Hote", 0);

    api.shuffleRoom.mockResolvedValue(undefined);
    api.fetchRoom.mockResolvedValue(lobbySnapshot([GUEST_ID, HOST_ID]));
    await useRoomStore.getState().shuffleOrder();

    expect(api.shuffleRoom).toHaveBeenCalledWith(ROOM_CODE);
    expect(useRoomStore.getState().players.map((player) => player.userId)).toEqual([GUEST_ID, HOST_ID]);
  });

  it("does not let a guest draw the turn order", async () => {
    session.ensureSession.mockResolvedValue(GUEST_ID);
    api.fetchRoom.mockResolvedValue(lobbySnapshot([HOST_ID, GUEST_ID]));
    await useRoomStore.getState().join(ROOM_CODE, "Invite", 1);

    await useRoomStore.getState().shuffleOrder();

    expect(api.shuffleRoom).not.toHaveBeenCalled();
  });
});
