# Apple Music Browser Support Report

Date: 2026-05-27  
Status: analysis and implementation recommendation  
Scope: Apple Music Web through browser MPRIS, observed in Chrome/Chromium

## Summary

Apple Music Web is already partially supported by LyricBar through the generic browser MPRIS path. A live inspection while Apple Music was playing showed that Chrome exposes enough MPRIS metadata for LyricBar to select the player, build a lyric query, and poll playback position.

The current implementation does not have an explicit Apple Music profile. Apple Music playback is classified as `chromium-browser`, which means it receives the generic browser debounce and metadata-retention behavior. That is a reasonable fallback, but it is not a durable support boundary. Apple Music should become a first-class browser service profile, similar to `spotify-web` and `youtube-music-web`, while still avoiding browser scraping or private Apple APIs.

Recommended direction:

- Add `apple-music-web` as a browser-source player profile.
- Extend `browser-player-service` with `apple-music`.
- Keep auto-detection conservative because Chromium does not expose `music.apple.com` through the MPRIS fields currently consumed.
- Reuse the existing browser stability policy at first.
- Add Apple Music fixtures and tests before changing runtime behavior.
- Fix the MPRIS inspection script's string parsing so quoted titles are rendered correctly in reports.

## Live Evidence

Captured with:

```bash
npm run inspect:mpris
```

Environment:

```text
Timestamp: 2026-05-27T03:24:50.723Z
GNOME Shell: 46.0
Installed LyricBar: 0.1.6
Extension state: ACTIVE
Browser identity: Chrome
```

Observed player:

```text
busName=org.mpris.MediaPlayer2.chromium.instance100256
Identity=Chrome
PlaybackStatus=Playing
xesam:title=It's Time
xesam:artist=Imagine Dragons
xesam:album=Night Visions (Deluxe)
mpris:length=441643557
mpris:trackid=/org/chromium/MediaPlayer2/TrackList/TrackAD881F63680FE0B3A97734DAC2ED7F63
mpris:artUrl=file:///tmp/.com.google.Chrome.lsjzqq
xesam:url=
```

Position advanced normally:

```text
1. status=Playing positionMs=195553
2. status=Playing positionMs=196057
3. status=Playing positionMs=196562
4. status=Playing positionMs=197065
5. status=Playing positionMs=197568
```

LyricBar runtime logs also showed that the browser player was selected and sent to lyrics lookup:

```text
stable-snapshot-decision adapter="browser" profile="chromium-browser" title="It's Time"
active-player-selected busName="org.mpris.MediaPlayer2.chromium.instance100256" playbackStatus="Playing" title="It's Time"
lookup-start busName="org.mpris.MediaPlayer2.chromium.instance100256" title="It's Time"
indicator-render text="Imagine Dragons - It's Time" visible=true
```

This confirms the base runtime path works:

- Chromium exposes usable title, artist, album, duration, status, and position.
- Browser track IDs use generic Chromium object paths and should continue to be ignored for stable browser identity.
- Apple Music Web does not expose a service-identifying URL through the inspected MPRIS metadata.
- The active player selection path can prefer Apple Music over paused Spotify because Apple Music is `Playing`.

## Current Implementation State

Supported profile IDs in `src/domain/mpris/profile.js`:

```text
spotify-desktop
spotify-web
youtube-music-web
chromium-browser
firefox-browser
generic-mpris
```

Supported browser service setting values:

```text
auto
spotify
youtube-music
generic
```

Current Apple Music behavior:

- Apple Music Web in Chrome maps to `chromium-browser`.
- It uses `adapterId="browser"`.
- It receives the shared browser policy:
  - 350 ms metadata debounce
  - retain previous valid metadata through empty metadata bursts
  - retain previous valid metadata through short advertisement bursts
  - require artist before lookup
  - poll position when synced lyrics are available
- It does not get an Apple Music-specific profile, preference option, fixture, or release documentation.

## Constraints

### MPRIS Does Not Identify The Web App

The browser root identity is only:

```text
Identity=Chrome
```

The inspected metadata did not include:

```text
xesam:url=https://music.apple.com/...
```

The track ID was also generic Chromium state:

```text
/org/chromium/MediaPlayer2/TrackList/Track...
```

So LyricBar should not claim automatic Apple Music detection from MPRIS alone. A preference-driven profile is the correct first implementation.

### Browser Track IDs Must Stay Ignored

The existing `buildTrackIdentityKey()` behavior is correct for Apple Music: browser profiles ignore `mpris:trackid`, because Chromium track IDs are browser implementation details and can churn or be reused.

Apple Music identity should continue to be based on:

```text
busName | artist | title | album | duration bucket
```

