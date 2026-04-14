import {
  playCheer,
  playImpact,
  playBoing,
  playSparkle,
} from "../../../lib/sounds";
import type { TrophyVariant } from "./TrophyBurst";

export type TrophyPreset = {
  effectId: string;
  emoji: string;
  variant: TrophyVariant;
  accent: string;
  duration: number;
  sound: () => void;
};

/**
 * Trophy action presets — ported from Chris's old Duo app.
 * Each reward in rewardRegistry points at one of these effectIds.
 *
 * Adding a new trophy: add a preset here, add a reward in rewardRegistry
 * with the matching effectId, and it'll render through the standard
 * EffectOverlay dispatch. No component changes needed.
 */
export const TROPHY_PRESETS: Record<string, TrophyPreset> = {
  // --- Love ---
  "effect.hug": {
    effectId: "effect.hug",
    emoji: "🤗",
    variant: "pulse",
    accent: "rgb(255, 182, 193)",
    duration: 2200,
    sound: playCheer,
  },
  "effect.kiss": {
    effectId: "effect.kiss",
    emoji: "😘",
    variant: "pulse",
    accent: "rgb(255, 105, 180)",
    duration: 2200,
    sound: playSparkle,
  },
  "effect.hearts": {
    effectId: "effect.hearts",
    emoji: "💕",
    variant: "rise",
    accent: "rgb(255, 100, 170)",
    duration: 2600,
    sound: playSparkle,
  },
  "effect.flowers": {
    effectId: "effect.flowers",
    emoji: "💐",
    variant: "rise",
    accent: "rgb(255, 150, 200)",
    duration: 2600,
    sound: playSparkle,
  },

  // --- Mean ---
  "effect.slap": {
    effectId: "effect.slap",
    emoji: "👋",
    variant: "shake",
    accent: "rgb(255, 70, 70)",
    duration: 1400,
    sound: playImpact,
  },
  "effect.punch": {
    effectId: "effect.punch",
    emoji: "👊",
    variant: "shake",
    accent: "rgb(255, 40, 40)",
    duration: 1400,
    sound: playImpact,
  },
  "effect.kick": {
    effectId: "effect.kick",
    emoji: "🦵",
    variant: "shake",
    accent: "rgb(255, 80, 40)",
    duration: 1400,
    sound: playImpact,
  },

  // --- Funny ---
  "effect.pie": {
    effectId: "effect.pie",
    emoji: "🥧",
    variant: "splash",
    accent: "rgb(255, 200, 100)",
    duration: 2000,
    sound: playBoing,
  },
  "effect.banana": {
    effectId: "effect.banana",
    emoji: "🍌",
    variant: "drift",
    accent: "rgb(255, 230, 60)",
    duration: 2200,
    sound: playBoing,
  },
  "effect.confetti": {
    effectId: "effect.confetti",
    emoji: "🎉",
    variant: "fall",
    accent: "rgb(255, 200, 60)",
    duration: 3000,
    sound: playCheer,
  },
  "effect.tickle": {
    effectId: "effect.tickle",
    emoji: "🤭",
    variant: "pulse",
    accent: "rgb(255, 180, 120)",
    duration: 1800,
    sound: playBoing,
  },
};
