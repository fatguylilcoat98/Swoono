import { create } from "zustand";
import { SYNTH_PRESETS, type SynthPreset } from "../lib/music/synthMusic";

export type MusicSource = "synth" | "url" | "spotify";

export type MusicTrack = {
  id: string;
  title: string;
  artist?: string;
  url: string;
  attribution?: string;
};

type MusicState = {
  /** User has interacted at least once so autoplay is unlocked. */
  unlocked: boolean;
  isPlaying: boolean;
  source: MusicSource;
  volume: number;
  preset: SynthPreset;
  /** Playlist of real MP3 tracks (empty = synth-only mode). */
  playlist: MusicTrack[];
  /** Index into playlist */
  trackIdx: number;

  unlock: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (v: number) => void;
  setPreset: (preset: SynthPreset) => void;
  setSource: (source: MusicSource) => void;
  setPlaylist: (tracks: MusicTrack[]) => void;
  nextTrack: () => void;
  prevTrack: () => void;
};

const VOLUME_KEY = "swoono:musicVolume";
const PLAYING_KEY = "swoono:musicPlaying";

function readVolume(): number {
  if (typeof localStorage === "undefined") return 0.7;
  const raw = localStorage.getItem(VOLUME_KEY);
  if (!raw) return 0.7;
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) return 0.7;
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
  playlist: [],
  trackIdx: 0,

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
  setPlaylist: (tracks) => {
    // If a non-empty playlist is loaded, default the source to "url"
    // so the player uses real tracks. Empty → stay on synth.
    set({
      playlist: tracks,
      trackIdx: 0,
      source: tracks.length > 0 ? "url" : "synth",
    });
  },
  nextTrack: () => {
    const { playlist, trackIdx, source, preset } = get();
    if (source === "synth") {
      // In synth mode, cycle through moods.
      const moods = Object.values(SYNTH_PRESETS);
      const currentPresetIdx = moods.findIndex((p) => p.id === preset.id);
      const nextIdx = (currentPresetIdx + 1) % moods.length;
      set({ preset: moods[nextIdx] });
      return;
    }
    if (playlist.length === 0) return;
    set({ trackIdx: (trackIdx + 1) % playlist.length });
  },
  prevTrack: () => {
    const { playlist, trackIdx, source, preset } = get();
    if (source === "synth") {
      const moods = Object.values(SYNTH_PRESETS);
      const currentPresetIdx = moods.findIndex((p) => p.id === preset.id);
      const prevIdx = (currentPresetIdx - 1 + moods.length) % moods.length;
      set({ preset: moods[prevIdx] });
      return;
    }
    if (playlist.length === 0) return;
    set({ trackIdx: (trackIdx - 1 + playlist.length) % playlist.length });
  },
}));
