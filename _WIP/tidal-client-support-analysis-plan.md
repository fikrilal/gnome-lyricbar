# TIDAL Client Support Analysis Plan

Date: 2026-06-05  
Owner: Dante  
Related issue: https://github.com/fikrilal/gnome-lyricbar/issues/5  
Status: draft  
Scope: analysis before implementation

## Objective

Analyze what is required to support TIDAL in LyricBar without committing to runtime behavior before evidence exists.

At minimum, TIDAL support should let LyricBar detect a TIDAL-backed MPRIS player and show the current track fallback. If TIDAL exposes stable title, artist, duration, playback status, and position, synced lyrics should work through the existing LRCLIB lookup and sync flow.

## Current Issue State

Issue #5 is a compatibility request for TIDAL. It currently has:

- client name: TIDAL
- client version: unknown
- distro/version: unknown
- GNOME Shell version: unknown
- session type: unknown
- current behavior: not tested yet
- MPRIS evidence: missing

The issue is correctly labeled `needs-evidence`. No implementation should be started from the issue body alone.

## Relevant Repository Rules

- Player support must use MPRIS over D-Bus only.
- Do not scrape TIDAL, browser tabs, browser DOM, credentials, or private app state.
- Browser player work must follow `docs/harness/browser-player-rnd-workflow.md`.
- Every new player support investigation should create a report under `docs/players/`.
- Runtime changes should be preceded by fixtures and tests when evidence shows new behavior is needed.
- Pure behavior changes belong under `src/domain/`; GJS, D-Bus, network, filesystem, and UI behavior stay outside `src/domain/`.

## Source Documents

- `docs/players/README.md`
- `docs/players/profile-architecture.md`
- `docs/harness/browser-player-rnd-workflow.md`
- `docs/compatibility.md`
- `src/domain/mpris/profile.js`
- `src/domain/mpris/profile-policy.js`
- `src/domain/mpris/stability.js`
- `src/domain/mpris/player-adapter.js`
- `src/domain/lyrics/track-identity.js`
- `src/domain/lyrics/cache-policy.js`
- `src/runtime/lyrics/service.js`
- `src/runtime/lyrics/lrclib.js`

## Analysis Questions

1. Does TIDAL expose an MPRIS player at all?
2. Is the exposed bus name native TIDAL, browser-family, Flatpak/wrapper-specific, or generic?
3. Does the MPRIS metadata include title, artist, album, duration, track ID, URL, and artwork?
4. Is `PlaybackStatus` reliable across playing, paused, stopped, and track changes?
5. Does `Position` advance while playing and reset correctly on track changes/seeks?
6. Does the metadata remain stable enough for lyric lookup and cache identity?
7. Does LRCLIB return synced lyrics for representative TIDAL tracks with exact lookup or search fallback?
8. Does existing generic MPRIS support already handle TIDAL well enough?
9. If not, what exact profile, adapter, policy, or diagnostics change is required?

## Evidence Collection Checklist

Collect evidence from at least one tester while TIDAL is actively playing.

### Environment

- TIDAL client type: native desktop, Flatpak, browser web app, wrapper, or bridge.
- TIDAL client version.
- Browser name/version if web-backed.
- Distro and version.
- GNOME Shell version:

```bash
gnome-shell --version
```

- Session type:

```bash
echo "$XDG_SESSION_TYPE"
```

### MPRIS Discovery

List candidate D-Bus owners:

```bash
busctl --user list | rg 'org\.mpris\.MediaPlayer2|tidal|chrom|chrome|firefox|brave|vivaldi'
```

Run the project inspector:

```bash
npm run inspect:mpris
```

Record:

- bus names
- process identity when visible
- competing desktop/browser players
- `PlaybackStatus`
- title
- artist
- album
- duration
- track ID
- URL if present
- artwork URL if present
- at least five position samples while playing

### Runtime Logs

Enable debug logging if needed, then collect:

