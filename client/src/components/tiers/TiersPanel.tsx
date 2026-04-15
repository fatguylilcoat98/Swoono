import GlassPanel from "../ui/GlassPanel";
import { usePointsStore } from "../../state/pointsStore";

const TIERS = [
  {
    id: 0,
    name: "Spark",
    emoji: "✨",
    desc: "Free. Core room, traditional games, basic rewards.",
    minPoints: 0,
  },
  {
    id: 1,
    name: "Glow",
    emoji: "🌙",
    desc: "Couples games, premium rewards, shared effects.",
    minPoints: 100,
  },
  {
    id: 2,
    name: "Swoon",
    emoji: "💖",
    desc: "Animated takeovers, exclusive effects, first-look features.",
    minPoints: 250,
  },
];

function calculateTier(points: number): number {
  // Find the highest tier the user qualifies for
  let tier = 0;
  for (const t of TIERS) {
    if (points >= t.minPoints) {
      tier = t.id;
    }
  }
  return tier;
}

export default function TiersPanel() {
  const points = usePointsStore((s) => s.points);
  const currentTier = calculateTier(points);

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
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase tracking-widest text-swoono-dim">
                    {active ? "Current" : locked ? "Locked" : "Unlocked"}
                  </span>
                  {locked && (
                    <span className="text-[9px] text-swoono-dim mt-0.5">
                      {t.minPoints - points} pts needed
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-swoono-dim leading-relaxed">
                {t.desc}
              </p>
              {t.minPoints > 0 && (
                <p className="mt-1 text-[10px] text-swoono-dim/60">
                  Requires {t.minPoints}+ points
                </p>
              )}
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
