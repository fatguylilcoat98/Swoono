import { motion } from "framer-motion";

type SwoonoLogoProps = {
  className?: string;
};

/**
 * Static Swoono wordmark. The last "O" is a heart.
 * The hero transition animation lives in HeartTransition.tsx — this
 * component is just the still logo.
 */
export default function SwoonoLogo({ className = "" }: SwoonoLogoProps) {
  return (
    <div className={`flex items-baseline justify-center gap-1 ${className}`}>
      <motion.span
        className="font-display text-7xl md:text-8xl font-semibold tracking-tight text-swoono-ink"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      >
        Swoon
      </motion.span>

      <motion.svg
        viewBox="0 0 24 24"
        className="w-16 h-16 md:w-20 md:h-20 translate-y-1"
        style={{
          filter:
            "drop-shadow(0 0 24px rgb(var(--swoono-accent) / 0.6))",
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        aria-label="Heart"
      >
        <defs>
          <radialGradient id="swoonoLogoHeart" cx="30%" cy="25%" r="80%">
            <stop offset="0%" stopColor="rgb(var(--swoono-glow))" />
            <stop offset="45%" stopColor="rgb(var(--swoono-accent))" />
            <stop offset="100%" stopColor="rgb(var(--swoono-accent2))" />
          </radialGradient>
        </defs>
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="url(#swoonoLogoHeart)"
        />
      </motion.svg>
    </div>
  );
}
