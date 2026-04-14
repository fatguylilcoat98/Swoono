import { create } from "zustand";

export type PointEvent = {
  id: string;
  delta: number;
  reason: string;
  at: number;
};

type PointsState = {
  points: number;
  history: PointEvent[];
  award: (delta: number, reason: string) => void;
  spend: (delta: number, reason: string) => boolean;
};

function makeEventId() {
  return Math.random().toString(36).slice(2, 10);
}

export const usePointsStore = create<PointsState>((set, get) => ({
  points: 50, // starter balance so placeholder UI isn't empty
  history: [],
  award: (delta, reason) => {
    const cost = Math.abs(delta);
    const event: PointEvent = {
      id: makeEventId(),
      delta: cost,
      reason,
      at: Date.now(),
    };
    set((s) => ({
      points: s.points + cost,
      history: [...s.history, event],
    }));
  },
  spend: (delta, reason) => {
    const cost = Math.abs(delta);
    if (get().points < cost) return false;
    const event: PointEvent = {
      id: makeEventId(),
      delta: -cost,
      reason,
      at: Date.now(),
    };
    set((s) => ({
      points: s.points - cost,
      history: [...s.history, event],
    }));
    return true;
  },
}));
