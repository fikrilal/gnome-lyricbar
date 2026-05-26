# LyricBar v0.1.6

Patch release focused on browser-player correctness.

## Fixed

- Browser players now keep the latest same-track playback status during metadata debounce.
- This prevents paused Spotify Desktop snapshots from stealing selection while Chrome or another browser player is actively playing.

## Verification

- `npm run verify`
- Live desktop check with YouTube Music/Chrome playing and Spotify Desktop paused.
