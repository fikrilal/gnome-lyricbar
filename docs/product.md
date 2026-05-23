# LyricBar Product Overview

LyricBar is a GNOME Shell extension that displays the current synced lyric line for the active music player directly in the GNOME top bar.

The product is built for people who listen to music while working and want glanceable lyrics without switching windows, opening a separate lyrics site, or keeping the Spotify window visible. LyricBar treats lyrics as ambient desktop context: present when useful, quiet when unavailable, and never disruptive to the user’s workflow.

## Problem

Desktop music players expose playback state through the Linux MPRIS interface, but they generally do not expose synchronized lyrics to the desktop shell. Users who want live lyrics usually need to keep a player window open, use a browser extension, or rely on a separate floating application.

That creates friction for a simple use case: seeing one line of the current lyric while continuing to work.

## Product

LyricBar adds a compact lyric display to the GNOME top bar. It watches MPRIS-compatible media players, identifies the active track, fetches synced lyrics from a lyrics provider, and updates the top-bar text as playback progresses.

When synced lyrics are unavailable, LyricBar falls back gracefully instead of failing noisily. Depending on user preferences, it can show the current track, show a neutral idle state, or hide the lyric label.

## Target Users

- GNOME users who listen to music while working.
- Spotify desktop users who want live lyrics outside the Spotify window.
- Linux desktop users who prefer native shell integration over floating widgets.
- Developers and power users who care about privacy, reliability, and predictable desktop behavior.

## Core Experience

The primary experience is intentionally small:

1. Start playing music in Spotify or another MPRIS-compatible player.
2. LyricBar appears in the GNOME top bar.
3. The current lyric line updates in sync with playback.
4. If lyrics are unavailable, LyricBar falls back to track metadata or a quiet idle state.

The extension should feel like part of GNOME, not like a web app embedded into the desktop.

## Product Principles

### Reliable Inside GNOME Shell

GNOME Shell extensions run inside the desktop shell process. LyricBar must be defensive by design: lifecycle cleanup, guarded async callbacks, bounded timers, explicit error handling, and no unsafe assumptions about D-Bus names or player behavior.

### Glanceable, Not Distracting

The top bar has limited space. LyricBar should show one useful line, respect a maximum width, use ellipsis when necessary, and avoid layout shifts.

### Privacy-Aware

Lyric lookup requires sending track metadata to a lyrics provider. LyricBar should document exactly what data is sent, avoid telemetry, and give users clear control over network-backed features.

### Native Linux Integration

LyricBar should use MPRIS and GNOME platform APIs directly. It should not scrape Spotify, automate browser windows, or depend on fragile UI inspection.

### Graceful Degradation

Missing lyrics, paused players, multiple players, network failures, and provider errors are normal states. The extension should handle them without noisy failures or broken UI.

## V1 Scope

The first production release should focus on doing one thing well:

- Detect active MPRIS-compatible players.
- Prioritize the currently playing player.
- Read track metadata and playback position.
- Fetch synced lyrics from LRCLIB.
- Parse LRC-format synced lyrics.
- Display the current lyric line in the GNOME top bar.
- Cache lyric lookups locally for repeat playback.
- Provide preferences for panel position, maximum text width, and fallback behavior.
- Provide clear diagnostics for unsupported players, missing lyrics, and network failures.

## Non-Goals

LyricBar is not intended to be a full music controller in its first release.

The following are intentionally out of scope for v1:

- Playback controls.
- Full lyrics view.
- Karaoke-style highlighting.
- Spotify account integration.
- Lyrics editing or contribution workflows.
- Floating desktop widgets.
- Support for non-GNOME desktop environments.

These features can be considered later if the core extension proves stable.

## Success Criteria

LyricBar is successful when it can run as a daily-use GNOME extension without destabilizing the desktop.

For v1, success means:

- The extension survives enable, disable, logout, login, player launch, player quit, and track changes.
- Failures are visible in diagnostics but do not interrupt the desktop.
- The top-bar UI remains compact and readable across common display sizes.
- Lyrics stay reasonably synchronized with playback.
- The repository is understandable to future contributors through tests, documentation, and release notes.

## Positioning

LyricBar is a small product with production standards. Its value is not feature volume; its value is reliable native integration, thoughtful failure handling, and a polished everyday desktop experience.
