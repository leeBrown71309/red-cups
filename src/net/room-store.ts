import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import type { GameAction } from "../game/game-actions";
import { pickGameState } from "../game/game-save";
import { canReinstatePlayer } from "../game/reinstate";
import { setActionRelay, useGameStore } from "../game/store";
import type { MapId, PlayerId } from "../game/types";
import { PLAYER_COLORS } from "../game/types";
import { EXPIRY_MARGIN_MS, getClockDeadline, getClockOwnerIds } from "../game/turn-clock";
import { useUiStore } from "../feedback/ui-store";
import { soundEffects } from "../audio/sound-effects";
import { createRandomSeed } from "../utils/seeded-random";
import {
  advanceRoom,
  answerRejoin as answerRejoinInRoom,
  claimSeat,
  createRoom,
  fetchRejoinStatus,
  fetchRoom,
  fetchServerTime,
  KICKED_VERSION,
  kickPlayer as kickPlayerFromRoom,
  leaveRoom,
  listRejoinRequests,
  openRoom,
  rematchRoom,
  requestRejoin as requestRejoinInRoom,
  shuffleRoom,
  touchSeat,
  type RejoinRequest,
  type RoomPlayer,
  type RoomSnapshot,
  type RoomStatus,
} from "./room-api";
import {
  applyRemoteAction,
  buildOnlineGame,
  getPlayerIdOfUser,
  hasLeftRoom,
  isSameRules,
  prepareLocalAction,
  type RoomWire,
} from "./room-protocol";
import { attachArmLive, handleArmWire, type ArmWire } from "./arm-live";
import { attachBasketLive, handleBasketWire, type BasketWire } from "./basket-live";
import { ensureSession, getSupabase } from "./supabase-client";
import {
  attachVoice,
  detachVoice,
  getVoicePresence,
  handleVoiceWire,
  joinVoiceIfEnabled,
  readVoicePresence,
  updateVoicePresence,
  type VoiceWire,
} from "./voice";

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
  /** Host only: the players sent away who ask to come back, waiting for an answer. */
  rejoinRequests: RejoinRequest[];
  /** The room code this device, sent away, has asked to come back to and waits on. */
  rejoinWaitingFor: string | null;
  busy: boolean;
  error: string | null;

  openMenu: (code?: string) => void;
  closeMenu: () => void;
  lookUpRoom: (code: string) => Promise<void>;
  clearPreview: () => void;
  createAndJoin: (name: string, avatar: number) => Promise<void>;
  join: (code: string, name: string, avatar: number) => Promise<void>;
  updateSeat: (name: string, avatar: number) => Promise<void>;
  shuffleOrder: () => Promise<void>;
  /** Host only: opens the room's game on the given map. */
  startGame: (mapId: MapId) => Promise<void>;
  /** Host only, once the game is over: a new game for whoever is still at the table. */
  rematch: (mapId: MapId) => Promise<void>;
  /** Host only: sends a player away from the lobby or the game. */
  kick: (userId: string) => Promise<void>;
  /** Sent away: asks the host to be let back into the room looked up in `preview`. */
  requestRejoin: (name: string, avatar: number) => Promise<void>;
  cancelRejoinWait: () => void;
  /** Host only: lets a player sent away back, or refuses. */
  answerRejoin: (userId: string, accept: boolean) => Promise<void>;
  leave: () => Promise<void>;
  restore: () => Promise<void>;
  clearError: () => void;
}

const KICKED_MESSAGE = "L’hôte t’a exclu du salon.";
const ROOM_MEMORY_KEY = "red-cups-room";
const HEARTBEAT_MS = 20_000;
/** How often the host looks for requests to come back, and a waiting player for the answer. */
const REJOIN_POLL_MS = 4_000;
/** How often this device looks at the clocks of the game. */
const CLOCK_CHECK_MS = 500;
/** A refused write is retried on the fresh board, e.g. when both duellists picked a hand at once. */
const MAX_SEND_ATTEMPTS = 3;

