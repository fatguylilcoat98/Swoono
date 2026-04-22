import { useEffect, useRef, useState } from "react";

interface ProposalEffectProps {
  onComplete?: () => void;
}

export default function ProposalEffect({ onComplete }: ProposalEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentPhase, setCurrentPhase] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to fullscreen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Web Audio for chime
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
    } catch {
      // Silent if audio fails
    }

    const playChime = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;

        // Gentle bell chime when ring appears
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(600, now + 1);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 2);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 2);
      } catch {
        // Silent fail
      }
    };

    // Play background music
    const audio = audioRef.current;
    if (audio) {
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Silent fail if audio doesn't work
      });
    }

    // Sparkles and particles for various phases
    const sparkles: Array<{
      x: number;
      y: number;
      size: number;
      life: number;
      maxLife: number;
    }> = [];

    const hearts: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      life: number;
      color: string;
    }> = [];

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

    let animationFrame: number;
    let startTime = Date.now();
    const duration = 8000; // 8 seconds total

    // Ring position
    let ringY = canvas.height + 100;
    const targetRingY = canvas.height / 2;

    // Phase timing
    const phaseTimers = [
      setTimeout(() => setCurrentPhase(2), 1000),  // Phase 2: Ring rises
      setTimeout(() => setCurrentPhase(3), 2000),  // Phase 3: Ring reaches center, sparkles
      setTimeout(() => setCurrentPhase(4), 3000),  // Phase 4: Text appears
      setTimeout(() => setCurrentPhase(5), 5000),  // Phase 5: Hearts and petals
      setTimeout(() => setCurrentPhase(6), 7000),  // Phase 6: Fade out
    ];

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Phase 1: Screen dims, spotlight appears (0-1s)
      if (currentPhase >= 1) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Spotlight effect
        const gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, 300
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Phase 2: Ring rises (1-2s)
      if (currentPhase >= 2) {
        const riseProgress = Math.min(1, (elapsed - 1000) / 1000);
        ringY = canvas.height + 100 - (canvas.height + 100 - targetRingY) * easeOutCubic(riseProgress);

        if (riseProgress === 1 && !sparkles.length) {
          playChime(); // Play chime when ring reaches center
        }
      }

      // Phase 3: Ring reaches center, sparkles explode (2-3s)
      if (currentPhase >= 3 && sparkles.length < 30) {
        // Create sparkles around ring
        for (let i = 0; i < 5; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 50 + Math.random() * 100;
          sparkles.push({
            x: canvas.width / 2 + Math.cos(angle) * distance,
            y: ringY + Math.sin(angle) * distance,
            size: 3 + Math.random() * 5,
            life: 1.0,
            maxLife: 1.0
          });
        }
      }

      // Phase 5: Hearts and rose petals (5-7s)
      if (currentPhase >= 5) {
        // Add hearts
        if (hearts.length < 50 && Math.random() < 0.3) {
          hearts.push({
            x: Math.random() * canvas.width,
            y: canvas.height + 50,
            vx: (Math.random() - 0.5) * 2,
            vy: -2 - Math.random() * 2,
            size: 15 + Math.random() * 10,
            life: 1.0,
            color: Math.random() > 0.5 ? '#ff69b4' : '#ff1744'
          });
        }

        // Add petals
        if (petals.length < 30 && Math.random() < 0.2) {
          petals.push({
            x: Math.random() * canvas.width,
            y: -50,
            vx: (Math.random() - 0.5) * 3,
            vy: 2 + Math.random() * 2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.1,
            size: 20 + Math.random() * 15,
            life: 1.0
          });
        }
      }

      // Draw ring
      if (currentPhase >= 2) {
        ctx.save();
        ctx.font = '5rem Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
        ctx.shadowBlur = 20;
        ctx.fillText('💍', canvas.width / 2, ringY);
        ctx.restore();
      }

      // Draw sparkles
      sparkles.forEach((sparkle, index) => {
        sparkle.life -= 0.02;
        if (sparkle.life <= 0) {
          sparkles.splice(index, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = sparkle.life;
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(sparkle.x, sparkle.y, sparkle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw hearts
      hearts.forEach((heart, index) => {
        heart.x += heart.vx;
        heart.y += heart.vy;
        heart.life -= 0.01;

        if (heart.life <= 0 || heart.y < -50) {
          hearts.splice(index, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = heart.life;
        ctx.font = `${heart.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = heart.color;
        ctx.fillText('❤️', heart.x, heart.y);
        ctx.restore();
      });

      // Draw petals
      petals.forEach((petal, index) => {
        petal.x += petal.vx;
        petal.y += petal.vy;
        petal.rotation += petal.rotationSpeed;
        petal.life -= 0.008;

        if (petal.life <= 0 || petal.y > canvas.height + 50) {
          petals.splice(index, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = petal.life;
        ctx.translate(petal.x, petal.y);
        ctx.rotate(petal.rotation);
        ctx.font = `${petal.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌹', 0, 0);
        ctx.restore();
      });

      // Phase 4: Text appears (3-5s)
      if (currentPhase >= 4) {
        const textProgress = Math.min(1, (elapsed - 3000) / 2000);
        ctx.save();
        ctx.globalAlpha = textProgress;
        ctx.font = 'bold 3rem serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
        ctx.shadowBlur = 15;
        ctx.fillText('Will You Be Mine?', canvas.width / 2, canvas.height / 2 + 150);
        ctx.restore();
      }

      // Phase 6: Gentle fade out
      if (currentPhase >= 6) {
        const fadeProgress = (elapsed - 7000) / 1000;
        ctx.fillStyle = `rgba(0, 0, 0, ${fadeProgress * 0.8})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    animate();

    // Easing function
    function easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
      if (audio) {
        audio.pause();
      }
      phaseTimers.forEach(timer => clearTimeout(timer));
    };
  }, [onComplete, currentPhase]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <audio
        ref={audioRef}
        src="https://lhbktlxtycdbaumjooof.supabase.co/storage/v1/object/public/swoono-audio/Counting%20the%20Miles.mp3"
        preload="auto"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}