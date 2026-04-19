/**
 * Music track manifest. One playlist per theme mode.
 *
 * To add tracks: paste direct MP3/OGG URLs into the arrays below. The URL must
 * be CORS-accessible from the browser (most CDNs are). If a track URL 404s or
 * fails CORS, the player skips to the next one and logs a warning.
 *
 * Good free sources (all allow hotlinking last I checked):
 *  - Pixabay Music:     https://pixabay.com/music/     (CC0, no attribution required)
 *  - Free Music Archive: https://freemusicarchive.org/  (CC-licensed, attribution)
 *  - Incompetech:       https://incompetech.com/        (CC-BY, Kevin MacLeod)
 *  - Bensound:          https://www.bensound.com/       (free with attribution)
 *
 * To get a direct URL: on Pixabay, right-click the "Download" button → "Copy
 * link address". That's usually a stable CDN URL.
 *
 * Leave the array empty ([]) to have the player fall back to the synthesized
 * ambient generator for that mode. That's what the player does by default —
 * Chris just hasn't pasted real URLs yet.
 */

export type MusicTrack = {
  id: string;
  title: string;
  artist?: string;
  /** Direct URL to an MP3, OGG, or WAV file. CORS must allow the request. */
  url: string;
  /** Attribution text to show in the UI, if the license requires it. */
  attribution?: string;
};

export type MusicPlaylist = MusicTrack[];

/**
 * Per-theme playlists. `neutral` is the default, `guy` ("Edge") is Chris's
 * mode, `girl` ("Bloom") is his partner's.
 */
export const PLAYLISTS: Record<"neutral" | "guy" | "girl", MusicPlaylist> = {
  neutral: [
    // Example placeholder — replace with real URLs.
    // {
    //   id: "sample-1",
    //   title: "Quiet Hour",
    //   artist: "Example Artist",
    //   url: "https://cdn.pixabay.com/audio/2023/.../quiet-hour.mp3",
    //   attribution: "Music by Example from Pixabay",
    // },
  ],
  guy: [],
  girl: [],
};

/** Returns a playlist, falling back to `neutral` if the mode has no tracks. */
export function getPlaylist(
  mode: "neutral" | "guy" | "girl",
): MusicPlaylist {
  const list = PLAYLISTS[mode];
  if (list.length > 0) return list;
  return PLAYLISTS.neutral;
}
