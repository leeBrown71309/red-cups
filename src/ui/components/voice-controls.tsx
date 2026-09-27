import { useAudioSettings } from "../../audio/audio-settings";
import { useRoomStore } from "../../net/room-store";
import { setVoiceMuted, useVoiceStore } from "../../net/voice";
import { UiIcon } from "../icons/ui-icon";

/** Voice chat only exists at an online table, in its lobby or during its game. */
function useAtOnlineTable(): boolean {
  return useRoomStore((state) => state.view === "lobby" || state.view === "playing");
}

/** The setting, as a row of the audio settings: on, the device joins the call of every room. */
export function VoiceSettingRow() {
  const atTable = useAtOnlineTable();
  const enabled = useAudioSettings((state) => state.voiceEnabled);
  const setEnabled = useAudioSettings((state) => state.setVoiceEnabled);
  const status = useVoiceStatus();
  if (!atTable) return null;

  return (
    <div className="audio-slider voice-setting">
      <span className="audio-slider__label">
        <UiIcon name="mic" size={18} /> Vocal
      </span>
      <span className="voice-setting__status">{status}</span>
      <button
        type="button"
        className={`pill-toggle ${enabled ? "is-on" : ""}`}
        onClick={() => setEnabled(!enabled)}
        aria-pressed={enabled}
        aria-label={enabled ? "Désactiver le chat vocal" : "Activer le chat vocal"}
      >
        {enabled ? "On" : "Off"}
      </button>
    </div>
  );
}

/**
 * The quick mic button of the lobby corner and the top bar: it turns the
 * voice chat on, then mutes and unmutes the mic.
 */
export function VoiceMicButton() {
  const atTable = useAtOnlineTable();
  const enabled = useAudioSettings((state) => state.voiceEnabled);
  const setEnabled = useAudioSettings((state) => state.setVoiceEnabled);
  const active = useVoiceStore((state) => state.active);
  const starting = useVoiceStore((state) => state.starting);
  const muted = useVoiceStore((state) => state.muted);
  if (!atTable) return null;

  const live = enabled && active;
  const label = !enabled ? "Activer le chat vocal" : muted ? "Réactiver le micro" : "Couper le micro";
  return (
    <button
      type="button"
      className={`icon-button ${live && !muted ? "is-live" : "is-off"}`}
      onClick={() => (!enabled ? setEnabled(true) : setVoiceMuted(!muted))}
      disabled={enabled && starting}
      aria-pressed={live && !muted}
      aria-label={label}
      title={label}
    >
      <UiIcon name={live && !muted ? "mic" : "micOff"} />
    </button>
  );
}

/**
 * Next to a player's name: whether they are in the call, muted, speaking.
 * Shown only once this device is in the call itself.
 */
export function VoiceBadge({ userId }: { userId: string | null }) {
  const myUserId = useRoomStore((state) => state.myUserId);
  const active = useVoiceStore((state) => state.active);
  const member = useVoiceStore((state) => (userId ? state.members[userId] : undefined));
  const myMuted = useVoiceStore((state) => state.muted);
  const linked = useVoiceStore((state) => (userId ? state.links[userId] === "connected" : false));
  const talking = useVoiceStore((state) => (userId ? state.talking[userId] === true : false));
  if (!active || !userId) return null;

  const isMe = userId === myUserId;
  if (!isMe && !(member && linked)) return null;
  const muted = isMe ? myMuted : member!.muted;
  return (
    <span
      className={`voice-badge ${talking && !muted ? "is-talking" : ""} ${muted ? "is-muted" : ""}`}
      title={muted ? "Micro coupé" : talking ? "Parle" : "Dans le vocal"}
    >
      <UiIcon name={muted ? "micOff" : "mic"} size={12} strokeWidth={2.8} />
    </span>
  );
}

function useVoiceStatus(): string {
  const enabled = useAudioSettings((state) => state.voiceEnabled);
  const { active, starting, muted, error, members, links } = useVoiceStore();
  if (!enabled) return error ?? "Désactivé";
  if (starting) return "Ouverture du micro…";
  if (!active) return "En attente";
  const heard = Object.keys(members).filter((id) => links[id] === "connected").length;
  const others = heard === 0 ? "personne d’autre" : `${heard} joueur${heard > 1 ? "s" : ""}`;
  return muted ? `Micro coupé · ${others}` : `Avec ${others}`;
}
