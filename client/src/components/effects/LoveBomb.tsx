import { useEffect, useRef } from "react";

interface LoveBombProps {
  onComplete?: () => void;
}

export default function LoveBomb({ onComplete }: LoveBombProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to fullscreen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Web Audio for rising musical swell
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
    } catch {
      // Silent if audio fails
    }

    const playLoveBombSound = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;

        // Multiple harmonics building up
        const frequencies = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

        frequencies.forEach((freq) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          // Building swell
          gain.gain.setValueAtTime(0, now);
          gain.gain.exponentialRampToValueAtTime(0.15, now + 2); // Build to climax
          gain.gain.exponentialRampToValueAtTime(0.01, now + 6); // Gentle fade

          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 6);
        });

        // Add some shimmer with higher frequencies
        for (let i = 0; i < 3; i++) {
          const shimmerOsc = audioCtx.createOscillator();
          const shimmerGain = audioCtx.createGain();

          shimmerOsc.type = 'sine';
          shimmerOsc.frequency.setValueAtTime(1047 + i * 100, now + 2);

          shimmerGain.gain.setValueAtTime(0, now + 2);
          shimmerGain.gain.exponentialRampToValueAtTime(0.08, now + 2.5);
          shimmerGain.gain.exponentialRampToValueAtTime(0.01, now + 5);

          shimmerOsc.connect(shimmerGain);
          shimmerGain.connect(audioCtx.destination);
          shimmerOsc.start(now + 2);
          shimmerOsc.stop(now + 5);
        }
      } catch {
        // Silent fail
      }
    };

    // Hearts, stars, and sparkles
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      type: 'heart' | 'star' | 'sparkle';
      size: number;
      rotation: number;
      rotationSpeed: number;
      life: number;
      color: string;
    }> = [];

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Create 100 hearts erupting from center
    for (let i = 0; i < 100; i++) {
      const angle = (Math.PI * 2 * i) / 100;
      const speed = 5 + Math.random() * 8;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      particles.push({
        x: centerX,
        y: centerY,
        vx: vx,
        vy: vy,
        type: 'heart',
        size: 15 + Math.random() * 15,
        rotation: 0,
        rotationSpeed: 0,
        life: 1.0,
        color: Math.random() > 0.5 ? '#ff69b4' : '#ff1744'
      });
    }

    // Add stars and sparkles
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      particles.push({
        x: centerX + (Math.random() - 0.5) * 100,
        y: centerY + (Math.random() - 0.5) * 100,
        vx: vx,
        vy: vy,
        type: Math.random() > 0.5 ? 'star' : 'sparkle',
        size: 8 + Math.random() * 12,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        life: 1.0,
        color: '#ffffff'
      });
    }

    let animationFrame: number;
    let startTime = Date.now();
    const duration = 6000; // 6 seconds

    // Play sound
    playLoveBombSound();

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

    // Draw star
    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const x1 = Math.cos(angle) * size;
        const y1 = Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(x1, y1);
        else ctx.lineTo(x1, y1);

        const innerAngle = ((i + 0.5) * Math.PI * 2) / 5 - Math.PI / 2;
        const x2 = Math.cos(innerAngle) * size * 0.4;
        const y2 = Math.sin(innerAngle) * size * 0.4;
        ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // Screen pulses pink/red
      const pulseIntensity = Math.sin(elapsed * 0.01) * 0.1 + 0.05;
      ctx.fillStyle = `rgba(255, 20, 147, ${pulseIntensity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Shockwave rings
      if (elapsed < 3000) {
        const shockwaveProgress = elapsed / 3000;
        for (let i = 0; i < 3; i++) {
          const radius = (shockwaveProgress * canvas.width) + (i * 100);
          if (radius > 0) {
            ctx.strokeStyle = `rgba(255, 105, 180, ${1 - shockwaveProgress})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Update and draw particles
      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.02; // Slight gravity
        particle.vx *= 0.99; // Air resistance
        particle.rotation += particle.rotationSpeed;

        // Fade based on time and distance from center
        const distanceFromCenter = Math.sqrt(
          Math.pow(particle.x - centerX, 2) + Math.pow(particle.y - centerY, 2)
        );
        particle.life = Math.max(0, 1 - progress * 0.6 - (distanceFromCenter / canvas.width) * 0.5);

        if (particle.life > 0) {
          ctx.globalAlpha = particle.life;
          ctx.fillStyle = particle.color;

          if (particle.type === 'heart') {
            drawHeart(ctx, particle.x, particle.y, particle.size);
          } else if (particle.type === 'star') {
            drawStar(ctx, particle.x, particle.y, particle.size, particle.rotation);
          } else if (particle.type === 'sparkle') {
            // Simple sparkle as a circle
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size / 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // "LOVE BOMB" text appears in center after 1 second
      if (elapsed > 1000) {
        const textProgress = Math.min(1, (elapsed - 1000) / 1000);
        ctx.globalAlpha = textProgress;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 4rem serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255, 105, 180, 0.8)';
        ctx.shadowBlur = 20;
        ctx.fillText('💕 LOVE BOMB 💕', centerX, centerY);
        ctx.shadowBlur = 0;
      }

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