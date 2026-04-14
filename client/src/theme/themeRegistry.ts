import type { ModeId, Theme } from "./types";
import { guyTheme, girlTheme, neutralTheme } from "./themes";

const _registry = new Map<ModeId, Theme>();

export function registerTheme(theme: Theme) {
  _registry.set(theme.id, theme);
}

export function getTheme(id: ModeId): Theme {
  return _registry.get(id) ?? neutralTheme;
}

export function getAllThemes(): Theme[] {
  // Neutral first so it's the visible default in selectors.
  return [
    _registry.get("neutral"),
    _registry.get("guy"),
    _registry.get("girl"),
  ].filter((t): t is Theme => !!t);
}

export const defaultThemeId: ModeId = "neutral";

registerTheme(neutralTheme);
registerTheme(guyTheme);
registerTheme(girlTheme);
