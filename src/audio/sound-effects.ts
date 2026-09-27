import { audioEngine } from "./audio-engine";

/** Note frequencies used by the jingles, in Hz. */
const NOTE = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392,
  A4: 440,
  Bb4: 466.16,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880,
  B5: 987.77,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
} as const;

function at(offset: number): number {
  return audioEngine.now + offset;
}

function arpeggio(notes: number[], step: number, options: { type?: OscillatorType; gain?: number; length?: number }) {
  notes.forEach((frequency, index) => {
    audioEngine.tone({
      type: options.type ?? "triangle",
      frequency,
      start: at(index * step),
      duration: options.length ?? step * 1.6,
      gain: options.gain ?? 0.16,
      release: 0.1,
    });
  });
}

/**
 * Every sound of the game, synthesised on demand. Names describe the moment
 * they accompany rather than the waveform, so call sites read naturally.
 */
export const soundEffects = {
  click(): void {
    audioEngine.tone({ type: "sine", frequency: 720, frequencyEnd: 420, duration: 0.07, gain: 0.14 });
  },

  softPop(): void {
    audioEngine.tone({ type: "sine", frequency: 380, frequencyEnd: 820, duration: 0.09, gain: 0.12 });
  },

  hop(): void {
    const pitch = 1 + (Math.random() - 0.5) * 0.16;
    audioEngine.tone({
      type: "triangle",
      frequency: 260 * pitch,
      frequencyEnd: 560 * pitch,
      duration: 0.1,
      gain: 0.13,
    });
    audioEngine.noise({ duration: 0.05, gain: 0.05, filterType: "lowpass", filterFrequency: 900 });
  },

  /** Banquise: the blizzard howls across the board. */
  blizzardWind(): void {
    audioEngine.noise({ duration: 2.4, gain: 0.09, filterFrequency: 600, filterFrequencyEnd: 1_800, q: 2.5 });
    audioEngine.noise({
      start: at(0.4),
      duration: 1.8,
      gain: 0.06,
      filterFrequency: 2_400,
      filterFrequencyEnd: 900,
      q: 4,
    });
    audioEngine.tone({ type: "sine", frequency: 320, frequencyEnd: 520, duration: 1.6, gain: 0.03 });
  },

  /** Banquise: chunks of ice crash down. */
  iceFall(): void {
    audioEngine.tone({ type: "sine", frequency: 1_600, frequencyEnd: 400, duration: 0.4, gain: 0.05 });
    audioEngine.noise({ start: at(0.45), duration: 0.35, gain: 0.14, filterType: "highpass", filterFrequency: 2_000 });
    audioEngine.tone({
      type: "triangle",
      frequency: 140,
      frequencyEnd: 60,
      start: at(0.45),
      duration: 0.3,
      gain: 0.12,
    });
  },

  /** Banquise: a block of ice bursts open. */
  iceShatter(): void {
    audioEngine.noise({ duration: 0.3, gain: 0.12, filterType: "highpass", filterFrequency: 3_500 });
    arpeggio([2_093, 2_637, 3_136], 0.04, { type: "sine", gain: 0.04, length: 0.12 });
  },

  /** Banquise: a pawn skids on across the ice. */
  iceSlide(): void {
    audioEngine.noise({ duration: 0.34, gain: 0.07, filterFrequency: 5_500, filterFrequencyEnd: 2_200, q: 1.5 });
    audioEngine.tone({ type: "sine", frequency: 1_900, frequencyEnd: 1_300, duration: 0.3, gain: 0.03 });
  },

  tunnel(): void {
    audioEngine.tone({ type: "sine", frequency: 300, frequencyEnd: 1400, duration: 0.3, gain: 0.12 });
    audioEngine.noise({ duration: 0.35, gain: 0.08, filterFrequency: 600, filterFrequencyEnd: 4_000, q: 3 });
  },

  coinGain(): void {
    audioEngine.tone({ type: "square", frequency: NOTE.B5, duration: 0.08, gain: 0.07, filterFrequency: 5_000 });
    audioEngine.tone({
      type: "square",
      frequency: NOTE.E6,
      start: at(0.08),
      duration: 0.28,
      gain: 0.07,
      filterFrequency: 5_000,
    });
  },

  coinLoss(): void {
    audioEngine.tone({
      type: "sawtooth",
      frequency: NOTE.G4,
      frequencyEnd: 370,
      duration: 0.18,
      gain: 0.08,
      filterFrequency: 1_400,
    });
    audioEngine.tone({
      type: "sawtooth",
      frequency: NOTE.D4,
      frequencyEnd: 230,
      start: at(0.2),
      duration: 0.38,
      gain: 0.08,
      filterFrequency: 1_100,
    });
  },

  cupCollected(): void {
    arpeggio([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.09, { gain: 0.15 });
    arpeggio([NOTE.E6, NOTE.G6], 0.07, { type: "sine", gain: 0.08 });
    audioEngine.tone({
      type: "triangle",
      frequency: NOTE.C6,
      start: at(0.36),
      duration: 0.6,
      gain: 0.12,
      release: 0.4,
    });
  },

  shopBell(): void {
    [NOTE.G5, NOTE.C6].forEach((frequency, index) => {
      audioEngine.tone({ type: "sine", frequency, start: at(index * 0.12), duration: 0.8, gain: 0.12, release: 0.7 });
      audioEngine.tone({
        type: "sine",
        frequency: frequency * 2.76,
        start: at(index * 0.12),
        duration: 0.35,
        gain: 0.03,
        release: 0.3,
      });
    });
  },

  purchase(): void {
    audioEngine.noise({ duration: 0.08, gain: 0.12, filterType: "highpass", filterFrequency: 3_000 });
    audioEngine.tone({ type: "sine", frequency: 2_637, start: at(0.06), duration: 0.35, gain: 0.08, release: 0.3 });
    audioEngine.tone({ type: "sine", frequency: 3_136, start: at(0.1), duration: 0.4, gain: 0.06, release: 0.35 });
  },

  wheelTick(speed: number): void {
    audioEngine.noise({
      duration: 0.03,
      gain: 0.05 + Math.min(0.08, speed * 0.02),
      filterType: "highpass",
      filterFrequency: 2_400,
    });
  },

  wheelStop(positive: boolean): void {
    if (positive) {
      arpeggio([NOTE.E5, NOTE.A5, NOTE.C6], 0.08, { gain: 0.13 });
    } else {
      arpeggio([NOTE.E4, NOTE.C4], 0.16, { type: "sawtooth", gain: 0.07, length: 0.3 });
    }
  },

  hellRumble(): void {
    audioEngine.tone({
      type: "sawtooth",
      frequency: 55,
      frequencyEnd: 42,
      duration: 1.3,
      gain: 0.14,
      filterFrequency: 380,
    });
    audioEngine.noise({
      duration: 1.1,
      gain: 0.08,
      filterType: "lowpass",
      filterFrequency: 500,
      filterFrequencyEnd: 120,
    });
    arpeggio([NOTE.A4, NOTE.C5, 622.25], 0.12, { type: "sawtooth", gain: 0.04, length: 0.7 });
  },

  duelDrums(): void {
    [0, 0.22, 0.44, 0.56].forEach((offset, index) => {
      audioEngine.tone({
        type: "sine",
        frequency: 120,
        frequencyEnd: 45,
        start: at(offset),
        duration: 0.22,
        gain: 0.3,
      });
      if (index % 2 === 1) audioEngine.noise({ start: at(offset), duration: 0.12, gain: 0.1, filterFrequency: 1_800 });
    });
  },

  turnStart(): void {
    audioEngine.tone({ type: "triangle", frequency: NOTE.E5, duration: 0.14, gain: 0.12 });
    audioEngine.tone({
      type: "triangle",
      frequency: NOTE.A5,
      start: at(0.12),
      duration: 0.3,
      gain: 0.12,
      release: 0.2,
    });
  },

  itemUsed(): void {
    audioEngine.noise({ duration: 0.42, gain: 0.12, filterFrequency: 400, filterFrequencyEnd: 3_500, q: 2 });
    audioEngine.tone({ type: "sine", frequency: 500, frequencyEnd: 1_100, duration: 0.3, gain: 0.06 });
  },

  /** A Tomate lobbed across the board, then squashed on its target. */
  tomatoThrow(flightSeconds: number, delay = 0): void {
    audioEngine.noise({
      start: at(delay),
      duration: 0.28,
      gain: 0.07,
      filterFrequency: 900,
      filterFrequencyEnd: 2_600,
      q: 3,
    });
    audioEngine.noise({
      start: at(delay + flightSeconds),
      duration: 0.22,
      gain: 0.2,
      filterType: "lowpass",
      filterFrequency: 1_400,
      filterFrequencyEnd: 220,
    });
    audioEngine.tone({
      type: "sine",
      frequency: 220,
      frequencyEnd: 90,
      start: at(delay + flightSeconds),
      duration: 0.16,
      gain: 0.12,
    });
  },

  /** Banquise: a snowball whistles through the air and bursts into powder. */
  snowballThrow(flightSeconds: number): void {
    audioEngine.noise({ duration: 0.3, gain: 0.05, filterFrequency: 1_800, filterFrequencyEnd: 3_800, q: 4 });
    audioEngine.noise({
      start: at(flightSeconds),
      duration: 0.25,
      gain: 0.14,
      filterType: "highpass",
      filterFrequency: 1_200,
    });
  },

  /** The rare Tomate that knocks its target out: a cartoon bonk and a few dizzy chirps. */
  tomatoKnockOut(delay: number): void {
    audioEngine.tone({
      type: "square",
      frequency: 190,
      frequencyEnd: 120,
      start: at(delay),
      duration: 0.14,
      gain: 0.08,
    });
    [1_318, 1_568, 1_318, 1_760].forEach((frequency, index) => {
      audioEngine.tone({ type: "sine", frequency, start: at(delay + 0.18 + index * 0.09), duration: 0.08, gain: 0.04 });
    });
  },

  mudSplat(): void {
    audioEngine.noise({
      duration: 0.3,
      gain: 0.18,
      filterType: "lowpass",
      filterFrequency: 700,
      filterFrequencyEnd: 150,
    });
    audioEngine.tone({ type: "sine", frequency: 140, frequencyEnd: 60, duration: 0.25, gain: 0.18 });
  },

  /** Two-tone siren: Bullet Bill has just landed on the start. */
  bulletAlarm(): void {
    for (let index = 0; index < 4; index += 1) {
      audioEngine.tone({
        type: "square",
        frequency: index % 2 === 0 ? 880 : 660,
        start: at(index * 0.2),
        duration: 0.18,
        gain: 0.05,
        filterFrequency: 2_400,
      });
    }
  },

  /** Engine revving up, then the whistle of the charge. */
  bulletCharge(): void {
    audioEngine.noise({ duration: 0.7, gain: 0.1, filterFrequency: 300, filterFrequencyEnd: 2_600, q: 3 });
    audioEngine.tone({
      type: "sawtooth",
      frequency: 90,
      frequencyEnd: 240,
      duration: 0.7,
      gain: 0.05,
      filterFrequency: 900,
    });
    audioEngine.tone({ type: "sine", frequency: 1_700, frequencyEnd: 450, start: at(0.7), duration: 0.9, gain: 0.08 });
  },

  explosion(): void {
    audioEngine.tone({ type: "sine", frequency: 120, frequencyEnd: 30, duration: 0.9, gain: 0.4 });
    audioEngine.tone({ type: "triangle", frequency: 70, frequencyEnd: 25, duration: 1.1, gain: 0.25 });
    audioEngine.noise({
      duration: 1.2,
      gain: 0.32,
      filterType: "lowpass",
      filterFrequency: 3_200,
      filterFrequencyEnd: 120,
    });
    audioEngine.noise({ start: at(0.05), duration: 0.5, gain: 0.12, filterFrequency: 5_000, q: 0.7 });
  },

  /** Tour de Bénédiction: a rising, sparkly fanfare. */
  blessing(): void {
    arpeggio([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6], 0.09, { gain: 0.11, length: 0.35 });
    audioEngine.tone({ type: "sine", frequency: NOTE.C6, start: at(0.55), duration: 0.8, gain: 0.06 });
  },

  snore(): void {
    audioEngine.tone({
      type: "triangle",
      frequency: 180,
      frequencyEnd: 120,
      duration: 0.5,
      gain: 0.08,
      filterFrequency: 700,
    });
  },

  error(): void {
    audioEngine.tone({ type: "square", frequency: 180, duration: 0.09, gain: 0.06, filterFrequency: 1_200 });
    audioEngine.tone({
      type: "square",
      frequency: 150,
      start: at(0.11),
      duration: 0.12,
      gain: 0.06,
      filterFrequency: 1_200,
    });
  },

  victory(): void {
    const melody = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6, NOTE.E6];
    const rhythm = [0, 0.12, 0.24, 0.36, 0.6, 0.72, 0.96];
    melody.forEach((frequency, index) => {
      audioEngine.tone({
        type: "square",
        frequency,
        start: at(rhythm[index]),
        duration: index === melody.length - 1 ? 0.9 : 0.16,
        gain: 0.07,
        filterFrequency: 4_000,
        release: 0.12,
      });
      audioEngine.tone({
        type: "triangle",
        frequency: frequency / 2,
        start: at(rhythm[index]),
        duration: 0.2,
        gain: 0.08,
      });
    });
  },

  duelWin(): void {
    arpeggio([NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5], 0.08, { gain: 0.13 });
  },

  coinFlip(): void {
    for (let index = 0; index < 8; index += 1) {
      audioEngine.tone({
        type: "sine",
        frequency: 2_200 + index * 90,
        start: at(index * 0.09),
        duration: 0.04,
        gain: 0.05,
      });
    }
  },

  /** Luna Park: the carousel changes direction, a wobbly fairground organ run up then down. */
  carouselFlip(): void {
    arpeggio([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.E5, NOTE.C5], 0.07, {
      type: "square",
      gain: 0.06,
      length: 0.12,
    });
    audioEngine.tone({ type: "sine", frequency: 220, frequencyEnd: 330, start: at(0.1), duration: 0.45, gain: 0.07 });
  },

  /** Luna Park: the ghost rises out of the ground, a wavering wail over a low rumble. */
  ghostAppear(): void {
    // Two voices a little out of tune beat against each other: the wail wavers like a theremin.
    for (const detune of [0, 38]) {
      audioEngine.tone({
        type: "sine",
        frequency: 240,
        frequencyEnd: 660,
        duration: 1.3,
        attack: 0.25,
        release: 0.5,
        gain: 0.06,
        detune,
      });
    }
    audioEngine.tone({
      type: "triangle",
      frequency: 880,
      frequencyEnd: 1_240,
      start: at(0.35),
      duration: 0.9,
      attack: 0.2,
      release: 0.5,
      gain: 0.02,
      detune: -25,
    });
    audioEngine.tone({
      type: "sawtooth",
      frequency: 52,
      frequencyEnd: 38,
      duration: 1.4,
      attack: 0.1,
      gain: 0.1,
      filterFrequency: 260,
    });
    audioEngine.noise({
      duration: 1.2,
      gain: 0.05,
      filterType: "lowpass",
      filterFrequency: 420,
      filterFrequencyEnd: 90,
    });
  },

  /** Luna Park: the ghost glides to the next carousel tile. */
  ghostWhoosh(delay = 0): void {
    audioEngine.noise({
      start: at(delay),
      duration: 0.6,
      gain: 0.07,
      filterFrequency: 380,
      filterFrequencyEnd: 1_900,
      q: 1.4,
    });
    audioEngine.tone({
      type: "sine",
      frequency: 520,
      frequencyEnd: 330,
      start: at(delay),
      duration: 0.55,
      attack: 0.15,
      gain: 0.025,
      detune: 30,
    });
  },

  /** Luna Park: the ghost's creepy cackle, a descending, wobbling "ha-ha-ha". */
  ghostLaugh(delay = 0): void {
    [640, 590, 540, 480, 420].forEach((frequency, index) => {
      const start = at(delay + index * 0.15);
      for (const detune of [0, 45]) {
        audioEngine.tone({
          type: "sawtooth",
          frequency,
          frequencyEnd: frequency * 0.86,
          start,
          duration: 0.12,
          attack: 0.015,
          release: 0.06,
          gain: 0.035,
          filterFrequency: 1_500,
          detune,
        });
      }
      audioEngine.noise({ start, duration: 0.1, gain: 0.025, filterFrequency: 1_300, q: 2 });
    });
  },

  /** Luna Park: the ghost's hand lands, a sharp crack over a thump. */
  ghostSlap(delay = 0): void {
    audioEngine.noise({ start: at(delay), duration: 0.07, gain: 0.2, filterType: "highpass", filterFrequency: 1_800 });
    audioEngine.noise({ start: at(delay), duration: 0.13, gain: 0.09, filterFrequency: 900, q: 1.2 });
    audioEngine.tone({
      type: "sine",
      frequency: 190,
      frequencyEnd: 60,
      start: at(delay),
      duration: 0.15,
      gain: 0.18,
    });
  },

  /** Luna Park: beaten, the ghost dissolves in a shimmer that sinks away. */
  ghostVanish(): void {
    arpeggio([2_093, 1_760, 1_480, 1_245, 1_047, 880], 0.08, { type: "sine", gain: 0.035, length: 0.25 });
    audioEngine.noise({ duration: 1, gain: 0.05, filterFrequency: 4_500, filterFrequencyEnd: 700, q: 3 });
    audioEngine.tone({
      type: "sine",
      frequency: 660,
      frequencyEnd: 180,
      duration: 1,
      attack: 0.05,
      release: 0.4,
      gain: 0.04,
      detune: 35,
    });
  },

  /** Basket: the soft whoosh of a throw. */
  basketShoot(): void {
    audioEngine.noise({ duration: 0.2, gain: 0.06, filterFrequency: 700, filterFrequencyEnd: 2_400, q: 1.2 });
    audioEngine.tone({ type: "sine", frequency: 300, frequencyEnd: 520, duration: 0.12, gain: 0.04 });
  },

  /** Basket: nothing but net. */
  basketSwish(): void {
    audioEngine.noise({ duration: 0.26, gain: 0.08, filterFrequency: 5_200, filterFrequencyEnd: 2_300, q: 0.8 });
    audioEngine.noise({
      start: at(0.06),
      duration: 0.2,
      gain: 0.04,
      filterFrequency: 3_800,
      filterFrequencyEnd: 1_600,
      q: 0.9,
    });
  },

  /** Basket: the ball clanks off the rim. */
  basketRim(): void {
    // Inharmonic partials, like struck metal.
    [
      [520, 0.06],
      [1_310, 0.04],
      [2_150, 0.025],
      [3_400, 0.015],
    ].forEach(([frequency, gain]) => {
      audioEngine.tone({ type: "sine", frequency, duration: 0.32, gain, release: 0.28 });
    });
    audioEngine.noise({ duration: 0.04, gain: 0.08, filterType: "highpass", filterFrequency: 2_500 });
  },

  /** Basket: time is up. */
  basketBuzzer(): void {
    for (const frequency of [220, 233]) {
      audioEngine.tone({
        type: "sawtooth",
        frequency,
        duration: 0.8,
        attack: 0.01,
        release: 0.08,
        gain: 0.045,
        filterFrequency: 1_600,
      });
    }
  },

  /** Basket: one tick of the countdown. */
  basketTick(): void {
    audioEngine.tone({ type: "triangle", frequency: 1_250, frequencyEnd: 950, duration: 0.05, gain: 0.07 });
  },

  reveal(): void {
    audioEngine.tone({ type: "triangle", frequency: NOTE.D5, duration: 0.1, gain: 0.1 });
    audioEngine.tone({ type: "triangle", frequency: NOTE.F5, start: at(0.08), duration: 0.18, gain: 0.1 });
    audioEngine.tone({ type: "triangle", frequency: NOTE.Bb4 * 2, start: at(0.16), duration: 0.3, gain: 0.1 });
  },
};
