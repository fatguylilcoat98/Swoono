import { useEffect, useRef } from "react";

type FireworksBurstProps = {
  onDone: () => void;
};

const DURATION_MS = 7200;
const LAUNCH_TIMES = [0, 500, 1000, 1500, 2000, 2600, 3200, 3800, 4400, 5000];

const PALETTES: string[][] = [
  ["#FF1744", "#F50057", "#FF4081"],
  ["#2979FF", "#00B0FF", "#00E5FF"],
  ["#FFD600", "#FFEA00", "#FFF176"],
  ["#00E676", "#1DE9B6", "#64FFDA"],
  ["#D500F9", "#E040FB", "#EA80FC"],
  ["#FF6E40", "#FF9E80", "#FFAB91"],
];

type FireworkParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  type: "rocket" | "burst";
  life: number;
  size: number;
  gravity: number;
  drag: number;
  decay: number;
  trail: { x: number; y: number }[];
  sparkle: boolean;
};

type Flash = { x: number; y: number; color: string; life: number; size: number };
type Shockwave = { x: number; y: number; color: string; life: number; radius: number };

function makeParticle(
  x: number,
  y: number,
  vx: number,
  vy: number,
  color: string,
  type: "rocket" | "burst",
): FireworkParticle {
  return {
    x,
    y,
    vx,
    vy,
    color,
    type,
    life: 1,
    size: type === "rocket" ? 4 : 3,
    gravity: type === "rocket" ? 0.08 : 0.12,
    drag: 0.97,
    decay: type === "rocket" ? 0.006 : 0.01,
    trail: [],
    sparkle: Math.random() > 0.7,
  };
}

/**
 * Ported from Chris's standalone Duo fireworks animation.
 * 10 rockets launch over ~5 seconds, each exploding into a 100-particle
 * radial burst with random colors from 6 palettes. Shockwave rings expand
 * at each explosion point. Web Audio synthesizes launch + explosion sounds.
 *
 * Used as the "effect.fireworks" reward — plays on the recipient's screen
 * when a partner redeems the Fireworks Display trophy.
 */
export default function FireworksBurst({ onDone }: FireworksBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let audioCtx: AudioContext | null = null;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) audioCtx = new Ctor();
    } catch {
      // Animation works silently if audio fails.
    }

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const particles: FireworkParticle[] = [];
    const flashes: Flash[] = [];
    const shockwaves: Shockwave[] = [];

    function playLaunch() {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(70, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      } catch {
        // noop
      }
    }

    function playExplosion() {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(1500, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.15);

        const bufferSize = Math.floor(audioCtx.sampleRate * 0.3);
        const buffer = audioCtx.createBuffer(
          1,
          bufferSize,
          audioCtx.sampleRate,
        );
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp((-i / bufferSize) * 5);
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.25, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        noise.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        noise.start(now);
      } catch {
        // noop
      }
    }

    function launchRocket() {
      if (!canvas) return;
      const x = canvas.width * (0.15 + Math.random() * 0.7);
      const vx = (Math.random() - 0.5) * 3;
      const vy = -10 - Math.random() * 3;
      particles.push(
        makeParticle(x, canvas.height, vx, vy, "#FFFFFF", "rocket"),
      );
      playLaunch();
    }

    function explodeAt(x: number, y: number) {
      const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      for (let i = 0; i < 100; i++) {
        const angle = (Math.PI * 2 * i) / 100;
        const speed = 4 + Math.random() * 7;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const color = palette[Math.floor(Math.random() * palette.length)];
        particles.push(makeParticle(x, y, vx, vy, color, "burst"));
      }
      flashes.push({ x, y, color: palette[0], life: 1, size: 50 });
      shockwaves.push({ x, y, color: palette[0], life: 1, radius: 0 });
      playExplosion();
    }

    const launchTimers: number[] = [];
    LAUNCH_TIMES.forEach((delay) => {
      launchTimers.push(window.setTimeout(launchRocket, delay));
    });

    let rafId = 0;
    const render = () => {
      if (!canvas || !ctx) return;

      // Trail fade background
      ctx.fillStyle = "rgba(2, 1, 17, 0.14)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Flashes (radial glow at explosion point)
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.life -= 0.04;
        f.size *= 1.08;
        if (f.life <= 0) {
          flashes.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = f.life;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size);
        g.addColorStop(0, f.color);
        g.addColorStop(0.5, f.color + "80");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Shockwave rings
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const s = shockwaves[i];
        s.life -= 0.025;
        s.radius += 6;
        if (s.life <= 0) {
          shockwaves.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = s.life * 0.8;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Particles (rockets + burst shards)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.type === "rocket" && p.life > 0.5) {
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 20) p.trail.shift();
        }

        // Rocket explodes when it slows (vy near 0) or reaches 30% of height.
        const velocityStopped = p.type === "rocket" && Math.abs(p.vy) < 1;
        const tooHigh = p.type === "rocket" && p.y < canvas.height * 0.3;
        if (velocityStopped || tooHigh) {
          explodeAt(p.x, p.y);
          particles.splice(i, 1);
          continue;
        }

        if (p.life <= 0 || p.y > canvas.height + 100) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);

        // Trail
        if (p.trail.length > 1) {
          const grad = ctx.createLinearGradient(
            p.trail[0].x,
            p.trail[0].y,
            p.x,
            p.y,
          );
          grad.addColorStop(0, "transparent");
          grad.addColorStop(1, p.color);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 4;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let j = 1; j < p.trail.length; j++) {
            ctx.lineTo(p.trail[j].x, p.trail[j].y);
          }
          ctx.stroke();
        }

        // Glow
        const glowSize = p.sparkle ? 22 : 18;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        grad.addColorStop(0, p.color);
        grad.addColorStop(0.3, p.color + "CC");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle =
          p.sparkle && Math.random() > 0.5 ? "#FFFFFF" : p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };
    render();

    const doneTimer = window.setTimeout(onDone, DURATION_MS);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(doneTimer);
      launchTimers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", resize);
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => {
          // noop
        });
      }
    };
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
}
