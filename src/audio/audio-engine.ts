import { useAudioSettings } from "./audio-settings";

export interface ToneOptions {
  type?: OscillatorType;
  frequency: number;
  /** Optional glide target reached at the end of the note. */
  frequencyEnd?: number;
  start?: number;
  duration: number;
  attack?: number;
  release?: number;
  gain?: number;
  destination?: AudioNode;
  filterFrequency?: number;
  detune?: number;
}

export interface NoiseOptions {
  start?: number;
  duration: number;
  gain?: number;
  filterType?: BiquadFilterType;
  filterFrequency?: number;
  filterFrequencyEnd?: number;
  q?: number;
  destination?: AudioNode;
}

/**
 * Tiny synthesiser shared by sound effects and music. Everything is generated
 * at runtime, so the game ships without audio files or licensing concerns.
 */
class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly unlockListeners = new Set<() => void>();

  /** Browsers only allow audio after a user gesture; call this from one. */
  unlock(): void {
    if (!this.context) {
      const AudioContextClass =
        window.AudioContext ??
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!AudioContextClass) return;
      try {
        this.context = new AudioContextClass();
      } catch (error) {
        console.warn("Audio is unavailable in this browser.", error);
        return;
      }
      this.master = this.context.createGain();
      this.master.gain.value = 0.9;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.ratio.value = 3;
      this.master.connect(compressor).connect(this.context.destination);
      this.sfxBus = this.context.createGain();
      this.musicBus = this.context.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.applySettings();
      useAudioSettings.subscribe(() => this.applySettings());
      this.unlockListeners.forEach((listener) => listener());
    }
    if (this.context.state === "suspended") void this.context.resume().catch(() => undefined);
  }

  onUnlock(listener: () => void): () => void {
    this.unlockListeners.add(listener);
    if (this.context) listener();
    return () => this.unlockListeners.delete(listener);
  }

  get ready(): boolean {
    return this.context !== null && this.context.state === "running";
  }

  get now(): number {
    return this.context?.currentTime ?? 0;
  }

  get sfxOutput(): AudioNode | null {
    return useAudioSettings.getState().sfxEnabled ? this.sfxBus : null;
  }

  get musicOutput(): AudioNode | null {
    return this.musicBus;
  }

  tone(options: ToneOptions): void {
    const context = this.context;
    const destination = options.destination ?? this.sfxOutput;
    if (!context || !destination) return;

    const start = options.start ?? context.currentTime;
    const attack = options.attack ?? 0.005;
    const release = options.release ?? 0.08;
    const peak = options.gain ?? 0.2;
    const end = start + options.duration;

    const oscillator = context.createOscillator();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(options.frequency, start);
    if (options.frequencyEnd) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.frequencyEnd), end);
    }
    if (options.detune) oscillator.detune.value = options.detune;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(peak, start + attack);
    envelope.gain.setValueAtTime(peak, Math.max(start + attack, end - release));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    let output: AudioNode = envelope;
    if (options.filterFrequency) {
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = options.filterFrequency;
      envelope.connect(filter);
      output = filter;
    }

    oscillator.connect(envelope);
    output.connect(destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  noise(options: NoiseOptions): void {
    const context = this.context;
    const destination = options.destination ?? this.sfxOutput;
    if (!context || !destination) return;

    const start = options.start ?? context.currentTime;
    const end = start + options.duration;
    const source = context.createBufferSource();
    source.buffer = this.getNoiseBuffer(context);
    source.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = options.filterType ?? "bandpass";
    filter.frequency.setValueAtTime(options.filterFrequency ?? 2_000, start);
    if (options.filterFrequencyEnd) {
      filter.frequency.exponentialRampToValueAtTime(options.filterFrequencyEnd, end);
    }
    filter.Q.value = options.q ?? 1;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(options.gain ?? 0.2, start + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter).connect(envelope).connect(destination);
    source.start(start);
    source.stop(end + 0.02);
  }

  private applySettings(): void {
    const settings = useAudioSettings.getState();
    const context = this.context;
    if (!context || !this.sfxBus || !this.musicBus) return;
    const now = context.currentTime;
    this.sfxBus.gain.setTargetAtTime(settings.sfxEnabled ? settings.sfxVolume : 0, now, 0.05);
    this.musicBus.gain.setTargetAtTime(settings.musicEnabled ? settings.musicVolume * 0.55 : 0, now, 0.25);
  }

  private getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }
}

export const audioEngine = new AudioEngine();
