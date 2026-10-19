import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The sound of the launch (report 2026-10-15): the audio context is built and asked to run as soon as the page
 * loads, and every kind of gesture asks again while it stays suspended.
 */

class FakeParam {
  value = 0;
  setValueAtTime() {}
  setTargetAtTime() {}
}

class FakeNode {
  gain = new FakeParam();
  threshold = new FakeParam();
  ratio = new FakeParam();
  connect<T>(node: T): T {
    return node;
  }
}

class FakeContext {
  static created = 0;
  static resumed = 0;
  state: "suspended" | "running" = "suspended";
  currentTime = 0;
  destination = new FakeNode();
  constructor() {
    FakeContext.created += 1;
  }
  createGain = () => new FakeNode();
  createDynamicsCompressor = () => new FakeNode();
  resume(): Promise<void> {
    FakeContext.resumed += 1;
    return Promise.resolve();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  FakeContext.created = 0;
  FakeContext.resumed = 0;
});

async function loadEngine() {
  vi.stubGlobal("window", { AudioContext: FakeContext });
  return import("./audio-engine");
}

describe("audio at launch", () => {
  it("builds the context and asks it to run before any gesture", async () => {
    const { audioEngine } = await loadEngine();
    expect(FakeContext.created).toBe(0);
    audioEngine.prime();
    expect(FakeContext.created).toBe(1);
    expect(FakeContext.resumed).toBe(1);
    // The music and the effects hang on the context: they exist as soon as it does.
    expect(audioEngine.musicOutput).not.toBeNull();
  });

  it("tells the music player the context exists, so it can start the moment the browser lets it play", async () => {
    const { audioEngine } = await loadEngine();
    const listener = vi.fn();
    audioEngine.onUnlock(listener);
    audioEngine.prime();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("asks again at every gesture while the browser keeps the context suspended, and builds it only once", async () => {
    const { audioEngine } = await loadEngine();
    audioEngine.prime();
    audioEngine.unlock();
    audioEngine.unlock();
    expect(FakeContext.created).toBe(1);
    expect(FakeContext.resumed).toBe(3);
  });

  it("stops asking once the context runs", async () => {
    const { audioEngine } = await loadEngine();
    audioEngine.prime();
    const resumedBefore = FakeContext.resumed;
    // The browser let it play: later gestures leave it alone.
    (audioEngine as unknown as { context: FakeContext }).context.state = "running";
    audioEngine.unlock();
    expect(FakeContext.resumed).toBe(resumedBefore);
    expect(audioEngine.ready).toBe(true);
  });

  it("wakes the context on a touch end, a click release and a key, not only on a press", async () => {
    const { AUDIO_UNLOCK_EVENTS } = await loadEngine();
    expect(AUDIO_UNLOCK_EVENTS).toEqual(
      expect.arrayContaining(["touchend", "click", "pointerup", "keydown", "pointerdown"]),
    );
  });
});
