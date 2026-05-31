# YouTube Music Browser Support

## Context

LyricBar already works with YouTube Music in Chromium through the browser MPRIS player. Live inspection on `2026-05-26` showed that synced lyrics can fetch and advance while YouTube Music is playing.

The current implementation still treats browser playback as either generic browser playback or Spotify Web, depending on the `browser-player-service` setting. That is good enough for a first pass, but it is not a production-quality YouTube Music support boundary.

The goal is to add explicit YouTube Music browser support without scraping browser tabs, reading browser history, or depending on YouTube Music DOM state.

## Live Evidence

Observed while YouTube Music was playing in Chrome:

```text
busName=org.mpris.MediaPlayer2.chromium.instance6544
Identity=Chrome
PlaybackStatus=Playing
xesam:title=Let Me Love You
xesam:artist=DJ Snake
xesam:album=
mpris:length=205341000
mpris:trackid=/org/chromium/MediaPlayer2/TrackList/Track22C9441C7D270DC57830A101D2310234
xesam:url=
```

Position samples advanced normally during inspection:

```text
positionMs=151468
positionMs=151971
positionMs=152474
positionMs=152977
positionMs=153479
```

LyricBar also logged a synced lookup and active sync loop for the track. That confirms the basic runtime path is valid:

- Chromium exposes enough title, artist, duration, playback status, and position data.
- LRCLIB lookup can succeed with the browser metadata.
- The sync loop can drive top-bar lyric updates from Chromium position polling.

## Current Gaps

### YouTube Music Is Misclassified As Spotify Web

With the current default setting:

```text
browser-player-service=spotify
```

music-like Chromium metadata is intentionally biased to `spotify-web`. This was useful for Spotify Web, but it makes YouTube Music sessions look like Spotify Web internally.

That does not necessarily break lyric display, but it is the wrong long-term model. It prevents us from tuning YouTube Music behavior independently from Spotify Web.

### Chromium Does Not Expose The Web App

The MPRIS root identity is:

```text
Identity=Chrome
```

Chromium does not expose `music.youtube.com` through the MPRIS properties we consume. It also does not expose a stable URL in the inspected metadata. That means LyricBar cannot reliably auto-detect YouTube Music from MPRIS alone.

This is the important constraint: service-specific browser support must be preference-driven or confidence-driven. It should not pretend Chromium gives us app identity when it does not.

### Browser Track IDs Are Generic

The inspected track ID used the generic Chromium shape:

```text
/org/chromium/MediaPlayer2/TrackList/Track...
```

This must continue to be ignored for browser track identity. The durable identity should stay based on normalized title, artist, album, and duration bucket.

### YouTube Music Can Emit Noisy Non-Track Metadata

Earlier live logs during YouTube Music playback showed a transient non-song-like title/artist pair being accepted long enough to trigger an LRCLIB lookup and cache a not-found result.

That points to the same browser risk we saw with Spotify Web: Chromium can expose short-lived metadata that is not the intended music track. For YouTube Music this can come from ads, shorts, videos, interstitials, or another media tab.

## Proposed Architecture

### Browser Service Setting

Expand `browser-player-service` from:

```text
auto | spotify | generic
```

to:

```text
auto | spotify | youtube-music | generic
```

Recommended behavior:

- `spotify`: classify music-like Chromium/Firefox metadata as `spotify-web`.
- `youtube-music`: classify music-like Chromium/Firefox metadata as `youtube-music-web`.
- `generic`: never use service-specific browser profiles.
- `auto`: only use service-specific profiles when metadata gives strong evidence; otherwise stay on `chromium-browser` or `firefox-browser`.

The preference UI should show this as:

```text
Browser player service
Auto
Spotify Web
YouTube Music
Generic browser
```

Default should be `auto`. In auto mode LyricBar should only use service-specific behavior when MPRIS carries strong evidence. Otherwise, browser music should stay on the generic browser profile, which avoids misclassifying YouTube Music as Spotify Web while still supporting synced lyric lookup and position polling.

### YouTube Music Profile

Add a first-class profile:

```text
youtube-music-web
```

It should use browser source behavior:

- ignore generic browser track IDs for identity
- debounce browser metadata changes
- retain the previous stable track through short metadata churn
- poll position while synced lyrics are active
- avoid desktop-only Spotify assumptions

The profile should share most policy with `spotify-web` initially. The point of the new profile is not immediate behavioral divergence; it is creating a clean place to add YouTube Music-specific handling when we observe real failures.

### Browser Classification

Add a small browser-service mapping layer instead of encoding every service inside `detectPlayerProfile`.

