export type ModeId = "neutral" | "guy" | "girl";

/**
 * Motion + particle tokens. These are the non-CSS-variable parts of a theme —
 * things a CSS variable can't express (ease curves, numeric drag, particle
 * physics config). Visual tokens (colors, gradients) are set via CSS custom
 * properties in the `.theme-X` classes in globals.css.
 */
export type ThemeMotion = {
  /** cubic-bezier control points for Framer Motion transitions */
  easing: [number, number, number, number];
  durationFast: number;
  durationBase: number;
  durationSlow: number;

  // Particle field physics
  particleDensity: number;
  particleSpeed: number;
  particlePulseStrength: number;
  /** HSL hue where the particle palette starts */
  particleHueStart: number;
  /** HSL hue range above particleHueStart */
  particleHueSpread: number;
  /** Velocity drag per frame — lower = floatier */
  particleDrag: number;
};

export type ThemeCopy = {
  welcome: string;
  subhead: string;
  enterLabel: string;
};

export type Theme = {
  id: ModeId;
  /** Display name — NOT the mode id. Rendered in the UI. */
  name: string;
  /** Short human description shown in the mode selector */
  description: string;
  /** CSS class applied to <html> to activate the variable set in globals.css */
  className: string;
  motion: ThemeMotion;
  copy: ThemeCopy;
};
