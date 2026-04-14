import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useEffectsStore, type ActiveEffect } from "../../state/effectsStore";
import VictoryBurst from "./VictoryBurst";
import DefeatFlash from "./DefeatFlash";

/**
 * Top-level renderer for full-screen effects pushed onto the effectsStore.
 * Mounted once in App.tsx. Reads the active effect queue and dispatches
 * each one to its React component by effectId.
 *
 * Adding a new effect: create the component, register a case below.
 * Adding a new reward animation: register a handler in effectRegistry
 * that pushes to the effectsStore, then wire a case here.
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
  // Unknown effect ids — dismiss immediately so they don't leak into the
  // queue forever. useEffect so state update happens after render.
  useEffect(() => {
    if (effect.effectId === "effect.game.win") return;
    if (effect.effectId === "effect.game.lose") return;
    const t = setTimeout(onDone, 0);
    return () => clearTimeout(t);
  }, [effect.effectId, onDone]);

  switch (effect.effectId) {
    case "effect.game.win":
      return <VictoryBurst onDone={onDone} />;
    case "effect.game.lose":
      return <DefeatFlash onDone={onDone} />;
    default:
      return null;
  }
}
