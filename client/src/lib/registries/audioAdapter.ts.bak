export type BeatFrame = {
  /** 0..1 envelope of the current beat (peaks on beat, decays in between) */
  intensity: number;
  /** true on the single frame where a new beat fires */
  isBeat: boolean;
  /** arbitrary low-frequency energy 0..1, for ambient breathing */
  energy: number;
};

export type AudioProvider = {
  id: string;
  name: string;
  start(): Promise<void> | void;
  stop(): void;
  /** Register a per-frame callback. Returns an unsubscribe function. */
  onFrame(cb: (frame: BeatFrame) => void): () => void;
};

/**
 * Deterministic simulated beat generator. 120 BPM by default, exponential
 * decay between beats, slow sine "breathing" for ambient energy.
 *
 * Plug-in point: implement AudioProvider with a real source (Spotify SDK,
 * Web Audio mic input, uploaded file + AnalyserNode) and call
 * setAudioProvider(realProvider). The ParticleField subscribes via onFrame
 * and will react automatically.
 *
 * Do not illegally embed copyrighted streams here. Build the adapter so a
 * legal provider can be dropped in.
 */
export function createSimulatedBeat(bpm = 120): AudioProvider {
  let raf = 0;
  let running = false;
  const listeners = new Set<(f: BeatFrame) => void>();
  const beatIntervalMs = 60_000 / bpm;
  let startAt = 0;
  let lastBeatAt = 0;

  function loop(now: number) {
    if (!running) return;
    const sinceStart = now - startAt;
    const sinceBeat = now - lastBeatAt;

    let isBeat = false;
    if (sinceBeat >= beatIntervalMs) {
      lastBeatAt = now;
      isBeat = true;
    }

    const decay = Math.max(0, 1 - (now - lastBeatAt) / beatIntervalMs);
    const intensity = Math.pow(decay, 2.2);
    const energy = 0.35 + 0.35 * Math.sin(sinceStart / 900);

    const frame: BeatFrame = { intensity, isBeat, energy };
    listeners.forEach((cb) => cb(frame));

    raf = requestAnimationFrame(loop);
  }

  return {
    id: "simulated-beat",
    name: "Simulated Beat (120 BPM)",
    start() {
      if (running) return;
      running = true;
      startAt = performance.now();
      lastBeatAt = startAt;
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    onFrame(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

// Phase 1: single-provider model. Phase 2 can expose a provider picker.
let _provider: AudioProvider = createSimulatedBeat();

export function getAudioProvider(): AudioProvider {
  return _provider;
}

export function setAudioProvider(provider: AudioProvider) {
  _provider.stop();
  _provider = provider;
}
