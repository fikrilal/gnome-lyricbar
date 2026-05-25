# Player Profile Architecture

LyricBar should support Spotify Desktop, Spotify Web, YouTube Music Web, and later Apple Music without splitting the runtime into app-specific implementations too early.

The right boundary is not "one code path per app". The right boundary is one MPRIS runtime with profile-driven behavior for player selection, metadata stability, and lyric lookup readiness.

## Problem

All target players expose media state through MPRIS, but their behavior differs:

- Spotify Desktop emits relatively stable metadata.
- Spotify Web through Chromium emits one browser-wide MPRIS player.
- Browser players can emit empty metadata, title-only metadata, advertisement metadata, old tab media, and playback-status changes in noisy bursts.
- YouTube Music Web and Apple Music Web will likely have different metadata quirks while still sharing the same browser MPRIS bus shape.

Current browser behavior shows the issue clearly. Chromium can expose a valid, advancing `Position` for Spotify Web while also emitting transient metadata such as:

```text
title=""
title="Advertisement"
title="Nina", artist=""
title="Nina", artist=".Feast"
old media from another tab
```

If every raw snapshot is treated as authoritative, LyricBar can blank the panel, start unnecessary lyric lookups, stop a valid sync loop, or display lyrics for the wrong browser media.

## Goals

- Keep one shared MPRIS runtime.
- Make Spotify Desktop remain the stable baseline.
- Add first-class support for Spotify Web and YouTube Music Web.
- Prepare for Apple Music without introducing broad refactors later.
- Keep browser-specific behavior explicit and testable.
- Avoid hardcoded app branches inside the controller.
- Make metadata churn reproducible through fixtures and unit tests.

## Non-Goals

- Build separate runtime adapters for every music service.
- Depend on Spotify, YouTube, or Apple private APIs.
- Parse browser page state or DOM content.
- Guarantee perfect behavior when multiple browser tabs actively fight for the same Chromium MPRIS player.
- Replace MPRIS as the primary integration surface.

## Architecture

The runtime should flow through four stages:

```text
Raw MPRIS properties
  -> PlayerProfile
  -> Metadata stability policy
  -> Stable PlayerSnapshot
  -> LyricsService
```

Profiles describe behavior. They should not own D-Bus access, HTTP lookup, cache, or panel rendering.

## Proposed Structure

```text
src/domain/mpris/
  profile.js
  profile-policy.js
  stability.js
  normalize.js
  selection.js
  types.js

src/runtime/mpris/
  player.js
  player-mapping.js
  stable-player.js
  service.js
```

### `profile.js`

Pure profile detection from bus name and normalized metadata.

Initial profile IDs:

```text
spotify-desktop
chromium-browser
firefox-browser
spotify-web
youtube-music-web
apple-music-web
generic-mpris
```

The first implementation can classify browser players as `chromium-browser` or `firefox-browser`. Service-specific profiles should only be selected when metadata gives a strong signal.

### `profile-policy.js`

Defines behavior flags for each profile.

Example:

```js
export const PLAYER_PROFILE_POLICIES = Object.freeze({
  'spotify-desktop': Object.freeze({
    debounceMetadataMs: 0,
    retainLastValidOnEmpty: false,
    retainLastValidOnAdvertisement: false,
    requireArtistForLookup: true,
    pollPositionWhenSynced: true,
  }),
  'chromium-browser': Object.freeze({
    debounceMetadataMs: 350,
    retainLastValidOnEmpty: true,
    retainLastValidOnAdvertisement: true,
    requireArtistForLookup: true,
    pollPositionWhenSynced: true,
  }),
});
```

### `stability.js`

Pure reducer that turns raw snapshots into stable snapshots.

Example shape:

```js
reduceStablePlayerSnapshot(previous, candidate, policy, nowMs);
```

Responsibilities:

- Ignore empty browser metadata when a recent valid snapshot exists.
- Ignore advertisement snapshots when a recent valid snapshot exists.
- Wait for title and artist before allowing lyric lookup.
- Debounce browser metadata bursts.
- Preserve the last valid synced track while transient browser state passes through.
- Accept real track changes when the candidate remains stable long enough.

### `stable-player.js`

Runtime wrapper around `PlayerProxy` that applies domain profile and stability decisions before the controller sees player state.

This keeps `LyricBarController` focused on orchestration:

- player discovery
- active player selection
- lyrics service updates
- sync loop
- rendering

The controller should not know browser-specific stabilization rules.

## Profile Detection

Bus names are reliable for app family, not always for service.

Examples:

```text
org.mpris.MediaPlayer2.spotify
org.mpris.MediaPlayer2.chromium.instance58782
org.mpris.MediaPlayer2.firefox.instance1234
```

Detection rules should be conservative:

1. `org.mpris.MediaPlayer2.spotify` -> `spotify-desktop`
2. Chromium bus -> `chromium-browser`
3. Firefox bus -> `firefox-browser`
4. Browser profile can be refined only when metadata strongly indicates the service.

Service-specific web detection can come later. For now, browser stability behavior matters more than exact service naming.

## Stability Policy

Browser MPRIS should use delayed acceptance:

