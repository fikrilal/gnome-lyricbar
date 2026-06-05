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

## Additional Runtime Evidence

Additional runtime checks were collected on 2026-06-05 against the same TIDAL Web through Chrome MPRIS path. The active browser bus changed after Chrome restart:

```text
org.mpris.MediaPlayer2.chromium.instance4608
```

### Baseline Track

Observed baseline track:

```text
title=Carry On
artist=fun.
album=Some Nights
playbackStatus=Playing
durationMs=278488
positionMs=162733
trackId=/org/chromium/MediaPlayer2/TrackList/TrackADA31A8E30FC47629D668EB1B187366E
url=
```

Position samples advanced normally:

```text
162733
163237
163739
164242
164744
```

LyricBar selected this Chrome player, hit synced lyrics from cache, started the sync loop, and rendered advancing lyric lines.

### Pause And Resume

A direct MPRIS pause call succeeded:

```bash
gdbus call --session \
  --dest org.mpris.MediaPlayer2.chromium.instance4608 \
  --object-path /org/mpris/MediaPlayer2 \
  --method org.mpris.MediaPlayer2.Player.Pause
```

LyricBar logs showed Chrome reporting `Paused` for `Carry On`. The same stable track was retained, active-player selection refreshed, and the visible lyric line was preserved:

```text
snapshot-changed playbackStatus="Paused" title="Carry On"
stable-snapshot-decision decision="accepted" playbackStatus="Paused" profile="chromium-browser"
active-player-selected playbackStatus="Paused" title="Carry On"
active-player-refresh playbackStatus="Paused" title="Carry On"
indicator-render text="'Cause we are, we are shining stars" visible=true
```

Playback then returned to `Playing`, and LyricBar refreshed the same active player without starting a new lyric lookup:

```text
snapshot-changed playbackStatus="Playing" title="Carry On"
stable-snapshot-decision decision="accepted" playbackStatus="Playing" profile="chromium-browser"
active-player-selected playbackStatus="Playing" title="Carry On"
active-player-refresh playbackStatus="Playing" title="Carry On"
```

### Seek

A direct MPRIS seek call succeeded:

```bash
gdbus call --session \
  --dest org.mpris.MediaPlayer2.chromium.instance4608 \
  --object-path /org/mpris/MediaPlayer2 \
  --method org.mpris.MediaPlayer2.Player.Seek 'int64 -60000000'
```

Chrome/TIDAL did not apply the full requested offset, but the exposed MPRIS position moved backward from approximately `189239ms` to `182895ms`. LyricBar selected the earlier matching lyric line and continued advancing:

```text
sync-line-selected positionMs=189239 rawPositionMs=189239 text="So we'll come, we will find our way home"
sync-line-selected positionMs=182895 rawPositionMs=182895 text="We are invincible, we are who we are"
sync-line-selected positionMs=184807 rawPositionMs=184807 text="On our darkest day when we're miles away"
```

This confirms LyricBar can recover sync from a TIDAL Web seek event when Chrome exposes the changed position.

### Track Change

A direct MPRIS next call succeeded:

```bash
gdbus call --session \
  --dest org.mpris.MediaPlayer2.chromium.instance4608 \
  --object-path /org/mpris/MediaPlayer2 \
  --method org.mpris.MediaPlayer2.Player.Next
```

Chrome first emitted a stopped/empty state:

```text
PlaybackStatus=Stopped
title=
artist=
album=
durationMs=0
positionMs=0
CanGoNext=false
CanGoPrevious=false
CanPause=false
CanPlay=false
CanSeek=false
```

During the transition, LyricBar briefly retained the previous `Carry On` track and restarted synced lyrics at position `0`:

```text
stable-snapshot-decision decision="accepted" playbackStatus="Stopped" title="Carry On"
active-player-selected playbackStatus="Stopped" title="Carry On"
lookup-start title="Carry On"
sync-loop-stop
cache-hit kind="synced"
sync-loop-start intervalMs=500 title="Carry On"
sync-line-selected positionMs=0 rawPositionMs=0 text="Well, I woke up to the sound of silence and cries"
```

Several seconds later Chrome emitted the next real track:

```text
title=Heathens
artist=twenty one pilots
album=Heathens
playbackStatus=Playing
durationMs=196034
positionMs=47872
trackId=/org/chromium/MediaPlayer2/TrackList/TrackADA31A8E30FC47629D668EB1B187366E
url=
```

LyricBar accepted the new track, hit synced cache, restarted the sync loop, and rendered the correct lyrics:

```text
stable-snapshot-decision decision="accepted" playbackStatus="Playing" title="Heathens"
active-player-selected playbackStatus="Playing" title="Heathens"
lookup-start title="Heathens"
cache-hit kind="synced"
sync-loop-start intervalMs=500 title="Heathens"
sync-line-selected positionMs=12662 rawPositionMs=12662 text="Wait for them to ask you who you know"
```

The final current-state inspector confirmed `Heathens` was playing with complete metadata and advancing position:

```text
47872
48373
48898
49400
49903
```

### Phase 2 Finding

Pause/resume and seek behavior are usable through Chrome MPRIS. Track transitions also recover once Chrome emits the next real track.

The main observed risk is the stopped/empty browser transition. Existing browser stabilization can briefly retain the previous track and restart synced lyrics at position `0` before the next real track arrives. This is not TIDAL-specific yet; it is a generic browser MPRIS transition risk worth covering with fixtures before any runtime change.

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

Exact LRCLIB lookup was also checked for the Phase 2 baseline track:

```text
artist_name=fun.
track_name=Carry On
album_name=Some Nights
duration=278
```

Result summary:

