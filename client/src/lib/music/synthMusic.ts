/**
 * Synthesized ambient music generator. Web Audio only — no files, no network,
 * no licensing. Guaranteed to play on any browser that supports AudioContext.
 *
 * Architecture: a slow chord progression plays on a sustained pad (two detuned
 * sine oscillators per note + gentle filter), a sparse arpeggio rings on top
 * (triangle wave, decaying envelope), and a low sine sub-bass grounds each
 * chord. Progression loops indefinitely. Tempo + scale vary by theme preset.
 *
 * This is intentionally simple. It's not going to replace real music, but it
 * fills the silence and sets a mood while we wait for real tracks or a
 * Spotify connection to be wired up.
 */

export type SynthPreset = {
  id: string;
  name: string;
  /** Seconds per chord. Slower = more ambient. */
  chordDurationSec: number;
  /** Root note MIDI number. 60 = middle C. */
  rootMidi: number;
  /** Chord progression in scale-degree intervals from the root. */
  progression: number[][];
  /** Base gain (0..1) for the pad. */
  padGain: number;
  /** Base gain (0..1) for the arpeggio. */
  arpGain: number;
  /** Filter cutoff frequency on the pad, Hz. */
  filterCutoff: number;
};

export const SYNTH_PRESETS: Record<string, SynthPreset> = {
  romantic: {
    id: "romantic",
    name: "Romantic",
    chordDurationSec: 8,
    rootMidi: 57, // A3
    progression: [
      [0, 4, 7], // Am
      [-3, 0, 4], // F
      [-5, 0, 4], // C
      [-2, 2, 5], // G
    ],
    padGain: 0.14,
    arpGain: 0.08,
    filterCutoff: 1400,
  },
  energetic: {
    id: "energetic",
    name: "Energetic",
    chordDurationSec: 4,
    rootMidi: 62, // D4
    progression: [
      [0, 4, 7], // D
      [5, 9, 12], // G
      [2, 6, 9], // Em
      [7, 11, 14], // A
    ],
    padGain: 0.12,
    arpGain: 0.11,
    filterCutoff: 2200,
  },
  ambient: {
    id: "ambient",
    name: "Ambient",
    chordDurationSec: 12,
    rootMidi: 55, // G3
    progression: [
      [0, 7, 12], // G fifth
      [-5, 0, 7], // C
      [-3, 4, 9], // Em
      [2, 7, 11], // Dsus
    ],
    padGain: 0.1,
    arpGain: 0.06,
    filterCutoff: 900,
  },
};

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export type SynthHandle = {
  stop: () => void;
  setVolume: (volume: number) => void;
  getPreset: () => SynthPreset;
};

/**
 * Start playing a synthesized ambient loop. Returns a handle with stop/volume
 * controls. Must be called from a user gesture (click/tap) to avoid Chrome's
 * autoplay policy.
 */
export function startSynthMusic(
  ctx: AudioContext,
  preset: SynthPreset,
  initialVolume = 0.5,
): SynthHandle {
  const master = ctx.createGain();
  master.gain.value = initialVolume;
  master.connect(ctx.destination);

  // Global low-pass for warmth.
  const warmth = ctx.createBiquadFilter();
  warmth.type = "lowpass";
  warmth.frequency.value = preset.filterCutoff;
  warmth.Q.value = 0.5;
  warmth.connect(master);

  // Pad bus.
  const padBus = ctx.createGain();
  padBus.gain.value = preset.padGain;
  padBus.connect(warmth);

  // Arp bus (brighter, bypass filter).
  const arpBus = ctx.createGain();
  arpBus.gain.value = preset.arpGain;
  arpBus.connect(master);

  // Sub bass bus.
  const subBus = ctx.createGain();
  subBus.gain.value = 0.18;
  subBus.connect(master);

  let stopped = false;
  let chordIdx = 0;
  const scheduledSources: AudioScheduledSourceNode[] = [];

  function spawnPadVoice(freq: number, startTime: number, durationSec: number) {
    // Two detuned sines for chorus.
    for (const detune of [-4, 4]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(1, startTime + 1.5); // slow attack
      env.gain.setValueAtTime(1, startTime + durationSec - 1.5);
      env.gain.linearRampToValueAtTime(0, startTime + durationSec);
      osc.connect(env);
      env.connect(padBus);
      osc.start(startTime);
      osc.stop(startTime + durationSec + 0.1);
      scheduledSources.push(osc);
    }
  }

  function spawnSubVoice(freq: number, startTime: number, durationSec: number) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq * 0.5; // one octave down
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(1, startTime + 0.8);
    env.gain.setValueAtTime(1, startTime + durationSec - 1);
    env.gain.linearRampToValueAtTime(0, startTime + durationSec);
    osc.connect(env);
    env.connect(subBus);
    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.1);
    scheduledSources.push(osc);
  }

  function spawnArpNote(freq: number, startTime: number) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq * 2; // up an octave for sparkle
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(1, startTime + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + 1.8);
    osc.connect(env);
    env.connect(arpBus);
    osc.start(startTime);
    osc.stop(startTime + 2);
    scheduledSources.push(osc);
  }

  function scheduleChord(startTime: number) {
    if (stopped) return;
    const chord = preset.progression[chordIdx % preset.progression.length];
    const duration = preset.chordDurationSec;
    const notes = chord.map((interval) =>
      midiToHz(preset.rootMidi + interval),
    );

    // Pad: all chord tones sustained.
    for (const freq of notes) {
      spawnPadVoice(freq, startTime, duration);
    }
    // Sub: root only.
    spawnSubVoice(notes[0], startTime, duration);
    // Arp: sparse, one note per beat.
    const beatInterval = duration / 8;
    for (let i = 0; i < 8; i++) {
      // Skip some beats for sparseness.
      if (i % 2 === 1 && Math.random() < 0.6) continue;
      const noteFreq = notes[i % notes.length];
      spawnArpNote(noteFreq, startTime + i * beatInterval);
    }

    chordIdx++;
    // Schedule next chord just before this one ends.
    const nextTimeoutMs = (duration - 0.1) * 1000;
    window.setTimeout(() => {
      if (!stopped) scheduleChord(ctx.currentTime);
    }, nextTimeoutMs);
  }

  // Kick off.
  scheduleChord(ctx.currentTime + 0.05);

  return {
    stop() {
      stopped = true;
      // Fade out master over 400ms, then disconnect everything.
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.4);
      window.setTimeout(() => {
        try {
          master.disconnect();
          warmth.disconnect();
          padBus.disconnect();
          arpBus.disconnect();
          subBus.disconnect();
          scheduledSources.forEach((s) => {
            try {
              s.stop();
            } catch {
              /* already stopped */
            }
          });
        } catch {
          /* nothing */
        }
      }, 500);
    },
    setVolume(volume) {
      const clamped = Math.max(0, Math.min(1, volume));
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(clamped, ctx.currentTime + 0.05);
    },
    getPreset() {
      return preset;
    },
  };
}