```bash
journalctl --user -b --no-pager -n 260 \
  | rg 'LyricBar(:player|:lyrics| active-player-selected| indicator-render| sync-line-selected)'
```

Record:

- stable snapshot decisions
- selected active player
- lookup start events
- cache hit/miss/write events
- provider results
- rendered panel text
- repeated lookup patterns

### Settings State

Use the installed schema directory when required:

```bash
SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io/schemas"
GSETTINGS_SCHEMA_DIR="$SCHEMA_DIR" \
  gsettings get org.gnome.shell.extensions.lyricbar browser-player-service
GSETTINGS_SCHEMA_DIR="$SCHEMA_DIR" \
  gsettings get org.gnome.shell.extensions.lyricbar player-priority
GSETTINGS_SCHEMA_DIR="$SCHEMA_DIR" \
  gsettings get org.gnome.shell.extensions.lyricbar debug-logging
```

### Provider Lookup

For the currently playing TIDAL track, run exact LRCLIB lookup:

```bash
curl -fsSLG 'https://lrclib.net/api/get' \
  --data-urlencode 'artist_name=<artist>' \
  --data-urlencode 'track_name=<title>' \
  --data-urlencode 'album_name=<album>' \
  --data-urlencode 'duration=<duration-seconds>'
```

Then run search fallback:

```bash
curl -fsSLG 'https://lrclib.net/api/search' \
  --data-urlencode 'artist_name=<artist>' \
  --data-urlencode 'track_name=<title>'
```

Record:

- exact lookup status
- search status
- whether synced candidates exist
- candidate title/artist/album differences
- candidate durations

## Required Report Artifact

Create:

```text
docs/players/tidal.md
```

Minimum sections:

- Summary
- Live Evidence
- Provider Evidence
- Current Implementation State
- Key Findings
- Recommended Architecture
- Proposed Implementation Plan
- Tests And Fixtures
- Risks
- Conclusion

Also update:

- `docs/players/README.md`
- `docs/README.md`
- `docs/compatibility.md` if the evidence changes support status

## Fixture Plan

Fixture names depend on the runtime found.

If native desktop:

```text
tests/fixtures/mpris/tidal-desktop-normal.json
tests/fixtures/mpris/tidal-desktop-empty-metadata.json
tests/fixtures/mpris/tidal-desktop-title-only.json
tests/fixtures/mpris/tidal-desktop-stopped.json
```

If browser-backed Chromium:

```text
tests/fixtures/mpris/tidal-web-chromium-normal.json
tests/fixtures/mpris/tidal-web-chromium-empty-metadata.json
tests/fixtures/mpris/tidal-web-chromium-title-only.json
tests/fixtures/mpris/tidal-web-chromium-stopped.json
```

If browser-backed Firefox:

```text
tests/fixtures/mpris/tidal-web-firefox-normal.json
tests/fixtures/mpris/tidal-web-firefox-empty-metadata.json
tests/fixtures/mpris/tidal-web-firefox-title-only.json
tests/fixtures/mpris/tidal-web-firefox-stopped.json
```

Add extra fixtures if evidence shows bad duration, stale status, position drift, advertisement metadata, or title/artist formatting issues.

## Implementation Decision Matrix

### No Code Needed

Choose this if TIDAL already works through generic MPRIS or existing browser profiles.

Expected work:

- add `docs/players/tidal.md`
- update player docs indexes
- update compatibility status to smoke tested or supported only if evidence is strong enough

Verification:

```bash
npm run verify:docs
```

### New Native Profile

Choose this if TIDAL exposes a stable native bus name and needs explicit classification.

Likely files:

- `src/domain/mpris/profile.js`
- `src/domain/mpris/profile-policy.js`
- `tests/mpris/profile.test.js`
- `tests/mpris/profile-policy.test.js`
- `docs/players/tidal.md`
- `docs/compatibility.md`

