# Plan: LRCLIB Search Fallback and Error Cache Policy

Date: 2026-10-18  
Owner: achmad  
Status: completed  
Risk class: low  
Related issue/PR: N/A

## Objective

Ensure tracks with synced lyrics available on LRCLIB (such as _Ghea Indrawari - Melangitkanmu_) are successfully found, matched, and displayed in LyricBar by:

1. Preventing transient network / HTTP errors (e.g. 503 Server Overloaded) from poisoning the lyrics cache with a 6-hour negative TTL.
2. Adopting Limusic's robust title sanitization logic (stripping pipe `|` suffixes and all bracketed expressions `()`, `[]`, `【】`, `（）`) to clean release decorations and YouTube video metadata.
3. Implementing multi-tier search fallback: structured field search (`track_name` & `artist_name`) followed by duration-gated free-text search (`q="{title} {artist}"`, then `q="{title}"`).
4. Broadening the duration matching tolerance to ±5.0s (5000ms) with distance-based scoring to accommodate slight lead-in/lead-out differences between release cuts.

## Constraints

- Architectural constraints:
  - Pure logic under `src/domain/lyrics/` must remain platform-free (no GJS, GLib, Gio, Soup, D-Bus, or UI imports).
  - Shell runtime code in `src/runtime/lyrics/` must clean up lifecycle cancellables and timeouts.
  - Do not scrape private player state; preserve MPRIS-over-D-Bus.
- User constraints:
  - Do not automatically install or update the extension in `~/.local/share/gnome-shell/extensions/`; confirm with the user first.
  - Scope all changes to `gnome-lyricbar`.
- Performance & Safety:
  - Free-text fallback search must only execute when the track duration is known and positive (`durationMs > 0`), guarding against false-positive lyric associations on generic titles.
  - Never cache results with `kind === 'error'`.

## Acceptance Criteria

1. `shouldWriteLyricsCache` returns `false` for any `LyricsProviderResult` with `kind === 'error'`, preventing transient server errors (like 503) from being cached.
2. Title sanitization strips content after `|` and all brackets (`()`, `[]`, `【】`, `（）`) regardless of position.
3. `buildLrclibQuerySearchUrl` constructs valid URL-encoded free-text search queries (`/api/search?q=...`).
4. `LrclibProvider` tries structured field search first; if no synced lyrics are found and track duration is known, it tries free-text search queries.
5. `scoreSearchResult` tolerates up to ±5000ms duration difference, scoring candidates closer in duration higher.
6. `scoreSearchResult` matches candidate tracks when the candidate's `artistName` matches or when the candidate's sanitized title contains the query artist.
7. `npm run verify` passes completely.
8. Poisoned 503 cache files in `~/.cache/lyricbar/cache-v1/` are cleaned up.

## Implementation Checklist

- [x] Write execution plan in `docs/exec-plans/active/2026-10-18_lrclib-search-fallback-and-cache-policy.md`.
- [x] Update `src/domain/lyrics/cache-policy.js` so `shouldWriteLyricsCache` rejects `result.kind === 'error'`.
- [x] Add unit tests in `tests/lyrics/cache-policy.test.js` and `tests/lyrics/service.test.js`.
- [x] Add `sanitizeSearchTitle` in `src/domain/lyrics/normalize.js` and test in `tests/lyrics/normalize.test.js`.
- [x] Update `src/domain/lyrics/provider-result.js` to use `sanitizeSearchTitle`, ±5000ms duration gate, and artist-in-title matching.
- [x] Add unit tests in `tests/lyrics/provider-result.test.js`.
- [x] Update `src/runtime/lyrics/url.js` to export `buildLrclibQuerySearchUrl` and `buildLrclibFreeTextQueries`.
- [x] Add unit tests in `tests/lyrics/url.test.js`.
- [x] Update `src/runtime/lyrics/lrclib.js` to execute multi-tier free-text search fallback when field search yields no synced result and duration is known.
- [x] Clean poisoned 503 cache files in `~/.cache/lyricbar/cache-v1/`.
- [x] Run `npm run verify` and record evidence.
- [x] Report completion to user and request approval before installing.
- [x] Install extension bundle to `~/.local/share/gnome-shell/extensions/` and compile gschemas.

## Decision Log

- 2026-10-18: Error results (`kind: 'error'`) must never be cached. Transient 503 / 500 / timeout errors should fail silently for the current playback and be retried upon next track change, instead of locking out lyrics for 6 hours.
- 2026-10-18: Free-text search fallback must be gated on known duration (`durationMs > 0`) with a ±5s tolerance window, matching Limusic's proven approach to prevent mismatched lyrics.
- 2026-10-18: Title sanitization strips pipe `|` suffixes and all brackets (`()`, `[]`, `【】`, `（）`) regardless of position, adopting Limusic's `search_title` behavior.

## Verification

```bash
npm run verify
```

Result:

```text
2026-10-18 — npm run verify passed (exit code 0):
- verify:docs, validate:metadata, validate:schema ok
- check:architecture ok (domain stays platform-free)
- format:check, lint, typecheck ok
- vitest: 38 test files, 430 tests passed
- build:extension built zip at dist/lyricbar@fikrilal.github.io.zip
- validate:bundle verified metadata matches
```

## Completion Notes

Merged as PR #16 and released as v0.1.15 on 2026-10-24. An independent review reproduced the full suite (38 files, 432 tests), validated the tier chain against live LRCLIB, and confirmed the error-cache fix against a real HTTP 503; README and the compatibility matrix were updated to record the GNOME Shell 51 evidence, and a newly published fast-uri advisory was patched separately.
