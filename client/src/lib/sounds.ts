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

/**
 * Warm major triad — used by love / confetti effects. C-E-G-C ascending sine.
 */
export function playCheer() {
  const c = ctx();
  if (!c) return;
  const now = c.currentTime;
  const notes = [261.63, 329.63, 392.0, 523.25];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.05;
    const end = start + 0.55;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(end + 0.05);
  });
}

/**
 * Low thud + noise burst — used by slap / punch / kick.
 */
export function playImpact() {
  const c = ctx();
  if (!c) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
  gain.gain.setValueAtTime(0.38, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.22);

  const bufferSize = Math.floor(c.sampleRate * 0.1);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.18, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  noise.connect(noiseGain);
  noiseGain.connect(c.destination);
  noise.start(now);
}

/**
 * Cartoon spring boing — used by pie / banana / tickle.
 */
export function playBoing() {
  const c = ctx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.linearRampToValueAtTime(620, now + 0.1);
  osc.frequency.linearRampToValueAtTime(250, now + 0.32);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.48);
}

/**
 * Bell sparkle — used by kiss / hearts / flowers.
 */
export function playSparkle() {
  const c = ctx();
  if (!c) return;
  const now = c.currentTime;
  const notes = [880, 1174.66, 1760];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.06;
    const end = start + 0.5;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(end + 0.05);
  });
}
