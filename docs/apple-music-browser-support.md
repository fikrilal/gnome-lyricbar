# Apple Music Browser Support Report

Date: 2026-05-27  
Status: live R&D report and implementation proposal  
Scope: Apple Music Web through Chrome/Chromium MPRIS on GNOME Shell 46

## Summary

Apple Music Web already reaches LyricBar through the generic Chromium MPRIS path. In the current live session, Chrome exposed title, artist, album, playback status, artwork, and an advancing position. LyricBar correctly selected the browser player over paused Spotify and rendered the track fallback text.

The missing work is not basic player discovery. The missing work is product-quality Apple Music browser handling:

- first-class `apple-music-web` profile
- explicit `Browser player service: Apple Music` preference
- Apple Music fixtures and tests
- duration sanity policy for browser metadata
- provider lookup strategy that does not trust clearly bogus Apple Music browser durations
- diagnostics that make repeated browser lookups explainable

The most important live finding is that Apple Music Web can report a bad `mpris:length`. For the currently playing track, Chrome reported `Radioactive` by Imagine Dragons with a duration of about 1172 seconds, while LRCLIB search results for the same song are around 186-188 seconds. Exact LRCLIB lookup with the reported Apple Music duration fails; search by artist/title finds synced candidates. This means a plain "add Apple Music profile" implementation is incomplete.

## Live Evidence

Captured with:

```bash
npm run inspect:mpris
busctl --user list | rg 'org\.mpris\.MediaPlayer2|chrom|firefox|brave|spotify'
```

Environment:

```text
Timestamp: 2026-05-27T03:36:37.098Z
GNOME Shell: GNOME Shell 46.0
Installed LyricBar: 0.1.6
Browser identity: Chrome
Apple Music player bus: org.mpris.MediaPlayer2.chromium.instance100256
Spotify Desktop bus: org.mpris.MediaPlayer2.spotify
```

Visible MPRIS players:

```text
org.mpris.MediaPlayer2.chromium.instance100256  chrome
org.mpris.MediaPlayer2.spotify                  spotify
```

Apple Music Web through Chrome:

```text
Identity=Chrome
PlaybackStatus=Playing
xesam:title=Radioactive
xesam:artist=Imagine Dragons
xesam:album=Night Visions (Deluxe)
mpris:length=1172197022 microseconds
durationMs=1172197
positionMs=901600, 902102, 902606, 903109, 903612
mpris:trackid=/org/chromium/MediaPlayer2/TrackList/TrackAD881F63680FE0B3A97734DAC2ED7F63
xesam:url=
```

Paused Spotify Desktop:

```text
PlaybackStatus=Paused
xesam:title=I'll Be Missing You
xesam:artist=Diddy
xesam:url=https://open.spotify.com/track/25tsnA5lDP4UctAQOoa8Ks
```

LyricBar selected Apple Music correctly:

```text
stable-snapshot-decision adapter="browser" profile="chromium-browser" title="Radioactive"
active-player-selected busName="org.mpris.MediaPlayer2.chromium.instance100256" playbackStatus="Playing" title="Radioactive"
lookup-start busName="org.mpris.MediaPlayer2.chromium.instance100256" title="Radioactive"
indicator-render text="Imagine Dragons - Radioactive" visible=true
```

## Provider Evidence

Exact LRCLIB lookup using Apple Music's reported duration failed:

```text
GET /api/get
artist_name=Imagine Dragons
track_name=Radioactive
album_name=Night Visions (Deluxe)
duration=1172

HTTP 404
```

LRCLIB search by artist/title returned synced candidates:

```text
GET /api/search
artist_name=Imagine Dragons
track_name=Radioactive

HTTP 200
candidate durations: 186, 187, 188, 201, ...
syncedLyrics: present
```

Conclusion: Apple Music browser metadata is good enough to identify the track, but the reported duration is not trustworthy enough for exact provider matching or cache identity without sanity checks.

