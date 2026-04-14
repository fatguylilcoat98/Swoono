import { motion } from "framer-motion";
import { useThemeStore } from "../../state/themeStore";
import { getAllThemes } from "../../theme/themeRegistry";
import type { Theme } from "../../theme/types";

type ModeSelectorProps = {
  onDone: () => void;
};

export default function ModeSelector({ onDone }: ModeSelectorProps) {
  const setMode = useThemeStore((s) => s.setMode);
  const themes = getAllThemes();

  const chooseAndContinue = (id: Theme["id"]) => {
    setMode(id);
    // Brief pause so the theme visibly settles before we transition out.
    setTimeout(onDone, 380);
  };

  return (
    <motion.div
      className="relative min-h-dvh flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-full max-w-4xl text-center">
        <motion.p
          className="text-xs tracking-[0.35em] uppercase text-swoono-dim mb-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Choose your feel
        </motion.p>
        <motion.h1
          className="font-display text-3xl md:text-4xl text-swoono-ink mb-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Same room. Your vision.
        </motion.h1>
        <motion.p
          className="text-sm text-swoono-dim max-w-md mx-auto mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          This is personal — the person in your room can pick their own.
        </motion.p>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {themes.map((theme, i) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              index={i}
              onChoose={chooseAndContinue}
            />
          ))}
        </div>

        <p className="mt-8 text-[11px] text-swoono-dim/80 max-w-md mx-auto leading-relaxed">
          You both see the same notes, games, and rewards — through your own
          lens. You can switch modes later from the room header.
        </p>
      </div>
    </motion.div>
  );
}

function ThemeCard({
  theme,
  index,
  onChoose,
}: {
  theme: Theme;
  index: number;
  onChoose: (id: Theme["id"]) => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onChoose(theme.id)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 + index * 0.1, duration: 0.6 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={`${theme.className} relative rounded-2xl p-6 text-left glass-strong shadow-glow border border-white/10 hover:border-white/25 transition-colors`}
    >
      {/* Preview palette — reads this card's local theme class, not the page's */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-full bg-swoono-accent shadow-glow" />
        <span className="w-6 h-6 rounded-full bg-swoono-accent2 opacity-80" />
        <span className="w-4 h-4 rounded-full bg-swoono-glow opacity-60" />
      </div>
      <h3 className="font-display text-xl text-swoono-ink mb-1">
        {theme.name}
      </h3>
      <p className="text-[10px] uppercase tracking-widest text-swoono-dim mb-4">
        {theme.id === "neutral"
          ? "Default"
          : theme.id === "guy"
            ? "Bold"
            : "Warm"}
      </p>
      <p className="text-sm text-swoono-dim leading-relaxed min-h-[60px]">
        {theme.description}
      </p>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-swoono-dim/60">
          Tap to choose
        </span>
        <span className="text-swoono-accent text-base">→</span>
      </div>
    </motion.button>
  );
}
