import { create } from "zustand";
import { useAudioSettings } from "../audio/audio-settings";
import { useUiStore } from "../feedback/ui-store";
import { VOICE_CHAT_ENABLED } from "./voice-feature";

/**
 * Voice chat of an online room: every device holds one WebRTC link to every
 * other device in the call, and no server carries the sound. The room's
 * private Realtime channel does the rest: presence says who is in the call
 * (and whether their mic is off), broadcast carries the offers and answers.
 *
 * Only STUN is configured: two devices behind strict NATs (some mobile
 * networks) may not hear each other. A TURN relay can be added to
 * ICE_SERVERS later without touching anything else.
 */

export interface VoiceSignal {
  type: "offer" | "answer";
  sdp: string;
}

/** One signalling message, addressed to a single device of the room. */
export interface VoiceWire {
  from: string;
  to: string;
  signal: VoiceSignal;
}

/** What a device says about itself in the room's presence. */
export interface VoicePresence {
  voice: boolean;
  muted: boolean;
}

export interface VoiceLink {
  selfId: string;
  send: (wire: VoiceWire) => void;
  /** Publishes this device's presence again, voice flags included. */
  announce: () => void;
}

interface VoiceState {
  /** This device's mic is captured and it is in the call. */
  active: boolean;
  starting: boolean;
  muted: boolean;
  error: string | null;
  /** Other devices in the call, by user id. */
  members: Record<string, { muted: boolean }>;
  /** State of this device's link to each of them. */
  links: Record<string, RTCPeerConnectionState>;
  /** Who is speaking right now, this device included. */
  talking: Record<string, boolean>;
}

const IDLE: Omit<VoiceState, "muted"> = {
  active: false,
  starting: false,
  error: null,
  members: {},
  links: {},
  talking: {},
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};
/** Candidates are sent in one SDP rather than trickled: two messages per link, well under the channel's rate limit. */
const GATHER_TIMEOUT_MS = 2_500;
/** A link that dropped is given this long to come back by itself before it is dialled again. */
const RECOVER_MS = 5_000;
const METER_MS = 180;
/** RMS level above which a voice counts as speaking. */
const SPEAKING_LEVEL = 0.045;

interface Peer {
  connection: RTCPeerConnection;
  audio: HTMLAudioElement;
  analyser: AnalyserNode | null;
  recoverTimer: number | null;
}

let link: VoiceLink | null = null;
let localStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let selfAnalyser: AnalyserNode | null = null;
let meter: number | null = null;
let unsubscribeSetting: (() => void) | null = null;
/** Bumped by every stop, so a mic request that answers late is dropped. */
let startToken = 0;
const peers = new Map<string, Peer>();
/** Last presence seen, so joining the call later knows whom to dial. */
let lastPresence: Record<string, VoicePresence> = {};

export const useVoiceStore = create<VoiceState>(() => ({ ...IDLE, muted: false }));

// ------------------------------------------------------------ pure rules

/** Exactly one side of a pair dials, so two offers never cross. */
export function shouldOffer(selfId: string, peerId: string): boolean {
  return selfId < peerId;
}

/** The devices to hold a link with: every other one that says it is in the call. */
export function selectVoicePeers(presence: Record<string, VoicePresence>, selfId: string): string[] {
  return Object.entries(presence)
    .filter(([id, entry]) => id !== selfId && entry.voice)
    .map(([id]) => id)
    .sort();
}

/** Reads the voice flags out of a Realtime presence state; a device may appear with several entries. */
export function readVoicePresence(
  state: Record<string, Array<{ voice?: unknown; muted?: unknown }>>,
): Record<string, VoicePresence> {
  return Object.fromEntries(
    Object.entries(state).map(([id, entries]) => {
      const latest = entries[entries.length - 1];
      return [id, { voice: entries.some((entry) => entry.voice === true), muted: latest?.muted === true }];
    }),
  );
}

export function describeMicError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Le micro a été refusé. Autorise-le dans les réglages du navigateur, puis réactive le chat vocal.";
  }
  if (name === "NotFoundError") return "Aucun micro trouvé sur cet appareil.";
  if (name === "NotReadableError") return "Le micro est déjà utilisé par une autre application.";
  return "Impossible d’ouvrir le micro.";
}

// ------------------------------------------------------ room integration

/** Plugs the voice chat into a room's channel; the setting then decides whether to join the call. */
export function attachVoice(next: VoiceLink): void {
  detachVoice();
  link = next;
  if (!VOICE_CHAT_ENABLED) return;
  unsubscribeSetting = useAudioSettings.subscribe((state, previous) => {
    if (state.voiceEnabled === previous.voiceEnabled) return;
    if (state.voiceEnabled) void startVoice();
    else stopVoice();
  });
}

