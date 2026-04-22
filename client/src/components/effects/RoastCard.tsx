import { useEffect, useState } from "react";

interface RoastCardProps {
  onComplete?: () => void;
}

const ROASTS = [
  "Your WiFi has more bars than your social life 📶",
  "I'd agree with you but then we'd both be wrong 🤷",
  "Your cooking would make a microwave nervous 🍳",
  "You have the energy of a Monday morning ☕",
  "You bring joy — whenever you leave the room 🚪",
  "Your selfies need a filter called Reality 📸",
  "You're the reason we have warning labels ⚠️",
  "Your GPS would get lost following you 🗺️",
  "You're like a cloud — when you disappear it's beautiful ☁️",
  "Your secrets are safe — I never listen anyway 🙉",
  "Your dance moves look like a software update 💻",
  "You're the human equivalent of a participation trophy 🏅",
  "Your fashion sense called — it wants a refund 👗",
  "You have miles of potential — all underground 🕳️",
  "You're not stupid — you just have bad luck thinking 🧠",
  "Your cooking is so bad even the fire alarm cheers 🔥",
  "You're like WiFi in an elevator — always going down 📉",
  "Your future is bright — you need shades for the dark 🕶️",
  "You're proof that even AI has off days 🤖",
  "Your jokes are like bad WiFi — they never connect 😐"
];

export default function RoastCard({ onComplete }: RoastCardProps) {
  const [roast] = useState(() => ROASTS[Math.floor(Math.random() * ROASTS.length)]);

  useEffect(() => {
    // Web Audio for crowd reaction sound
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
    } catch {
      // Silent if audio fails
    }

    const playCrowdReaction = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;

        // Rising tone + crowd reaction
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const distortion = audioCtx.createWaveShaper();

        // Create distortion curve for "OOOOH" effect
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < samples; i++) {
          const x = (i * 2) / samples - 1;
          curve[i] = ((3 + deg) * x * 20 * deg) / (Math.PI + deg * Math.abs(x));
        }
        distortion.curve = curve;

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(150, now);
        osc1.frequency.exponentialRampToValueAtTime(400, now + 1);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(75, now);
        osc2.frequency.exponentialRampToValueAtTime(200, now + 1);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 2);

        osc1.connect(distortion);
        osc2.connect(distortion);
        distortion.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2);
        osc2.stop(now + 2);
      } catch {
        // Silent fail
      }
    };

    const duration = 4000; // 4 seconds

    // Play sound
    playCrowdReaction();

    const timer = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => {
      clearTimeout(timer);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-90" />

      {/* Fire border animation */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 border-8"
          style={{
            borderImage: 'linear-gradient(45deg, #ff4500, #ff6500, #ff8500, #ff4500) 1',
            animation: 'fireGlow 1s ease-in-out infinite alternate',
          }}
        />
      </div>

      {/* Roast text */}
      <div className="relative max-w-2xl mx-8 text-center">
        <div
          className="text-3xl md:text-4xl font-bold text-white leading-relaxed px-8 py-6 rounded-lg"
          style={{
            background: 'rgba(255, 69, 0, 0.2)',
            border: '2px solid #ff4500',
            animation: 'bounceIn 0.6s ease-out',
            textShadow: '0 0 10px rgba(255, 255, 255, 0.8)',
            fontFamily: 'serif'
          }}
        >
          🔥 {roast} 🔥
        </div>
      </div>

      <style>{`
        @keyframes fireGlow {
          0% {
            border-color: #ff4500;
            box-shadow: inset 0 0 20px rgba(255, 69, 0, 0.5), 0 0 20px rgba(255, 69, 0, 0.3);
          }
          100% {
            border-color: #ff8500;
            box-shadow: inset 0 0 30px rgba(255, 133, 0, 0.7), 0 0 30px rgba(255, 133, 0, 0.5);
          }
        }

        @keyframes bounceIn {
          0% {
            transform: scale(0.3) rotateZ(-15deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.1) rotateZ(5deg);
          }
          100% {
            transform: scale(1) rotateZ(0deg);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}