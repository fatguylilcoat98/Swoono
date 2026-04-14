import { useEffect } from "react";
import { motion } from "framer-motion";
import { playLose } from "../../lib/sounds";

type DefeatFlashProps = {
  onDone: () => void;
};

const DURATION_MS = 2600;

export default function DefeatFlash({ onDone }: DefeatFlashProps) {
  useEffect(() => {
    playLose();
    const t = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50 flex items-center justify-center">
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.45, 0.45, 0] }}
        transition={{
          duration: DURATION_MS / 1000,
          times: [0, 0.18, 0.78, 1],
          ease: "easeInOut",
        }}
      />
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{
          scale: [0.5, 1.15, 1, 1, 0.95],
          opacity: [0, 1, 1, 1, 0],
        }}
        transition={{
          duration: DURATION_MS / 1000,
          times: [0, 0.15, 0.28, 0.82, 1],
          ease: [0.2, 0.8, 0.2, 1],
        }}
        className="relative font-display text-6xl md:text-8xl font-bold text-swoono-dim"
        style={{
          textShadow:
            "0 0 40px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)",
        }}
      >
        LOSER
      </motion.div>
    </div>
  );
}
