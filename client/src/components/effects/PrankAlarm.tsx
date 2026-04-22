import { useEffect, useState } from "react";

interface PrankAlarmProps {
  onComplete?: () => void;
}

export default function PrankAlarm({ onComplete }: PrankAlarmProps) {
  const [flashCount, setFlashCount] = useState(0);

  useEffect(() => {
    // Web Audio for alarm sound
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
    } catch {
      // Silent if audio fails
    }

    const playAlarmSound = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;

        // Alternating alarm tones (800hz / 600hz)
        const createAlarmBeep = (freq: number, startTime: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.2, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(startTime);
          osc.stop(startTime + duration);
        };

        // Rapid alternating beeps
        for (let i = 0; i < 15; i++) {
          const freq = i % 2 === 0 ? 800 : 600;
          createAlarmBeep(freq, now + i * 0.2, 0.15);
        }
      } catch {
        // Silent fail
      }
    };

    const duration = 3000; // 3 seconds

    // Play alarm sound
    playAlarmSound();

    // Flash effect - 10 flashes
    const flashInterval = setInterval(() => {
      setFlashCount(prev => {
        if (prev >= 10) {
          clearInterval(flashInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 150);

    const timer = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearInterval(flashInterval);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      {/* Flashing red overlay */}
      <div
        className={`absolute inset-0 transition-opacity duration-150 ${
          flashCount % 2 === 0 ? 'bg-red-600 opacity-70' : 'bg-transparent opacity-0'
        }`}
      />

      {/* Spinning alarm emoji */}
      <div className="relative">
        <div
          className="text-9xl"
          style={{
            animation: 'spin 0.5s linear infinite',
            filter: 'drop-shadow(0 0 20px rgba(255, 0, 0, 0.8))'
          }}
        >
          🚨
        </div>

        {/* ALERT text */}
        <div
          className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 text-4xl font-bold text-red-500"
          style={{
            animation: 'pulse 0.3s ease-in-out infinite',
            textShadow: '0 0 10px rgba(255, 0, 0, 0.8)',
            fontFamily: 'monospace'
          }}
        >
          ALERT! ALERT!
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}