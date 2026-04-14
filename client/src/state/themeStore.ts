import { create } from "zustand";
import { getTheme, defaultThemeId } from "../theme/themeRegistry";
import type { ModeId, Theme } from "../theme/types";

const STORAGE_KEY = "swoono:mode";

function loadMode(): ModeId | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "guy" || v === "girl" || v === "neutral") return v;
    return null;
  } catch {
    return null;
  }
}

function saveMode(id: ModeId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage unavailable — mode is still applied in memory
  }
}

type ThemeState = {
  mode: ModeId;
  theme: Theme;
  /** true once the user has explicitly picked a mode (or had one stored) */
  hasChosen: boolean;
  setMode: (id: ModeId) => void;
};

const stored = loadMode();
const initialMode: ModeId = stored ?? defaultThemeId;

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialMode,
  theme: getTheme(initialMode),
  hasChosen: stored !== null,
  setMode: (id) => {
    saveMode(id);
    set({ mode: id, theme: getTheme(id), hasChosen: true });
  },
}));