let channel: RealtimeChannel | null = null;
let heartbeat: number | null = null;
let clockCheck: number | null = null;
/** Host: looks for players asking to come back. Sent away: waits for the host's answer. */
let rejoinPoll: number | null = null;
/** This device was accepted back after being sent away: it tells the engine once the table is at rest. */
let reinstating = false;
/** The last deadline this device closed, so it asks once per deadline. */
let lastExpiredDeadline: number | null = null;
/** Server time minus device time, measured at every heartbeat. */
let serverOffsetMs = 0;

/** The server's time as this device best knows it; the device's own clock until the first measure. */
export function getServerNow(): number {
  return Date.now() + serverOffsetMs;
}

/**
 * Measures the gap between this device's clock and the server's, halfway
 * through the round trip. Without the server function (an older database),
 * the device's clock stands in.
 */
async function measureServerOffset(): Promise<void> {
  try {
    const sentAt = Date.now();
    const serverTime = await fetchServerTime();
    const receivedAt = Date.now();
    if (Number.isFinite(serverTime)) serverOffsetMs = serverTime - (sentAt + receivedAt) / 2;
  } catch {
    // Kept as it was: one failed measure does not move the clocks.
  }
}
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
  const message = error instanceof Error ? error.message : String(error);
  // A database function the server does not know yet: the schema was not replayed after the update.
  if (message.includes("schema cache"))
    return "Le serveur n’est pas à jour : la base de données doit être mise à jour.";
  return message;
}

function toast(text: string, tone: "good" | "bad" | "neutral" = "neutral"): void {
  useUiStore.getState().pushToast({ id: `room-${Date.now()}-${Math.random()}`, text, tone });
}

