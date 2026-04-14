import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useEffectsStore, type ActiveEffect } from "../../state/effectsStore";
import VictoryBurst from "./VictoryBurst";
import DefeatFlash from "./DefeatFlash";
import FireworksBurst from "./FireworksBurst";
import TrophyBurst from "./trophy/TrophyBurst";
import { TROPHY_PRESETS } from "./trophy/presets";

/**
 * Top-level renderer for full-screen effects pushed onto the effectsStore.
 * Mounted once in App.tsx. Dispatches each active effect to its component
 * by effectId:
 *
 *   "effect.game.win"  -> VictoryBurst
 *   "effect.game.lose" -> DefeatFlash
 *   any id in TROPHY_PRESETS -> TrophyBurst with that preset's config
 */
export default function EffectOverlay() {
  const active = useEffectsStore((s) => s.active);
  const dismiss = useEffectsStore((s) => s.dismissEffect);

  return (
    <AnimatePresence>
      {active.map((effect) => (
        <EffectRenderer
          key={effect.id}
          effect={effect}
          onDone={() => dismiss(effect.id)}
        />
      ))}
    </AnimatePresence>
  );
}

function EffectRenderer({
  effect,
  onDone,
}: {
  effect: ActiveEffect;
  onDone: () => void;
}) {
  const preset = TROPHY_PRESETS[effect.effectId];
  const isKnown =
    effect.effectId === "effect.game.win" ||
    effect.effectId === "effect.game.lose" ||
    effect.effectId === "effect.fireworks" ||
    preset !== undefined;

  // Unknown effect ids — dismiss immediately so they don't leak.
  useEffect(() => {
    if (isKnown) return;
    const t = setTimeout(onDone, 0);
    return () => clearTimeout(t);
  }, [isKnown, onDone]);

  if (effect.effectId === "effect.game.win") {
    return <VictoryBurst onDone={onDone} />;
  }
  if (effect.effectId === "effect.game.lose") {
    return <DefeatFlash onDone={onDone} />;
  }
  if (effect.effectId === "effect.fireworks") {
    return <FireworksBurst onDone={onDone} />;
  }
  if (preset) {
    return (
      <TrophyBurst
        emoji={preset.emoji}
        variant={preset.variant}
        accent={preset.accent}
        duration={preset.duration}
        sound={preset.sound}
        onDone={onDone}
      />
    );
  }
  return null;
}
