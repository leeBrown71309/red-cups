import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import type { GameAction } from "../game/game-actions";
import { pickGameState } from "../game/game-save";
import { setActionRelay, useGameStore } from "../game/store";
import type { PlayerId } from "../game/types";
import { useUiStore } from "../feedback/ui-store";
import { soundEffects } from "../audio/sound-effects";
import { createRandomSeed } from "../utils/seeded-random";
import {
  advanceRoom,
  claimSeat,
  createRoom,
  fetchRoom,
  leaveRoom,
  openRoom,
  touchSeat,
  type RoomPlayer,
  type RoomSnapshot,
  type RoomStatus,
} from "./room-api";
import {
  applyRemoteAction,
  buildOnlineGame,
  getPlayerIdOfUser,
  prepareLocalAction,
  type RoomWire,
} from "./room-protocol";
import { ensureSession, getSupabase } from "./supabase-client";

/**
 * The online room this device sits at, and the plumbing behind it: the
 * private Realtime channel, the heartbeat, and the relay that turns every
 * game action into a checked write followed by a broadcast.
 */

export type RoomView = "closed" | "menu" | "lobby" | "playing";
export type ConnectionStatus = "offline" | "connecting" | "online";

interface RoomState {
  view: RoomView;
  code: string | null;
  status: RoomStatus | null;
  hostId: string | null;
  myUserId: string | null;
  players: RoomPlayer[];
  seatOrder: string[];
  version: number;
  /** User ids currently connected to the channel. */
  connectedUserIds: string[];
  connection: ConnectionStatus;
  /** A lobby looked up by code, before sitting down in it. */
  preview: RoomSnapshot | null;
  busy: boolean;
  error: string | null;

  openMenu: (code?: string) => void;
  closeMenu: () => void;
  lookUpRoom: (code: string) => Promise<void>;
  clearPreview: () => void;
  createAndJoin: (name: string, avatar: number) => Promise<void>;
  join: (code: string, name: string, avatar: number) => Promise<void>;
  updateSeat: (name: string, avatar: number) => Promise<void>;
  startGame: () => Promise<void>;
  leave: () => Promise<void>;
  restore: () => Promise<void>;
  clearError: () => void;
}

const ROOM_MEMORY_KEY = "red-cups-room";
const HEARTBEAT_MS = 20_000;
/** A refused write is retried on the fresh board, e.g. when both duellists picked a hand at once. */
const MAX_SEND_ATTEMPTS = 3;

let channel: RealtimeChannel | null = null;
let heartbeat: number | null = null;
/** Incoming and outgoing actions run one at a time, so the board and the version never interleave. */
let queue: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task).catch((error: unknown) => {
    console.error("Online room task failed", error);
  });
}

function rememberRoom(code: string | null): void {
  try {
    if (code) window.sessionStorage.setItem(ROOM_MEMORY_KEY, code);
    else window.sessionStorage.removeItem(ROOM_MEMORY_KEY);
  } catch {
    // Without storage a reload simply leaves the room; playing still works.
  }
}

