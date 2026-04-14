import { create } from "zustand";

/**
 * An active full-screen effect being displayed (or about to display).
 * Kept tiny on purpose — each entry is just an id + effect type + data.
 * The EffectOverlay component dispatches by effectId to the right
 * React component (VictoryBurst, DefeatFlash, future reward animations).
 */
export type ActiveEffect = {
  id: string;
  effectId: string;
  data?: Record<string, unknown>;
};

type EffectsState = {
  active: ActiveEffect[];
  pushEffect: (effectId: string, data?: Record<string, unknown>) => string;
  dismissEffect: (id: string) => void;
  clearAll: () => void;
};

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useEffectsStore = create<EffectsState>((set) => ({
  active: [],
  pushEffect: (effectId, data) => {
    const id = makeId();
    set((s) => ({ active: [...s.active, { id, effectId, data }] }));
    return id;
  },
  dismissEffect: (id) => {
    set((s) => ({ active: s.active.filter((e) => e.id !== id) }));
  },
  clearAll: () => set({ active: [] }),
}));