### LRCLIB Matching Is Provider-Dependent

The inspected Apple Music track, `It's Time` by Imagine Dragons, produced LRCLIB `not-found` responses in the current logs. That is not necessarily an Apple Music integration failure. It may be a provider catalog mismatch, version mismatch, apostrophe/quote normalization issue, or duration/album mismatch.

Apple Music support should first make metadata handling correct and observable. Provider matching improvements should be handled separately and tested with known LRCLIB-positive Apple Music tracks.

### Current Inspection Script Has A Reporting Bug

`scripts/inspect-mpris.mjs` printed the normalized title as blank even though raw metadata included:

```text
xesam:title: <"It's Time">
```

The parser currently handles single-quoted values but not double-quoted GVariant string rendering. LyricBar itself saw the title correctly, so this is a harness/reporting issue, not a runtime metadata issue.

## Recommended Implementation

### Phase 1: Add Apple Music Browser Profile

Add a profile:

```text
apple-music-web
```

Expected shape:

```js
export const PLAYER_PROFILES = Object.freeze({
  // existing profiles...
  appleMusicWeb: Object.freeze({
    id: 'apple-music-web',
    sourceKind: 'browser',
  }),
});
```

Update the profile ID typedef to include:

```text
apple-music-web
```

Policy should initially reuse `BROWSER_POLICY`, matching `spotify-web`, `youtube-music-web`, `chromium-browser`, and `firefox-browser`.

Acceptance:

- `policyForPlayerProfile(PLAYER_PROFILES.appleMusicWeb)` equals browser policy.
- Existing Spotify, YouTube Music, Chromium, Firefox, and generic tests still pass.

### Phase 2: Extend Browser Service Settings

Extend the browser service setting from:

```text
auto | spotify | youtube-music | generic
```

to:

```text
auto | spotify | youtube-music | apple-music | generic
```

Files likely affected:

- `schemas/org.gnome.shell.extensions.lyricbar.gschema.xml`
- `src/domain/settings/types.js`
- `src/domain/settings/normalize.js`
- `prefs.js`
- `src/domain/mpris/profile.js`
- related tests under `tests/settings/` and `tests/mpris/`

Preferences label:

```text
Apple Music
```

Recommended default remains:

```text
auto
```

Acceptance:

- `normalizeBrowserPlayerService('apple-music')` returns `'apple-music'`.
- Preferences exposes Apple Music in the browser-service dropdown.
- Invalid values still normalize to `auto`.

### Phase 3: Map Explicit Apple Music Service To Apple Profile

In `selectBrowserServiceProfile()`:

```text
browser-player-service=apple-music
```

should map music-like Chromium/Firefox metadata to:

```text
apple-music-web
```

Do not infer Apple Music in `auto` mode yet. The inspected MPRIS data has no strong Apple-specific signal. If future evidence shows `xesam:url`, `trackId`, or another stable field contains `music.apple.com`, auto detection can be added behind a focused test.

Acceptance:

- Chromium with title, artist, duration, and `browserPlayerService: 'apple-music'` maps to `apple-music-web`.
- Firefox with equivalent metadata also maps to `apple-music-web`.
- Advertisement and stopped metadata stay on the browser-family profile.
- `browserPlayerService: 'generic'` keeps `chromium-browser` or `firefox-browser`.
- `auto` stays browser-family unless strong service evidence exists.

### Phase 4: Add Apple Music Fixtures

Add fixtures under:

```text
tests/fixtures/mpris/
```

Suggested fixtures:

```text
apple-music-web-chromium-normal.json
apple-music-web-chromium-empty-metadata.json
apple-music-web-chromium-title-only.json
apple-music-web-chromium-stopped.json
```

Start with the live normal fixture:

```json
{
  "name": "apple-music-web-chromium-normal",
  "busName": "org.mpris.MediaPlayer2.chromium.instance100256",
  "identity": "Chrome",
  "properties": {
    "PlaybackStatus": "Playing",
    "Metadata": {
      "xesam:title": "It's Time",
      "xesam:artist": ["Imagine Dragons"],
      "xesam:album": "Night Visions (Deluxe)",
      "mpris:length": 441643557,
      "mpris:trackid": "/org/chromium/MediaPlayer2/TrackList/TrackAD881F63680FE0B3A97734DAC2ED7F63",
      "mpris:artUrl": "file:///tmp/.com.google.Chrome.lsjzqq"
    }
  },
  "expectedSnapshot": {
    "busName": "org.mpris.MediaPlayer2.chromium.instance100256",
    "title": "It's Time",
    "artist": "Imagine Dragons",
    "album": "Night Visions (Deluxe)",
    "durationMs": 441644,
    "trackId": "/org/chromium/MediaPlayer2/TrackList/TrackAD881F63680FE0B3A97734DAC2ED7F63",
    "playbackStatus": "Playing"
  },
  "expectedProfileWhenConfigured": "apple-music-web",
  "expectedProfileInAuto": "chromium-browser"
}
```

