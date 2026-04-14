import { useEffect, useRef } from "react";
import {
  getAudioProvider,
  type BeatFrame,
} from "../../lib/registries/audioAdapter";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseR: number;
  hue: number;
  alpha: number;
};

type ParticleFieldProps = {
  className?: string;
  density?: number;
  speed?: number;
  pulseStrength?: number;
  /** HSL hue base for the particle palette (0..360) */
  hueStart?: number;
  /** HSL hue range above hueStart */
  hueSpread?: number;
  /** Velocity drag per frame, 0..1 — lower is floatier */
  drag?: number;
};

/**
 * Canvas 2D particle field subscribed to the active audio adapter.
 *
 * Today the adapter is SimulatedBeat (120 BPM, exponential decay).
 * Swap the provider via setAudioProvider(realProvider) and this component
 * will start reacting to real audio without modification.
 *
 * All physics tokens (density / speed / drag / hue) are theme-driven — the
 * consumer passes them from the active theme's `motion` config so Guy /
 * Girl / Neutral each have a distinct particle behavior.
 */
export default function ParticleField({
  className = "",
  density = 140,
  speed = 0.35,
  pulseStrength = 1,
  hueStart = 210,
  hueSpread = 30,
  drag = 0.985,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestBeat = useRef<BeatFrame>({
    intensity: 0,
    isBeat: false,
    energy: 0.5,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const particles: Particle[] = [];

    function resize() {
      if (!canvas || !ctx) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initParticles() {
      particles.length = 0;
      for (let i = 0; i < density; i++) {
        const baseR = 1 + Math.random() * 2.5;
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * speed,
          vy: (Math.random() - 0.5) * speed,
          baseR,
          hue: hueStart + Math.random() * hueSpread,
          alpha: 0.3 + Math.random() * 0.5,
        });
      }
    }

    function step() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const beat = latestBeat.current;
      const pulseBoost = 1 + beat.intensity * 1.4 * pulseStrength;
      const energyDrift = 1 + beat.energy * 0.4;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // On a new beat, kick every particle radially outward from center.
        if (beat.isBeat) {
          const cx = width / 2;
          const cy = height / 2;
          const dx = p.x - cx;
          const dy = p.y - cy;
          const dist = Math.hypot(dx, dy) || 1;
          const kick = 0.8 * pulseStrength;
          p.vx += (dx / dist) * kick;
          p.vy += (dy / dist) * kick;
        }

        p.x += p.vx * energyDrift;
        p.y += p.vy * energyDrift;

        // Soft drag so beat kicks settle. Per-theme value — guy mode is
        // stiffer (closer to 1), girl mode is floatier (lower drag).
        p.vx *= drag;
        p.vy *= drag;

        // Wrap edges.
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        const r = p.baseR * pulseBoost;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 85%, 70%, ${p.alpha})`;
        ctx.shadowColor = `hsla(${p.hue}, 95%, 65%, ${p.alpha * 0.9})`;
        ctx.shadowBlur = 8 + beat.intensity * 12;
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(step);
    }

    resize();
    initParticles();
    step();

    const onResize = () => {
      resize();
      initParticles();
    };
    window.addEventListener("resize", onResize);

    const provider = getAudioProvider();
    const unsubscribe = provider.onFrame((f) => {
      latestBeat.current = f;
    });
    provider.start();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      unsubscribe();
      // Leave the provider running — other subscribers may still need it.
    };
  }, [density, speed, pulseStrength, hueStart, hueSpread, drag]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full pointer-events-none ${className}`}
    />
  );
}
