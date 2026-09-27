import type { MapThemeId } from "../game/maps/map-types";
import { audioEngine } from "./audio-engine";
import { useAudioSettings } from "./audio-settings";
import type { MusicMood } from "./music-mood";

interface MoodDefinition {
  tempo: number;
  /** Sixteenth-note steps per bar: 16 for a 4/4 loop, 12 for a waltz. */
  stepsPerBar: number;
  /** Chord tones per bar, as MIDI note numbers. */
  chords: number[][];
  bass: number[];
  bassSteps: number[];
  /** Short chord hits (the "pah-pah" of a waltz), on top of or instead of the held pad. */
  stabSteps: number[];
  /** The held pad chord; a waltz leaves it out and lets the chord hits carry the harmony. */
  pad: boolean;
  kickSteps: number[];
  hatSteps: number[];
  melodySteps: number[];
  melodyWave: OscillatorType;
  melodyLength: number;
  padFilter: number;
}

/** Sunny toy box: the original cosy loop. */
const TOY_BOX_MOODS: Record<MusicMood, MoodDefinition> = {
  calm: {
    tempo: 96,
    stepsPerBar: 16,
    chords: [
      [60, 64, 67, 71],
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 64],
    ],
    bass: [48, 45, 41, 43],
    bassSteps: [0, 7, 8, 14],
    stabSteps: [],
    pad: true,
    kickSteps: [0, 8],
    hatSteps: [2, 6, 10, 14],
    melodySteps: [0, 3, 6, 8, 10, 12, 14],
    melodyWave: "triangle",
    melodyLength: 0.22,
    padFilter: 1_500,
  },
  // In Hell or a duel the toys go quiet: a slow minor lament over a heartbeat
  // kick, the bass sinking a semitone at a time, as dark as the other maps.
  tense: {
    tempo: 72,
    stepsPerBar: 16,
    chords: [
      [57, 60, 64],
      [58, 62, 65],
      [57, 60, 64],
      [56, 59, 62, 65],
    ],
    bass: [45, 46, 45, 44],
    bassSteps: [0, 8],
    stabSteps: [],
    pad: true,
    kickSteps: [0, 3],
    hatSteps: [],
    melodySteps: [0, 10],
    melodyWave: "sine",
    melodyLength: 0.6,
    padFilter: 650,
  },
};

/**
 * Night fair: a minor fairground waltz, bass on the beat and chord hits on
 * beats two and three, with a reedy organ tune. In Hell or a duel it slows
 * into a crooked, diminished carousel.
 */
const NIGHT_FAIR_MOODS: Record<MusicMood, MoodDefinition> = {
  calm: {
    tempo: 150,
    stepsPerBar: 12,
    chords: [
      [57, 60, 64],
      [57, 62, 65],
      [56, 59, 62, 64],
      [57, 60, 64],
      [53, 57, 60],
      [57, 62, 65],
      [52, 56, 59, 62],
      [52, 56, 59],
    ],
    bass: [45, 50, 40, 45, 41, 50, 40, 40],
    bassSteps: [0],
    stabSteps: [4, 8],
    pad: false,
    kickSteps: [],
    hatSteps: [8],
    melodySteps: [0, 2, 4, 6, 8, 10],
    melodyWave: "square",
    melodyLength: 0.16,
    padFilter: 1_300,
  },
  tense: {
    tempo: 104,
    stepsPerBar: 12,
    chords: [
      [57, 60, 63],
      [56, 59, 62],
      [55, 58, 61],
      [56, 59, 62],
    ],
    bass: [45, 44, 43, 44],
    bassSteps: [0, 6],
    stabSteps: [4, 8],
    pad: true,
    kickSteps: [0],
    hatSteps: [],
    melodySteps: [0, 6],
    melodyWave: "sine",
    melodyLength: 0.5,
    padFilter: 700,
  },
};

/**
 * Far north: a slow music box in 6/8, glassy high notes over a soft pad, like
 * wind chimes on the ice. In Hell or a duel the chimes turn cold and sparse.
 */
