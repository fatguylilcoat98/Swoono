import { useEffect, useRef } from "react";

interface ConfettiCannonProps {
  onComplete?: () => void;
}

export default function ConfettiCannon({ onComplete }: ConfettiCannonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to fullscreen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Web Audio for epic boom
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
    } catch {
      // Silent if audio fails
    }

    const playBoomSound = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;

        // Low frequency thump
        const lowOsc = audioCtx.createOscillator();
        const lowGain = audioCtx.createGain();

        lowOsc.type = 'sine';
        lowOsc.frequency.setValueAtTime(60, now);
        lowOsc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
        lowGain.gain.setValueAtTime(0.3, now);
        lowGain.gain.exponentialRampToValueAtTime(0.01, now + 1);

        lowOsc.connect(lowGain);
        lowGain.connect(audioCtx.destination);
        lowOsc.start(now);
        lowOsc.stop(now + 1);

        // High frequency crackle
        const bufferSize = audioCtx.sampleRate * 0.5;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufferSize * 8);
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const highGain = audioCtx.createGain();
        highGain.gain.setValueAtTime(0.2, now + 0.1);
        highGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2000, now);

        noise.connect(filter);
        filter.connect(highGain);
        highGain.connect(audioCtx.destination);
        noise.start(now + 0.1);
      } catch {
        // Silent fail
      }
    };

    // Confetti particles
    const confetti: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      rotation: number;
      rotationSpeed: number;
      color: string;
      shape: 'rect' | 'circle' | 'star';
      size: number;
      life: number;
      gravity: number;
    }> = [];

    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
      '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
      '#dda0dd', '#98fb98', '#f0e68c', '#daa0dd', '#87ceeb'
    ];

    // Create 500+ confetti pieces from center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < 500; i++) {
      const angle = (Math.PI * 2 * i) / 500;
      const speed = 8 + Math.random() * 12;
      const vx = Math.cos(angle) * speed * (0.5 + Math.random() * 0.5);
      const vy = Math.sin(angle) * speed * (0.5 + Math.random() * 0.5);

      confetti.push({
        x: centerX,
        y: centerY,
        vx: vx,
        vy: vy,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() > 0.66 ? 'star' : Math.random() > 0.5 ? 'circle' : 'rect',
        size: 4 + Math.random() * 8,
        life: 1.0,
        gravity: 0.05 + Math.random() * 0.05
      });
    }

    let animationFrame: number;
    let startTime = Date.now();
    const duration = 5000; // 5 seconds

    // Play boom sound
    playBoomSound();

    // Draw shapes
    const drawShape = (particle: typeof confetti[0]) => {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;

      if (particle.shape === 'rect') {
        ctx.fillRect(-particle.size/2, -particle.size/2, particle.size, particle.size);
      } else if (particle.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, particle.size/2, 0, Math.PI * 2);
        ctx.fill();
      } else if (particle.shape === 'star') {
        // Draw simple 5-pointed star
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const x = Math.cos(angle) * particle.size/2;
          const y = Math.sin(angle) * particle.size/2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          const innerAngle = ((i + 0.5) * Math.PI * 2) / 5 - Math.PI / 2;
          const innerX = Math.cos(innerAngle) * particle.size/4;
          const innerY = Math.sin(innerAngle) * particle.size/4;
          ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // Clear canvas with slight fade for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw confetti
      confetti.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += particle.gravity; // Gravity effect
        particle.vx *= 0.99; // Air resistance
        particle.rotation += particle.rotationSpeed;

        // Fade out over time
        particle.life = Math.max(0, 1 - progress * 0.8);

        if (particle.life > 0 && particle.y < canvas.height + 50) {
          ctx.globalAlpha = particle.life;
          drawShape(particle);
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