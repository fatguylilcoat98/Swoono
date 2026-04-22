import { useEffect, useRef, useState } from "react";
import { useMusicStore } from "../../state/musicStore";
import { useThemeStore } from "../../state/themeStore";
import {
  SYNTH_PRESETS,
  startSynthMusic,
  type SynthHandle,
} from "../../lib/music/synthMusic";
import { getPlaylist } from "../../lib/music/musicTracks";

// MusicPlayer owns a single AudioContext for the lifetime of the room
// session. Key hardening vs the prior version:
//
//  - AudioContext is created AND resumed SYNCHRONOUSLY inside the click
//    handler, not from a state-triggered useEffect. iOS Safari and
//    some Android browsers require the AudioContext to be touched
//    directly in a user-gesture callback, otherwise resume() silently
//    fails and no audio comes out. The prior version put resume() in
//    an effect and fell afoul of this rule.
//
//  - Supports two modes:
//      * URL playlist mode — loads /music.json on mount; if it has
//        tracks, the player uses an HTML5 Audio element and renders
//        next/prev buttons
//      * Synth mode — if no playlist or it fails to load, falls back
//        to the in-browser synth ambient generator. Next/Prev cycle
//        through the 3 moods (Romantic / Energetic / Ambient).
//
//  - Synth attack time dropped from 1.5s → 0.3s so the user hears
//    sound immediately after hitting play. Gains also bumped ~60%.