/** Called once the channel is joined. */
export function joinVoiceIfEnabled(): void {
  // A setting saved while the feature was live must not open the mic now that it is hidden.
  if (VOICE_CHAT_ENABLED && useAudioSettings.getState().voiceEnabled) void startVoice();
}

/** Leaving the room: hang up and forget everything about it. */
export function detachVoice(): void {
  unsubscribeSetting?.();
  unsubscribeSetting = null;
  startToken += 1;
  teardown();
  link = null;
  lastPresence = {};
  useVoiceStore.setState({ ...IDLE });
}

export function getVoicePresence(): VoicePresence {
  return { voice: localStream !== null, muted: useVoiceStore.getState().muted };
}

export function setVoiceMuted(muted: boolean): void {
  useVoiceStore.setState({ muted });
  applyMute();
  link?.announce();
}

/** The room's presence changed: open the links that are missing, close the ones nobody needs. */
export function updateVoicePresence(presence: Record<string, VoicePresence>): void {
  lastPresence = presence;
  const selfId = link?.selfId;
  const members = Object.fromEntries(
    Object.entries(presence)
      .filter(([id, entry]) => id !== selfId && entry.voice)
      .map(([id, entry]) => [id, { muted: entry.muted }]),
  );
  useVoiceStore.setState({ members });
  if (!link || !localStream) return;

  const wanted = new Set(selectVoicePeers(presence, link.selfId));
  for (const id of peers.keys()) if (!wanted.has(id)) dropPeer(id);
  for (const id of wanted) {
    if (peers.has(id)) continue;
    if (shouldOffer(link.selfId, id)) void dial(id);
    else ensurePeer(id);
  }
}

export async function handleVoiceWire(wire: VoiceWire): Promise<void> {
  if (!link || !localStream || wire.to !== link.selfId) return;
  try {
    if (wire.signal.type === "offer") {
      // An offer on a link that already had one means the other side dialled again.
      if (peers.get(wire.from)?.connection.remoteDescription) dropPeer(wire.from);
      const { connection } = ensurePeer(wire.from);
      await connection.setRemoteDescription({ type: "offer", sdp: wire.signal.sdp });
      await connection.setLocalDescription(await connection.createAnswer());
      await waitForCandidates(connection);
      if (peers.get(wire.from)?.connection !== connection || !connection.localDescription) return;
      link.send({ from: link.selfId, to: wire.from, signal: { type: "answer", sdp: connection.localDescription.sdp } });
      return;
    }
    const peer = peers.get(wire.from);
    if (peer?.connection.signalingState === "have-local-offer") {
      await peer.connection.setRemoteDescription({ type: "answer", sdp: wire.signal.sdp });
    }
  } catch (error) {
    console.warn("Voice signalling failed", error);
    dropPeer(wire.from);
  }
}

// ------------------------------------------------------------- the call

async function startVoice(): Promise<void> {
  const { starting } = useVoiceStore.getState();
  if (!link || localStream || starting) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    fail("Le chat vocal demande une connexion sécurisée (https) et un navigateur récent.");
    return;
  }
  const token = startToken;
  useVoiceStore.setState({ starting: true, error: null });
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (token !== startToken || !link) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    localStream = stream;
    applyMute();
    audioContext = new AudioContext();
    void audioContext.resume().catch(() => undefined);
    selfAnalyser = createAnalyser(stream);
    meter = window.setInterval(measureVoices, METER_MS);
    useVoiceStore.setState({ active: true, starting: false });
    link.announce();
    updateVoicePresence(lastPresence);
  } catch (error) {
    if (token !== startToken) return;
    useVoiceStore.setState({ starting: false });
    fail(describeMicError(error));
  }
}

function stopVoice(): void {
  startToken += 1;
  teardown();
  useVoiceStore.setState({ active: false, starting: false, links: {}, talking: {} });
  link?.announce();
}

/** A failure turns the setting off, so the next room does not ask for the mic again. */
function fail(message: string): void {
  useVoiceStore.setState({ error: message });
  useUiStore.getState().pushToast({ id: `voice-${Date.now()}`, text: message, tone: "bad" });
  useAudioSettings.getState().setVoiceEnabled(false);
}

function teardown(): void {
  if (meter !== null) window.clearInterval(meter);
  meter = null;
  for (const id of [...peers.keys()]) dropPeer(id);
  localStream?.getTracks().forEach((track) => track.stop());
  localStream = null;
  selfAnalyser = null;
  void audioContext?.close().catch(() => undefined);
  audioContext = null;
}

