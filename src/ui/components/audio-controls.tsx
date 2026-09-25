import { useAudioSettings } from "../../audio/audio-settings";
import { UiIcon } from "../icons/ui-icon";

/** Quick mute toggles, used in the lobby corner and the in-game top bar. */
export function AudioToggles() {
  const musicEnabled = useAudioSettings((state) => state.musicEnabled);
  const sfxEnabled = useAudioSettings((state) => state.sfxEnabled);
  const setMusicEnabled = useAudioSettings((state) => state.setMusicEnabled);
  const setSfxEnabled = useAudioSettings((state) => state.setSfxEnabled);

  return (
    <div className="audio-toggles">
      <button
        type="button"
        className={`icon-button ${musicEnabled ? "" : "is-off"}`}
        onClick={() => setMusicEnabled(!musicEnabled)}
        aria-pressed={musicEnabled}
        aria-label={musicEnabled ? "Couper la musique" : "Activer la musique"}
        title="Musique"
      >
        <UiIcon name="music" />
      </button>
      <button
        type="button"
        className={`icon-button ${sfxEnabled ? "" : "is-off"}`}
        onClick={() => setSfxEnabled(!sfxEnabled)}
        aria-pressed={sfxEnabled}
        aria-label={sfxEnabled ? "Couper les sons" : "Activer les sons"}
        title="Effets sonores"
      >
        <UiIcon name={sfxEnabled ? "sound" : "soundOff"} />
      </button>
    </div>
  );
}

/** Full sliders for the pause menu. */
export function AudioSliders() {
  const settings = useAudioSettings();

  return (
    <div className="audio-sliders">
      <div className="audio-slider">
        <span className="audio-slider__label">
          <UiIcon name="music" size={18} /> Musique
        </span>
        <input
          type="range"
          min={0}
          max={100}
          aria-label="Volume de la musique"
          value={Math.round(settings.musicVolume * 100)}
          disabled={!settings.musicEnabled}
          onChange={(event) => settings.setMusicVolume(Number(event.target.value) / 100)}
        />
        <button
          type="button"
          className={`pill-toggle ${settings.musicEnabled ? "is-on" : ""}`}
          onClick={() => settings.setMusicEnabled(!settings.musicEnabled)}
          aria-pressed={settings.musicEnabled}
        >
          {settings.musicEnabled ? "On" : "Off"}
        </button>
      </div>
      <div className="audio-slider">
        <span className="audio-slider__label">
          <UiIcon name="sound" size={18} /> Effets
        </span>
        <input
          type="range"
          min={0}
          max={100}
          aria-label="Volume des effets sonores"
          value={Math.round(settings.sfxVolume * 100)}
          disabled={!settings.sfxEnabled}
          onChange={(event) => settings.setSfxVolume(Number(event.target.value) / 100)}
        />
        <button
          type="button"
          className={`pill-toggle ${settings.sfxEnabled ? "is-on" : ""}`}
          onClick={() => settings.setSfxEnabled(!settings.sfxEnabled)}
          aria-pressed={settings.sfxEnabled}
        >
          {settings.sfxEnabled ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}
