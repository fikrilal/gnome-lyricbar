# Player Support

This directory documents how LyricBar supports each music player, and how to add a new one.

LyricBar talks to players exclusively through MPRIS over D-Bus. It does not scrape browser tabs, read page DOM, read browser history, or use private Spotify, YouTube, or Apple APIs. Every player doc here is grounded in live MPRIS evidence captured with the project harness.

## Start Here

- [Profile architecture](profile-architecture.md): the shared MPRIS runtime and profile-driven model for player selection, metadata stability, and lyric lookup readiness. Read this first.
- [Browser player R&D workflow](../harness/browser-player-rnd-workflow.md): the mandatory evidence workflow you must follow before implementing or recommending browser-player support.

## Supported Players

| Player            | Doc                                                | Notes                                             |
| ----------------- | -------------------------------------------------- | ------------------------------------------------- |
| Spotify Desktop   | [profile-architecture.md](profile-architecture.md) | Stable baseline; native MPRIS player.             |
| Spotify Web       | [spotify-web.md](spotify-web.md)                   | Browser MPRIS via Chromium.                       |
| YouTube Music Web | [youtube-music.md](youtube-music.md)               | Browser MPRIS via Chromium.                       |
| Apple Music Web   | [apple-music.md](apple-music.md)                   | Browser MPRIS; cumulative position normalization. |
| TIDAL Web         | [tidal.md](tidal.md)                               | Smoke tested through Chrome browser MPRIS.        |
| Firefox players   | [firefox.md](firefox.md)                           | Firefox MPRIS findings and limitations.           |

## Adding a New Player

1. Read [profile-architecture.md](profile-architecture.md) to understand the profile model and why LyricBar avoids one code path per app.
2. Follow the [browser player R&D workflow](../harness/browser-player-rnd-workflow.md) to capture live MPRIS evidence. Do not write a support report from a single `busctl` or `inspect:mpris` output.
3. Create a new doc in this directory named `players/<service>.md` (for example `players/tidal.md`), following the report template in the R&D workflow.
4. Add the new doc to the table above and to the docs index in [`docs/README.md`](../README.md).
5. Propose fixtures and tests before runtime changes, as described in the R&D workflow.

## Naming Convention

Player docs use the service name without redundant suffixes: `spotify-web.md`, `youtube-music.md`, `apple-music.md`, `firefox.md`. This keeps the directory predictable as new players are added.
