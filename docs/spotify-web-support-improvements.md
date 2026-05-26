# Spotify Web Support Improvements

## Context

LyricBar currently supports Spotify Web through the generic browser MPRIS path. This works for normal playback, but live inspection shows that Chromium does not expose enough Spotify-specific identity to reliably classify the browser player as `spotify-web` with the current heuristic.

The goal is to make Spotify Web support more explicit, more diagnosable, and less prone to stale lyric behavior during browser metadata churn.

## Live Evidence

Observed on `2026-05-25` while Spotify Web was playing in Chromium:

```text
busName=org.mpris.MediaPlayer2.chromium.instance105121
Identity=Chrome
PlaybackStatus=Playing
xesam:title=Mangu
xesam:artist=Fourtwnty, Charita Utami
xesam:album=Nalar
mpris:length=261094444
mpris:trackid=/org/chromium/MediaPlayer2/TrackList/Track6E48368FFCC0639F42096268ED9E4B97
```

Important observations:

- The browser MPRIS bus identifies Chromium, not Spotify.
- Chromium did not expose `xesam:url`.
- Chromium used a generic `mpris:trackid` object path.
- The same generic track ID shape appeared across different songs.
- Position advanced correctly during playback.
- LyricBar successfully fetched synced lyrics and advanced lines.
- LyricBar retained the previous stable track through empty metadata and `Advertisement` snapshots.

## Current Gap

`spotify-web` detection currently depends on strong Spotify evidence in browser metadata, especially a Spotify-shaped track ID. Real Chromium metadata may not include that evidence.

As a result, Spotify Web commonly stays classified as:

```text
chromium-browser
```

This still works through generic browser stabilization, but it prevents Spotify-specific policy tuning.

## Risks

### Browser Track IDs Are Not Reliable

Browser `mpris:trackid` should be treated as an implementation detail. It is useful for change observation, but it should not be trusted as a durable song identity.

Using it too strongly can cause:

- missed track changes
- unnecessary lyric lookups
- stale lookup suppression
- incorrect cache associations if future code starts using track ID in cache keys

### Advertisement Retention Can Show Stale Lyrics

The browser stability reducer currently retains the previous valid track through `Advertisement` metadata. This is good for short browser churn, but during a real ad break it can keep showing stale lyrics for too long.

The desired behavior is time-bounded retention:

- short transition: keep the previous lyric
- confirmed ad: hide lyrics or show configured fallback
- music resumes: accept the new stable track and restart synced lyrics

## Proposed Phase 1: Spotify Web Profile Inference

Commit:

```text
feat(mpris): improve spotify web profile inference
```

Goals:

- Stop depending on browser `trackId` as Spotify Web evidence.
- Add an explicit way to bias browser MPRIS toward Spotify Web.
- Keep the generic browser path for future browser services.

Recommended design:

- Add a setting:

```text
browser-player-service = auto | spotify | generic
```

- Original Spotify-first default:

```text
spotify
```

Rationale: LyricBar is currently Spotify-first, and this matches the primary product promise.

After YouTube Music support, the safer product default is `auto`: use Spotify-specific behavior only when MPRIS carries strong Spotify evidence, otherwise keep browser playback on the generic browser policy.

Classification behavior:

- `spotify`: classify Chromium/Firefox MPRIS as `spotify-web` when metadata looks like music playback.
- `generic`: always use `chromium-browser` or `firefox-browser`.
- `auto`: use strong service evidence when available, otherwise generic browser.

Music-like metadata criteria:

- non-empty title
- non-empty artist
- duration greater than a short threshold
- not an advertisement
- not empty browser metadata

Non-goals:

- Do not scrape browser tabs.
- Do not depend on Spotify DOM or browser automation.
- Do not add YouTube Music or Apple Music behavior in this phase.

## Proposed Phase 2: Browser Track Identity Hardening

Commit:

```text
fix(mpris): ignore unstable browser track ids for identity
```

Goals:

- Avoid over-trusting Chromium/Firefox track IDs.
- Make lookup suppression depend on stable music metadata for browser players.

Recommended behavior:

- For desktop players, keep using track ID as part of identity.
- For browser players, ignore generic browser track IDs when building runtime track identity.
- Prefer:

```text
busName + artist + title + album + duration bucket
```

Acceptance:

- Changing browser songs with reused Chromium track IDs still triggers lookup.
- Playback status changes do not trigger lookup.
- Small position/duration drift does not trigger lookup.
- Desktop Spotify behavior remains unchanged.

## Proposed Phase 3: Time-Bounded Advertisement Retention

Commit:

```text
fix(mpris): bound browser advertisement retention
```

Goals:

- Keep lyrics stable through short browser churn.
- Avoid showing stale lyrics throughout real ad breaks.

Recommended behavior:

- Retain previous valid track for a short grace window.
- If advertisement metadata persists past the grace window, clear the stable snapshot or emit a non-lyric fallback state.
- When valid music metadata returns, debounce and accept it normally.

Suggested defaults:

```text
advertisementRetentionMs = 2000
```

Acceptance:

- Short ad-like metadata bursts do not blank the lyric line.
- Long ad breaks stop showing stale lyric text.
- Music resumes without requiring logout or extension reload.

## Proposed Phase 4: MPRIS Inspection Harness

Commit:

```text
chore(harness): add mpris inspection script
```

Goals:

- Make browser bug reports easier to reproduce.
- Give agents and maintainers a single command for runtime evidence.

Suggested command:

```bash
npm run inspect:mpris
```

Suggested output:

- active MPRIS bus names
- player identity
- raw metadata
- normalized snapshot
- detected profile
- adapter result
- policy result
- position samples over 3-5 seconds
- recent LyricBar logs

Acceptance:

- Works without `playerctl`.
- Uses `gdbus`, because it is more commonly available on GNOME systems.
- Does not require root.
- Does not modify user settings.

## Recommended Order

1. Spotify Web profile inference.
2. Browser track identity hardening.
3. Time-bounded advertisement retention.
4. MPRIS inspection harness.

This order improves correctness first, then user-visible polish, then maintainability.