Default policy should probably match generic or desktop behavior unless evidence shows churn.

### New Browser-Service Profile

Choose this if TIDAL Web needs service-specific behavior beyond current browser-family handling.

Likely files:

- `src/domain/mpris/profile.js`
- `src/domain/mpris/profile-policy.js`
- `src/domain/mpris/player-adapter.js`
- `src/domain/settings/types.js`
- `src/domain/settings/normalize.js`
- `src/runtime/settings.js`
- `prefs.js`
- `schemas/org.gnome.shell.extensions.lyricbar.gschema.xml`
- relevant tests under `tests/mpris/`, `tests/settings/`, and `tests/runtime/`

Be conservative. Do not add a `browser-player-service` enum value for TIDAL unless the evidence shows users need to disambiguate it from other browser media.

### Metadata Adapter

Choose this if TIDAL exposes title/artist in a combined or decorated shape.

Likely files:

- `src/domain/mpris/player-adapter.js`
- `tests/mpris/player-adapter.test.js`
- fixtures under `tests/fixtures/mpris/`

Examples that would justify an adapter:

- title is `Song - Artist`
- title contains `- TIDAL`
- artist is missing but extractable from title

### Duration, Identity, Query, Or Cache Policy

Choose this only if evidence shows TIDAL-specific instability:

- duration changes for the same visible track
- track ID churns for the same visible track
- repeated lookup happens for one visible song
- negative cache is poisoned by transient metadata
- LRCLIB exact lookup fails but search fallback succeeds because album/duration is unreliable

Likely files:

- `src/domain/lyrics/duration-policy.js`
- `src/domain/lyrics/track-identity.js`
- `src/domain/lyrics/query-policy.js`
- `src/domain/lyrics/cache-policy.js`
- matching tests under `tests/lyrics/`

## Proposed Execution Phases

### Phase 1: Evidence Report

Goal:

- gather TIDAL MPRIS, runtime, settings, and provider evidence
- create `docs/players/tidal.md`
- update docs indexes

Acceptance:

- report includes exact environment and runtime data
- report states whether current implementation already works
- report proposes fixtures before code changes

Verification:

```bash
npm run verify:docs
```

### Phase 2: Fixtures And Pure Tests

Goal:

- encode observed TIDAL metadata shapes as fixtures
- add profile/adapter/policy tests only for behavior proven by evidence

Acceptance:

- failing tests demonstrate the current gap
- tests avoid GNOME/GJS runtime dependencies

Verification:

```bash
npm test
npm run check:architecture
```

### Phase 3: Minimal Runtime-Affecting Change

Goal:

- implement the smallest profile, adapter, or policy change required by the fixtures

Acceptance:

- existing Spotify, YouTube Music, Apple Music, Firefox, and generic MPRIS tests remain green
- no controller-specific app branching unless there is no domain-level alternative
- async/lifecycle behavior remains unchanged unless explicitly required

Verification:

```bash
npm run verify
```

### Phase 4: Runtime Evidence

Goal:

- prove behavior inside the extension runtime with TIDAL

Acceptance:

- extension detects the intended player
- active-player selection is correct
- fallback track display works
- synced lyrics work if LRCLIB returns synced results
- pause, resume, seek, track change, and quit do not produce stale UI or repeated bad lookups

Evidence:

- logs
- inspector output
- screenshots if useful
- notes added to `docs/players/tidal.md`

## Risks

- TIDAL may not expose MPRIS on Linux depending on client packaging.
- TIDAL desktop, web, Flatpak, wrappers, and bridges may expose different bus names and metadata shapes.
- Browser-backed TIDAL may be indistinguishable from other browser media without URL evidence.
- LRCLIB coverage for TIDAL tracks may vary; missing provider results should not be mistaken for client incompatibility.
- Adding a settings enum for TIDAL too early would increase UI/API surface without evidence.

## Initial Recommendation

Do not implement TIDAL support yet.

