# Music playlists

The MusicPlayer renders from two sources, in order:

1. **Real tracks** listed in `musicTracks.ts` under the current theme mode.
2. **Synth ambient** (generated live by `synthMusic.ts`) as fallback.

If a mode's playlist is empty the synth kicks in automatically, so
music plays immediately with zero setup. Real tracks take over as
soon as any are listed.

## Adding your own tracks (2-minute setup)

### Step 1. Find free tracks

All three sources below allow hotlinking with a permissive license:

| Source | License | URL pattern |
|---|---|---|
| [Pixabay Music](https://pixabay.com/music/) | Pixabay Content License (no attribution required) | `https://cdn.pixabay.com/audio/...` |
| [Free Music Archive](https://freemusicarchive.org/) | Creative Commons (attribution required) | `https://freemusicarchive.org/file/music/...` |
| [Incompetech](https://incompetech.com/music/royalty-free/) | CC BY 4.0 (attribution required) | `https://incompetech.com/music/royalty-free/mp3-royaltyfree/...` |

### Step 2. Get the direct MP3 URL

- **On Pixabay:** hover over a track → right-click the orange
  **Download** button → **Copy link address**. That gives you a
  stable `cdn.pixabay.com` URL you can paste below.
- **On Free Music Archive:** the download button is a direct link.
- **On Incompetech:** track URLs are predictable from the track page.

### Step 3. Paste into `musicTracks.ts`

Find the `PLAYLISTS` constant and add tracks under whichever mode
you want them to play on:

```ts
export const PLAYLISTS: Record<"neutral" | "guy" | "girl", MusicPlaylist> = {
  neutral: [
    {
      id: "quiet-hour",
      title: "Quiet Hour",
      artist: "Example Artist",
      url: "https://cdn.pixabay.com/audio/2024/01/01/audio_123456.mp3",
      attribution: "Music by Example Artist from Pixabay",
    },
    // add more...
  ],
  guy: [
    // Edge mode — faster, more energetic
  ],
  girl: [
    // Bloom mode — softer, more romantic
  ],
};
```

### Step 4. (If needed) extend the MusicPlayer

The current player auto-uses the synth because `PLAYLISTS` is
empty. Once you populate a list, you'll want to teach
`MusicPlayer.tsx` to fetch the list, cycle through the tracks,
and render them via an `<audio>` element instead of (or alongside)
the synth. That wiring is intentionally left out until real URLs
exist to test against — see the existing `synth` source branch in
`MusicPlayer.tsx` as the reference for how to add a `url` source
branch.

## Licenses

Each track carries an `attribution` field. For tracks licensed
under CC BY (Incompetech) and FMA-CC-BY, the attribution string is
displayed in the Music panel's popover so users can see who made
the music. Pixabay tracks can have `attribution` set to `""` —
Pixabay's license does not require attribution, but leaving the
name in is a kindness.

## No copyrighted streams

Do NOT paste Spotify URLs, YouTube URLs, Apple Music URLs, or any
other streaming platform URL into `musicTracks.ts`. Those services
do not allow direct audio hotlinking and their terms of service
prohibit it. Real Spotify integration is a separate project — see
the Connect Spotify button in the Music panel for the setup path.
