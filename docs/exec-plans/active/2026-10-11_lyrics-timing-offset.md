# Plan: User-Adjustable Lyric Timing Offset

Date: 2026-10-11  
Owner: ahmad fikril  
Status: active  
Risk class: medium  
Related issue/PR: [fikrilal/gnome-lyricbar#12](https://github.com/fikrilal/gnome-lyricbar/issues/12)  
Proposal: `docs/engineering/_WIP/2026-10-11_lyrics-timing-offset.md`

## Objective

Add a persisted `lyrics-offset-ms` preference (`-5000..5000`, 50 ms UI step, default `0`) that shifts synced lyric line selection earlier or later. The offset is applied strictly after browser-position normalization and immediately before display state computation; zero offset is exact current behavior.

## Constraints

- Architectural constraints:
  - Pure offset math in `src/domain/display/lyrics-offset.js`; settings normalization in `src/domain/settings/normalize.js`.
  - The offset must never reach track identity, cache keys, provider queries, or browser-normalization gates.
  - No behavior change at offset `0`.
- Product/runtime constraints:
  - Positive values delay the lyrics; negative values show them earlier (schema description, prefs subtitle, and troubleshooting all state this).
  - Adjustments apply within one poll (<=500 ms); setting changes trigger an immediate re-poll while the sync loop is active.
- Out of scope:
  - Per-track offsets, auto-calibration, panel quick-menu access, retiming non-synced fallbacks.

## Acceptance Criteria

1. Existing tests pass; default `0` behavior is unchanged.
2. New unit tests: `normalizeLyricsOffset`, `applyLyricsOffset`, a display-level shift test, adapter read/subscription updates, and the settings-change predicate.
3. The preferences row persists through GSettings, and the diagnostics block includes the value.
4. `npm run verify` passes.
5. Runtime evidence is recorded, or a deferral protocol with owner steps is documented.
6. The diff does not touch track identity, cache, or query surfaces.

## Implementation Checklist

- [x] Add the `lyrics-offset-ms` schema key.
- [x] Wire types, `normalizeLyricsOffset`, and the settings adapter.
- [x] Add the `applyLyricsOffset` domain module.
- [x] Wire the controller (application order + immediate re-poll).
- [x] Add the prefs SpinRow and diagnostics row.
- [x] Add new tests and update existing fixtures.
- [x] Update README and troubleshooting docs.
- [x] Run `npm run verify`.
- [x] Attempt runtime evidence and record the outcome.

## Decision Log

- 2026-10-11: Range `-5000..5000` ms with 50 ms step (confirmed with owner) -> covers practical drift while staying modest.
- 2026-10-11: Offset applied after browser normalization, clamped at 0 -> keeps raw-position gates and the estimator untouched; negative results fall back to the first line via existing behavior.
- 2026-10-11: Add `shouldRefreshSyncedLyrics()` to `src/domain/settings/change.js` for the immediate re-poll -> mirrors existing change-policy modules and stays unit-testable.

## Verification

List exact commands and outcomes.

```bash
npm run verify
```

Result:

```text
2026-10-11 22:19 — npm run verify passed (exit 0). Stage log:
- verify:docs, validate:metadata, check:architecture ok
- validate:schema: GSettings schema is valid (the new key compiles)
- format:check, lint, typecheck ok
- vitest: 37 test files, 406 tests passed (44 across the touched suites)
- build:extension + validate:bundle: Bundle metadata matches repo metadata (version-name: 0.1.13)
```

## Runtime Evidence

Required when the change is medium/high-risk and behavior cannot be proven sufficiently by static checks alone.

Attempt status: Completed at the schema and GJS module level; panel-level visual check deferred (see Notes).

- GNOME Shell version: n/a for the executed level (GLib/GJS on the host used directly).
- Session type: Wayland primary session; no primary-session or live dconf state was touched (isolated keyfile backend with a temporary `XDG_CONFIG_HOME`).
- Player: n/a (module-level evidence); the mock MPRIS player from `docs/harness/nested-runtime-harness.md` does not exist yet.
- Scenario(s):
  - Schema from the built bundle's compiled schema: default `0`; set `-250` persists; out-of-range `9999` rejected with "The provided value is outside of the valid range"; reset returns `0`; `describe` matches the sign convention.
  - Real modules under GJS (晴天 lookup, position 19500 ms): offset `0` -> display 19500 -> line 故事的小黃花; offset `+1000` -> display 20500 -> line 從出生那年就飄著 (later); offset `-1000` -> display 18500 -> still 故事的小黃花; offset `-20000` -> clamped to `0` -> first-line fallback.
- Artifact path(s): evidence scripts were session-scoped scratch files; results are recorded here.
- Notes:
  - Panel-level visual check deferred to the owner: play a synced track, adjust Preferences -> Behavior -> Lyrics offset, and confirm the displayed line shifts within one poll (<=500 ms while playing). The sync loop re-polls immediately on offset changes; changes made while paused apply when playback resumes.

## Risks And Mitigations

- Risk: masking wrong-content matches -> modest range; troubleshooting wording keeps expectations honest.
- Risk: sign confusion -> convention stated in schema, UI subtitle, and docs.
- Risk: zero-offset regression -> tests pin zero behavior; diff review boundary excludes identity/cache/query files.

## Completion Notes

Added the `lyrics-offset-ms` preference end to end: schema key (range `-5000..5000`), domain normalization, settings adapter subscription, `applyLyricsOffset()` applied after browser normalization in the controller (with an immediate re-poll via `shouldRefreshSyncedLyrics`), preferences SpinRow, diagnostics row, README and troubleshooting updates. New tests cover normalization, offset math, display-level line shifts, adapter wiring, and the change predicate; `npm run verify` passes (37 files, 406 tests). Schema behavior was verified at runtime with an isolated keyfile backend against the compiled bundle schema, and module behavior was verified under GJS.

## Follow-Ups

- [x] Link the implementation PR in issue #12 — PR #13 opened 2026-10-11.
- [ ] Promote the `_WIP` proposal into the stable docs tree once stabilized.
- [ ] Record any new debt in `docs/exec-plans/tech-debt-tracker.md`.