## Current Implementation State

Current profile IDs:

```text
spotify-desktop
spotify-web
youtube-music-web
chromium-browser
firefox-browser
generic-mpris
```

Current browser service setting values:

```text
auto
spotify
youtube-music
generic
```

Current Apple Music behavior:

- Apple Music Web maps to `chromium-browser`.
- It uses the shared browser stability policy.
- It can be selected over paused Spotify when Chrome reports `Playing`.
- It does not have an Apple Music-specific profile, preference option, fixture set, diagnostics, or release wording.
- Its exact LRCLIB lookup can fail because browser-reported duration is not reliable.

## Key Findings

### MPRIS Does Not Identify Apple Music

The root MPRIS identity is only:

```text
Identity=Chrome
```

The inspected metadata did not include:

```text
xesam:url=https://music.apple.com/...
```

The track ID was a generic Chromium object path:

```text
/org/chromium/MediaPlayer2/TrackList/Track...
```

So LyricBar should not auto-detect Apple Music from the current MPRIS fields. Apple Music support should start as explicit user selection through the browser service preference.

### Title And Artist Are Usable

Apple Music exposed:

```text
title=Radioactive
artist=Imagine Dragons
album=Night Visions (Deluxe)
```

This is enough for fallback display, basic provider search, diagnostics, and stable user-facing behavior.

### Duration Is Not Trustworthy

Apple Music exposed:

```text
durationMs=1172197
```

That is about 19.5 minutes for a normal Radioactive track. This appears to be browser/app metadata drift, playlist/session duration, or a web app media-session bug. Regardless of root cause, LyricBar should not use this value blindly for Apple Music exact lookup or cache identity.

### Repeated Lookup Needs Instrumentation

Logs showed repeated `lookup-start` for the same visible Apple Music track. `LyricsService` should suppress duplicate lookups when the identity key is stable, so repeated lookups imply one of the identity fields is changing across browser snapshots.

Likely candidates:

- duration
- album
- browser metadata churn around stabilization
- cache read errors causing no durable hit

Before implementing provider fixes, add debug evidence for the generated track identity key or changed identity fields. Do not guess.

### Inspection Script Has A Separate String Parsing Bug

The inspector printed Spotify's double-quoted title as blank:

```text
xesam:title=<"I'll Be Missing You">
Normalized snapshot title=
```

Runtime code handled browser single-quoted strings correctly, but the diagnostic script needs to parse both single-quoted and double-quoted GVariant strings. This affects support quality because diagnostics are our first-line user evidence.

## Recommended Architecture

Apple Music support should be profile-driven, not scraper-driven.

Do:

- Use MPRIS only.
- Add an explicit Apple Music browser profile.
- Add a user preference value for Apple Music.
- Keep browser track IDs ignored for identity.
- Treat browser duration as lower confidence for Apple Music.
- Reuse the existing browser stability reducer.

Do not:

- scrape browser tabs
- use Apple private APIs
- infer Apple Music from every Chromium music-like track
- add a magic fallback that affects Spotify Web or YouTube Music
- trust `mpris:length` from Apple Music without a sanity policy

## Proposed Implementation Plan

### Phase 1: Fix Diagnostics First

Fix `scripts/inspect-mpris.mjs` so it reports GVariant strings rendered with either single quotes or double quotes.

Acceptance:

- `<"I'll Be Missing You">` normalizes to `I'll Be Missing You`.
- `<'Radioactive'>` still normalizes to `Radioactive`.
- `npm run inspect:mpris` reports browser and Spotify titles correctly.

Why first: all Apple Music work depends on reliable evidence.

### Phase 2: Add Apple Music Fixtures

Add fixtures under:

```text
tests/fixtures/mpris/
```

Recommended fixtures:

```text
apple-music-web-chromium-normal.json
apple-music-web-chromium-bogus-duration.json
apple-music-web-chromium-empty-metadata.json
apple-music-web-chromium-title-only.json
apple-music-web-chromium-stopped.json
```

