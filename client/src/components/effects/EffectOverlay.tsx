import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useEffectsStore, type ActiveEffect } from "../../state/effectsStore";
import VictoryBurst from "./VictoryBurst";
import DefeatFlash from "./DefeatFlash";
import FireworksBurst from "./FireworksBurst";
import TrophyBurst from "./trophy/TrophyBurst";
import { TROPHY_PRESETS } from "./trophy/presets";
// New effect imports
import FloatingHearts from "./FloatingHearts";
import RoseShower from "./RoseShower";
import GhostMode from "./GhostMode";
import RoastCard from "./RoastCard";
import PrankAlarm from "./PrankAlarm";
import ConfettiCannon from "./ConfettiCannon";
import LoveBomb from "./LoveBomb";
import ProposalEffect from "./ProposalEffect";
import AnniversaryEffect from "./AnniversaryEffect";
import ILoveYouEffect from "./ILoveYouEffect";
import MeetUpEffect from "./MeetUpEffect";

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
  const isNewEffect = [
    "floating_hearts", "rose_shower", "ghost_mode", "roast_card", "prank_alarm",
    "confetti_cannon", "love_bomb", "proposal", "anniversary", "i_love_you", "meet_up"
  ].includes(effect.effectId);
  const isKnown =
    effect.effectId === "effect.game.win" ||
    effect.effectId === "effect.game.lose" ||
    effect.effectId === "effect.fireworks" ||
    preset !== undefined ||
    isNewEffect;

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

  // New effect components
  if (effect.effectId === "floating_hearts") {
    return <FloatingHearts onComplete={onDone} />;
  }
  if (effect.effectId === "rose_shower") {
    return <RoseShower onComplete={onDone} />;
  }
  if (effect.effectId === "ghost_mode") {
    return <GhostMode onComplete={onDone} />;
  }
  if (effect.effectId === "roast_card") {
    return <RoastCard onComplete={onDone} />;
  }
  if (effect.effectId === "prank_alarm") {
    return <PrankAlarm onComplete={onDone} />;
  }
  if (effect.effectId === "confetti_cannon") {
    return <ConfettiCannon onComplete={onDone} />;
  }
  if (effect.effectId === "love_bomb") {
    return <LoveBomb onComplete={onDone} />;
  }
  if (effect.effectId === "proposal") {
    return <ProposalEffect onComplete={onDone} />;
  }
  if (effect.effectId === "anniversary") {
    return <AnniversaryEffect onComplete={onDone} />;
  }
  if (effect.effectId === "i_love_you") {
    return <ILoveYouEffect onComplete={onDone} />;
  }
  if (effect.effectId === "meet_up") {
    return <MeetUpEffect onComplete={onDone} />;
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
