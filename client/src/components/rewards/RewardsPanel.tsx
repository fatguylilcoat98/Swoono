import GlassPanel from "../ui/GlassPanel";
import {
  getRewards,
  type RewardDefinition,
} from "../../lib/registries/rewardRegistry";
import { usePointsStore } from "../../state/pointsStore";
import { broadcastEffect } from "../../lib/registries/effectRegistry";
import { useRoomStore } from "../../state/roomStore";

export default function RewardsPanel() {
  const points = usePointsStore((s) => s.points);
  const spend = usePointsStore((s) => s.spend);
  const rewards = getRewards().slice(0, 4);
  const clientId = useRoomStore((s) => s.clientId);

  function redeem(r: RewardDefinition) {
    const ok = spend(r.cost, `Redeemed ${r.name}`);
    if (!ok) return;
    broadcastEffect({
      effectId: r.effectId,
      fromClientId: clientId,
      data: { rewardId: r.id },
    });
  }

  return (
    <GlassPanel className="p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-lg text-swoono-ink">Rewards</h2>
        <span className="text-swoono-dim text-[10px] uppercase tracking-widest">
          {points} pts
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {rewards.map((r) => {
          const canAfford = points >= r.cost;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => redeem(r)}
              disabled={!canAfford}
              className={`flex items-center gap-3 rounded-xl p-3 border text-left transition-all ${
                canAfford
                  ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-swoono-accent/40"
                  : "bg-white/[0.02] border-white/5 opacity-60 cursor-not-allowed"
              }`}
            >
              <span className="text-2xl leading-none">{r.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-swoono-ink">{r.name}</span>
                <span className="block text-[10px] text-swoono-dim/80 truncate">
                  {r.description}
                </span>
              </span>
              <span className="text-xs text-swoono-accent font-medium">
                {r.cost}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-swoono-dim/70">
        Animations are stubs — existing effects plug into{" "}
        <code className="text-swoono-dim">effectRegistry</code>.
      </p>
    </GlassPanel>
  );
}
