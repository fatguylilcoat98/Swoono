import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import GlassPanel from "../ui/GlassPanel";
import { usePointsStore } from "../../state/pointsStore";
import { sendEffectToPeer } from "../../lib/registries/effectRegistry";
import { useRoomStore } from "../../state/roomStore";

type RewardTier = "sweet" | "savage" | "legendary" | "milestone";

type RewardItem = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  effectId: string;
  description: string;
};

const TIER_META: Record<
  RewardTier,
  { label: string; icon: string; accent: string; description: string }
> = {
  sweet: {
    label: "SWEET",
    icon: "💝",
    accent: "rgb(255 105 180)",
    description: "Loving gestures"
  },
  savage: {
    label: "SAVAGE",
    icon: "😈",
    accent: "rgb(255 70 70)",
    description: "Playful attacks"
  },
  legendary: {
    label: "LEGENDARY",
    icon: "👑",
    accent: "rgb(255 215 0)",
    description: "Epic celebrations"
  },
  milestone: {
    label: "MILESTONE",
    icon: "💍",
    accent: "rgb(218 165 32)",
    description: "Relationship moments"
  },
};

const REWARDS: Record<RewardTier, RewardItem[]> = {
  sweet: [
    { id: "floating_hearts", name: "Send Hearts", emoji: "❤️", cost: 50, effectId: "floating_hearts", description: "Floating hearts rise up" },
    { id: "kiss", name: "Blow a Kiss", emoji: "💋", cost: 60, effectId: "effect.kiss", description: "Sparkly kiss across screen" },
    { id: "rose_shower", name: "Rose Shower", emoji: "🌹", cost: 75, effectId: "rose_shower", description: "Red rose petals rain down" },
    { id: "hug", name: "Warm Hug", emoji: "🤗", cost: 80, effectId: "effect.hug", description: "Send a warm embrace" },
    { id: "hearts", name: "Love Letter", emoji: "💌", cost: 100, effectId: "effect.hearts", description: "Flurry of floating hearts" },
  ],
  savage: [
    { id: "pie_splat", name: "Pie in the Face", emoji: "🥧", cost: 200, effectId: "effect.pie", description: "Splat! No takebacks" },
    { id: "ghost_mode", name: "Ghost Mode", emoji: "👻", cost: 225, effectId: "ghost_mode", description: "Spooky screen takeover" },
    { id: "roast_card", name: "Roast Card", emoji: "🔥", cost: 250, effectId: "roast_card", description: "Random savage roast" },
    { id: "prank_alarm", name: "Prank Alarm", emoji: "🚨", cost: 275, effectId: "prank_alarm", description: "Red alert chaos" },
    { id: "slap", name: "Slap", emoji: "👋", cost: 300, effectId: "effect.slap", description: "Cartoon smack attack" },
  ],
  legendary: [
    { id: "confetti_cannon", name: "Confetti Cannon", emoji: "🎊", cost: 500, effectId: "confetti_cannon", description: "500+ pieces explode outward" },
    { id: "fireworks", name: "Fireworks Show", emoji: "🎆", cost: 600, effectId: "effect.fireworks", description: "10 rockets with sound" },
    { id: "love_bomb", name: "Love Bomb", emoji: "💕", cost: 750, effectId: "love_bomb", description: "Hearts + stars + shockwaves" },
  ],
  milestone: [
    { id: "i_love_you", name: "I Love You", emoji: "❤️", cost: 800, effectId: "i_love_you", description: "Letter-by-letter reveal" },
    { id: "meet_up", name: "Let's Meet Up", emoji: "✈️", cost: 1000, effectId: "meet_up", description: "Airplane with heart trail" },
    { id: "anniversary", name: "Happy Anniversary", emoji: "🎂", cost: 1500, effectId: "anniversary", description: "Gold confetti + slideshow" },
    { id: "proposal", name: "Will You Be Mine?", emoji: "💍", cost: 2000, effectId: "proposal", description: "8-phase cinematic proposal" },
  ],
};