Start with `docs/players/tidal.md` and live evidence from at least one actual TIDAL runtime. If generic MPRIS already handles it, document the support level rather than adding code. If a gap exists, add fixtures first and implement the smallest profile or adapter change needed.

## Live Evidence Captured

Date: 2026-06-05  
Tester machine: `fikrilal-Legion-5-Pro-16ACH6`  
GNOME Shell: 46.0  
Session type: X11  
Claimed active client: TIDAL playing in Google Chrome  
Chrome process: `/opt/google/chrome/chrome`  
LyricBar version: 0.1.11  
LyricBar state: enabled and active

### MPRIS Owners

Observed owners:

```text
org.mpris.MediaPlayer2.chromium.instance11414
org.mpris.MediaPlayer2.spotify
```

No native TIDAL MPRIS bus was observed. TIDAL appears to be exposed through Chrome's browser MPRIS integration in this session.

### Current Chrome Snapshot

Bus name:

```text
org.mpris.MediaPlayer2.chromium.instance11414
```

Root identity:

```text
Identity=Chrome
```

Normalized snapshot:

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

The MPRIS snapshot had complete title, artist, album, duration, playback status, and advancing position. It did not expose a service URL, so LyricBar cannot distinguish TIDAL Web from other Chrome media through URL evidence.

### Competing Player

Spotify Desktop was also present:

```text
busName=org.mpris.MediaPlayer2.spotify
title=ECHO
artist=STARSET
album=DIVISIONS
playbackStatus=Paused
positionMs=210513
```

LyricBar correctly selected the playing Chrome player over paused Spotify, even though `player-priority` is `['spotify']`.

### Settings

```text
browser-player-service='auto'
player-priority=['spotify']
debug-logging=true
```

### Runtime Behavior

LyricBar logs show:

- Chrome snapshots classified as `chromium-browser`.
- Browser metadata held briefly by the existing debounce policy.
- Stable snapshots accepted after the debounce window.
- Active player selected as `org.mpris.MediaPlayer2.chromium.instance11414`.
- Track fallback rendered while lookup/cache resolved.
- Synced lyrics rendered after cache/provider result.
- Sync loop started and lyric lines advanced with raw MPRIS position.

Representative events:

```text
stable-snapshot-decision adapter="browser" profile="chromium-browser" decision="held"
stable-snapshot-decision adapter="browser" profile="chromium-browser" decision="accepted"
active-player-selected busName="org.mpris.MediaPlayer2.chromium.instance11414" playbackStatus="Playing"
lookup-start busName="org.mpris.MediaPlayer2.chromium.instance11414" title="Stressed Out"
cache-hit kind="synced"
sync-loop-start intervalMs=500 title="Stressed Out"
sync-line-selected rawPositionMs=<advancing>
```

There was also an earlier provider lookup for `We Are Young (feat. Janelle Monáe)` that returned synced lyrics and wrote cache successfully.

### LRCLIB Provider Check

Exact lookup for the current observed track:

```text
artist=twenty one pilots
title=Stressed Out
album=Blurryface
duration=202
```

Result:

```text
id=1357
name=Stressed Out
artistName=Twenty One Pilots
albumName=Blurryface
duration=202
syncedLyrics=true
plainLyrics=true
instrumental=false
```

Search fallback also returned synced candidates, including duration-compatible results.

### Initial Finding From This Session

For TIDAL Web in Google Chrome, the current generic Chromium browser path appears to work:

- player discovery works
- active-player selection works
- metadata is complete for the sampled track
- position advances
- LRCLIB lookup works
- lyric sync works in the panel

This does not justify a TIDAL-specific runtime profile yet. The current evidence supports documenting TIDAL Web on Chrome as smoke tested, not adding code.

### Remaining Evidence Needed

Before claiming full support:

