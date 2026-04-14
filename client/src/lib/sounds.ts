/**
 * Web Audio sound effects. No audio files — everything is synthesized from
 * oscillators so we don't bundle copyrighted clips, the bundle stays tiny,
 * and it works offline.
 *
 * If you later want real voice samples ("hooray!", "haha") drop mp3s in
 * client/public/sounds/ and swap these two functions to use new Audio().
 */

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    _ctx = new Ctor();
  }
  // Autoplay policy: Chrome suspends the context until a user gesture.
  // Since sounds fire after players have been clicking cells, it's already
  // active — but we resume defensively.
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
}

/**
 * Bright ascending bell arpeggio — plays on win.
 * C5 → E5 → G5 → C6, triangle wave, fast onsets, bell-like decay.
 */
export function playWin() {
  const c = ctx();
  if (!c) return;
  const now = c.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const start = now + i * 0.11;
    const end = start + 0.45;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(end + 0.05);
  });
}

/**
 * Cartoon sad trombone — plays on loss.
 * Descending pitches G4 → F#4 → F4 → D4, sawtooth wave for that nasal tone.
 */
export function playLose() {
  const c = ctx();
  if (!c) return;
  const now = c.currentTime;
  const notes = [392, 370, 349, 294];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const start = now + i * 0.2;
    const end = start + 0.34;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.14, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(end + 0.05);
  });
}
