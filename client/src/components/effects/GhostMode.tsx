import { useEffect, useRef } from "react";

interface GhostModeProps {
  onComplete?: () => void;
}

export default function GhostMode({ onComplete }: GhostModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Web Audio for spooky sound
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
    } catch {
      // Silent if audio fails
    }

    const playGhostSound = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;

        // Low frequency "whooooo" sound
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 1);
        osc.frequency.exponentialRampToValueAtTime(60, now + 2.5);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.Q.setValueAtTime(10, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 3);

        // Add some reverb-like delay
        const delay = audioCtx.createDelay();
        delay.delayTime.setValueAtTime(0.3, now);
        const delayGain = audioCtx.createGain();
        delayGain.gain.setValueAtTime(0.3, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        gain.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 3);
      } catch {
        // Silent fail
      }
    };

    const duration = 3000; // 3 seconds

    // Play sound
    playGhostSound();

    // Screen shake effect
    const shake = () => {
      const container = containerRef.current;
      if (!container) return;

      const shakeIntensity = 5;
      const shakeX = (Math.random() - 0.5) * shakeIntensity;
      const shakeY = (Math.random() - 0.5) * shakeIntensity;

      container.style.transform = `translate(${shakeX}px, ${shakeY}px)`;

      setTimeout(() => {
        if (container) {
          container.style.transform = 'translate(0, 0)';
        }
      }, 100);
    };

    // Shake every 200ms
    const shakeInterval = setInterval(shake, 200);

    const timer = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearInterval(shakeInterval);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.9)' }}
    >
      {/* Ghost that bobs up and down */}
      <div className="relative">
        <div
          className="text-9xl animate-bounce"
          style={{
            animation: 'bounce 0.8s infinite',
            filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.5))'
          }}
        >
          👻
        </div>

        {/* Flickering BOO text */}
        <div
          className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 text-4xl font-bold text-white"
          style={{
            animation: 'flicker 0.3s infinite alternate',
            textShadow: '0 0 10px rgba(255, 255, 255, 0.8)',
            fontFamily: 'serif'
          }}
        >
          BOO! 👻
        </div>
      </div>

      <style>{`
        @keyframes flicker {
          0%, 50% { opacity: 1; }
          25%, 75% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}