# TIDAL Support Report

Date: 2026-06-05  
Status: smoke tested for TIDAL Web in Google Chrome  
Scope: TIDAL Web through Chrome MPRIS on GNOME Shell 46

## Summary

TIDAL Web was tested while playing in Google Chrome. In this session, TIDAL did not expose a native TIDAL MPRIS bus. Playback appeared through Chrome's browser MPRIS service:

```text
org.mpris.MediaPlayer2.chromium.instance11414
```

The existing Chromium browser support path handled the observed playback correctly:

- LyricBar discovered the Chrome MPRIS player.
- LyricBar selected the playing Chrome player over paused Spotify Desktop.
- The browser metadata included title, artist, album, duration, playback status, and advancing position.
- LRCLIB exact lookup returned synced lyrics for the sampled track.
- LyricBar rendered synced lyrics in the top bar using the existing sync loop.

This evidence does not justify a TIDAL-specific runtime profile yet. For TIDAL Web in Chrome, the current generic Chromium browser path is sufficient for the sampled track.

## Live Evidence

Environment:

```text
GNOME Shell: 46.0
Session type: X11
LyricBar version: 0.1.11
Extension state: enabled and active
Client: TIDAL Web in Google Chrome
Chrome process: /opt/google/chrome/chrome
```

Observed MPRIS owners:

```text
org.mpris.MediaPlayer2.chromium.instance11414
org.mpris.MediaPlayer2.spotify
```

No native TIDAL MPRIS owner was observed.

Chrome root identity:

```text
Identity=Chrome
```

Normalized Chrome player snapshot:

```text
title=Stressed Out
artist=twenty one pilots
album=Blurryface
playbackStatus=Playing
durationMs=202448
positionMs=46192
trackId=/org/chromium/MediaPlayer2/TrackList/Track5139CA4885E69CAB02FA35CD144E8724
url=
artUrl=file:///tmp/.com.google.Chrome.zomyQp
```

Position samples advanced normally:

```text
46192
46695
47196
47699
48202
```

A paused Spotify Desktop player was also present:

```text
busName=org.mpris.MediaPlayer2.spotify
title=ECHO
artist=STARSET
album=DIVISIONS
playbackStatus=Paused
positionMs=210513
```

LyricBar settings during the test:

```text
browser-player-service='auto'
player-priority=['spotify']
debug-logging=true
```

Even with Spotify in `player-priority`, LyricBar selected the Chrome player because it was playing and Spotify was paused.

Runtime log summary:

- Chrome snapshots were classified as `chromium-browser`.
- The browser adapter was used.
- Browser metadata was briefly held by the debounce policy.
- The stable snapshot was accepted after the debounce window.
- Active player selection chose `org.mpris.MediaPlayer2.chromium.instance11414`.
- A synced lookup was served from cache for the sampled current track.
- The sync loop started and lyric lines advanced from raw MPRIS position.

Representative runtime events:

```text
stable-snapshot-decision adapter="browser" profile="chromium-browser" decision="held"
stable-snapshot-decision adapter="browser" profile="chromium-browser" decision="accepted"
active-player-selected busName="org.mpris.MediaPlayer2.chromium.instance11414" playbackStatus="Playing"
lookup-start busName="org.mpris.MediaPlayer2.chromium.instance11414" title="Stressed Out"
cache-hit kind="synced"
sync-loop-start intervalMs=500 title="Stressed Out"
```

Earlier in the same session, another TIDAL Web track produced a provider `synced` result and wrote that result to cache. This confirms provider lookup can also work from a cache miss with Chrome-backed TIDAL metadata.

## Provider Evidence

Exact LRCLIB lookup was checked for the observed current track:

```text
artist_name=twenty one pilots
track_name=Stressed Out
album_name=Blurryface
duration=202
```

Result summary:

```text
id=1357
name=Stressed Out
artistName=Twenty One Pilots
albumName=Blurryface
duration=202
instrumental=false
syncedLyrics=true
plainLyrics=true
```

LRCLIB search fallback also returned synced candidates, including duration-compatible candidates.

Provider success means the observed client path can support synced lyrics when TIDAL exposes clean title, artist, album, and duration metadata.

## Current Implementation State

The current codebase already contains the pieces needed for this observed TIDAL Web session:

