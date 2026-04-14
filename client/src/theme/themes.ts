import type { Theme } from "./types";

/**
 * Three theme configs. Each is a structured bag of tokens — there is no
 * per-mode JSX and no per-mode CSS branches. Components read tokens, the
 * theme class on <html> rebinds CSS custom properties, and everything
 * downstream just works.
 *
 * Future themes (Couple Blend, seasonal, unlockable premium) follow the
 * same shape and register with themeRegistry.registerTheme().
 */

export const neutralTheme: Theme = {
  id: "neutral",
  name: "Calm",
  description:
    "Minimal, refined, balanced. Cool slate accents and measured motion.",
  className: "theme-neutral",
  motion: {
    easing: [0.4, 0, 0.2, 1],
    durationFast: 0.3,
    durationBase: 0.6,
    durationSlow: 1.1,
    particleDensity: 140,
    particleSpeed: 0.35,
    particlePulseStrength: 1.0,
    particleHueStart: 210,
    particleHueSpread: 30,
    particleDrag: 0.985,
  },
  copy: {
    welcome: "Welcome to",
    subhead: "A quiet, synced space for two.",
    enterLabel: "Enter",
  },
};

export const guyTheme: Theme = {
  id: "guy",
  name: "Edge",
  description:
    "Sleek and bold. High-contrast panels, electric accents, snappier motion.",
  className: "theme-guy",
  motion: {
    easing: [0.7, 0, 0.3, 1],
    durationFast: 0.22,
    durationBase: 0.45,
    durationSlow: 0.85,
    particleDensity: 180,
    particleSpeed: 0.6,
    particlePulseStrength: 1.4,
    particleHueStart: 185,
    particleHueSpread: 30,
    particleDrag: 0.992,
  },
  copy: {
    welcome: "Welcome to",
    subhead: "A synced room built for the two of you. Notes. Games. Edge.",
    enterLabel: "Enter",
  },
};

export const girlTheme: Theme = {
  id: "girl",
  name: "Bloom",
  description:
    "Warm, elegant, dreamy. Soft gradients, expressive floating motion.",
  className: "theme-girl",
  motion: {
    easing: [0.2, 0.8, 0.2, 1],
    durationFast: 0.35,
    durationBase: 0.75,
    durationSlow: 1.3,
    particleDensity: 160,
    particleSpeed: 0.28,
    particlePulseStrength: 0.85,
    particleHueStart: 310,
    particleHueSpread: 50,
    particleDrag: 0.978,
  },
  copy: {
    welcome: "Welcome to",
    subhead:
      "A synced room for the two of you. Notes, games, little gestures — live, together.",
    enterLabel: "Enter",
  },
};
