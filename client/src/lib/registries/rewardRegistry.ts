export type RewardKind = "love" | "mean" | "funny";

export type RewardDefinition = {
  id: string;
  name: string;
  description: string;
  kind: RewardKind;
  cost: number;
  emoji: string;
  /** Effect id dispatched to effectRegistry when this reward is redeemed. */
  effectId: string;
  tier: number;
};

const _rewards = new Map<string, RewardDefinition>();

const KIND_ORDER: Record<RewardKind, number> = { love: 0, mean: 1, funny: 2 };

export function registerReward(r: RewardDefinition) {
  _rewards.set(r.id, r);
}

export function getRewards(): RewardDefinition[] {
  return Array.from(_rewards.values()).sort((a, b) => {
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return a.cost - b.cost;
  });
}

export function getRewardsByKind(kind: RewardKind): RewardDefinition[] {
  return getRewards().filter((r) => r.kind === kind);
}

export function getReward(id: string): RewardDefinition | undefined {
  return _rewards.get(id);
}

// --- Trophy actions (ported from Chris's Duo app) -------------------------
// Effect handlers are registered in lib/effects/registerGameEffects.ts
// Animation presets live in components/effects/trophy/presets.ts

// Love
registerReward({
  id: "hug",
  name: "Hug",
  description: "Send a warm embrace.",
  kind: "love",
  cost: 5,
  emoji: "🤗",
  effectId: "effect.hug",
  tier: 0,
});
registerReward({
  id: "kiss",
  name: "Kiss",
  description: "Blow a sparkly kiss across the screen.",
  kind: "love",
  cost: 5,
  emoji: "😘",
  effectId: "effect.kiss",
  tier: 0,
});
registerReward({
  id: "hearts",
  name: "Send Hearts",
  description: "A flurry of floating hearts.",
  kind: "love",
  cost: 3,
  emoji: "💕",
  effectId: "effect.hearts",
  tier: 0,
});
registerReward({
  id: "flowers",
  name: "Send Flowers",
  description: "A bouquet rises across their screen.",
  kind: "love",
  cost: 8,
  emoji: "💐",
  effectId: "effect.flowers",
  tier: 0,
});

// Mean (playful, not actually mean)
registerReward({
  id: "slap",
  name: "Slap",
  description: "A cartoon smack. Not to be used in anger.",
  kind: "mean",
  cost: 10,
  emoji: "👋",
  effectId: "effect.slap",
  tier: 0,
});
registerReward({
  id: "punch",
  name: "Punch",
  description: "A cartoonish impact burst.",
  kind: "mean",
  cost: 15,
  emoji: "👊",
  effectId: "effect.punch",
  tier: 0,
});
registerReward({
  id: "kick",
  name: "Kick",
  description: "A swift boot to the screen.",
  kind: "mean",
  cost: 12,
  emoji: "🦵",
  effectId: "effect.kick",
  tier: 0,
});

// Funny
registerReward({
  id: "pie",
  name: "Throw Pie",
  description: "Splat. No takebacks.",
  kind: "funny",
  cost: 8,
  emoji: "🥧",
  effectId: "effect.pie",
  tier: 0,
});
registerReward({
  id: "banana",
  name: "Banana Peel",
  description: "A banana slides across the screen.",
  kind: "funny",
  cost: 6,
  emoji: "🍌",
  effectId: "effect.banana",
  tier: 0,
});
registerReward({
  id: "confetti",
  name: "Confetti Blast",
  description: "A delighted blast of confetti.",
  kind: "funny",
  cost: 10,
  emoji: "🎉",
  effectId: "effect.confetti",
  tier: 0,
});
registerReward({
  id: "tickle",
  name: "Tickle",
  description: "Surprise giggle attack.",
  kind: "funny",
  cost: 7,
  emoji: "🤭",
  effectId: "effect.tickle",
  tier: 0,
});
