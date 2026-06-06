# TIDAL Web Through Chrome

Date: 2026-06-05

Status: observed route through generic Chrome MPRIS; no dedicated TIDAL support

Scope: externally confirmed TIDAL Web playback routed through Google Chrome MPRIS on GNOME Shell 46

## Summary

TIDAL Web was tested while playing in Google Chrome. LyricBar did not see a TIDAL application identity. It saw Chrome's generic browser MPRIS service:

```text
org.mpris.MediaPlayer2.chromium.instance...
```

The sampled TIDAL Web tracks worked because Chrome exposed usable generic browser metadata: title, artist, album, duration, playback status, and advancing position. LyricBar used the existing Chromium browser path to fetch LRCLIB synced lyrics and render a live top-bar lyric line.

This is compatibility evidence for that route, not a claim that LyricBar detects or independently supports TIDAL.

## Classification

What the evidence proves:

- TIDAL Web can work when routed through Chrome MPRIS.
- Chrome exposed complete enough music metadata for the sampled tracks.
- Position advanced normally for the sampled tracks.
- LRCLIB returned synced lyrics for the sampled metadata.
- LyricBar selected playing Chrome over paused Spotify Desktop.

What the evidence does not prove:

- LyricBar can detect that Chrome is playing TIDAL.
- LyricBar has a TIDAL profile, adapter, preference, or provider integration.
- The fixtures exercise TIDAL-specific behavior.
- TIDAL Desktop, wrappers, Flatpak clients, Firefox, or other browser routes are compatible.

In this document, “TIDAL” records the externally known source of the capture. It is provenance, not a runtime identity available to LyricBar.

## Captured Route

Environment:

```text
GNOME Shell: 46.0
Session type: X11
LyricBar version: 0.1.11
Client: TIDAL Web in Google Chrome
Chrome process: /opt/google/chrome/chrome
Competing player: Spotify Desktop paused
browser-player-service='auto'
player-priority=['spotify']
```

Observed browser identity:

```text
Identity=Chrome
busName=org.mpris.MediaPlayer2.chromium.instance...
```

No native TIDAL MPRIS owner and no TIDAL URL were observed.

## Metadata Evidence

Representative normal playback snapshots:

```text
title=Stressed Out
artist=twenty one pilots
album=Blurryface
playbackStatus=Playing
durationMs=202448
positionMs=<advancing>
trackId=/org/chromium/MediaPlayer2/TrackList/...
url=<missing>
```

```text
title=Carry On
artist=fun.
album=Some Nights
playbackStatus=Playing
durationMs=278488
positionMs=<advancing>
trackId=/org/chromium/MediaPlayer2/TrackList/...
url=<missing>
```

Representative transition state during browser next-track handling:

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

Recovered next-track metadata:

```text
title=Heathens
artist=twenty one pilots
album=Heathens
playbackStatus=Playing
durationMs=196034
positionMs=<advancing>
trackId=/org/chromium/MediaPlayer2/TrackList/...
url=<missing>
```

The generic Chromium track ID was reused across different songs, so LyricBar must keep ignoring browser track IDs for identity and rely on normalized metadata instead.

## Runtime Behavior

Observed behavior before the final stabilization fix:

- Pause and resume preserved the active Chrome track.
- Seek changed the exposed MPRIS position and LyricBar recovered sync.
- Track change emitted a stopped/empty Chrome state before the next real track.
- Retaining the previous track while reading raw position could restart old lyrics at position `0`.
- Clearing the browser immediately could let paused preferred Spotify steal active-player selection.

Current generic browser behavior:

- Browser profiles retain the previous snapshot for a bounded stopped/empty grace period.
- Raw position reads are suppressed during the grace period and recovered-track metadata debounce.
- Persistent stopped/empty metadata clears after timeout.
- Recovered Chrome metadata follows normal browser debounce and becomes active after stabilization.

This behavior is implemented as generic browser MPRIS stability, not TIDAL-specific logic.

## Fixtures And Tests

The captured Chrome route is preserved as generic Chromium transition evidence:

```text
tests/fixtures/mpris/chromium-browser-transition-before.json
tests/fixtures/mpris/chromium-browser-transition-empty-stopped.json
tests/fixtures/mpris/chromium-browser-transition-after.json
tests/mpris/chromium-browser-transition-fixtures.test.js
```

The tests cover:

- MPRIS mapping for before, stopped/empty, and recovered snapshots.
- Generic Chromium profile classification in auto mode.
- Monotonic position samples for normal playback.
- Reused Chromium track IDs across different songs.
- Cache policy for high-confidence metadata vs low-confidence stopped/empty transition metadata.
- Bounded stopped/empty retention followed by timeout clearing.
- Chrome playing with paused preferred Spotify present.
- No Spotify lookup during the Chrome transition.
- Recovered Chrome metadata lookup after stabilization.

Focused verification:

```bash
npx vitest run tests/mpris/profile-policy.test.js tests/mpris/stability.test.js tests/mpris/stable-player.test.js tests/mpris/chromium-browser-transition-fixtures.test.js tests/mpris/selection.test.js
```

Expected result:

```text
5 test files passed
60 tests passed
```

## Support Boundary

Do not add a `tidal-web` profile from the current evidence. Chrome did not expose enough identity to distinguish TIDAL from another media tab.

Future TIDAL-specific support requires at least one stable identifying signal, such as:

- native TIDAL MPRIS bus identity
- wrapper or Flatpak app identity
- browser metadata containing a reliable TIDAL URL or service marker
- repeated TIDAL-specific metadata quirks that require a dedicated adapter or policy

Until then, TIDAL Web should remain classified as an observed route through generic Chrome MPRIS.
