# Compatibility Matrix

LyricBar supports music clients through MPRIS, the Linux desktop media-player interface. It does not scrape browser pages, inspect tabs, or use private player APIs.

Compatibility depends on whether the player exposes useful MPRIS metadata: title, artist, album, playback status, duration, and position. Browser-based players can behave differently across Chromium, Chrome, Firefox, Brave, Vivaldi, and other browser builds.

## Status Labels

- **Supported**: tested end to end and expected to work for normal use.
- **Smoke tested**: verified for basic rendering, but not enough coverage to claim broad support.
- **Needs test**: expected to be possible through MPRIS, but not yet verified.
- **Unsupported**: known not to expose enough usable MPRIS data or outside current scope.

## Desktop Environments

| Environment           | GNOME Shell | Status    | Evidence                                                                                                      |
| --------------------- | ----------: | --------- | ------------------------------------------------------------------------------------------------------------- |
| Ubuntu GNOME          |          46 | Supported | Daily development machine and live Spotify/Desktop browser testing.                                           |
| GNOME Shell           |          47 | Supported | Metadata-compatible; needs broader distro confirmation.                                                       |
| GNOME Shell           |          48 | Supported | Metadata-compatible; needs broader distro confirmation.                                                       |
| GNOME Shell           |          49 | Supported | Metadata-compatible; needs broader distro confirmation.                                                       |
| Fedora 44 Workstation |        50.0 | Supported | Fedora VM smoke test: extension loaded, preferences opened, YouTube Music Web rendered lyrics in the top bar. |
| GNOME Shell           |        50.1 | Supported | Metadata-compatible with 50; needs explicit user confirmation from Fedora 44 / GNOME 50.1.                    |

## Music Clients

| Client                         | Runtime                 | Status       | Notes                                                                                                                                                                                                                                                                 |
| ------------------------------ | ----------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spotify Desktop                | Native app              | Supported    | Primary development target. Uses Spotify's native MPRIS service.                                                                                                                                                                                                      |
| Spotify Web                    | Chromium-family browser | Supported    | Tested with browser MPRIS. Includes browser-specific position handling.                                                                                                                                                                                               |
| Spotify Web                    | Firefox                 | Needs test   | Expected through Firefox MPRIS, but not yet systematically verified.                                                                                                                                                                                                  |
| YouTube Music Web              | Chromium-family browser | Supported    | Tested with browser MPRIS and explicit YouTube Music browser profile behavior.                                                                                                                                                                                        |
| YouTube Music Web              | Firefox                 | Supported    | Firefox can expose `Position=0` during active playback. A Firefox-specific low-confidence position hold plus estimated advance now covers this case. Live-verified on GNOME Shell 46 (v0.1.10) with logs showing `sync-position-held-low-confidence`, `sync-position-estimated`, and advancing lyric lines while Firefox reported `Position=0`. |
| Apple Music Web                | Chromium-family browser | Supported    | Tested with browser MPRIS, including unreliable duration and position offset handling.                                                                                                                                                                                |
| Apple Music Web                | Firefox                 | Needs test   | Expected through Firefox MPRIS if metadata and position are exposed correctly.                                                                                                                                                                                        |
| Other MPRIS-compatible players | Native app or browser   | Needs test   | May work when title, artist, duration, position, and playback status are exposed consistently.                                                                                                                                                                        |

## Browser Compatibility Notes

Browser support is not a single implementation target. Each browser can expose a different MPRIS service name and metadata shape.

Known browser variables:

- MPRIS bus name, for example `org.mpris.MediaPlayer2.chromium.instance...` or browser-specific equivalents.
- Track identity quality, especially title and artist formatting.
- Playback position freshness.
- Duration reliability.
- Whether paused players remain visible and compete with active players.
- Whether the browser exposes one global MPRIS player or one player per tab/session.

LyricBar should prefer architecture-level player profiles over ad hoc player hacks. New browser/client support should capture MPRIS evidence first, then add profile rules only when the evidence shows stable behavior.

## Required Evidence For New Client Support

Before changing support status to **Supported**, capture:

- Distro and version.
- GNOME Shell version from `gnome-shell --version`.
- Browser/app name and version.
- Player URL or app name.
- `npm run inspect:mpris` output while playing.
- `npm run inspect:mpris` output while paused.
- At least one track change.
- At least one seek forward/backward.
- At least one lyric line transition shown in the GNOME top bar.
- Runtime logs filtered with `LyricBar|lyricbar|JS ERROR|Extension`.

## Current Test Priorities

1. Spotify Web on Firefox.
2. Apple Music Web on Firefox.
3. GNOME Shell 50.1 confirmation on Fedora 44.
4. Brave/Vivaldi browser behavior for Spotify Web and YouTube Music Web.