Acceptance:

- Fixture maps to `apple-music-web` only when configured.
- Browser identity ignores Chromium track ID.
- Browser stability behavior matches existing browser profile behavior.

### Phase 5: Fix MPRIS Inspection Reporting

Update `scripts/inspect-mpris.mjs` so `readStringProperty()` handles GVariant strings rendered with either single quotes or double quotes.

Current issue:

```text
xesam:title: <"It's Time">
```

was rendered as:

```text
title=
```

Acceptance:

- The inspection script reports `title=It's Time` for double-quoted GVariant strings.
- Existing single-quoted parsing still works.
- Add or update a unit test if script parsing is made testable; otherwise document verification with `npm run inspect:mpris`.

## Tests To Add

Profile tests:

- Detect configured Apple Music Web in Chromium.
- Detect configured Apple Music Web in Firefox.
- Do not infer Apple Music Web in auto mode without strong evidence.
- Keep generic mode on browser-family profile.
- Do not classify advertisements as Apple Music Web.
- Do not classify stopped browser metadata as Apple Music Web.

Policy tests:

- `apple-music-web` uses browser policy.

Identity/cache tests:

- Browser track IDs remain ignored for Apple Music.
- Low-confidence Apple Music browser misses do not poison not-found cache.
- Positive lyric results remain cacheable.

Runtime/harness tests:

- Apple Music fixture maps to the expected normalized snapshot.
- Position polling remains enabled for synced browser lyrics.
- Transient empty/title-only metadata does not clear a previous stable Apple Music track immediately.

## Release Notes And Docs

Update public docs after implementation:

- README features/compatibility: add Apple Music Web as supported or experimental.
- `docs/product.md`: mention Apple Music Web only if runtime evidence is good enough.
- `docs/troubleshooting.md`: explain the `Browser player service` preference and when to choose Apple Music.
- `docs/privacy.md`: no new privacy surface if implementation remains MPRIS plus LRCLIB only.
- Release notes for `0.1.8`: include Apple Music Web browser-profile support.

Suggested wording:

```text
Added explicit Apple Music Web support for browser MPRIS players. Because browsers usually expose only the browser identity over MPRIS, choose Apple Music in Browser player service when using music.apple.com.
```

## Risks

### Misclassification In Browser Auto Mode

Risk: treating all music-like Chromium metadata as Apple Music would break Spotify Web, YouTube Music, and generic browser playback.

Mitigation: make Apple Music opt-in through `browser-player-service=apple-music` until MPRIS exposes strong service evidence.

### Provider Mismatch

Risk: Apple Music metadata can represent album versions, deluxe editions, remasters, live editions, or punctuation variants that LRCLIB does not match exactly.

Mitigation: keep profile work separate from lyrics provider matching. Add provider matching improvements only after collecting known failing and passing tracks.

### Browser Tab Contention

Risk: Chromium exposes one browser-wide MPRIS player, so another tab can replace Apple Music metadata.

Mitigation: reuse existing browser stability policy and keep service selection explicit. Do not scrape tabs to solve this.

### Negative Cache Poisoning

Risk: short-lived browser metadata can trigger `not-found` cache entries.

Mitigation: continue high-confidence checks before writing browser misses. Add Apple Music-specific fixtures around low-confidence metadata.

## Proposed Work Order

1. Fix `scripts/inspect-mpris.mjs` double-quoted string parsing.
2. Add Apple Music fixtures from the live MPRIS capture.
3. Add `apple-music-web` profile and browser policy mapping.
4. Add `apple-music` to settings normalization, schema, and preferences.
5. Add profile, settings, policy, identity, and cache tests.
6. Run `npm run verify`.
7. Manually verify with Apple Music Web in Chrome:
   - extension enabled
   - `browser-player-service=apple-music`
   - track starts
   - track changes
   - pause/resume
   - browser tab closed
   - Spotify paused while Apple Music plays
8. Record runtime evidence in the relevant execution plan.

## Conclusion

Apple Music Web support should be a small, profile-driven extension of the existing browser MPRIS architecture. The live data is favorable: Apple Music in Chrome exposes normal music metadata and advancing position. The main missing piece is not low-level runtime support; it is an explicit service profile, preference option, fixtures, and documentation.

Do not attempt automatic Apple Music detection from the current MPRIS evidence. The correct first release behavior is explicit user selection through `Browser player service: Apple Music`, backed by browser stability policy and fixture coverage.
