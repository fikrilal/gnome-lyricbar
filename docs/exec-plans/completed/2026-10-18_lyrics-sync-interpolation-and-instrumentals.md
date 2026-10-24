# Plan: Lyrics Sync Interpolation And Instrumental Breaks

Date: 2026-10-18  
Owner: achmad  
Status: completed  
Risk class: medium  
Related issue/PR: N/A

## Objective

Eliminate lyric synchronization lag, jitter, and stuck lines during playback by:

1. Supporting timestamped empty lyric lines in LRC parsing and display state so instrumental interludes clear the active lyrics.
2. Introducing client-side clock interpolation during playback so lyric line transitions occur smoothly in real-time, even when MPRIS players throttle position updates (e.g. every 2–3s) or during the 500ms intervals between D-Bus polls.

## Constraints

- Architectural constraints:
  - Pure logic under `src/domain/display/` and `src/domain/lyrics/` must remain platform-free (no GJS, GLib, Gio, D-Bus, or UI imports).
  - Shell runtime code in `src/runtime/controller.js` must clean up timeouts, sources, and state upon disable via `LifecycleRegistry`.
  - Do not scrape private player state; preserve MPRIS-over-D-Bus.
- Product/runtime constraints:
  - Do not increase D-Bus query traffic (polling stays at 500ms).
  - Rapid local tick (100ms) only re-renders when the selected lyric line actually changes.
  - Seek detection must re-anchor clock base immediately when the user jumps forward or backward.
- Out of scope:
  - Modifying the `limusic` player codebase.
  - Adding new settings schema keys or preferences UI controls.

## Acceptance Criteria

1. Empty timestamped lines in LRC format (e.g. `[01:15.00]`) are preserved and clear the lyric line (falling back to track display or hidden per settings) instead of leaving the preceding line frozen during instrumental breaks.
2. A pure domain clock module (`src/domain/display/sync-clock.js`) calculates interpolated playback positions at monotonic clock resolution during active playback.
3. Stale/throttled position reports from players (where position does not change between consecutive samples while `playbackStatus === 'Playing'`) do not pull the running clock backward.
4. `npm run verify` passes completely (lint, typecheck, tests, architecture guardrails, build).

## Implementation Checklist

- [x] Add `src/domain/display/sync-clock.js` with pure domain clock interpolation logic.
- [x] Add comprehensive unit tests in `tests/display/sync-clock.test.js`.
- [x] Update `src/domain/lyrics/lrc.js` to preserve timestamped lines with empty text.
- [x] Update `src/domain/display/lyrics-state.js` so empty selected lyric lines return `{ kind: 'lyrics', line: '', track }`.
- [x] Update tests in `tests/lyrics/lrc.test.js` and `tests/display/lyrics-state.test.js`.
- [x] Integrate clock interpolation and sub-interval ticking into `src/runtime/controller.js`.
- [x] Fix boundary jitter/oscillation: advance display via synced clock in `#pollSyncedPosition` instead of passing raw position directly.
- [x] Protect interpolated clock against minor backward drift/latency while preserving seek detection.
- [x] Run `npm run verify` and record results.

## Decision Log

- 2026-10-18: Keep D-Bus position poll at 500ms while running a 100ms local tick -> avoids flooding D-Bus while guaranteeing <100ms lyric transition response.
- 2026-10-18: If the player reports the identical raw position between samples while `Playing`, do not reset monotonic base -> accommodates players with throttled media pushes like Limusic (2s throttle).
- 2026-10-18: Empty timestamped lines (`[mm:ss.xx]`) represent lyrics clearance -> standard LRC behavior for instrumentals/interludes.
- 2026-10-18: Eliminate session-fight oscillation at lyric boundary: `#pollSyncedPosition` must advance display using the interpolated clock (`#advanceSyncedLyrics`) rather than passing raw polled position (`effectivePositionMs`). Furthermore, `updateSyncedClock` ignores minor backward drift (`< 1500ms`) during active playback to prevent D-Bus sampling latency from pulling the monotonic clock backward across lyric timestamps.

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
- vitest: 38 test files, 432 tests passed
- build:extension built zip at dist/lyricbar@fikrilal.github.io.zip
- validate:bundle verified metadata matches
```

## Risks And Mitigations

- Risk: High-frequency timeouts causing CPU drain in GNOME Shell.
  - Mitigation: The 100ms timer only executes a fast binary/linear search and mathematical subtraction; if the selected lyric line string is identical to the current line, it returns immediately without DOM/St redraws.
- Risk: Clock drift across long songs.
  - Mitigation: Seek jumps and large drifts (>= 1500ms) re-anchor base position immediately, while continuous playback uses the monotonic hardware clock.

## Completion Notes

Merged as PR #16 and released as v0.1.15 on 2026-10-24. The independent review reproduced the full suite (38 files, 432 tests), checked the clock integration against the existing browser normalization and lyrics offset paths, and confirmed the empty-line fallback behavior through `formatDisplayState`; runtime smoke testing on the maintainer's players remains the post-install check.
