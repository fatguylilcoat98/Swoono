import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";

export type TrophyVariant =
  | "pulse"
  | "rise"
  | "fall"
  | "shake"
  | "drift"
  | "splash";

export type TrophyBurstProps = {
  emoji: string;
  variant: TrophyVariant;
  accent: string;
  duration: number;
  sound?: () => void;
  onDone: () => void;
};

/**
 * Shared full-screen overlay primitive for trophy/reward animations.
 *
 * Each reward picks a `variant` and fills in its emoji + accent color.
 * Animation logic lives here; presets.ts contains the configs that drive it.
 *
 * Adding a new variant: extend the switch and add a keyframe block.
 * Adding a new reward: add an entry to TROPHY_PRESETS (don't touch this file).
 */
export default function TrophyBurst({
  emoji,
  variant,
  accent,
  duration,
  sound,
  onDone,
}: TrophyBurstProps) {
  useEffect(() => {
    sound?.();
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [sound, duration, onDone]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const secs = duration / 1000;

  const rise = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: (i / 14) * 100 + (Math.random() * 10 - 5),
      delay: Math.random() * 0.3,
      dur: 1.8 + Math.random() * 0.8,
      drift: (Math.random() - 0.5) * 60,
      size: 32 + Math.random() * 24,
    }));
  }, []);

  const fall = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      dur: 2.0 + Math.random() * 1.0,
      rotate: Math.random() * 720 - 360,
      size: 24 + Math.random() * 20,
    }));
  }, []);

  if (variant === "pulse") {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{
            scale: [0.4, 1.6, 1.3, 1.5, 0.6],
            opacity: [0, 1, 1, 1, 0],
          }}
          transition={{
            duration: secs,
            times: [0, 0.2, 0.45, 0.75, 1],
            ease: "easeOut",
          }}
          style={{
            fontSize: "12rem",
            filter: `drop-shadow(0 0 40px ${accent})`,
          }}
        >
          {emoji}
        </motion.div>
      </div>
    );
  }

  if (variant === "rise") {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
        {rise.map((it) => (
          <motion.div
            key={it.id}
            className="absolute bottom-0"
            style={{
              left: `${it.left}%`,
              fontSize: it.size,
              filter: `drop-shadow(0 0 10px ${accent})`,
            }}
            initial={{ y: 0, x: 0, opacity: 0 }}
            animate={{
              y: -vh - 80,
              x: it.drift,
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: it.dur, delay: it.delay, ease: "easeOut" }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>
    );
  }

  if (variant === "fall") {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
        {fall.map((it) => (
          <motion.div
            key={it.id}
            className="absolute"
            style={{ left: `${it.left}%`, top: -60, fontSize: it.size }}
            initial={{ y: 0, rotate: 0, opacity: 1 }}
            animate={{
              y: vh + 100,
              rotate: it.rotate,
              opacity: [1, 1, 0.8, 0],
            }}
            transition={{ duration: it.dur, delay: it.delay, ease: "linear" }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>
    );
  }

  if (variant === "shake") {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50 flex items-center justify-center">
        <motion.div
          className="absolute inset-0"
          style={{ background: accent }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.25, 0.1, 0] }}
          transition={{ duration: secs, times: [0, 0.12, 0.28, 1] }}
        />
        <motion.div
          initial={{ scale: 0.3, opacity: 0, rotate: 0 }}
          animate={{
            scale: [0.3, 2.8, 2.4, 2.4, 0.6],
            opacity: [0, 1, 1, 1, 0],
            rotate: [0, -20, 15, -12, 20],
            x: [0, -30, 25, -15, 10, 0],
          }}
          transition={{
            duration: secs,
            times: [0, 0.15, 0.4, 0.75, 1],
            ease: "easeOut",
          }}
          style={{ fontSize: "10rem" }}
        >
          {emoji}
        </motion.div>
      </div>
    );
  }

  if (variant === "drift") {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50 flex items-center">
        <motion.div
          initial={{ x: -200, y: 0, rotate: -30, opacity: 0 }}
          animate={{
            x: vw + 200,
            y: [0, -50, 30, -40, 20, 0],
            rotate: [0, 180, 360, 540, 720],
            opacity: [0, 1, 1, 1, 0],
          }}
          transition={{
            duration: secs,
            times: [0, 0.15, 0.4, 0.65, 1],
            ease: "linear",
          }}
          style={{ fontSize: "8rem" }}
        >
          {emoji}
        </motion.div>
      </div>
    );
  }

  if (variant === "splash") {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{
            scale: [0.1, 4, 3.8, 4, 0.5],
            opacity: [0, 1, 1, 1, 0],
          }}
          transition={{
            duration: secs,
            times: [0, 0.15, 0.3, 0.7, 1],
            ease: "easeOut",
          }}
          style={{
            fontSize: "10rem",
            filter: `drop-shadow(0 0 60px ${accent})`,
          }}
        >
          {emoji}
        </motion.div>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ border: `6px solid ${accent}` }}
            initial={{ width: 50, height: 50, opacity: 0.8 }}
            animate={{
              width: 400 + i * 120,
              height: 400 + i * 120,
              opacity: 0,
            }}
            transition={{
              duration: secs,
              delay: 0.15 + i * 0.1,
              ease: "easeOut",
            }}
          />
        ))}
      </div>
    );
  }

  return null;
}