function applyMute(): void {
  const { muted } = useVoiceStore.getState();
  localStream?.getAudioTracks().forEach((track) => {
    track.enabled = !muted;
  });
}

// -------------------------------------------------------------- the links

async function dial(id: string): Promise<void> {
  if (!link) return;
  const { connection } = ensurePeer(id);
  try {
    await connection.setLocalDescription(await connection.createOffer());
    await waitForCandidates(connection);
    if (peers.get(id)?.connection !== connection || !connection.localDescription || !link) return;
    link.send({ from: link.selfId, to: id, signal: { type: "offer", sdp: connection.localDescription.sdp } });
  } catch (error) {
    console.warn("Voice call failed", error);
    dropPeer(id);
  }
}

function ensurePeer(id: string): Peer {
  const existing = peers.get(id);
  if (existing) return existing;

  const connection = new RTCPeerConnection(ICE_SERVERS);
  // In the page rather than detached: iOS Safari only plays inline media that belongs to the document.
  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.setAttribute("playsinline", "");
  audio.hidden = true;
  document.body.appendChild(audio);
  const peer: Peer = { connection, audio, analyser: null, recoverTimer: null };
  peers.set(id, peer);

  localStream?.getTracks().forEach((track) => connection.addTrack(track, localStream!));
  connection.ontrack = ({ streams }) => {
    const [stream] = streams;
    if (!stream) return;
    audio.srcObject = stream;
    peer.analyser = createAnalyser(stream);
    playWhenAllowed(audio);
  };
  connection.onconnectionstatechange = () => {
    const state = connection.connectionState;
    useVoiceStore.setState((current) => ({ links: { ...current.links, [id]: state } }));
    if (peer.recoverTimer !== null) window.clearTimeout(peer.recoverTimer);
    peer.recoverTimer = null;
    if (state === "failed") redial(id);
    else if (state === "disconnected") peer.recoverTimer = window.setTimeout(() => redial(id), RECOVER_MS);
  };
  return peer;
}

/** Presence does not change when a link dies, so the link is rebuilt here, by the side that dials. */
function redial(id: string): void {
  dropPeer(id);
  if (!link || !localStream || !lastPresence[id]?.voice) return;
  if (shouldOffer(link.selfId, id)) void dial(id);
  else ensurePeer(id);
}

function dropPeer(id: string): void {
  const peer = peers.get(id);
  if (!peer) return;
  peers.delete(id);
  if (peer.recoverTimer !== null) window.clearTimeout(peer.recoverTimer);
  peer.connection.ontrack = null;
  peer.connection.onconnectionstatechange = null;
  peer.connection.close();
  peer.audio.srcObject = null;
  peer.audio.remove();
  useVoiceStore.setState((current) => {
    const { [id]: _link, ...links } = current.links;
    const { [id]: _talking, ...talking } = current.talking;
    return { links, talking };
  });
}

function waitForCandidates(connection: RTCPeerConnection): Promise<void> {
  if (connection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      connection.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => {
      if (connection.iceGatheringState === "complete") done();
    };
    const timer = window.setTimeout(done, GATHER_TIMEOUT_MS);
    connection.addEventListener("icegatheringstatechange", check);
  });
}

/** Browsers refuse to play sound before the first tap on the page: the next tap starts it. */
function playWhenAllowed(audio: HTMLAudioElement): void {
  void audio.play().catch(() => {
    const retry = () => void audio.play().catch(() => undefined);
    window.addEventListener("pointerdown", retry, { once: true, capture: true });
  });
}

// ------------------------------------------------------------ who speaks

function createAnalyser(stream: MediaStream): AnalyserNode | null {
  if (!audioContext) return null;
  try {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    return analyser;
  } catch {
    // Without a meter the call still works; only the speaking glow is lost.
    return null;
  }
}

function levelOf(analyser: AnalyserNode | null): number {
  if (!analyser) return 0;
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
  return Math.sqrt(sum / samples.length);
}

function measureVoices(): void {
  if (!link) return;
  const { muted, talking } = useVoiceStore.getState();
  const next: Record<string, boolean> = { [link.selfId]: !muted && levelOf(selfAnalyser) > SPEAKING_LEVEL };
  for (const [id, peer] of peers) next[id] = levelOf(peer.analyser) > SPEAKING_LEVEL;
  const changed =
    Object.keys(next).length !== Object.keys(talking).length ||
    Object.entries(next).some(([id, value]) => talking[id] !== value);
  if (changed) useVoiceStore.setState({ talking: next });
}