const POLAR_MOODS: Record<MusicMood, MoodDefinition> = {
  calm: {
    tempo: 84,
    stepsPerBar: 12,
    chords: [
      [52, 55, 59, 64],
      [48, 52, 55, 60],
      [55, 59, 62, 67],
      [50, 54, 57, 62],
    ],
    bass: [40, 36, 43, 38],
    bassSteps: [0, 6],
    stabSteps: [],
    pad: true,
    kickSteps: [],
    hatSteps: [],
    melodySteps: [0, 2, 3, 6, 8, 9],
    melodyWave: "sine",
    melodyLength: 0.45,
    padFilter: 1_100,
  },
  tense: {
    tempo: 66,
    stepsPerBar: 12,
    chords: [
      [52, 55, 58],
      [51, 54, 57],
      [50, 53, 56],
      [51, 54, 57],
    ],
    bass: [40, 39, 38, 39],
    bassSteps: [0],
    stabSteps: [],
    pad: true,
    kickSteps: [0],
    hatSteps: [],
    melodySteps: [0, 9],
    melodyWave: "sine",
    melodyLength: 0.8,
    padFilter: 650,
  },
};

const SOUNDTRACKS: Record<MapThemeId, Record<MusicMood, MoodDefinition>> = {
  "toy-box": TOY_BOX_MOODS,
  "night-fair": NIGHT_FAIR_MOODS,
  polar: POLAR_MOODS,
};

const LOOKAHEAD_SECONDS = 0.14;
/** How long the old soundtrack takes to fade away when another one takes over. */
const THEME_FADE_SECONDS = 0.35;

function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/**
 * Background loop built from a chord progression, with a soundtrack per map
 * theme and a calm or tense mood. A lookahead scheduler keeps timing tight
 * even when the main thread is busy rendering. The mood only changes on a bar
 * line so the music never stumbles; a new theme starts right away, while the
 * old one fades out, so browsing the maps plays each one at once.
 */
class MusicPlayer {
  private timer: number | null = null;
  private step = 0;
  private bar = 0;
  private nextStepTime = 0;
  private mood: MusicMood = "calm";
  private pendingMood: MusicMood = "calm";
  private theme: MapThemeId = "toy-box";
  private pendingTheme: MapThemeId = "toy-box";
  /** Every note of the current soundtrack goes through this gain, so it can be faded out as a whole. */
  private voice: GainNode | null = null;

  private readonly unsubscribers: (() => void)[];

  constructor() {
    this.unsubscribers = [
      audioEngine.onUnlock(() => this.syncWithSettings()),
      useAudioSettings.subscribe(() => this.syncWithSettings()),
    ];
  }

  /** Silences this player for good, so a replacement never plays on top of it. */
  dispose(): void {
    this.stop();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.voice?.disconnect();
    this.voice = null;
  }

  setMood(mood: MusicMood): void {
    this.pendingMood = mood;
  }

  /** The soundtrack of the map being played or browsed. */
  setTheme(theme: MapThemeId): void {
    this.pendingTheme = theme;
  }

  private get definition(): MoodDefinition {
    return SOUNDTRACKS[this.theme][this.mood];
  }

  private syncWithSettings(): void {
    const enabled = useAudioSettings.getState().musicEnabled;
    if (enabled && audioEngine.musicOutput) this.start();
    if (!enabled) this.stop();
  }

