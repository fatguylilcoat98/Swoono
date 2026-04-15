import { create } from "zustand";
import { SYNTH_PRESETS, type SynthPreset } from "../lib/music/synthMusic";

export type MusicSource = "synth" | "url" | "spotify";

type MusicState = {
  /** User has interacted at least once so autoplay is unlocked. */
  unlocked: boolean;
  isPlaying: boolean;
  source: MusicSource;
  volume: number;
  preset: SynthPreset;

  unlock: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (v: number) => void;
  setPreset: (preset: SynthPreset) => void;
  setSource: (source: MusicSource) => void;
};

const VOLUME_KEY = "swoono:musicVolume";
const PLAYING_KEY = "swoono:musicPlaying";

function readVolume(): number {
  if (typeof localStorage === "undefined") return 0.45;
  const raw = localStorage.getItem(VOLUME_KEY);
  if (!raw) return 0.45;
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) return 0.45;
  return Math.max(0, Math.min(1, parsed));
}

function readPlaying(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(PLAYING_KEY) === "true";
}

export const useMusicStore = create<MusicState>((set, get) => ({
  unlocked: false,
  isPlaying: readPlaying(),
  source: "synth",
  volume: readVolume(),
  preset: SYNTH_PRESETS.romantic,

  unlock: () => set({ unlocked: true }),
  play: () => {
    localStorage.setItem(PLAYING_KEY, "true");
    set({ isPlaying: true });
  },
  pause: () => {
    localStorage.setItem(PLAYING_KEY, "false");
    set({ isPlaying: false });
  },
  togglePlay: () => {
    const { isPlaying, play, pause } = get();
    if (isPlaying) pause();
    else play();
  },
  setVolume: (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    localStorage.setItem(VOLUME_KEY, String(clamped));
    set({ volume: clamped });
  },
  setPreset: (preset) => set({ preset }),
  setSource: (source) => set({ source }),
}));