export default function MusicPlayer() {
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const volume = useMusicStore((s) => s.volume);
  const preset = useMusicStore((s) => s.preset);
  const source = useMusicStore((s) => s.source);
  const playlist = useMusicStore((s) => s.playlist);
  const trackIdx = useMusicStore((s) => s.trackIdx);

  const unlock = useMusicStore((s) => s.unlock);
  const play = useMusicStore((s) => s.play);
  const pause = useMusicStore((s) => s.pause);
  const setVolume = useMusicStore((s) => s.setVolume);
  const setPreset = useMusicStore((s) => s.setPreset);
  const setPlaylist = useMusicStore((s) => s.setPlaylist);
  const nextTrack = useMusicStore((s) => s.nextTrack);
  const prevTrack = useMusicStore((s) => s.prevTrack);

  const theme = useThemeStore((s) => s.theme);
  const themeClass = theme.className;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const synthHandleRef = useRef<SynthHandle | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [spotifyDialogOpen, setSpotifyDialogOpen] = useState(false);
  const [playerError, setPlayerError] = useState("");

  // Load theme-based playlist from musicTracks.ts on mount and theme change.
  // If empty, stay in synth mode — that's the fallback.
  useEffect(() => {
    const themeMode = themeClass.includes("guy") ? "guy" :
                     themeClass.includes("girl") ? "girl" : "neutral";
    const playlist = getPlaylist(themeMode);
    setPlaylist(playlist);
  }, [themeClass, setPlaylist]);

  // Pick a synth preset based on the current theme mode — only on mount
  // or when theme changes. Don't override user's explicit mood pick.
  const userPickedPresetRef = useRef(false);
  useEffect(() => {
    if (userPickedPresetRef.current) return;
    let nextPreset = SYNTH_PRESETS.ambient;
    if (themeClass.includes("guy")) nextPreset = SYNTH_PRESETS.energetic;
    else if (themeClass.includes("girl")) nextPreset = SYNTH_PRESETS.romantic;
    if (nextPreset.id !== preset.id) setPreset(nextPreset);
  }, [themeClass, preset.id, setPreset]);

  // Synth engine lifecycle
  useEffect(() => {
    if (source !== "synth") {
      if (synthHandleRef.current) {
        synthHandleRef.current.stop();
        synthHandleRef.current = null;
      }
      return;
    }
    if (!isPlaying) {
      if (synthHandleRef.current) {
        synthHandleRef.current.stop();
        synthHandleRef.current = null;
      }
      return;
    }
    if (!audioCtxRef.current) return; // created in handleToggle
    if (synthHandleRef.current) return; // already running
    synthHandleRef.current = startSynthMusic(
      audioCtxRef.current,
      preset,
      volume,
    );
  }, [isPlaying, source, preset, volume]);

  // Restart the synth when preset changes while playing
  useEffect(() => {
    if (source !== "synth" || !isPlaying) return;
    if (!synthHandleRef.current || !audioCtxRef.current) return;
    if (synthHandleRef.current.getPreset().id === preset.id) return;
    synthHandleRef.current.stop();
    synthHandleRef.current = startSynthMusic(
      audioCtxRef.current,
      preset,
      volume,
    );
  }, [preset, isPlaying, source, volume]);

  // Propagate volume to a live synth
  useEffect(() => {
    if (synthHandleRef.current) {
      synthHandleRef.current.setVolume(volume);
    }
    if (audioElRef.current) {
      audioElRef.current.volume = volume;
    }
  }, [volume]);

  // URL player lifecycle
  useEffect(() => {
    if (source !== "url") {
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
      return;
    }
    const el = audioElRef.current;
    if (!el) return;
    const track = playlist[trackIdx];
    if (!track) return;
    // Only change src if it's different — avoids an unnecessary reload
    // on every state change.
    if (!el.src.endsWith(track.url) && el.src !== track.url) {
      el.src = track.url;
      el.load();
    }
    el.volume = volume;
    if (isPlaying) {
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch((err) => {
          setPlayerError(
            `Track "${track.title}" failed to play (${err.name}). ` +
              `Check the URL in musicTracks.ts — falling back to synth.`,
          );
          // Fall back to synth so there's at least SOMETHING audible
          setPlaylist([]);
        });
      }
    } else {
      el.pause();
    }
  }, [source, trackIdx, isPlaying, volume, playlist, setPlaylist]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (synthHandleRef.current) {
        synthHandleRef.current.stop();
        synthHandleRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current.src = "";
      }
    };
  }, []);

  // Advance to next track when current track ends
  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    const onEnded = () => {
      if (playlist.length > 1) {
        nextTrack();
      } else {
        pause();
      }
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [playlist.length, nextTrack, pause]);

  // The critical fix: create + resume AudioContext IN the click handler,
  // synchronous to the user gesture. This is what lets iOS/Android
  // browsers actually produce sound.
  const handleToggle = async () => {
    setPlayerError("");
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) {
        audioCtxRef.current = new Ctor();
      }
    }
    // Resume inside the gesture — no awaiting state
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      try {
        await audioCtxRef.current.resume();
      } catch {
        /* best effort */
      }
    }
    unlock();
    if (isPlaying) {
      pause();
    } else {
      play();
      // Kick the URL audio element directly in the same gesture so
      // iOS Safari accepts the play() call.
      if (source === "url" && audioElRef.current) {
        const p = audioElRef.current.play();
        if (p && typeof p.catch === "function") {
          p.catch((err) => {
            setPlayerError(`Play blocked by browser (${err.name})`);
          });
        }
      }
    }
  };

  const currentTrack =
    source === "url" && playlist.length > 0 ? playlist[trackIdx] : null;
  const trackLabel = currentTrack
    ? `${trackIdx + 1}/${playlist.length} · ${currentTrack.title}`
    : `♪ ${preset.name}`;

  return (
    <div className="relative flex items-center gap-2">
      {/* Hidden HTML5 audio element — driven by the url-mode effect */}
      <audio ref={audioElRef} preload="metadata" crossOrigin="anonymous" />

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
        onClick={() => {
          userPickedPresetRef.current = true;
          nextTrack();
        }}
        className="flex items-center justify-center w-7 h-7 rounded-full border border-white/10 hover:border-swoono-accent/40 hover:bg-swoono-accent/10 transition-colors"
        title={source === "url" ? "Next track" : "Next mood"}
        aria-label="Next"
      >
        <span className="text-swoono-accent text-[10px]">▶▶</span>
      </button>

      <button
        onClick={() => setShowDetails((v) => !v)}
        className="text-[10px] uppercase tracking-widest text-swoono-dim hover:text-swoono-accent transition-colors truncate max-w-[140px]"
        title="Music options"
      >
        {trackLabel}
      </button>

      {showDetails && (
        <div
          className="absolute top-full right-0 mt-2 min-w-[260px] p-4 rounded-lg bg-black/90 border border-white/10 backdrop-blur-lg z-[200]"
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

          {playerError && (
            <p className="text-[10px] text-red-400 mb-3 leading-snug">
              {playerError}
            </p>
          )}

          <label className="block text-[10px] uppercase tracking-widest text-swoono-dim mb-1">
            Mode
          </label>
          <div className="text-[11px] text-swoono-ink mb-3">
            {source === "url"
              ? `Playlist (${playlist.length} tracks)`
              : "Live synth ambient"}
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

          {source === "url" && playlist.length > 0 ? (
            <div className="mb-4">
              <label className="block text-[10px] uppercase tracking-widest text-swoono-dim mb-1">
                Now playing
              </label>
              <div className="text-[11px] text-swoono-ink">
                {currentTrack?.title}
                {currentTrack?.artist && (
                  <span className="text-swoono-dim"> — {currentTrack.artist}</span>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={prevTrack}
                  className="flex-1 text-[10px] uppercase tracking-widest py-2 rounded border border-white/10 text-swoono-ink hover:border-white/30"
                >
                  ◀◀ Prev
                </button>
                <button
                  onClick={nextTrack}
                  className="flex-1 text-[10px] uppercase tracking-widest py-2 rounded border border-white/10 text-swoono-ink hover:border-white/30"
                >
                  Next ▶▶
                </button>
              </div>
              {currentTrack?.attribution && (
                <p className="text-[9px] text-swoono-dim/70 mt-2">
                  {currentTrack.attribution}
                </p>
              )}
            </div>
          ) : (
            <>
              <label className="block text-[10px] uppercase tracking-widest text-swoono-dim mb-1">
                Mood
              </label>
              <div className="grid grid-cols-3 gap-1 mb-4">
                {Object.values(SYNTH_PRESETS).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      userPickedPresetRef.current = true;
                      setPreset(p);
                    }}
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
              <p className="text-[9px] text-swoono-dim/60 mb-3 leading-snug">
                Swoono Originals playing by theme.{" "}
                Next button cycles moods in synth mode.
              </p>
            </>
          )}

          <button
            onClick={() => setSpotifyDialogOpen(true)}
            className="w-full text-[10px] uppercase tracking-widest py-2 rounded border border-white/10 text-swoono-dim hover:border-white/30 transition-colors"
          >
            🎧 Connect Spotify
          </button>
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
