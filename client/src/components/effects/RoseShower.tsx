import { useEffect, useRef } from "react";

interface RoseShowerProps {
  onComplete?: () => void;
}

export default function RoseShower({ onComplete }: RoseShowerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to fullscreen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Web Audio for sound
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
    } catch {
      // Silent if audio fails
    }

    const playWhooshAndBell = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;

        // Whoosh sound (filtered noise)
        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufferSize * 3);
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);
        filter.Q.setValueAtTime(15, now);

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.15, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 2);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        noise.start(now);

        // Bell tone
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now + 0.5);
        gain.gain.setValueAtTime(0.1, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + 0.5);
        osc.stop(now + 3);
      } catch {
        // Silent fail
      }
    };

    // Rose petals
    const petals: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      rotation: number;
      rotationSpeed: number;
      size: number;
      life: number;
    }> = [];

    // Create petals
    for (let i = 0; i < 40; i++) {
      petals.push({
        x: Math.random() * canvas.width,
        y: -50 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 3,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        size: 24 + Math.random() * 16,
        life: 1.0
      });
    }

    let animationFrame: number;
    let startTime = Date.now();
    const duration = 4000; // 4 seconds

    // Play sound
    playWhooshAndBell();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw petals
      petals.forEach((petal) => {
        petal.x += petal.vx;
        petal.y += petal.vy;
        petal.rotation += petal.rotationSpeed;

        // Drift side to side
        petal.x += Math.sin(elapsed * 0.001 + petal.y * 0.01) * 0.5;

        // Fade out at bottom
        if (petal.y > canvas.height * 0.8) {
          petal.life -= 0.03;
        }

        if (petal.life > 0 && petal.y < canvas.height + 50) {
          ctx.save();
          ctx.globalAlpha = petal.life;
          ctx.translate(petal.x, petal.y);
          ctx.rotate(petal.rotation);
          ctx.font = `${petal.size}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🌹', 0, 0);
          ctx.restore();
        }
      });

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    animate();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}