export default function RewardsPanel() {
  const points = usePointsStore((s) => s.points);
  const spend = usePointsStore((s) => s.spend);
  const clientId = useRoomStore((s) => s.clientId);
  const peers = useRoomStore((s) => s.peers);
  const hasPartner = peers.some((p) => p.clientId !== clientId);

  const [activeTab, setActiveTab] = useState<RewardTier>("sweet");
  const [sentToast, setSentToast] = useState<{
    id: number;
    text: string;
  } | null>(null);

  function redeem(reward: RewardItem) {
    if (!hasPartner) {
      setSentToast({ id: Date.now(), text: "Waiting for your partner…" });
      setTimeout(() => setSentToast(null), 1800);
      return;
    }
    const ok = spend(reward.cost, `Redeemed ${reward.name}`);
    if (!ok) return;
    sendEffectToPeer({
      effectId: reward.effectId,
      fromClientId: clientId,
      data: { rewardId: reward.id },
    });
    setSentToast({
      id: Date.now(),
      text: `${reward.emoji} ${reward.name} sent!`,
    });
    setTimeout(() => setSentToast(null), 1800);
  }

  const canAfford = (cost: number) => points >= cost;
  const pointsNeeded = (cost: number) => Math.max(0, cost - points);

  return (
    <GlassPanel className={`p-5 relative ${activeTab === 'milestone' ? 'border-2 border-yellow-400' : ''}`}>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-lg text-swoono-ink">Reward Shop</h2>
        <span
          className="text-2xl font-bold font-mono"
          style={{ color: TIER_META[activeTab].accent }}
        >
          {points.toLocaleString()} pts
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

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-4">
        {(Object.keys(TIER_META) as RewardTier[]).map((tier) => {
          const meta = TIER_META[tier];
          const isActive = activeTab === tier;
          return (
            <button
              key={tier}
              onClick={() => setActiveTab(tier)}
              className={`flex-1 py-2 px-1 text-xs uppercase tracking-widest font-semibold rounded transition-all ${
                isActive
                  ? 'text-swoono-ink border-2'
                  : 'text-swoono-dim hover:text-swoono-ink border border-white/10 hover:border-white/20'
              }`}
              style={{
                borderColor: isActive ? meta.accent : undefined,
                background: isActive ? `${meta.accent}20` : undefined,
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm">{meta.icon}</span>
                <span style={{ fontSize: '9px' }}>{meta.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Current Tab Description */}
      <div className="text-center mb-4">
        <p
          className="text-xs uppercase tracking-widest"
          style={{ color: TIER_META[activeTab].accent }}
        >
          {TIER_META[activeTab].description}
        </p>
      </div>

      {/* Rewards Grid */}
      <div className="grid grid-cols-1 gap-3 max-h-[420px] overflow-y-auto pr-1">
        {REWARDS[activeTab].map((reward) => {
          const affordable = canAfford(reward.cost);
          const needed = pointsNeeded(reward.cost);

          return (
            <button
              key={reward.id}
              type="button"
              onClick={() => redeem(reward)}
              disabled={!affordable}
              title={reward.description}
              className={`flex items-center gap-3 rounded-xl p-3 border text-left transition-all ${
                affordable
                  ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-swoono-accent/40"
                  : "bg-white/[0.02] border-white/5 opacity-60 cursor-not-allowed"
              }`}
            >
              <span className="text-3xl leading-none">{reward.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-swoono-ink font-semibold truncate">
                    {reward.name}
                  </span>
                  <span
                    className="text-sm font-bold font-mono"
                    style={{ color: affordable ? TIER_META[activeTab].accent : '#666' }}
                  >
                    {reward.cost.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-swoono-dim truncate pr-2">
                    {reward.description}
                  </span>
                  {!affordable && (
                    <span className="text-xs text-red-400 whitespace-nowrap">
                      Need {needed.toLocaleString()} more
                    </span>
                  )}
                  {affordable && (
                    <span
                      className="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded"
                      style={{
                        background: TIER_META[activeTab].accent + '30',
                        color: TIER_META[activeTab].accent
                      }}
                    >
                      SEND
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}