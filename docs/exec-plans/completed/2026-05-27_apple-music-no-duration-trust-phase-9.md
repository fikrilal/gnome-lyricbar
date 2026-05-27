# Plan: Apple Music No Duration Trust Phase 9

Date: 2026-05-27  
Owner: Codex  
Status: installed; awaiting fresh Shell runtime  
Risk class: medium  
Related issue/PR: N/A

## Objective

Stop Apple Music Web browser duration churn from causing repeated lyric lookups, cache misses, rejected LRCLIB search candidates, and stale display behavior.

## Constraints

- Architectural constraints: duration trust decisions stay in pure domain logic under `src/domain/`.
- Product/runtime constraints: use MPRIS only; do not scrape Apple Music or browser internals.
- Out of scope: recovering accurate synced playback position when Chrome reports bogus Apple Music media-session timing.

## Acceptance Criteria

1. Explicit `apple-music-web` ignores browser duration for track identity and lyric lookup query.
2. Apple Music Web not-found results are not cached from browser metadata.
3. Apple Music Web synced position polling is disabled until a reliable timing signal exists.
4. LRCLIB search fallback can accept same artist/title candidates when Apple Music browser duration is absent.
5. Verification, install, and live inspection evidence are recorded.

## Implementation Checklist

- [x] Add no-trust Apple Music duration policy.
- [x] Wire policy into query, identity, cache, and synced position decisions.
- [x] Update unit and fixture tests.
- [x] Run relevant verification.
- [x] Install bundle to desktop.
- [x] Inspect live MPRIS/log behavior.

## Decision Log

- 2026-05-27: Ignore all Apple Music Web browser duration values -> live evidence showed the same visible track changing from 733887ms to 773825ms, still below the old 15-minute cutoff.
- 2026-05-27: Disable Apple Music Web synced position polling -> duration and position both appear to be from browser/media-session state rather than the actual song.

## Verification

```bash
npm test
npm run verify
gnome-extensions install --force dist/lyricbar@fikrilal.github.io.zip
npm run inspect:mpris
```

Result:

```text
Targeted tests passed:
npm test -- tests/lyrics/query-policy.test.js tests/lyrics/track-identity.test.js tests/lyrics/cache-policy.test.js tests/lyrics/service.test.js tests/lyrics/provider-result.test.js tests/display/sync-position-policy.test.js tests/display/sync-polling.test.js tests/mpris/apple-music-fixtures.test.js
Test Files 8 passed (8)
Tests 105 passed (105)

Full verification passed after fixing lint/typecheck/format issues:
npm run verify
Documentation structure is valid.
metadata.json is valid.
GSettings schema is valid.
Architecture guardrails passed.
All matched files use Prettier code style.
Vitest: Test Files 32 passed (32), Tests 328 passed (328)
Built dist/lyricbar@fikrilal.github.io.zip
Bundle metadata matches repo metadata (version-name: 0.1.7).

Installed:
gnome-extensions install --force dist/lyricbar@fikrilal.github.io.zip
gnome-extensions disable lyricbar@fikrilal.github.io
gnome-extensions enable lyricbar@fikrilal.github.io

Installed file check passed:
~/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io/src/domain/lyrics/duration-policy.js contains shouldIgnoreAppleMusicDuration().

Live inspection after extension toggle still showed old module behavior in the same GNOME Shell process:
cache-write kind="not-found" for apple-music-web and repeated lookup-start events continued.
Conclusion: installed files are correct, but live runtime verification requires a fresh GNOME Shell session.
```

## Runtime Evidence

- GNOME Shell version: GNOME Shell 46.0
- Session type: user desktop session
- Player: Apple Music Web through Chrome
- Scenario(s): "Radioactive" by Imagine Dragons, then "Thunder (Live in Vegas)" by Imagine Dragons
- Artifact path(s): `npm run inspect:mpris`, journal output in conversation
- Notes: Current live evidence before fix showed repeated lookup-start events every ~10 seconds and changing browser duration for the same visible track. Post-install inspection in the same Shell process still showed old module behavior, so a logout/login is required before runtime verification can prove the new policy.

## Risks And Mitigations

- Risk: Apple Music Web loses exact duration matching and live synced-line timing.
- Mitigation: restrict the no-duration policy to explicit Apple Music Web; LRCLIB search fallback still returns synced candidates by artist/title, and the display falls back without using bogus timing.

## Completion Notes

Implemented and installed phase 9. Static verification passed and installed files contain the new no-duration-trust policy. Runtime verification is not complete because GNOME Shell continued running old imported modules after extension disable/enable.

## Follow-Ups

- [ ] Re-inspect after logout/login to confirm Apple Music Web stops repeated same-track lookups.
