# Browser Player R&D Workflow

## Purpose

This workflow is mandatory for agents investigating browser music-player support, including Spotify Web, YouTube Music, Apple Music Web, and future browser-backed services.

Browser players are noisy. MPRIS usually exposes the browser identity, not the web app. A shallow inspection can easily produce the wrong conclusion. Agents must collect enough evidence to separate these concerns:

- player discovery
- service identity
- metadata stability
- active-player selection
- lyrics lookup behavior
- cache and identity behavior
- runtime UI behavior

Do not implement or write a final support report after only checking `busctl`, `playerctl`, or one `npm run inspect:mpris` output.

## Required Output

Every browser-player R&D task must produce or update one Markdown report under `docs/`:

```text
docs/spotify-web-support-improvements.md
docs/youtube-music-browser-support.md
docs/apple-music-browser-support.md
```

For a new service, create:

```text
docs/<service>-browser-support.md
```

The report must include:

- exact date
- GNOME Shell version
- browser and service tested
- MPRIS bus names
- raw metadata summary
- normalized snapshot summary
- position samples
- selected LyricBar active player
- provider lookup result
- cache/identity findings
- risks
- implementation phases
- tests and fixtures to add

## Minimum Evidence Checklist

An agent must collect all of the following before making an architectural claim.

### 1. Repository Context

Read the current implementation:

```bash
sed -n '1,260p' src/domain/mpris/profile.js
sed -n '1,220p' src/domain/mpris/profile-policy.js
sed -n '1,260p' src/domain/mpris/stability.js
sed -n '1,260p' src/domain/lyrics/track-identity.js
sed -n '1,260p' src/domain/lyrics/cache-policy.js
sed -n '1,260p' src/runtime/lyrics/service.js
sed -n '1,260p' src/runtime/lyrics/lrclib.js
```

Read the nearest existing support report:

```bash
sed -n '1,260p' docs/spotify-web-support-improvements.md
sed -n '1,260p' docs/youtube-music-browser-support.md
sed -n '1,260p' docs/apple-music-browser-support.md
```

If the nearest report is stale, replace it with current evidence instead of appending guesses.

### 2. Live MPRIS Discovery

List MPRIS owners:

```bash
busctl --user list | rg 'org\.mpris\.MediaPlayer2|chrom|firefox|brave|spotify'
```

Run the project inspector:

```bash
npm run inspect:mpris
```

Record:

- browser bus name
- browser process identity
- competing desktop players
- `PlaybackStatus`
- title, artist, album
- duration
- track ID
- URL if present
- artwork URL if present
- five position samples

If no browser MPRIS player appears, report that as the finding. Do not invent service support from browser UI state.

### 3. LyricBar Runtime Logs

Collect recent logs:

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

If LyricBar selects the wrong player, diagnose selection and stale state before provider behavior.

### 4. Settings State

Use the installed schema directory when needed:

```bash
SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io/schemas"
GSETTINGS_SCHEMA_DIR="$SCHEMA_DIR" \
  gsettings get org.gnome.shell.extensions.lyricbar browser-player-service
GSETTINGS_SCHEMA_DIR="$SCHEMA_DIR" \
  gsettings get org.gnome.shell.extensions.lyricbar player-priority
GSETTINGS_SCHEMA_DIR="$SCHEMA_DIR" \
  gsettings get org.gnome.shell.extensions.lyricbar debug-logging
```

Record the values in the report. If `gsettings` fails without `GSETTINGS_SCHEMA_DIR`, that is expected for local extensions and should not be treated as missing settings support.

### 5. Provider Lookup Check

Use LRCLIB directly for the currently playing track.

Exact lookup:

```bash
curl -fsSLG 'https://lrclib.net/api/get' \
  --data-urlencode 'artist_name=<artist>' \
  --data-urlencode 'track_name=<title>' \
  --data-urlencode 'album_name=<album>' \
  --data-urlencode 'duration=<duration-seconds>'
```

Search fallback:

```bash
curl -fsSLG 'https://lrclib.net/api/search' \
  --data-urlencode 'artist_name=<artist>' \
  --data-urlencode 'track_name=<title>'
```

Record:

- exact lookup status
- search status
- whether synced candidates exist
- candidate durations
- candidate album/title differences

Do not conclude "lyrics unavailable" until search fallback has been checked.

### 6. Identity And Cache Analysis

Inspect whether repeated lookups are caused by identity churn.

Check current identity inputs:

```text
busName
trackId
artist
title
album
duration
browser-player-service
```

For browser players, verify whether:

- browser track ID is ignored
- duration is stable
- album is stable
- title/artist are stable
- repeated not-found results are cached or intentionally skipped

If repeated lookup happens for the same visible track, the report must identify the likely changed field or explicitly state that more instrumentation is needed.

### 7. Fixture Plan

Every browser-service report must propose fixtures before runtime changes.

Fixture names should follow:

```text
tests/fixtures/mpris/<service>-web-<browser>-normal.json
tests/fixtures/mpris/<service>-web-<browser>-empty-metadata.json
tests/fixtures/mpris/<service>-web-<browser>-title-only.json
tests/fixtures/mpris/<service>-web-<browser>-stopped.json
```

If the live issue involves a bad duration or stale status, add a fixture for that too:

```text
tests/fixtures/mpris/<service>-web-<browser>-bogus-duration.json
tests/fixtures/mpris/<service>-web-<browser>-stale-status.json
```

### 8. Architecture Recommendation

The recommendation must state whether the service needs:

- new player profile
- new browser-service preference value
- profile-specific metadata adapter
- profile-specific duration policy
- provider lookup policy
- cache policy change
- identity key change
- diagnostics improvement
- runtime selection change

Each recommendation must name the files likely affected.

## Anti-Patterns

These are failures:

- Inspecting only `busctl` and claiming support status.
- Inspecting only `npm run inspect:mpris` and writing a final implementation plan.
- Assuming the browser bus name identifies the web app.
- Treating `Identity=Chrome` as proof of Spotify, YouTube Music, or Apple Music.
- Trusting browser `mpris:length` without checking provider candidates.
- Ignoring paused desktop players when diagnosing active-player selection.
- Writing an implementation before adding fixtures or identifying the unstable metadata field.
- Making auto-detection claims without a service-specific MPRIS signal.
- Using browser scraping, browser tabs, credentials, or private app state.

## Minimum Report Template

```markdown
# <Service> Browser Support Report

Date:
Status:
Scope:

## Summary

## Live Evidence

## Provider Evidence

## Current Implementation State

## Key Findings

## Recommended Architecture

## Proposed Implementation Plan

## Tests And Fixtures

## Risks

## Conclusion
```

## Verification

For report-only work:

```bash
npm run verify:docs
```

For implementation work:

```bash
npm run verify
```

If runtime behavior changes, also follow `docs/harness/runtime-agent-workflow.md` or collect live runtime evidence with the owner's explicit approval.