  private start(): void {
    if (this.timer !== null) return;
    this.step = 0;
    this.nextStepTime = audioEngine.now + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private stop(): void {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    if (!audioEngine.ready) return;
    // After a long pause (hidden tab) jump forward instead of flooding notes.
    if (this.nextStepTime < audioEngine.now - 0.5) this.nextStepTime = audioEngine.now + 0.05;

    while (this.nextStepTime < audioEngine.now + LOOKAHEAD_SECONDS) {
      if (this.theme !== this.pendingTheme) this.switchTheme(this.nextStepTime);
      else if (this.step === 0) this.mood = this.pendingMood;
      this.playStep(this.step, this.nextStepTime);
      const definition = this.definition;
      this.nextStepTime += 60 / definition.tempo / 4;
      this.step = (this.step + 1) % definition.stepsPerBar;
      if (this.step === 0) this.bar += 1;
    }
  }

  /** Fades the old soundtrack out, notes already scheduled included, and restarts the loop on the new one. */
  private switchTheme(time: number): void {
    const oldVoice = this.voice;
    if (oldVoice) {
      oldVoice.gain.setTargetAtTime(0, time, THEME_FADE_SECONDS / 3);
      // The longest note (a held pad) is over well before this.
      window.setTimeout(() => oldVoice.disconnect(), 4_000);
    }
    this.voice = null;
    this.theme = this.pendingTheme;
    this.mood = this.pendingMood;
    this.step = 0;
    this.bar = 0;
  }

  private getVoice(): GainNode | null {
    const output = audioEngine.musicOutput;
    if (!output) return null;
    if (!this.voice) {
      this.voice = output.context.createGain();
      this.voice.connect(output);
    }
    return this.voice;
  }

  private playStep(step: number, time: number): void {
    const output = this.getVoice();
    if (!output) return;
    const definition = this.definition;
    const chordIndex = this.bar % definition.chords.length;
    const chord = definition.chords[chordIndex];
    const stepLength = 60 / definition.tempo / 4;

    if (definition.pad && step === 0) {
      for (const note of chord) {
        audioEngine.tone({
          type: "triangle",
          frequency: midiToFrequency(note),
          start: time,
          duration: stepLength * definition.stepsPerBar * 0.98,
          attack: 0.3,
          release: 0.6,
          gain: 0.022,
          filterFrequency: definition.padFilter,
          destination: output,
        });
      }
    }

    if (definition.stabSteps.includes(step)) {
      for (const note of chord) {
        audioEngine.tone({
          type: "square",
          frequency: midiToFrequency(note),
          start: time,
          duration: stepLength * 1.4,
          gain: 0.018,
          release: 0.06,
          filterFrequency: definition.padFilter,
          destination: output,
        });
      }
    }

    if (definition.bassSteps.includes(step)) {
      const root = definition.bass[chordIndex];
      const note = step === 7 || step === 11 ? root + 7 : root;
      audioEngine.tone({
        type: "triangle",
        frequency: midiToFrequency(note),
        start: time,
        duration: stepLength * 1.8,
        gain: 0.085,
        release: 0.08,
        filterFrequency: 900,
        destination: output,
      });
    }

    if (definition.melodySteps.includes(step)) {
      // A deterministic walk through chord tones gives variety without randomness drift.
      const index = (step * 3 + this.bar * 5 + (step > 7 ? 1 : 0)) % chord.length;
      const octave = (this.bar + step) % 5 === 0 ? 24 : 12;
      audioEngine.tone({
        type: definition.melodyWave,
        frequency: midiToFrequency(chord[index] + octave),
        start: time,
        duration: definition.melodyLength,
        // A square wave sounds far louder than a triangle: the organ tune is tamed and filtered.
        gain: definition.melodyWave === "square" ? 0.022 : 0.04,
        filterFrequency: definition.melodyWave === "square" ? 2_400 : undefined,
        release: 0.18,
        destination: output,
      });
    }

    if (definition.kickSteps.includes(step)) {
      audioEngine.tone({
        type: "sine",
        frequency: 110,
        frequencyEnd: 42,
        start: time,
        duration: 0.16,
        gain: 0.14,
        destination: output,
      });
    }

    if (definition.hatSteps.includes(step)) {
      audioEngine.noise({
        start: time,
        duration: 0.035,
        gain: 0.03,
        filterType: "highpass",
        filterFrequency: 7_000,
        destination: output,
      });
    }
  }
}

export const musicPlayer = new MusicPlayer();

// A hot reload in development runs this file again and builds a fresh player,
// without telling the old one: it would keep playing its soundtrack under the
// new one. The hot-reload data outlives the reload, so the new player stops it.
if (import.meta.hot) {
  const hotData = import.meta.hot.data as { musicPlayer?: MusicPlayer };
  hotData.musicPlayer?.dispose();
  hotData.musicPlayer = musicPlayer;
}
