import { useState } from "react";
import { motion } from "framer-motion";
import SwoonoLogo from "./SwoonoLogo";
import HeartTransition from "./HeartTransition";

type LandingProps = {
  onEnter: () => void;
};

export default function Landing({ onEnter }: LandingProps) {
  const [transitioning, setTransitioning] = useState(false);

  return (
    <motion.div
      className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <AmbientBackground />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-10 px-6 text-center"
        animate={{ opacity: transitioning ? 0 : 1 }}
        transition={{
          duration: transitioning ? 0.6 : 1.2,
          ease: [0.2, 0.8, 0.2, 1],
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <motion.p
            className="text-sm tracking-[0.35em] uppercase text-swoono-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: transitioning ? 0 : 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            Welcome to
          </motion.p>
          <SwoonoLogo />
        </div>

        <motion.p
          className="max-w-md text-balance text-swoono-dim text-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: transitioning ? 0 : 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          A synced room for the two of you. Notes, games, little gestures —
          live, together.
        </motion.p>

        <motion.button
          onClick={() => setTransitioning(true)}
          className="group relative px-10 py-4 rounded-full bg-swoono-accent/15 border border-swoono-accent/40 text-swoono-ink font-medium tracking-widest uppercase text-sm hover:bg-swoono-accent/25 transition-colors shadow-glow"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: transitioning ? 0 : 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.8 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Enter
        </motion.button>
      </motion.div>

      {transitioning && <HeartTransition onComplete={onEnter} />}
    </motion.div>
  );
}

function AmbientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-40 -left-40 w-[60vw] h-[60vw] rounded-full bg-swoono-accent/20 blur-3xl"
        animate={{
          x: [0, 30, -10, 0],
          y: [0, 20, -20, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-60 -right-40 w-[70vw] h-[70vw] rounded-full bg-swoono-accent2/15 blur-3xl"
        animate={{
          x: [0, -40, 20, 0],
          y: [0, -30, 10, 0],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full bg-swoono-glow/10 blur-3xl"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