export const useRoomStore = create<RoomState>((set, get) => {
  const applySnapshot = (room: RoomSnapshot) => {
    // A game on other rules (another version of the game) would never land on the same boards.
    if (room.status !== "lobby" && !isSameRules(room.state)) {
      void closeRoom("Ce salon joue sur une autre version de Red Cups : mets le jeu à jour ou rejoins un autre salon.");
      return;
    }
    set({
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      players: room.players,
      seatOrder: room.seatOrder,
      version: room.version,
    });
    // A finished game is never come back to: a reload must not bring its room back, unless a rematch reopens it.
    if (room.status === "over") rememberRoom(null);
    else rememberRoom(room.code);
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
      const issuedAt = getServerNow();
      const nextState = prepareLocalAction(state, action, getPlayerIdOfUser(seatOrder, myUserId), issuedAt);
      if (!nextState) {
        if (attempt === 0) soundEffects.error();
        return;
      }
      if (await advanceRoom(code, nextState, version)) {
        useGameStore.getState().adoptGame(nextState);
        set({ version: version + 1, status: nextState.phase === "finished" ? "over" : "playing" });
        if (nextState.phase === "finished") rememberRoom(null);
        broadcast({ kind: "action", action, fromVersion: version, senderId: myUserId, issuedAt });
        return;
      }
      await resync();
    }
    toast("Action refusée : la partie a changé entre-temps.", "bad");
  };

  /**
   * Sitting down after the kickoff only reserves the seat: this device then
   * tells the engine, once, so that every board gets the new player. It is
   * tried again on every reconnection until the board lists the player.
   */
  const ensureLateJoin = async () => {
    const { code, myUserId, seatOrder, players, status } = get();
    const game = useGameStore.getState();
    if (!code || !myUserId || status !== "playing" || (game.phase !== "playing" && game.phase !== "draft")) return;
    const playerId = getPlayerIdOfUser(seatOrder, myUserId);
    const me = players.find((player) => player.userId === myUserId);
    // Accepted back by the host: the engine seats the player again once the table is at rest, tried at every beat.
    if (reinstating && playerId) {
      if (game.players.some((player) => player.id === playerId)) {
        reinstating = false;
      } else if (canReinstatePlayer(game, playerId)) {
        await sendAction({ type: "reinstatePlayer", playerId });
      }
      return;
    }
    if (!playerId || !me || game.players.some((player) => player.id === playerId)) return;
    await sendAction({
      type: "joinLatePlayer",
      playerId,
      name: me.name,
      color: PLAYER_COLORS[me.avatar] ?? PLAYER_COLORS[0],
    });
    // Refused for good (the first round ended meanwhile): the seat is of no use.
    if (!useGameStore.getState().players.some((player) => player.id === playerId)) {
      await get().leave();
      toast("La première manche est terminée : tu ne peux plus rejoindre cette partie.", "bad");
    }
  };

  const handleWire = async (wire: RoomWire) => {
    switch (wire.kind) {
      case "roster":
        await resync();
        return;
      case "start":
        await resync();
        return;
      case "kicked":
        if (wire.userId === get().myUserId) await closeRoom(KICKED_MESSAGE);
        else await resync();
        return;
      case "action": {
        const { version, seatOrder } = get();
        const outcome = applyRemoteAction(pickGameState(useGameStore.getState()), version, seatOrder, wire);
        if (outcome.kind === "applied") {
          useGameStore.getState().adoptGame(outcome.state);
          set({ version: outcome.version, status: outcome.state.phase === "finished" ? "over" : "playing" });
          if (outcome.state.phase === "finished") rememberRoom(null);
        } else if (outcome.kind === "resync") {
          await resync();
        }
        return;
      }
    }
  };

  /**
   * Closes a clock that ran out: the device of whoever had to decide first,
   * the others a little later, should that device be gone. The database lets
   * only one of them through.
   */
  const checkClocks = () => {
    const { view, myUserId, seatOrder } = get();
    const game = useGameStore.getState();
    const deadline = getClockDeadline(game);
    if (view !== "playing" || !myUserId || deadline === null || deadline === lastExpiredDeadline) return;
    const playerId = getPlayerIdOfUser(seatOrder, myUserId);
    const margin = playerId && getClockOwnerIds(game).includes(playerId) ? 0 : EXPIRY_MARGIN_MS;
    if (getServerNow() < deadline + margin) return;
    lastExpiredDeadline = deadline;
    enqueue(() => sendAction({ type: "expireClock" }));
  };

  const beat = async () => {
    const code = get().code;
    if (!code) return;
    void measureServerOffset();
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
    if (storedVersion === KICKED_VERSION) {
      await closeRoom(KICKED_MESSAGE);
      return;
    }
    // A lost broadcast shows up here at the latest.
    if (storedVersion !== get().version) enqueue(resync);
  };

  /** Host: the players asking to come back; a toast tells of each new one. */
  const pollRejoinRequests = async () => {
    const { code, myUserId, hostId, rejoinRequests } = get();
    if (!code || !myUserId || myUserId !== hostId) return;
    try {
      const requests = await listRejoinRequests(code);
      const known = new Set(rejoinRequests.map((request) => request.userId));
      for (const request of requests) {
        if (!known.has(request.userId)) toast(`${request.name} demande à revenir à la table.`, "neutral");
      }
      if (requests.length !== rejoinRequests.length || requests.some((request) => !known.has(request.userId))) {
        set({ rejoinRequests: requests });
      }
    } catch {
      // The next poll tries again.
    }
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
    const announce = () => void channel?.track({ at: Date.now(), ...getVoicePresence() });
    attachVoice({
      selfId: userId,
      send: (wire) => void channel?.send({ type: "broadcast", event: "voice", payload: wire }),
      announce,
    });

    channel.on("broadcast", { event: "room" }, ({ payload }) => enqueue(() => handleWire(payload as RoomWire)));
    // Voice signalling skips the game queue: a call must not wait behind a resync.
    channel.on("broadcast", { event: "voice" }, ({ payload }) => void handleVoiceWire(payload as VoiceWire));
    // Live Basket shots are only for the show: they skip the game queue too.
    channel.on("broadcast", { event: "basket" }, ({ payload }) => handleBasketWire(payload as BasketWire));
    attachBasketLive((wire) => void channel?.send({ type: "broadcast", event: "basket", payload: wire }));
    // The arm wrestle's running taps, for the bar only.
    channel.on("broadcast", { event: "arm" }, ({ payload }) => handleArmWire(payload as ArmWire));
    attachArmLive((wire) => void channel?.send({ type: "broadcast", event: "arm", payload: wire }));
    channel.on("presence", { event: "sync" }, () => {
      const presence = channel?.presenceState<{ voice?: unknown; muted?: unknown }>() ?? {};
      set({ connectedUserIds: Object.keys(presence) });
      updateVoicePresence(readVoicePresence(presence));
    });
    // In the lobby, somebody arriving or leaving also refreshes the roster, in case its broadcast was lost.
    channel.on("presence", { event: "join" }, ({ key }) => {
      if (key !== userId && get().view === "lobby") enqueue(resync);
    });
    channel.on("presence", { event: "leave" }, ({ key, currentPresences }) => {
      // A device that only updated its presence (voice chat) has not left.
      if (!hasLeftRoom(currentPresences)) return;
      if (key !== userId && get().view === "lobby") enqueue(resync);
      if (key === userId || get().view !== "playing") return;
      const name = get().players.find((player) => player.userId === key)?.name;
      if (name) toast(`${name} s’est déconnecté.`, "bad");
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        set({ connection: "online" });
        announce();
        joinVoiceIfEnabled();
        // Back after a drop: whatever was broadcast meanwhile is in the snapshot.
        if (hasSubscribed) enqueue(resync);
        hasSubscribed = true;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        set({ connection: "offline" });
      }
    });

    heartbeat = window.setInterval(() => void beat(), HEARTBEAT_MS);
    rejoinPoll = window.setInterval(() => {
      void pollRejoinRequests();
      if (reinstating) enqueue(ensureLateJoin);
    }, REJOIN_POLL_MS);
    void pollRejoinRequests();
    clockCheck = window.setInterval(checkClocks, CLOCK_CHECK_MS);
    void measureServerOffset();
    setActionRelay((action) => enqueue(() => sendAction(action)));
  };

  const disconnect = async () => {
    setActionRelay(null);
    detachVoice();
    attachBasketLive(null);
    attachArmLive(null);
    if (heartbeat !== null) window.clearInterval(heartbeat);
    heartbeat = null;
    if (clockCheck !== null) window.clearInterval(clockCheck);
    clockCheck = null;
    if (rejoinPoll !== null) window.clearInterval(rejoinPoll);
    rejoinPoll = null;
    set({ rejoinRequests: [] });
    if (channel) await getSupabase().removeChannel(channel);
    channel = null;
    set({ connection: "offline", connectedUserIds: [] });
  };

  const closeRoom = async (message?: string) => {
    reinstating = false;
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
      toast(describeError(error), "bad");
    } finally {
      set({ busy: false });
    }
  };

  const sitDown = async (code: string, name: string, avatar: number) => {
    const userId = await ensureSession();
    await claimSeat(code, name, avatar);
    // `resync` reloads whichever room is stored, so the code must be stored before it runs.
    set({ myUserId: userId, code, preview: null });
    rememberRoom(code);
    await resync();
    await connect(code, userId);
    broadcast({ kind: "roster" });
    await ensureLateJoin();
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
    rejoinRequests: [],
    rejoinWaitingFor: null,
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
        // The players still at the table keep their standings; nobody else comes back to it.
        if (room.status === "over") {
          if (room.isPlayer) await leaveRoom(code).catch(() => undefined);
          throw new Error("Cette partie est terminée.");
        }
        if (room.isPlayer) {
          set({ myUserId: await ensureSession() });
          rememberRoom(code);
          applySnapshot(room);
          await connect(code, get().myUserId!);
          await ensureLateJoin();
          return;
        }
        // Sent away by the host: no seat to take, but a request to make.
        if (room.kicked) {
          set({ preview: room });
          return;
        }
        if (!room.joinable) throw new Error("Cette partie a déjà commencé : impossible de la rejoindre.");
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

    // The new order reaches the other players as a roster change: they reload the lobby.
    shuffleOrder: () =>
      run(async () => {
        const { code, myUserId, hostId } = get();
        if (!code || myUserId !== hostId) return;
        await shuffleRoom(code);
        await resync();
        broadcast({ kind: "roster" });
      }),

    startGame: (mapId) =>
      run(async () => {
        const { code, players, myUserId, hostId } = get();
        if (!code || myUserId !== hostId) return;
        if (players.length < 2) throw new Error("Il faut au moins deux joueurs.");
        await measureServerOffset();
        const { state, seatOrder } = buildOnlineGame(players, createRandomSeed(), mapId, getServerNow(), hostId);
        await openRoom(code, state, seatOrder);
        await resync();
        broadcast({ kind: "start" });
      }),

    rematch: (mapId) =>
      run(async () => {
        const { code, myUserId, hostId } = get();
        if (!code || myUserId !== hostId) return;
        const room = await fetchRoom(code);
        if (!room || room.status !== "over") throw new Error("La revanche n’est plus possible.");
        // Same turn order as the game just played, without whoever left or went quiet.
        const rank = (userId: string) => {
          const seat = room.seatOrder.indexOf(userId);
          return seat < 0 ? room.seatOrder.length : seat;
        };
        const players = room.players
          .filter((player) => !player.absent || player.userId === myUserId)
          .sort((left, right) => rank(left.userId) - rank(right.userId));
        if (players.length < 2) throw new Error("Il faut au moins deux joueurs encore à table.");
        const { state, seatOrder } = buildOnlineGame(players, createRandomSeed(), mapId, getServerNow(), hostId);
        await rematchRoom(code, state, seatOrder);
        await resync();
        broadcast({ kind: "start" });
      }),

    kick: (userId) =>
      run(async () => {
        const { code, view, seatOrder, myUserId, hostId } = get();
        if (!code || !myUserId || myUserId !== hostId || userId === myUserId) return;
        if (view === "playing") {
          const hostPlayerId = getPlayerIdOfUser(seatOrder, myUserId);
          const targetId = getPlayerIdOfUser(seatOrder, userId);
          if (!hostPlayerId || !targetId) return;
          // The engine first: it only lets a player go while the table is at rest.
          await new Promise<void>((resolve) =>
            enqueue(async () => {
              try {
                await sendAction({ type: "kickPlayer", hostId: hostPlayerId, playerId: targetId });
              } finally {
                resolve();
              }
            }),
          );
          if (useGameStore.getState().players.some((player) => player.id === targetId)) {
            toast("Attends la fin de l’action en cours pour exclure ce joueur.", "bad");
            return;
          }
        }
        await kickPlayerFromRoom(code, userId);
        await resync();
        broadcast({ kind: "kicked", userId });
      }),

    requestRejoin: (name, avatar) =>
      run(async () => {
        const code = get().preview?.code;
        if (!code) return;
        await ensureSession();
        const status = await requestRejoinInRoom(code, name, avatar);
        if (status === "refused") throw new Error("L’hôte a refusé ton retour dans ce salon.");
        set({ rejoinWaitingFor: code });
        const wait = window.setInterval(() => {
          void (async () => {
            if (get().rejoinWaitingFor !== code) {
              window.clearInterval(wait);
              return;
            }
            try {
              const answer = await fetchRejoinStatus(code);
              if (answer === "pending") return;
              window.clearInterval(wait);
              set({ rejoinWaitingFor: null });
              if (answer === "refused") {
                toast("L’hôte a refusé ton retour.", "bad");
                set({ preview: null });
                return;
              }
              if (answer === "accepted") {
                toast("L’hôte t’a laissé revenir !", "good");
                reinstating = true;
                set({ preview: null });
                await get().lookUpRoom(code);
              }
            } catch {
              // The next poll tries again.
            }
          })();
        }, REJOIN_POLL_MS);
      }),

    cancelRejoinWait: () => set({ rejoinWaitingFor: null }),

    answerRejoin: (userId, accept) =>
      run(async () => {
        const { code, myUserId, hostId, rejoinRequests } = get();
        if (!code || !myUserId || myUserId !== hostId) return;
        await answerRejoinInRoom(code, userId, accept);
        set({ rejoinRequests: rejoinRequests.filter((request) => request.userId !== userId) });
        if (accept) {
          await resync();
          broadcast({ kind: "roster" });
        }
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
