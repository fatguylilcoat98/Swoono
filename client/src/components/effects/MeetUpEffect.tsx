import { useEffect, useRef } from "react";

interface MeetUpEffectProps {
  onComplete?: () => void;
}

export default function MeetUpEffect({ onComplete }: MeetUpEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to fullscreen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Web Audio for whoosh + chime landing
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
    } catch {
      // Silent if audio fails
    }

    const playWhooshAndChime = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;

        // Whoosh sound (filtered noise)
        const bufferSize = audioCtx.sampleRate * 1.5;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          const t = i / bufferSize;
          data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3) * (1 - t);
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 1.5);

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.2, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 2);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        noise.start(now);

        // Chime when landing (at 2.5 seconds)
        const chimeOsc = audioCtx.createOscillator();
        const chimeGain = audioCtx.createGain();

        chimeOsc.type = 'sine';
        chimeOsc.frequency.setValueAtTime(800, now + 2.5);
        chimeOsc.frequency.exponentialRampToValueAtTime(400, now + 3.5);

        chimeGain.gain.setValueAtTime(0.15, now + 2.5);
        chimeGain.gain.exponentialRampToValueAtTime(0.01, now + 3.5);

        chimeOsc.connect(chimeGain);
        chimeGain.connect(audioCtx.destination);
        chimeOsc.start(now + 2.5);
        chimeOsc.stop(now + 3.5);
      } catch {
        // Silent fail
      }
    };

    // Airplane position and trail
    let airplaneX = -100;
    const airplaneY = canvas.height / 2 - 50;
    const targetX = canvas.width + 100;

    // Heart trail particles
    const heartTrail: Array<{
      x: number;
      y: number;
      size: number;
      life: number;
      color: string;
    }> = [];

    // Map pin animation state
    let showMapPin = false;
    let mapPinY = -50;
    const mapPinTargetY = airplaneY + 100;

    let animationFrame: number;
    let startTime = Date.now();
    const duration = 4000; // 4 seconds

    // Play whoosh sound
    playWhooshAndChime();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Move airplane across screen
      const airplaneProgress = Math.min(1, progress);
      airplaneX = -100 + (targetX + 100) * easeInOutQuad(airplaneProgress);

      // Create heart trail behind airplane
      if (airplaneX > 0 && airplaneX < canvas.width) {
        // Add new heart to trail
        if (Math.random() < 0.3) {
          heartTrail.push({
            x: airplaneX - 30,
            y: airplaneY + (Math.random() - 0.5) * 40,
            size: 15 + Math.random() * 10,
            life: 1.0,
            color: Math.random() > 0.5 ? '#ff69b4' : '#ff1744'
          });
        }
      }

      // Update and draw heart trail
      heartTrail.forEach((heart, index) => {
        heart.life -= 0.02;
        heart.x -= 2; // Trail effect

        if (heart.life <= 0) {
          heartTrail.splice(index, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = heart.life;
        ctx.font = `${heart.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = heart.color;
        ctx.fillText('💕', heart.x, heart.y);
        ctx.restore();
      });

      // Draw airplane
      if (airplaneX > -50 && airplaneX < canvas.width + 50) {
        ctx.save();
        ctx.font = '4rem Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#4a90e2';
        ctx.shadowColor = 'rgba(74, 144, 226, 0.6)';
        ctx.shadowBlur = 15;
        ctx.fillText('✈️', airplaneX, airplaneY);
        ctx.restore();
      }

      // Show map pin when airplane reaches 70% of journey
      if (progress > 0.7 && !showMapPin) {
        showMapPin = true;
      }

      // Animate map pin dropping
      if (showMapPin) {
        const pinProgress = Math.min(1, (elapsed - duration * 0.7) / (duration * 0.3));
        mapPinY = -50 + (mapPinTargetY + 50) * easeOutBounce(pinProgress);

        ctx.save();
        ctx.font = '3rem Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e74c3c';
        ctx.shadowColor = 'rgba(231, 76, 60, 0.6)';
        ctx.shadowBlur = 15;
        ctx.fillText('📍', airplaneX - 50, mapPinY);
        ctx.restore();
      }

      // "Let's Meet Up!" text appears when pin lands
      if (showMapPin && mapPinY >= mapPinTargetY - 10) {
        const textProgress = Math.min(1, (elapsed - duration * 0.85) / (duration * 0.15));

        ctx.save();
        ctx.globalAlpha = textProgress;
        ctx.font = 'bold 3rem sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#2c3e50';
        ctx.shadowColor = 'rgba(44, 62, 80, 0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText("Let's Meet Up! ✈️", canvas.width / 2, canvas.height / 2 + 100);
        ctx.restore();
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    animate();

    // Easing functions
    function easeInOutQuad(t: number): number {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function easeOutBounce(t: number): number {
      const n1 = 7.5625;
      const d1 = 2.75;

      if (t < 1 / d1) {
        return n1 * t * t;
      } else if (t < 2 / d1) {
        return n1 * (t -= 1.5 / d1) * t + 0.75;
      } else if (t < 2.5 / d1) {
        return n1 * (t -= 2.25 / d1) * t + 0.9375;
      } else {
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
      }
    }

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
        style={{ background: 'rgba(135, 206, 235, 0.1)' }} // Light sky background
      />
    </div>
  );
}