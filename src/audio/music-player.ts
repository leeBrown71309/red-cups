import { audioEngine } from "./audio-engine";
import { useAudioSettings } from "./audio-settings";

export type MusicMood = "calm" | "tense";

interface MoodDefinition {
  tempo: number;
  /** Chord tones per bar, as MIDI note numbers. */
  chords: number[][];
  bass: number[];
  bassSteps: number[];
  kickSteps: number[];
  hatSteps: number[];
  melodySteps: number[];
  padFilter: number;
}

const MOODS: Record<MusicMood, MoodDefinition> = {
  calm: {
    tempo: 96,
    chords: [
      [60, 64, 67, 71],
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 64],
    ],
    bass: [48, 45, 41, 43],
    bassSteps: [0, 7, 8, 14],
    kickSteps: [0, 8],
    hatSteps: [2, 6, 10, 14],
    melodySteps: [0, 3, 6, 8, 10, 12, 14],
    padFilter: 1_500,
  },
  tense: {
    tempo: 84,
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [50, 53, 57],
      [52, 56, 59],
    ],
    bass: [45, 41, 38, 40],
    bassSteps: [0, 3, 6, 8, 11, 14],
    kickSteps: [0, 6, 8],
    hatSteps: [],
    melodySteps: [0, 4, 8, 12],
    padFilter: 800,
  },
};

const STEPS_PER_BAR = 16;
const LOOKAHEAD_SECONDS = 0.14;

function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/**
 * Cosy background loop built from a four-chord progression. A lookahead
 * scheduler keeps timing tight even when the main thread is busy rendering.
 */
class MusicPlayer {
  private timer: number | null = null;
  private step = 0;
  private bar = 0;
  private nextStepTime = 0;
  private mood: MusicMood = "calm";
  private pendingMood: MusicMood = "calm";

  constructor() {
    audioEngine.onUnlock(() => this.syncWithSettings());
    useAudioSettings.subscribe(() => this.syncWithSettings());
  }

  setMood(mood: MusicMood): void {
    this.pendingMood = mood;
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
      if (this.step === 0) this.mood = this.pendingMood;
      this.playStep(this.step, this.nextStepTime);
      const definition = MOODS[this.mood];
      this.nextStepTime += 60 / definition.tempo / 4;
      this.step = (this.step + 1) % STEPS_PER_BAR;
      if (this.step === 0) this.bar += 1;
    }
  }

  private playStep(step: number, time: number): void {
    const output = audioEngine.musicOutput;
    if (!output) return;
    const definition = MOODS[this.mood];
    const chordIndex = this.bar % definition.chords.length;
    const chord = definition.chords[chordIndex];
    const stepLength = 60 / definition.tempo / 4;

    if (step === 0) {
      for (const note of chord) {
        audioEngine.tone({
          type: "triangle",
          frequency: midiToFrequency(note),
          start: time,
          duration: stepLength * STEPS_PER_BAR * 0.98,
          attack: 0.3,
          release: 0.6,
          gain: 0.022,
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
        type: this.mood === "calm" ? "triangle" : "sine",
        frequency: midiToFrequency(chord[index] + octave),
        start: time,
        duration: this.mood === "calm" ? 0.22 : 0.4,
        gain: 0.04,
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
