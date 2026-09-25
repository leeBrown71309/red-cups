import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export interface AudioSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  setMusicEnabled: (enabled: boolean) => void;
  setSfxEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
}

/** Private windows can block storage: preferences then simply last for the session. */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Ignored on purpose: losing a volume preference is harmless.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Same as above.
    }
  },
};

const clampVolume = (volume: number) => Math.min(1, Math.max(0, volume));

export const useAudioSettings = create<AudioSettings>()(
  persist(
    (set) => ({
      musicEnabled: true,
      sfxEnabled: true,
      musicVolume: 0.45,
      sfxVolume: 0.8,
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setSfxEnabled: (sfxEnabled) => set({ sfxEnabled }),
      setMusicVolume: (volume) => set({ musicVolume: clampVolume(volume) }),
      setSfxVolume: (volume) => set({ sfxVolume: clampVolume(volume) }),
    }),
    {
      name: "red-cups-audio",
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ musicEnabled, sfxEnabled, musicVolume, sfxVolume }) => ({
        musicEnabled,
        sfxEnabled,
        musicVolume,
        sfxVolume,
      }),
    },
  ),
);
