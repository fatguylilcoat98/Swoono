export type RewardKind = "love" | "fun" | "utility";

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

export function registerReward(r: RewardDefinition) {
  _rewards.set(r.id, r);
}

export function getRewards(): RewardDefinition[] {
  return Array.from(_rewards.values()).sort((a, b) => a.cost - b.cost);
}

export function getRewardsByKind(kind: RewardKind): RewardDefinition[] {
  return getRewards().filter((r) => r.kind === kind);
}

export function getReward(id: string): RewardDefinition | undefined {
  return _rewards.get(id);
}

// --- Seeded placeholder rewards -------------------------------------------
// Drop existing animations in by implementing an EffectHandler for each
// effectId below inside effectRegistry.ts.

registerReward({
  id: "kiss",
  name: "Kiss",
  description: "Send a blown kiss across the screen.",
  kind: "love",
  cost: 10,
  emoji: "💋",
  effectId: "effect.kiss",
  tier: 0,
});

registerReward({
  id: "heart-burst",
  name: "Heart Burst",
  description: "Fireworks of hearts from their side of the screen.",
  kind: "love",
  cost: 20,
  emoji: "💖",
  effectId: "effect.heart-burst",
  tier: 0,
});

registerReward({
  id: "flowers",
  name: "Flowers",
  description: "A bouquet blooms across their screen.",
  kind: "love",
  cost: 25,
  emoji: "💐",
  effectId: "effect.flowers",
  tier: 0,
});

registerReward({
  id: "pie-splatter",
  name: "Pie Splatter",
  description: "A pie hits the camera. No takebacks.",
  kind: "fun",
  cost: 15,
  emoji: "🥧",
  effectId: "effect.pie-splatter",
  tier: 0,
});

registerReward({
  id: "confetti-bomb",
  name: "Confetti Bomb",
  description: "A delighted blast of confetti.",
  kind: "fun",
  cost: 12,
  emoji: "🎉",
  effectId: "effect.confetti",
  tier: 0,
});

registerReward({
  id: "screen-takeover",
  name: "Screen Takeover",
  description: "Take over their screen for 5 seconds with a playful effect.",
  kind: "fun",
  cost: 40,
  emoji: "🎭",
  effectId: "effect.takeover",
  tier: 1,
});
