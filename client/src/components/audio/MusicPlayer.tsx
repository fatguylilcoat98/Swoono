import { useEffect, useRef, useState } from "react";
import { useMusicStore } from "../../state/musicStore";
import { useThemeStore } from "../../state/themeStore";
import {
  SYNTH_PRESETS,
  startSynthMusic,
  type SynthHandle,
} from "../../lib/music/synthMusic";

// MusicPlayer owns a single AudioContext for the lifetime of the room session.
// It drives the synth ambient generator from the Zustand store and reacts to
// theme mode changes by swapping the synth preset.

export default function MusicPlayer() {
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const volume = useMusicStore((s) => s.volume);
  const preset = useMusicStore((s) => s.preset);
  const source = useMusicStore((s) => s.source);
  const unlocked = useMusicStore((s) => s.unlocked);

  const unlock = useMusicStore((s) => s.unlock);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const setVolume = useMusicStore((s) => s.setVolume);
  const setPreset = useMusicStore((s) => s.setPreset);

  const theme = useThemeStore((s) => s.theme);
  const themeClass = theme.className;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const synthHandleRef = useRef<SynthHandle | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [spotifyDialogOpen, setSpotifyDialogOpen] = useState(false);

  // Pick a synth preset based on the current theme mode.
  useEffect(() => {
    let nextPreset = SYNTH_PRESETS.romantic;
    if (themeClass.includes("guy")) nextPreset = SYNTH_PRESETS.energetic;
    else if (themeClass.includes("girl")) nextPreset = SYNTH_PRESETS.romantic;
    else nextPreset = SYNTH_PRESETS.ambient;
    if (nextPreset.id !== preset.id) setPreset(nextPreset);
  }, [themeClass, preset.id, setPreset]);

  // Drive the synth engine from play/pause state.
  useEffect(() => {
    if (source !== "synth") {
      // Other sources not wired yet — ensure synth is stopped.
      if (synthHandleRef.current) {
        synthHandleRef.current.stop();
        synthHandleRef.current = null;
      }
      return;
    }

    if (isPlaying && unlocked) {
      // Start the synth if not already running.
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return;
        audioCtxRef.current = new Ctor();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      if (!synthHandleRef.current) {
        synthHandleRef.current = startSynthMusic(
          audioCtxRef.current,
          preset,
          volume,
        );
      }
    } else {
      // Stop.
      if (synthHandleRef.current) {
        synthHandleRef.current.stop();
        synthHandleRef.current = null;
      }
    }
  }, [isPlaying, unlocked, source, preset, volume]);

  // When preset changes while playing, restart the synth with the new preset.
  useEffect(() => {
    if (
      isPlaying &&
      unlocked &&
      source === "synth" &&
      synthHandleRef.current &&
      synthHandleRef.current.getPreset().id !== preset.id &&
      audioCtxRef.current
    ) {
      synthHandleRef.current.stop();
      synthHandleRef.current = startSynthMusic(
        audioCtxRef.current,
        preset,
        volume,
      );
    }
  }, [preset, isPlaying, unlocked, source, volume]);

  // Propagate volume changes to a live synth.
  useEffect(() => {
    if (synthHandleRef.current) {
      synthHandleRef.current.setVolume(volume);
    }
  }, [volume]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (synthHandleRef.current) {
        synthHandleRef.current.stop();
        synthHandleRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const handleToggle = () => {
    if (!unlocked) unlock();
    togglePlay();
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={handleToggle}
        className="flex items-center justify-center w-8 h-8 rounded-full border border-white/10 hover:border-swoono-accent/40 hover:bg-swoono-accent/10 transition-colors"
        title={isPlaying ? "Pause music" : "Play music"}
        aria-label={isPlaying ? "Pause music" : "Play music"}
      >
        {isPlaying ? (
          <span className="text-swoono-accent text-xs">❚❚</span>
        ) : (
          <span className="text-swoono-accent text-xs">▶</span>
        )}
      </button>

      <button
        onClick={() => setShowDetails((v) => !v)}
        className="text-[10px] uppercase tracking-widest text-swoono-dim hover:text-swoono-accent transition-colors"
        title="Music options"
      >
        ♪ {preset.name}
      </button>

      {showDetails && (
        <div
          className="absolute top-full right-0 mt-2 min-w-[240px] p-4 rounded-lg bg-black/90 border border-white/10 backdrop-blur-lg z-50"
          style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-swoono-ink">
              Music
            </span>
            <button
              onClick={() => setShowDetails(false)}
              className="text-swoono-dim text-xs hover:text-swoono-accent"
            >
              ✕
            </button>
          </div>

          <label className="block text-[10px] uppercase tracking-widest text-swoono-dim mb-1">
            Volume
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full mb-4 accent-swoono-accent"
          />

          <label className="block text-[10px] uppercase tracking-widest text-swoono-dim mb-1">
            Mood
          </label>
          <div className="grid grid-cols-3 gap-1 mb-4">
            {Object.values(SYNTH_PRESETS).map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p)}
                className={`text-[10px] uppercase tracking-wider py-2 rounded border transition-colors ${
                  p.id === preset.id
                    ? "border-swoono-accent bg-swoono-accent/20 text-swoono-accent"
                    : "border-white/10 text-swoono-dim hover:border-white/30"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSpotifyDialogOpen(true)}
            className="w-full text-[10px] uppercase tracking-widest py-2 rounded border border-white/10 text-swoono-dim hover:border-white/30 transition-colors"
          >
            🎧 Connect Spotify
          </button>

          <p className="text-[9px] text-swoono-dim/60 mt-3 leading-snug">
            Free ambient music generated live. Spotify integration coming soon.
          </p>
        </div>
      )}

      {spotifyDialogOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          onClick={() => setSpotifyDialogOpen(false)}
        >
          <div
            className="max-w-md w-full bg-swoono-panel border border-white/15 rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-swoono-ink mb-3">
              Spotify Setup
            </h3>
            <p className="text-sm text-swoono-dim mb-4 leading-relaxed">
              Spotify playback needs a developer app Client ID and a Spotify
              Premium account. One-time setup:
            </p>
            <ol className="text-xs text-swoono-dim space-y-2 mb-4 list-decimal list-inside">
              <li>
                Go to{" "}
                <span className="text-swoono-accent">
                  developer.spotify.com/dashboard
                </span>{" "}
                and create a new app.
              </li>
              <li>
                Set the redirect URI to your Swoono URL (e.g.{" "}
                <span className="font-mono text-swoono-ink/80">
                  https://your-app.onrender.com/spotify-callback
                </span>
                ).
              </li>
              <li>
                Copy the Client ID into your Render env vars as{" "}
                <span className="font-mono text-swoono-accent">
                  VITE_SPOTIFY_CLIENT_ID
                </span>
                .
              </li>
              <li>Redeploy. The Connect button will go live.</li>
            </ol>
            <button
              onClick={() => setSpotifyDialogOpen(false)}
              className="w-full py-2 bg-swoono-accent text-black font-semibold uppercase tracking-widest text-xs rounded"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
