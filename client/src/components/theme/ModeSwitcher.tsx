import { useThemeStore } from "../../state/themeStore";
import { getAllThemes } from "../../theme/themeRegistry";

/**
 * Compact mode switcher for the room header. Lets the user change their
 * personal theme at any time. Mode is NOT broadcast to the peer — the
 * peer keeps their own preference.
 */
export default function ModeSwitcher() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const themes = getAllThemes();

  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
      {themes.map((t) => {
        const active = t.id === mode;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            title={t.description}
            className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider transition-colors ${
              active
                ? "bg-swoono-accent/25 text-swoono-ink"
                : "text-swoono-dim hover:text-swoono-ink"
            }`}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
