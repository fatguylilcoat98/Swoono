import { useEffect, useRef, useState } from "react";

interface AnniversaryEffectProps {
  onComplete?: () => void;
}

export default function AnniversaryEffect({ onComplete }: AnniversaryEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPhase, setCurrentPhase] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to fullscreen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Web Audio for celebratory fanfare
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
    } catch {
      // Silent if audio fails
    }

    const playFanfare = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;

        // Trumpet-like ascending fanfare
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5

        notes.forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + i * 0.2);

          gain.gain.setValueAtTime(0.1, now + i * 0.2);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.5);

          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.2);
          osc.stop(now + i * 0.2 + 0.5);
        });
      } catch {
        // Silent fail
      }
    };

    // Gold confetti particles
    const confetti: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      rotation: number;
      rotationSpeed: number;
      size: number;
      life: number;
      shape: 'rect' | 'circle';
    }> = [];

    // Heart slideshow particles
    const hearts: Array<{
      x: number;
      y: number;
      scale: number;
      life: number;
      type: 'pulse' | 'float';
    }> = [];

    // Firework particles for phase 4
    const fireworks: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      life: number;
      size: number;
    }> = [];

    let animationFrame: number;
    let startTime = Date.now();
    const duration = 6000; // 6 seconds

    // Play fanfare
    playFanfare();

    // Phase timing
    const phaseTimers = [
      setTimeout(() => setCurrentPhase(2), 1000),  // Phase 2: Text appears
      setTimeout(() => setCurrentPhase(3), 2500),  // Phase 3: Heart slideshow
      setTimeout(() => setCurrentPhase(4), 4000),  // Phase 4: Fireworks
    ];

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Phase 1: Gold confetti explosion
      if (currentPhase >= 1 && confetti.length < 200) {
        for (let i = 0; i < 10; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 5 + Math.random() * 10;
          confetti.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.3,
            size: 4 + Math.random() * 8,
            life: 1.0,
            shape: Math.random() > 0.5 ? 'rect' : 'circle'
          });
        }
      }

      // Phase 3: Heart slideshow
      if (currentPhase >= 3) {
        // Add floating hearts
        if (hearts.length < 15 && Math.random() < 0.1) {
          hearts.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            scale: 0.5 + Math.random() * 1,
            life: 1.0,
            type: Math.random() > 0.5 ? 'pulse' : 'float'
          });
        }
      }

      // Phase 4: Fireworks burst
      if (currentPhase >= 4) {
        // Create firework bursts
        if (fireworks.length < 100 && Math.random() < 0.3) {
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8;
            const speed = 3 + Math.random() * 5;
            fireworks.push({
              x: canvas.width / 2 + (Math.random() - 0.5) * 200,
              y: canvas.height / 2 + (Math.random() - 0.5) * 200,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1'][Math.floor(Math.random() * 4)],
              life: 1.0,
              size: 3 + Math.random() * 5
            });
          }
        }
      }

      // Draw confetti
      confetti.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.1; // Gravity
        particle.rotation += particle.rotationSpeed;
        particle.life -= 0.008;

        if (particle.life <= 0) {
          confetti.splice(index, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = particle.life;
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.fillStyle = '#ffd700';

        if (particle.shape === 'rect') {
          ctx.fillRect(-particle.size/2, -particle.size/2, particle.size, particle.size);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, particle.size/2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // Phase 2: "Happy Anniversary" text in gold
      if (currentPhase >= 2) {
        const textProgress = Math.min(1, (elapsed - 1000) / 1500);
        ctx.save();
        ctx.globalAlpha = textProgress;
        ctx.font = 'bold 4rem serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
        ctx.shadowBlur = 20;
        ctx.fillText('Happy Anniversary ❤️', canvas.width / 2, canvas.height / 2);
        ctx.restore();
      }

      // Draw hearts for slideshow
      hearts.forEach((heart, index) => {
        heart.life -= 0.01;

        if (heart.life <= 0) {
          hearts.splice(index, 1);
          return;
        }

        let currentScale = heart.scale;
        if (heart.type === 'pulse') {
          currentScale = heart.scale * (1 + Math.sin(elapsed * 0.005) * 0.2);
        } else {
          heart.y -= 0.5; // Float upward
        }

        ctx.save();
        ctx.globalAlpha = heart.life;
        ctx.font = `${20 * currentScale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff69b4';
        ctx.fillText('💕', heart.x, heart.y);
        ctx.restore();
      });

      // Draw fireworks
      fireworks.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.05; // Slight gravity
        particle.vx *= 0.98; // Air resistance
        particle.life -= 0.02;

        if (particle.life <= 0) {
          fireworks.splice(index, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
      phaseTimers.forEach(timer => clearTimeout(timer));
    };
  }, [onComplete, currentPhase]);

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