Suggested shape:

```text
browser-player-service -> browser profile id
spotify -> spotify-web
youtube-music -> youtube-music-web
generic -> chromium-browser/firefox-browser
auto -> strong evidence only
```

This keeps profile detection simple and prevents future Apple Music support from becoming another special case inside the Spotify heuristic.

### Lookup Confidence

Add a browser metadata confidence gate before lookup and not-found caching.

High confidence:

- non-empty title
- non-empty artist
- playback status is not stopped
- duration is missing or greater than the short-media threshold
- title is not a known browser placeholder such as `Advertisement`

Low confidence:

- missing artist
- missing title
- duration is very short
- title looks like a browser placeholder
- metadata appears only briefly during a churn window

Recommended behavior:

- High-confidence metadata can trigger lookup and cache results.
- Low-confidence browser metadata should not permanently cache `not-found`.
- Low-confidence browser metadata should not immediately replace an active synced lyric line unless it persists past the retention window.

## Implementation Phases

### Phase 1: Add YouTube Music Browser Profile

Commit:

```text
feat(mpris): add youtube music browser profile
```

Scope:

- Add `youtube-music-web` to profile types and constants.
- Add `youtube-music` to `BrowserPlayerService`.
- Update settings normalization and schema description.
- Update Preferences browser service dropdown.
- Add tests for explicit YouTube Music browser classification.

Acceptance:

- Chromium with music-like metadata and `browser-player-service=youtube-music` maps to `youtube-music-web`.
- Existing Spotify Desktop, Spotify Web, generic Chromium, and Firefox tests still pass.
- `npm run verify` passes.

### Phase 2: Extract Browser Service Mapping

Commit:

```text
refactor(mpris): isolate browser service profile mapping
```

Scope:

- Move browser service-to-profile selection into a small pure helper.
- Keep MPRIS bus-family detection separate from web-service preference mapping.
- Add focused tests for `auto`, `spotify`, `youtube-music`, and `generic`.

Acceptance:

- Adding Apple Music later only requires adding a service enum value, profile, and mapping test.
- `detectPlayerProfile` remains readable and does not grow app-specific condition chains.

### Phase 3: Harden Browser Lookup Confidence

Commit:

```text
fix(lyrics): avoid caching low-confidence browser misses
```

Scope:

- Add a pure confidence function for browser snapshots.
- Prevent permanent `not-found` cache writes for low-confidence browser metadata.
- Keep successful synced/plain cache writes unchanged.
- Keep desktop player behavior unchanged.

Acceptance:

- Browser ad/interstitial fixtures do not poison the cache with durable misses.
- Normal YouTube Music and Spotify Web fixtures still cache synced lyrics.
- Existing cache behavior for Spotify Desktop is unchanged.

### Phase 4: Add YouTube Music Harness Fixtures

Commit:

```text
chore(harness): add youtube music browser fixtures
```

Scope:

- Add Chromium MPRIS fixtures for normal YouTube Music playback.
- Add fixture for empty album with valid title/artist/duration.
- Add fixture for transient non-track metadata.
- Add regression tests for position polling and stable identity.

Acceptance:

- The harness can reproduce the observed YouTube Music MPRIS shape without live browser playback.
- Agents can validate YouTube Music support without asking the user to log out or manually test every change.

## Runtime Verification Plan

1. Play YouTube Music in Chrome or Chromium.
2. Set Browser player service to `YouTube Music`.
3. Run:

```bash
npm run inspect:mpris
```

4. Confirm:

```text
Identity=Chrome
PlaybackStatus=Playing
title=<current YouTube Music title>
artist=<current YouTube Music artist>
positionMs advances between samples
profile=youtube-music-web
```

5. Confirm LyricBar logs:

```text
sync-loop-start
sync-line-selected
indicator-render
```

6. Switch tracks and confirm the new title/artist triggers a new lookup even if Chromium reuses a generic track ID shape.

## Risks

- MPRIS alone cannot prove the active browser tab is YouTube Music.
- Multiple browser media tabs can fight for the same Chromium MPRIS bus.
- YouTube Music may expose videos, shorts, podcast-like content, ads, and normal music through the same MPRIS shape.
- Some valid songs have sparse metadata, especially empty albums.
- Aggressive filtering can reduce false positives but may also delay real lyric lookup.

The correct product stance is explicit support with honest diagnostics, not magic auto-detection.

## Recommendation

Start with Phase 1. It is small, reversible, and establishes the correct profile boundary. Then do Phase 2 immediately after, because browser service mapping will otherwise become harder to reason about as Apple Music support arrives.
