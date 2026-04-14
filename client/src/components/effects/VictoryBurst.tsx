import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { playWin } from "../../lib/sounds";

type VictoryBurstProps = {
  onDone: () => void;
};

const DURATION_MS = 3600;

type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  rotate: number;
  hue: number;
  size: number;
};

type Balloon = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  wobble: number;
  hue: number;
  size: number;
};

export default function VictoryBurst({ onDone }: VictoryBurstProps) {
  useEffect(() => {
    playWin();
    const t = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  const confetti = useMemo<ConfettiPiece[]>(
    () =>
      Array.from({ length: 64 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        duration: 2.2 + Math.random() * 1.2,
        rotate: Math.random() * 720 - 360,
        hue: Math.floor(Math.random() * 360),
        size: 6 + Math.random() * 6,
      })),
    [],
  );

  const balloons = useMemo<Balloon[]>(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: 8 + Math.random() * 84,
        delay: Math.random() * 0.4,
        duration: 3.0 + Math.random() * 1.2,
        wobble: (Math.random() - 0.5) * 24,
        hue: Math.floor(290 + Math.random() * 80),
        size: 32 + Math.random() * 24,
      })),
    [],
  );

  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {balloons.map((b) => (
        <motion.div
          key={`b${b.id}`}
          className="absolute bottom-0 flex flex-col items-center"
          style={{ left: `${b.left}%` }}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: -vh - 120, opacity: [0, 1, 1, 0.8] }}
          transition={{ duration: b.duration, delay: b.delay, ease: "easeOut" }}
        >
          <motion.div
            animate={{ x: [0, b.wobble, 0, -b.wobble, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: b.size,
              height: b.size * 1.2,
              background: `radial-gradient(circle at 35% 30%, hsl(${b.hue}, 95%, 85%), hsl(${b.hue}, 85%, 58%))`,
              borderRadius: "50%",
              boxShadow: `0 0 24px hsla(${b.hue}, 90%, 70%, 0.55)`,
            }}
          />
          <div className="w-px h-10 bg-white/25" />
        </motion.div>
      ))}

      {confetti.map((c) => (
        <motion.div
          key={`c${c.id}`}
          className="absolute top-0"
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.size * 1.6,
            background: `hsl(${c.hue}, 90%, 65%)`,
            borderRadius: 1,
          }}
          initial={{ y: -60, rotate: 0, opacity: 1 }}
          animate={{
            y: vh + 80,
            rotate: c.rotate,
            opacity: [1, 1, 0.8, 0],
          }}
          transition={{ duration: c.duration, delay: c.delay, ease: "linear" }}
        />
      ))}

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
          animate={{
            scale: [0.4, 1.25, 1, 1.05, 1],
            opacity: [0, 1, 1, 1, 0],
            rotate: [-6, 2, 0, 0, 0],
          }}
          transition={{
            duration: DURATION_MS / 1000,
            times: [0, 0.15, 0.3, 0.78, 1],
            ease: [0.2, 0.8, 0.2, 1],
          }}
          className="font-display text-6xl md:text-8xl font-bold drop-shadow-[0_0_40px_rgb(var(--swoono-accent)/0.9)]"
          style={{
            background:
              "linear-gradient(135deg, rgb(var(--swoono-glow)), rgb(var(--swoono-accent)), rgb(var(--swoono-accent2)))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          WINNER
        </motion.div>
      </div>
    </div>
  );
}
