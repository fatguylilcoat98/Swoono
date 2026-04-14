import { motion } from "framer-motion";

type HeartTransitionProps = {
  onComplete: () => void;
};

/**
 * The signature "Enter Swoono" moment. A heart:
 *   1. pulses twice (beats)
 *   2. swells
 *   3. lunges toward the viewer
 *   4. handoff to the next screen via onComplete
 *
 * Everything is one Framer Motion keyframe array with `times` so the pulses,
 * the swell, and the approach stay in sync with the darkening overlay.
 */
export default function HeartTransition({ onComplete }: HeartTransitionProps) {
  const times = [0, 0.12, 0.24, 0.36, 0.48, 0.75, 1];
  const duration = 2.4;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      {/* Expanding ambient glow */}
      <motion.div
        className="absolute w-24 h-24 rounded-full bg-swoono-accent/40 blur-3xl"
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{ scale: [1, 3, 20], opacity: [0.5, 0.8, 0] }}
        transition={{ duration, ease: [0.5, 0, 0.5, 1] }}
      />

      {/* The heart itself */}
      <motion.svg
        viewBox="0 0 24 24"
        className="absolute w-16 h-16 drop-shadow-[0_0_40px_rgba(255,77,143,0.85)]"
        initial={{ scale: 1, opacity: 1 }}
        animate={{
          scale: [1, 1.2, 1, 1.25, 1, 3, 18],
          opacity: [1, 1, 1, 1, 1, 0.95, 0],
        }}
        transition={{ duration, times, ease: [0.5, 0, 0.5, 1] }}
        onAnimationComplete={onComplete}
      >
        <defs>
          <radialGradient id="heartTransitionGrad" cx="30%" cy="25%" r="80%">
            <stop offset="0%" stopColor="rgb(var(--swoono-glow))" />
            <stop offset="45%" stopColor="rgb(var(--swoono-accent))" />
            <stop offset="100%" stopColor="rgb(var(--swoono-accent2))" />
          </radialGradient>
        </defs>
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="url(#heartTransitionGrad)"
        />
      </motion.svg>

      {/* Darkening overlay that fades in as the heart approaches */}
      <motion.div
        className="absolute inset-0 bg-swoono-bg"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0, 0, 0, 0.2, 0.9] }}
        transition={{ duration, times }}
      />
    </div>
  );
}