The first two should be based on the live capture:

```json
{
  "busName": "org.mpris.MediaPlayer2.chromium.instance100256",
  "identity": "Chrome",
  "playbackStatus": "Playing",
  "title": "Radioactive",
  "artist": "Imagine Dragons",
  "album": "Night Visions (Deluxe)",
  "durationMs": 1172197,
  "trackId": "/org/chromium/MediaPlayer2/TrackList/TrackAD881F63680FE0B3A97734DAC2ED7F63"
}
```

Acceptance:

- Fixture normalizes to the expected browser snapshot.
- Browser track ID does not become a lyrics identity key input.
- Bogus duration is preserved at raw snapshot level but can be sanitized at query/identity policy level.

### Phase 3: Add Apple Music Browser Profile

Add:

```text
apple-music-web
```

Initial policy:

```text
BROWSER_POLICY
```

Files likely affected:

- `src/domain/mpris/profile.js`
- `src/domain/mpris/profile-policy.js`
- profile tests
- policy tests

Acceptance:

- `PLAYER_PROFILES.appleMusicWeb.id === 'apple-music-web'`
- `policyForPlayerProfile(PLAYER_PROFILES.appleMusicWeb)` uses the shared browser policy.
- Auto mode does not classify generic Chromium as Apple Music without evidence.

### Phase 4: Add Browser Service Preference

Extend:

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
- settings tests
- diagnostics output

Preference label:

```text
Apple Music
```

Default should remain:

```text
auto
```

Acceptance:

- `normalizeBrowserPlayerService('apple-music')` returns `apple-music`.
- Preferences exposes Apple Music.
- Copy diagnostics includes `apple-music` when selected.
- Invalid values still normalize to `auto`.

### Phase 5: Map Explicit Apple Music To Profile

When the user chooses:

```text
browser-player-service=apple-music
```

music-like Chromium/Firefox metadata should map to:

```text
apple-music-web
```

Do not infer Apple Music in `auto` mode unless future MPRIS evidence gives a stable Apple-specific signal.

Acceptance:

- Chromium playing music-like metadata maps to `apple-music-web` when configured.
- Firefox playing music-like metadata maps to `apple-music-web` when configured.
- `generic` keeps the browser-family profile.
- `auto` stays `chromium-browser` or `firefox-browser` for the current observed Apple Music evidence.
- Advertisement, stopped, and incomplete metadata do not map to Apple Music.

### Phase 6: Add Apple Music Duration Policy

Introduce a profile-aware lyrics query policy before provider lookup.

Recommended first rule:

- For `apple-music-web`, ignore browser duration when it is implausible for a normal song.
- A conservative threshold can start at `durationMs > 15 * 60 * 1000`.
- If ignored, exact LRCLIB lookup should omit duration or provider fallback should search by artist/title/album without the bad duration.

Better long-term shape:

```text
PlayerSnapshot -> LyricsQueryInput -> profile-aware query policy -> LyricsQuery
```

This avoids baking Apple Music behavior into LRCLIB itself.

Acceptance:

- Apple Music `Radioactive` with `durationMs=1172197` does not perform an exact lookup using `duration=1172`.
- Search fallback can select a synced LRCLIB candidate by artist/title.
- Spotify Desktop exact lookup behavior is unchanged.
- Spotify Web and YouTube Music behavior is unchanged unless their own profile policies opt in later.

### Phase 7: Stabilize Browser Identity And Cache Behavior

Current track identity includes duration:

```text
busName | trackId | artist | title | album | duration
```

For browser profiles, track ID is already ignored. Apple Music should also ignore or sanitize implausible browser duration in identity keys. Otherwise repeated duration churn can retrigger lookups and produce multiple negative cache entries.

Acceptance:

- Repeated Apple Music snapshots for the same visible title/artist do not retrigger lookup if only implausible duration changes.
- Low-confidence Apple Music misses are not cached.
- Positive Apple Music results remain cacheable.
- Cache keys do not include a bogus 1172-second duration for Apple Music.

