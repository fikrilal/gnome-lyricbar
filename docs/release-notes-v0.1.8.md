# LyricBar v0.1.8

Apple Music Web reliability release focused on synced lyrics in browser playback.

## Fixed

- Apple Music Web no longer uses browser-reported duration for lyrics lookup, cache confidence, or track identity.
- Apple Music Web synced lyrics no longer get stuck on the first line when Chrome exposes cumulative media-session position.
- Synced lyric position validation now allows long outros after the final lyric line.

## Changed

- Apple Music Web positions can be normalized relative to the first observed raw position for a track.
- Synced lyric polling keeps the current line stable during same-track metadata refreshes.

## Verification

- `npm run verify`
- Live Apple Music Web desktop check on GNOME Shell 46 with Chrome playback.
