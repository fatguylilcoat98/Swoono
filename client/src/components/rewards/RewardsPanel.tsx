import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import GlassPanel from "../ui/GlassPanel";
import {
  getRewardsByKind,
  type RewardDefinition,
  type RewardKind,
} from "../../lib/registries/rewardRegistry";
import { usePointsStore } from "../../state/pointsStore";
import { sendEffectToPeer } from "../../lib/registries/effectRegistry";
import { useRoomStore } from "../../state/roomStore";

const KIND_META: Record<
  RewardKind,
  { label: string; hint: string; accent: string }
> = {
  love: { label: "Love", hint: "💕", accent: "rgb(255 100 170)" },
  mean: { label: "Mean", hint: "😈", accent: "rgb(255 70 70)" },
  funny: { label: "Funny", hint: "😄", accent: "rgb(255 180 60)" },
};

export default function RewardsPanel() {
  const points = usePointsStore((s) => s.points);
  const spend = usePointsStore((s) => s.spend);
  const clientId = useRoomStore((s) => s.clientId);
  const peers = useRoomStore((s) => s.peers);
  const hasPartner = peers.some((p) => p.clientId !== clientId);

  const [sentToast, setSentToast] = useState<{
    id: number;
    text: string;
  } | null>(null);

  function redeem(r: RewardDefinition) {
    if (!hasPartner) {
      setSentToast({ id: Date.now(), text: "Waiting for your partner…" });
      setTimeout(() => setSentToast(null), 1800);
      return;
    }
    const ok = spend(r.cost, `Redeemed ${r.name}`);
    if (!ok) return;
    sendEffectToPeer({
      effectId: r.effectId,
      fromClientId: clientId,
      data: { rewardId: r.id },
    });
    setSentToast({
      id: Date.now(),
      text: `${r.emoji} ${r.name} sent!`,
    });
    setTimeout(() => setSentToast(null), 1800);
  }

  return (
    <GlassPanel className="p-5 relative">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-lg text-swoono-ink">Trophy Shop</h2>
        <span className="text-swoono-dim text-[10px] uppercase tracking-widest">
          {points} pts
        </span>
      </div>

      <AnimatePresence>
        {sentToast && (
          <motion.div
            key={sentToast.id}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-swoono-accent/25 border border-swoono-accent/50 text-swoono-ink text-xs uppercase tracking-widest px-3 py-1.5 rounded-full shadow-glow"
          >
            {sentToast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-1">
        {(Object.keys(KIND_META) as RewardKind[]).map((kind) => {
          const rewards = getRewardsByKind(kind);
          if (rewards.length === 0) return null;
          const meta = KIND_META[kind];
          return (
            <div key={kind}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-1.5 h-3 rounded-sm"
                  style={{ background: meta.accent }}
                />
                <span className="text-[10px] uppercase tracking-widest text-swoono-dim">
                  {meta.label} {meta.hint}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {rewards.map((r) => {
                  const canAfford = points >= r.cost;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => redeem(r)}
                      disabled={!canAfford}
                      title={r.description}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 border text-left transition-all ${
                        canAfford
                          ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-swoono-accent/40"
                          : "bg-white/[0.02] border-white/5 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <span className="text-xl leading-none">{r.emoji}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[11px] text-swoono-ink leading-tight truncate">
                          {r.name}
                        </span>
                        <span className="block text-[10px] text-swoono-accent/90 font-mono">
                          {r.cost} pts
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