- `src/runtime/mpris/service.js` discovers the Chrome MPRIS bus through `ListNames` and `NameOwnerChanged`.
- `src/domain/mpris/profile.js` classifies the bus as `chromium-browser`.
- `src/domain/mpris/profile-policy.js` applies browser metadata debounce and retention policy.
- `src/runtime/mpris/stable-player.js` wraps raw MPRIS snapshots with profile-aware stabilization.
- `src/domain/lyrics/track-identity.js` ignores browser track IDs for identity.
- `src/runtime/lyrics/service.js` suppresses stale lookup callbacks by generation.
- `src/runtime/lyrics/lrclib.js` supports exact lookup plus synced search fallback.

No TIDAL-specific code is currently required for the sampled Chrome-backed behavior.

## Key Findings

- TIDAL Web in Chrome exposes browser MPRIS, not a TIDAL-specific MPRIS identity.
- Chrome did not expose a TIDAL URL in `xesam:url`, so LyricBar cannot reliably auto-detect TIDAL Web from this MPRIS snapshot.
- Metadata quality was high for the sampled track.
- Playback position advanced correctly and was usable for sync.
- Existing active-player selection handled competition with paused Spotify Desktop correctly.
- Existing LRCLIB lookup behavior works with the sampled TIDAL metadata.
- Existing generic Chromium handling is the right support boundary unless future evidence shows a TIDAL-specific quirk.

## Recommended Architecture

Do not add a `tidal-web` profile yet.

The current evidence points to a documentation-only support update:

- Treat TIDAL Web in Chrome as smoke tested through generic Chromium browser MPRIS support.
- Keep browser-service auto-detection conservative because the tested snapshot had no TIDAL URL evidence.
- Avoid adding a `browser-player-service` enum value for TIDAL until users need explicit disambiguation from other browser media.
- Avoid adding a TIDAL metadata adapter until evidence shows decorated title/artist shapes, missing artist, bad duration, or repeated lookup churn.

If later evidence shows TIDAL-specific behavior, revisit these possible changes:

- `src/domain/mpris/profile.js` for profile detection.
- `src/domain/mpris/profile-policy.js` for stability policy.
- `src/domain/mpris/player-adapter.js` for title/artist cleanup.
- `src/domain/lyrics/track-identity.js` for identity churn.
- `src/domain/lyrics/query-policy.js` for lookup normalization.
- `src/domain/lyrics/cache-policy.js` for negative-cache safety.

## Proposed Implementation Plan

### Phase 1: Evidence Documentation

Status: complete for the observed Chrome-backed session.

Work:

- Create this support report.
- Add TIDAL to the player support index.
- Add TIDAL to the docs index.
- Add a conservative compatibility entry for TIDAL Web on Chrome.

### Phase 2: Additional Runtime Evidence

Collect before changing code:

- pause and resume samples
- seek forward/backward samples
- track-change samples
- a track without synced LRCLIB lyrics to confirm fallback behavior
- confirmation from the visible browser that the playing tab is TIDAL Web
- TIDAL Desktop, Flatpak, wrapper, or bridge evidence if those clients are in scope

### Phase 3: Fixtures If Needed

Only add fixtures for observed behavior that should be protected.

Possible fixture names:

```text
tests/fixtures/mpris/tidal-web-chromium-normal.json
tests/fixtures/mpris/tidal-web-chromium-empty-metadata.json
tests/fixtures/mpris/tidal-web-chromium-title-only.json
tests/fixtures/mpris/tidal-web-chromium-stopped.json
```

### Phase 4: Minimal Code Change If Evidence Requires It

Do this only if evidence shows the generic Chromium path is insufficient.

Potential changes:

- metadata adapter for title/artist cleanup
- profile policy for TIDAL-specific churn
- lookup/cache policy if duration or album is unreliable
- settings UI change only if explicit user disambiguation is necessary

## Tests And Fixtures

No fixture was added for Phase 1 because the observed behavior is already covered by the generic Chromium/browser path at runtime and this phase is documentation-only.

If future work claims support beyond smoke testing, add fixtures before runtime changes.

## Risks

- This is a single TIDAL Web on Chrome sample, not broad TIDAL support.
- TIDAL Desktop, Flatpak, wrappers, and browser bridges may expose different MPRIS names or metadata.
- Browser MPRIS did not expose a TIDAL URL, so service identity cannot be proven from MPRIS alone.
- Other browser media can compete for the same Chrome MPRIS player.
- LRCLIB coverage can vary by track; provider failure is not the same as TIDAL client failure.

## Conclusion

TIDAL Web in Google Chrome is smoke tested through the existing generic Chromium browser support path. The sampled session worked end to end for synced lyrics.

The next correct step is more evidence, not TIDAL-specific implementation. A dedicated TIDAL profile or setting should wait until live MPRIS evidence shows behavior the generic browser profile cannot handle.