### Phase 8: Runtime Evidence

Manual scenarios:

- Apple Music Web starts after LyricBar is enabled.
- Apple Music Web is already playing when LyricBar starts.
- Spotify Desktop is paused while Apple Music Web is playing.
- Track change updates fallback text and lookup once.
- Pause/resume does not leak timers.
- Browser tab close clears the active player or falls back correctly.
- `Browser player service: Apple Music` maps to `apple-music-web`.
- `Browser player service: Auto` stays generic browser unless strong evidence is added.

Evidence to record:

- `npm run inspect:mpris`
- `journalctl --user -b` filtered LyricBar logs
- preference value
- player list
- selected bus name
- title/artist/album/duration
- lookup count per track
- provider result

## Tests To Add

Profile tests:

- configured Apple Music maps Chromium to `apple-music-web`
- configured Apple Music maps Firefox to `apple-music-web`
- auto mode does not infer Apple Music from plain Chrome identity
- stopped metadata does not classify as Apple Music
- title-only metadata does not classify as Apple Music

Settings tests:

- `apple-music` normalizes as valid
- schema description includes Apple Music
- preferences dropdown includes Apple Music

Lyrics query tests:

- Apple Music bogus duration is ignored or sanitized
- normal desktop duration is preserved
- query fallback can still search by artist/title

Identity tests:

- Apple Music browser track ID is ignored
- Apple Music implausible duration does not destabilize identity
- repeated same-track snapshots suppress duplicate lookup

Cache-policy tests:

- low-confidence Apple Music browser misses are not cached
- high-confidence positives are cached
- Spotify Desktop cache behavior is unchanged

Diagnostics tests:

- inspector parses single-quoted GVariant strings
- inspector parses double-quoted GVariant strings

## Release And Docs

After implementation, update:

- README feature list
- `docs/product.md`
- `docs/troubleshooting.md`
- `docs/privacy.md` only if the implementation changes data handling
- release notes

Suggested release note:

```text
Added explicit Apple Music Web support for browser MPRIS players. Apple Music can be selected in Browser player service, with safer browser-duration handling for lyric lookup.
```

## Risks

### Wrong Auto Detection

Current MPRIS evidence does not identify `music.apple.com`. Auto-detecting Apple Music from any Chrome music metadata would break Spotify Web, YouTube Music, and generic browser players.

Mitigation: make Apple Music explicit first.

### Bad Duration Breaks Lyrics

Apple Music Web can report an implausible duration. Exact provider lookup and cache identity should not trust it.

Mitigation: add profile-aware duration sanitation before lookup and identity generation.

### Repeated Network Requests

Repeated browser snapshots for the same visible track triggered repeated lookup attempts in the live logs.

Mitigation: instrument identity changes, sanitize unstable fields, and add tests for duplicate suppression.

### Provider Ambiguity

LRCLIB search can return many versions of the same song. Picking the wrong synced candidate is possible when duration is removed.

Mitigation: rank candidates by artist/title exactness first, then album similarity, then plausible duration if available. Do not blindly pick the first result without tests.

## Conclusion

Apple Music browser support should be added, but the implementation should not stop at a profile enum. The live evidence shows the browser player path works and Apple Music is selectable, while lyric lookup quality is blocked by unreliable browser duration and insufficient Apple Music-specific query policy.

Recommended first implementation:

1. Fix diagnostics string parsing.
2. Add Apple Music MPRIS fixtures.
3. Add explicit `apple-music-web` profile and preference value.
4. Add profile-aware query and identity sanitation for implausible Apple Music browser duration.
5. Verify duplicate lookup suppression and live Apple Music playback.

This keeps the architecture clean: MPRIS remains the only player integration surface, Apple Music behavior is isolated behind profile policy, and shared browser behavior stays safe for Spotify Web and YouTube Music.
