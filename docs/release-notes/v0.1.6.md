# LyricBar v0.1.6

Browser-player and diagnostics release focused on making LyricBar more reliable outside Spotify Desktop.

## Added

- YouTube Music browser player profile.
- Automatic browser service mode so browser playback does not require manual Spotify/YouTube Music selection in common cases.
- Preferences version information.
- Copy diagnostics action for issue reports.
- Open issue action from preferences.
- YouTube Music browser MPRIS fixtures for regression coverage.

## Changed

- Browser service profile mapping is now isolated behind a dedicated profile selection path.
- Browser metadata handling is more conservative when service identity is ambiguous.

## Fixed

- Browser players now keep the latest same-track playback status during metadata debounce.
- Paused Spotify Desktop snapshots no longer steal selection while Chrome or another browser player is actively playing.
- Peer player state is refreshed before selection so stale MPRIS proxy state is less likely to win.
- Low-confidence browser lyric misses are no longer cached, reducing persistent bad lookups from ambiguous browser metadata.
- Browser playback now defaults to automatic service handling instead of assuming Spotify Web.

## Verification

- `npm run verify`
- Live desktop check with YouTube Music/Chrome playing and Spotify Desktop paused.
