import GlassPanel from "../ui/GlassPanel";

const TIERS = [
  {
    id: 0,
    name: "Spark",
    emoji: "✨",
    desc: "Free. Core room, traditional games, basic rewards.",
  },
  {
    id: 1,
    name: "Glow",
    emoji: "🌙",
    desc: "Couples games, premium rewards, shared effects.",
  },
  {
    id: 2,
    name: "Swoon",
    emoji: "💖",
    desc: "Animated takeovers, exclusive effects, first-look features.",
  },
];

export default function TiersPanel() {
  const currentTier = 0; // Placeholder until the points/tier rules land.

  return (
    <GlassPanel className="p-5">
      <h2 className="font-display text-lg text-swoono-ink mb-4">Tiers</h2>
      <div className="flex flex-col gap-2">
        {TIERS.map((t) => {
          const active = t.id === currentTier;
          const locked = t.id > currentTier;
          return (
            <div
              key={t.id}
              className={`rounded-xl p-3 border transition-colors ${
                active
                  ? "bg-swoono-accent/10 border-swoono-accent/40"
                  : locked
                    ? "bg-white/[0.02] border-white/5"
                    : "bg-white/5 border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.emoji}</span>
                  <span className="text-sm text-swoono-ink">{t.name}</span>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-swoono-dim">
                  {active ? "Current" : locked ? "Locked" : "Unlocked"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-swoono-dim leading-relaxed">
                {t.desc}
              </p>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
