import { useEffect, ReactNode } from "react";
import { useThemeStore } from "../../state/themeStore";

/**
 * Applies the active theme's CSS class to <html> so all CSS variables
 * defined in globals.css cascade to every descendant (body, overlays,
 * portals, everything). Swap themes at runtime and every component
 * updates automatically.
 */
const ALL_THEME_CLASSES = ["theme-neutral", "theme-guy", "theme-girl"];

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    ALL_THEME_CLASSES.forEach((c) => root.classList.remove(c));
    root.classList.add(theme.className);
  }, [theme]);

  return <>{children}</>;
}