function recallRoom(): string | null {
  try {
    return window.sessionStorage.getItem(ROOM_MEMORY_KEY);
  } catch {
    return null;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toast(text: string, tone: "good" | "bad" | "neutral" = "neutral"): void {
  useUiStore.getState().pushToast({ id: `room-${Date.now()}-${Math.random()}`, text, tone });
}

export const useRoomStore = create<RoomState>((set, get) => {
  const applySnapshot = (room: RoomSnapshot) => {
    set({
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      players: room.players,
      seatOrder: room.seatOrder,
      version: room.version,
    });
    if (room.status !== "lobby" && room.state) {
      useGameStore.getState().adoptGame(room.state);
      set({ view: "playing" });
    } else if (room.status === "lobby") {
      set({ view: "lobby" });
    }
  };

  /** Reloads the stored room: the fix for any doubt about the board or the roster. */
  const resync = async () => {
    const code = get().code;
    if (!code) return;
    const room = await fetchRoom(code);
    if (!room || !room.isPlayer) {
      await closeRoom("Le salon n’existe plus.");
      return;
    }
    applySnapshot(room);
  };

  const broadcast = (wire: RoomWire) => {
    void channel?.send({ type: "broadcast", event: "room", payload: wire });
  };

  const sendAction = async (action: GameAction) => {
    const { code, myUserId } = get();
    if (!code || !myUserId) return;
    for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS; attempt += 1) {
      const { version, seatOrder } = get();
      const state = pickGameState(useGameStore.getState());
      const nextState = prepareLocalAction(state, action, getPlayerIdOfUser(seatOrder, myUserId));
      if (!nextState) {
        if (attempt === 0) soundEffects.error();
        return;
      }
      if (await advanceRoom(code, nextState, version)) {
        useGameStore.getState().adoptGame(nextState);
        set({ version: version + 1, status: nextState.phase === "finished" ? "over" : "playing" });
        broadcast({ kind: "action", action, fromVersion: version, senderId: myUserId });
        return;
      }
      await resync();
    }
    toast("Action refusée : la partie a changé entre-temps.", "bad");
  };

  const handleWire = async (wire: RoomWire) => {
    switch (wire.kind) {
      case "roster":
        await resync();
        return;
      case "start":
        await resync();
        return;
      case "action": {
        const { version, seatOrder } = get();
        const outcome = applyRemoteAction(pickGameState(useGameStore.getState()), version, seatOrder, wire);
        if (outcome.kind === "applied") {
          useGameStore.getState().adoptGame(outcome.state);
          set({ version: outcome.version, status: outcome.state.phase === "finished" ? "over" : "playing" });
        } else if (outcome.kind === "resync") {
          await resync();
        }
        return;
      }
    }
  };

  const beat = async () => {
    const code = get().code;
    if (!code) return;
    let storedVersion: number | null;
    try {
      storedVersion = await touchSeat(code);
    } catch {
      // One missed beat is harmless: the absence threshold is nearly four beats.
      return;
    }
    if (storedVersion === null) {
      await closeRoom("Le salon a expiré.");
      return;
    }
    // A lost broadcast shows up here at the latest.
    if (storedVersion !== get().version) enqueue(resync);
  };

  const connect = async (code: string, userId: string) => {
    await disconnect();
    const supabase = getSupabase();
    // Private channels check the session's token against the Realtime policies of the schema.
    await supabase.realtime.setAuth();
    set({ connection: "connecting" });

    let hasSubscribed = false;
    channel = supabase.channel(`room:${code}`, {
      config: { private: true, broadcast: { self: false }, presence: { key: userId } },
    });
    channel.on("broadcast", { event: "room" }, ({ payload }) => enqueue(() => handleWire(payload as RoomWire)));
    channel.on("presence", { event: "sync" }, () => {
      const presence = channel?.presenceState() ?? {};
      set({ connectedUserIds: Object.keys(presence) });
    });
    // In the lobby, somebody arriving or leaving also refreshes the roster, in case its broadcast was lost.
    channel.on("presence", { event: "join" }, ({ key }) => {
      if (key !== userId && get().view === "lobby") enqueue(resync);
    });
    channel.on("presence", { event: "leave" }, ({ key }) => {
      if (key !== userId && get().view === "lobby") enqueue(resync);
      if (key === userId || get().view !== "playing") return;
      const name = get().players.find((player) => player.userId === key)?.name;
      if (name) toast(`${name} s’est déconnecté.`, "bad");
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        set({ connection: "online" });
        void channel?.track({ at: Date.now() });
        // Back after a drop: whatever was broadcast meanwhile is in the snapshot.
        if (hasSubscribed) enqueue(resync);
        hasSubscribed = true;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        set({ connection: "offline" });
      }
    });

    heartbeat = window.setInterval(() => void beat(), HEARTBEAT_MS);
    setActionRelay((action) => enqueue(() => sendAction(action)));
  };

  const disconnect = async () => {
    setActionRelay(null);
    if (heartbeat !== null) window.clearInterval(heartbeat);
    heartbeat = null;
    if (channel) await getSupabase().removeChannel(channel);
    channel = null;
    set({ connection: "offline", connectedUserIds: [] });
  };

  const closeRoom = async (message?: string) => {
    await disconnect();
    rememberRoom(null);
    const wasPlaying = get().view === "playing";
    set({
      view: "menu",
      code: null,
      status: null,
      hostId: null,
      players: [],
      seatOrder: [],
      version: 0,
      preview: null,
    });
    if (wasPlaying) useGameStore.getState().resetGame();
    if (message) toast(message, "bad");
  };

  /** Runs one lobby step with the busy flag and a readable error. */
  const run = async (step: () => Promise<void>) => {
    set({ busy: true, error: null });
    try {
      await step();
    } catch (error) {
      set({ error: describeError(error) });
    } finally {
      set({ busy: false });
    }
  };

  const sitDown = async (code: string, name: string, avatar: number) => {
    const userId = await ensureSession();
    await claimSeat(code, name, avatar);
    set({ myUserId: userId, preview: null });
    rememberRoom(code);
    await resync();
    await connect(code, userId);
    broadcast({ kind: "roster" });
  };

  return {
    view: "closed",
    code: null,
    status: null,
    hostId: null,
    myUserId: null,
    players: [],
    seatOrder: [],
    version: 0,
    connectedUserIds: [],
    connection: "offline",
    preview: null,
    busy: false,
    error: null,

    openMenu: (code) => {
      set({ view: "menu", error: null });
      if (code) void get().lookUpRoom(code);
    },
    closeMenu: () => {
      if (get().code) return;
      set({ view: "closed", preview: null, error: null });
    },

    lookUpRoom: (code) =>
      run(async () => {
        await ensureSession();
        const room = await fetchRoom(code);
        if (!room) throw new Error("Aucun salon avec ce code.");
        if (room.isPlayer) {
          set({ myUserId: await ensureSession() });
          rememberRoom(code);
          applySnapshot(room);
          await connect(code, get().myUserId!);
          return;
        }
        if (room.status !== "lobby") throw new Error("Cette partie a déjà commencé : impossible de la rejoindre.");
        if (room.players.length >= 8) throw new Error("Ce salon est complet.");
        set({ preview: room });
      }),
    clearPreview: () => set({ preview: null, error: null }),

    createAndJoin: (name, avatar) =>
      run(async () => {
        await ensureSession();
        const code = await createRoom();
        await sitDown(code, name, avatar);
      }),

    join: (code, name, avatar) => run(() => sitDown(code, name, avatar)),

    updateSeat: (name, avatar) =>
      run(async () => {
        const code = get().code;
        if (!code) return;
        await claimSeat(code, name, avatar);
        await resync();
        broadcast({ kind: "roster" });
      }),

    startGame: () =>
      run(async () => {
        const { code, players, myUserId, hostId } = get();
        if (!code || myUserId !== hostId) return;
        if (players.length < 2) throw new Error("Il faut au moins deux joueurs.");
        const { state, seatOrder } = buildOnlineGame(players, createRandomSeed());
        await openRoom(code, state, seatOrder);
        await resync();
        broadcast({ kind: "start" });
      }),

    leave: () =>
      run(async () => {
        const { code, view, seatOrder, myUserId } = get();
        const localPlayerId = myUserId ? getPlayerIdOfUser(seatOrder, myUserId) : null;
        // Leaving a game in progress abandons it, so the others are not left waiting on an empty seat.
        if (view === "playing" && localPlayerId && useGameStore.getState().phase === "playing") {
          await new Promise<void>((resolve) =>
            enqueue(async () => {
              try {
                await sendAction({ type: "abandonGame", playerId: localPlayerId });
              } finally {
                resolve();
              }
            }),
          );
        }
        if (code) await leaveRoom(code).catch(() => undefined);
        broadcast({ kind: "roster" });
        await closeRoom();
      }),

    restore: async () => {
      const params = new URLSearchParams(window.location.search);
      const invited = params.get("room");
      if (invited) {
        params.delete("room");
        const query = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      }
      const code = recallRoom() ?? invited;
      if (!code) return;
      get().openMenu(code.toUpperCase());
    },

    clearError: () => set({ error: null }),
  };
});

/** The engine player of this device in an online game; null in a local game, where one device plays every seat. */
export function getLocalPlayerId(): PlayerId | null {
  const { view, seatOrder, myUserId } = useRoomStore.getState();
  if (view !== "playing" || !myUserId) return null;
  return getPlayerIdOfUser(seatOrder, myUserId);
}

export function useLocalPlayerId(): PlayerId | null {
  return useRoomStore((state) =>
    state.view === "playing" && state.myUserId ? getPlayerIdOfUser(state.seatOrder, state.myUserId) : null,
  );
}

/** Whether this device may act for one of these players: always in a local game. */
export function useCanActFor(playerIds: (PlayerId | null | undefined)[]): boolean {
  const localPlayerId = useLocalPlayerId();
  return localPlayerId === null || playerIds.includes(localPlayerId);
}
