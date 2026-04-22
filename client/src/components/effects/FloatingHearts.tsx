import { useEffect, useRef } from "react";

interface FloatingHeartsProps {
  onComplete?: () => void;
}

export default function FloatingHearts({ onComplete }: FloatingHeartsProps) {
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

    const playChimes = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;

        // Play C, E, G chord progression
        const frequencies = [261.63, 329.63, 392.00]; // C4, E4, G4

        frequencies.forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.3);
          gain.gain.setValueAtTime(0.1, now + i * 0.3);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.3 + 0.8);

          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.3);
          osc.stop(now + i * 0.3 + 0.8);
        });
      } catch {
        // Silent fail
      }
    };

    // Heart particles
    const hearts: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      life: number;
      wobble: number;
      wobbleSpeed: number;
    }> = [];

    // Create hearts in waves
    const maxHearts = 60;
    const spawnWaves = 6;
    const heartsPerWave = maxHearts / spawnWaves;

    const spawnWave = () => {
      for (let i = 0; i < heartsPerWave; i++) {
        hearts.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 50,
          vx: (Math.random() - 0.5) * 2,
          vy: -2 - Math.random() * 2,
          size: 20 + Math.random() * 15,
          color: Math.random() > 0.5 ? '#ff69b4' : '#ff1744',
          life: 1.0,
          wobble: 0,
          wobbleSpeed: 0.05 + Math.random() * 0.05
        });
      }
    };

    // Spawn waves every 500ms
    for (let wave = 0; wave < spawnWaves; wave++) {
      setTimeout(() => spawnWave(), wave * 500);
    }

    let animationFrame: number;
    let startTime = Date.now();
    const duration = 4000; // 4 seconds

    // Play sound
    playChimes();

    // Draw heart shape
    const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      const scale = size / 20;
      ctx.beginPath();
      ctx.moveTo(x, y + 6 * scale);
      ctx.bezierCurveTo(x, y + 3 * scale, x - 7 * scale, y - 2 * scale, x - 7 * scale, y + 3 * scale);
      ctx.bezierCurveTo(x - 7 * scale, y + 7 * scale, x, y + 11 * scale, x, y + 16 * scale);
      ctx.bezierCurveTo(x, y + 11 * scale, x + 7 * scale, y + 7 * scale, x + 7 * scale, y + 3 * scale);
      ctx.bezierCurveTo(x + 7 * scale, y - 2 * scale, x, y + 3 * scale, x, y + 6 * scale);
      ctx.fill();
    };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw hearts
      hearts.forEach((heart) => {
        heart.x += heart.vx;
        heart.y += heart.vy;
        heart.wobble += heart.wobbleSpeed;

        // Side-to-side wobble
        const wobbleOffset = Math.sin(heart.wobble) * 3;
        heart.x += wobbleOffset;

        // Fade out at top
        if (heart.y < canvas.height * 0.2) {
          heart.life -= 0.02;
        }

        if (heart.life > 0 && heart.y > -50) {
          ctx.globalAlpha = heart.life;
          ctx.fillStyle = heart.color;
          drawHeart(ctx, heart.x, heart.y, heart.size);
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