```text
candidate appears
candidate has title + artist
candidate remains stable for debounce window
candidate becomes stable snapshot
lyrics lookup starts
```

Transient snapshots should not immediately replace the stable track:

```text
stable: Nina / .Feast
candidate: title=""
result: keep Nina

stable: Nina / .Feast
candidate: Advertisement
result: keep Nina

stable: Nina / .Feast
candidate: WISATA SUKABUMI / cholis majid
result: accept only after debounce window, because this might be another browser tab
```

Spotify Desktop should stay immediate because the metadata is already stable.

## Lyrics Lookup Readiness

Lyrics lookup should require enough metadata to avoid bad cache entries.

Default readiness:

```text
title is non-empty
artist is non-empty
```

Duration and album should improve matching but should not be required.

Browser profiles should avoid caching `not-found` for incomplete snapshots. Incomplete browser metadata is usually a transient state, not a real lookup failure.

## Sync Loop Policy

For synced lyrics, position polling should be profile-aware but not overly dependent on playback status.

Browser profiles should poll position once synced lyrics exist because browser `PlaybackStatus` can be late or stale. If playback is paused or stopped, position remains stable and LyricBar will not emit new lines.

This is intentionally more reliable than using `PlaybackStatus === "Playing"` as a hard gate.

## Testing Strategy

This architecture needs fixtures before broad runtime changes.

Recommended fixtures:

```text
tests/fixtures/mpris/
  spotify-desktop-normal.json
  spotify-web-nina-churn.json
  spotify-web-advertisement.json
  chromium-empty-metadata-burst.json
  youtube-music-web-normal.json
  youtube-music-web-title-only-then-artist.json
```

Recommended test coverage:

- Profile detection from bus names.
- Browser metadata burst is debounced.
- Empty browser metadata does not clear the last valid track.
- Advertisement metadata does not clear the last valid track.
- Title-only metadata does not trigger lyrics lookup.
- Full title and artist metadata eventually triggers lookup.
- Spotify Desktop metadata is accepted immediately.
- Same-track playback status changes update the snapshot without triggering another lyric lookup.
- Synced browser lyrics keep polling position even when playback status is stale.

## Implementation Phases

### Phase 1: Profile Detection

Commit:

```text
feat(mpris): add player profile detection
```

Add pure profile detection and tests. No runtime behavior change.

Acceptance:

- Spotify Desktop maps to `spotify-desktop`.
- Chromium maps to `chromium-browser`.
- Firefox maps to `firefox-browser`.
- Unknown MPRIS maps to `generic-mpris`.

### Phase 2: Stability Reducer

Commit:

```text
feat(mpris): add metadata stability reducer
```

Add pure reducer and fixtures. No D-Bus changes yet.

Acceptance:

- Browser empty metadata is ignored when a valid snapshot exists.
- Browser advertisement metadata is ignored when a valid snapshot exists.
- Browser title-only metadata is held until artist arrives.
- Desktop metadata remains immediate.

### Phase 3: Runtime Stabilization

Commit:

```text
feat(mpris): stabilize browser player snapshots
```

Wire stability between `PlayerProxy` and controller.

Acceptance:

- Spotify Desktop behavior remains unchanged.
- Spotify Web no longer blanks or sticks during transient metadata bursts.
- Runtime evidence includes Spotify Web through Chromium.

### Phase 4: YouTube Music Browser Support

Commit:

```text
feat(mpris): support youtube music browser profile
```

Add fixtures and policy for YouTube Music Web once real metadata samples are collected.

Acceptance:

- YouTube Music Web track metadata stabilizes before lookup.
- Synced lyrics work when LRCLIB has a matching track.
- Unsupported or video-like metadata falls back cleanly.

### Phase 5: Apple Music Preparation

Commit:

```text
feat(mpris): add apple music browser profile
```

Only implement after collecting real Apple Music MPRIS samples.

Acceptance:

- Apple Music Web metadata samples are covered by fixtures.
- Profile does not regress Spotify or YouTube Music.

## Risks

### Browser MPRIS Is Shared

Chromium exposes one browser MPRIS player. Multiple media tabs can fight for the same bus name.

Mitigation:

- Debounce browser track changes.
- Keep last valid music track during empty or advertisement states.
- Document that multiple active media tabs reduce reliability.

### Over-Stabilization

Too much debouncing can make real track changes feel late.

Mitigation:

- Keep debounce window short, around 300-500 ms.
- Desktop profile should not debounce.
- Add tests for quick but real browser track changes.

### Bad Cache Entries

Transient browser metadata can produce wrong `not-found` cache entries.

Mitigation:

- Do not lookup incomplete browser metadata.
- Do not cache transient incomplete results.
- Keep cache key based on normalized title, artist, album, and duration.

### App-Specific Creep

Hardcoded service logic can spread across controller, lyrics service, and shell UI.

Mitigation:

- Profiles and stability remain pure domain code.
- Runtime code consumes policies rather than branching on app names.
- New service support requires fixtures.

## Decision

Adopt profile-driven MPRIS behavior with a metadata stability layer.

Do not create separate app-specific runtimes yet. Add app-specific policy only when real MPRIS samples prove it is needed.

The next implementation should start with profile detection and pure stability tests before touching live D-Bus behavior.