- one pause/resume sample
- one seek sample
- one explicit track-change sample from TIDAL
- confirmation that the playing Chrome tab was TIDAL Web, since MPRIS did not expose a TIDAL URL
- TIDAL Desktop, Flatpak, wrapper, or bridge evidence if those clients are in scope
- a negative/fallback track where LRCLIB has no synced result, to confirm graceful fallback

### Updated Recommendation

Do not add code from this evidence alone.

Next best step is documentation and fixtures:

1. Create `docs/players/tidal.md` as a TIDAL support report.
2. Mark this exact runtime as TIDAL Web via Chrome, smoke tested.
3. Add fixtures for the observed Chrome metadata shape only if we want regression coverage for the documentation claim.
4. Defer a TIDAL-specific profile, settings enum, adapter, or cache policy until evidence shows a behavior that generic Chromium handling cannot cover.

## Phase 2 Runtime Evidence Captured

Date: 2026-06-05  
Browser bus: `org.mpris.MediaPlayer2.chromium.instance4608`  
Scope: TIDAL Web through Chrome MPRIS, same GNOME Shell 46/X11 environment.

### Baseline

Observed track:

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

Position advanced normally:

```text
162733
163237
163739
164242
164744
```

LRCLIB exact lookup for `fun. / Carry On / Some Nights / 278s` returned synced lyrics.

### Pause And Resume

MPRIS pause via `gdbus` succeeded. Logs showed `PlaybackStatus=Paused`, stable snapshot accepted, active-player refresh, and the visible lyric line retained. Playback then returned to `Playing`; LyricBar refreshed the active player without a new lyric lookup.

### Seek

MPRIS seek via `gdbus` succeeded. Chrome/TIDAL did not apply the full requested offset, but exposed position moved backward from about `189239ms` to `182895ms`. LyricBar selected the earlier matching lyric line and continued advancing.

### Track Change

MPRIS next via `gdbus` succeeded. Chrome first emitted a stopped/empty transition:

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

LyricBar briefly retained `Carry On`, hit synced cache, restarted the sync loop at position `0`, and rendered the first line of the previous track.

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

LyricBar accepted `Heathens`, hit synced cache, restarted the sync loop, and rendered correct lyrics. Final position samples advanced normally.

### Phase 2 Conclusion

Pause/resume, seek, and track-change recovery work through Chrome MPRIS. The notable gap is generic browser transition behavior: stopped/empty metadata can briefly retain and restart stale previous-track lyrics before the next real track arrives.

This still does not justify a TIDAL-specific profile. The next implementation-oriented step should be fixtures for the stopped/empty browser transition, then a domain-level stability decision if the product owner wants to eliminate stale lyric retention in this case.

## Phase 3 Fixtures Captured

Date: 2026-06-05  
Status: complete

Added fixtures:

```text
tests/fixtures/mpris/tidal-web-chromium-normal.json
tests/fixtures/mpris/tidal-web-chromium-track-transition-empty-stopped.json
tests/fixtures/mpris/tidal-web-chromium-next-normal.json
```

Added test file:

```text
tests/mpris/tidal-fixtures.test.js
```

The tests cover:

- mapping the observed TIDAL Web Chrome MPRIS snapshots into expected `PlayerSnapshot` values
- keeping TIDAL Web Chrome on the generic `chromium-browser` profile in auto mode
- monotonic position samples during normal playback
- identity changes based on song metadata even when Chromium reuses the same generic track ID
- skipped `not-found` cache writes for the stopped/empty transition
- allowed `not-found` cache writes for high-confidence normal browser metadata
- current browser stability behavior that retains the previous stable track on stopped/empty metadata
- acceptance of the recovered next track after the debounce window

Verification:

```bash
npx vitest run tests/mpris/tidal-fixtures.test.js
```

Result: 1 test file passed, 10 tests passed.

Phase 3 does not change runtime behavior. It preserves the observed behavior and gives Phase 4 a concrete failing/passing target if we decide to change generic browser stopped/empty transition handling.