```text
id=1031288
name=Carry On
artistName=fun.
albumName=Some Nights
duration=278
instrumental=false
syncedLyrics=true
plainLyrics=true
```

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
- Pause/resume and seek work through Chrome MPRIS for the sampled TIDAL Web session.
- Track-change recovery works once Chrome emits the next real track.
- Chrome can emit a stopped/empty transition state, during which LyricBar may briefly retain stale previous-track lyrics.

## Recommended Architecture

Do not add a `tidal-web` profile yet.

The current evidence points to a documentation-only support update:

- Treat TIDAL Web in Chrome as smoke tested through generic Chromium browser MPRIS support.
- Keep browser-service auto-detection conservative because the tested snapshot had no TIDAL URL evidence.
- Avoid adding a `browser-player-service` enum value for TIDAL until users need explicit disambiguation from other browser media.
- Avoid adding a TIDAL metadata adapter until evidence shows decorated title/artist shapes, missing artist, bad duration, or repeated lookup churn.
- Treat the stopped/empty track-transition behavior as a generic browser stability issue, not a TIDAL-specific profile requirement yet.

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

Status: complete for pause/resume, seek, and one next-track transition on TIDAL Web through Chrome.

Collected:

- pause and resume samples
- seek forward/backward samples
- track-change samples

Still needed before broad support:

- a track without synced LRCLIB lyrics to confirm fallback behavior
- confirmation from the visible browser that the playing tab is TIDAL Web
- TIDAL Desktop, Flatpak, wrapper, or bridge evidence if those clients are in scope

### Phase 3: Fixtures If Needed

Status: complete for the observed TIDAL Web Chrome track-transition behavior.

Fixtures added:

```text
tests/fixtures/mpris/tidal-web-chromium-normal.json
tests/fixtures/mpris/tidal-web-chromium-track-transition-empty-stopped.json
tests/fixtures/mpris/tidal-web-chromium-next-normal.json
tests/mpris/tidal-fixtures.test.js
```

The fixtures preserve:

- normal `Carry On` playback metadata
- the stopped/empty transition emitted by Chrome during next-track handling
- recovered `Heathens` playback metadata
- reused Chromium track ID across different songs
- current stability behavior that retains the previous track through empty browser metadata

Potential future fixtures if more evidence appears:

```text
tests/fixtures/mpris/tidal-web-chromium-empty-metadata.json
tests/fixtures/mpris/tidal-web-chromium-title-only.json
tests/fixtures/mpris/tidal-web-chromium-stopped.json
```

### Phase 4: Minimal Code Change If Evidence Requires It

Status: complete for the observed stopped/empty Chrome transition.

Change:

- `src/domain/mpris/stability.js` now clears stopped/empty browser snapshots instead of retaining the previous stable track.
- Non-stopped empty browser snapshots still retain the previous stable track.
- The change is generic browser MPRIS behavior, not a TIDAL-specific profile.

Reason:

- Phase 2 showed Chrome/TIDAL can emit stopped/empty metadata during a next-track transition.
- Retaining that snapshot caused LyricBar to restart stale `Carry On` synced lyrics at position `0` before `Heathens` arrived.
- Clearing the stable snapshot avoids showing stale lyrics during that transition.

Verification:

```bash
npx vitest run tests/mpris/stability.test.js tests/mpris/tidal-fixtures.test.js
```

Result: 2 test files passed, 24 tests passed.

## Tests And Fixtures

Phase 3 added TIDAL Web Chrome fixtures and tests:

```text
tests/fixtures/mpris/tidal-web-chromium-normal.json
tests/fixtures/mpris/tidal-web-chromium-track-transition-empty-stopped.json
tests/fixtures/mpris/tidal-web-chromium-next-normal.json
tests/mpris/tidal-fixtures.test.js
```

Coverage:

- MPRIS mapping for normal, stopped/empty transition, and recovered next-track snapshots.
- Generic Chromium profile classification in auto mode.
- Monotonic position samples for normal playback.
- Browser identity behavior when Chromium reuses a generic track ID for different songs.
- Cache policy for high-confidence metadata vs low-confidence stopped/empty transition metadata.
- Current browser stability reducer behavior for stopped/empty metadata retention.
- Acceptance of the recovered next track after the debounce window.

Phase 4 updated the stopped/empty stability expectation:

- `tidal-web-chromium-track-transition-empty-stopped.json` now verifies that the reducer clears the previous stable track.
- `tests/mpris/stability.test.js` verifies that non-stopped empty browser metadata still retains the previous stable track.

Verification:

```bash
npx vitest run tests/mpris/tidal-fixtures.test.js
```

Result: 1 test file passed, 10 tests passed.

Phase 4 targeted verification:

```bash
npx vitest run tests/mpris/stability.test.js tests/mpris/tidal-fixtures.test.js
```

Result: 2 test files passed, 24 tests passed.

## Risks

- This is a single TIDAL Web on Chrome sample, not broad TIDAL support.
- TIDAL Desktop, Flatpak, wrappers, and browser bridges may expose different MPRIS names or metadata.
- Browser MPRIS did not expose a TIDAL URL, so service identity cannot be proven from MPRIS alone.
- Other browser media can compete for the same Chrome MPRIS player.
- LRCLIB coverage can vary by track; provider failure is not the same as TIDAL client failure.
- Stopped/empty browser transition metadata previously retained stale lyrics before the next real track arrived. Phase 4 changes the reducer to clear stopped/empty snapshots.

## Conclusion

TIDAL Web in Google Chrome is smoke tested through the existing generic Chromium browser support path. The sampled session worked end to end for synced lyrics.

The next correct step is more evidence, not TIDAL-specific implementation. A dedicated TIDAL profile or setting should wait until live MPRIS evidence shows behavior the generic browser profile cannot handle.
