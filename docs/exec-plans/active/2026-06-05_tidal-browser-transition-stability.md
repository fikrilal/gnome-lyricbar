# Plan: TIDAL Browser Transition Stability

Date: 2026-06-05

Owner: Dante

Status: superseded by `2026-06-06_tidal-support-reanalysis.md`

Risk class: medium

Related issue/PR: https://github.com/fikrilal/gnome-lyricbar/issues/5

## Objective

Stop LyricBar from briefly restarting stale synced lyrics when Chrome-backed browser playback emits stopped/empty metadata during a TIDAL Web track transition.

This plan is retained as historical context only. The immediate-clear decision below was superseded because it could let an unrelated paused preferred player steal selection during a short browser transition. Current behavior is documented in `2026-06-06_tidal-support-reanalysis.md`: generic browser profiles retain the previous snapshot for a bounded stopped/empty grace period while suppressing raw position reads.

The fix should stay generic to browser MPRIS stability. Current evidence does not justify a TIDAL-specific player profile, setting, or adapter.

## Constraints

- Architectural constraints:
  - Keep the behavior in pure domain logic under `src/domain/mpris/`.
  - Do not add GNOME, GJS, D-Bus, filesystem, network, or UI dependencies to domain logic.
  - Do not branch the controller on TIDAL-specific behavior.
- Product/runtime constraints:
  - Preserve existing browser resilience for short non-stopped empty metadata churn.
  - Superseded: immediate clearing was replaced by bounded retention plus position suppression.
  - Let recovered full metadata enter the existing debounce/acceptance path.
- Out of scope:
  - TIDAL-specific profile or `browser-player-service` option.
  - Browser tab inspection, DOM scraping, URL scraping, credentials, or private app state.
  - Runtime installation/reload unless explicitly requested.

## Acceptance Criteria

1. Superseded: stopped/empty browser metadata is retained briefly and clears only after timeout.
2. Non-stopped empty browser metadata still retains the previous stable snapshot.
3. TIDAL Chrome fixtures document the new stopped/empty transition behavior.
4. Existing browser metadata debounce and recovered-track acceptance behavior remains intact.
5. Verification evidence is recorded before completion.

## Implementation Checklist

- [x] Add or update stability reducer tests for stopped/empty browser metadata.
- [x] Update the TIDAL fixture test to expect cleared state for the stopped/empty transition.
- [x] Implement the smallest reducer change in `src/domain/mpris/stability.js`.
- [x] Update TIDAL docs and `_WIP` plan with Phase 4 outcome.
- [x] Run targeted tests.
- [x] Run `npm run verify`.
- [x] Record verification evidence.

## Decision Log

- 2026-06-05: Do not add a TIDAL profile -> live evidence shows TIDAL Web is exposed as generic Chrome MPRIS with no TIDAL URL evidence.
- 2026-06-05: Clear stopped/empty browser metadata -> Phase 2 showed retaining it restarts stale previous-track lyrics at position `0` during a next-track transition.
- 2026-06-05: Preserve non-stopped empty retention -> existing browser churn handling protects against short metadata blanks while playback remains active.

## Verification

List exact commands and outcomes.

```bash
npx vitest run tests/mpris/stability.test.js tests/mpris/chromium-browser-transition-fixtures.test.js
npm run verify
```

Result:

```text
Targeted:
npx vitest run tests/mpris/stability.test.js tests/mpris/chromium-browser-transition-fixtures.test.js
2 test files passed, 24 tests passed.

Full:
npm run verify
Passed:
- verify:docs
- validate:metadata
- validate:schema
- check:architecture
- format:check
- lint
- typecheck
- vitest: 35 test files, 377 tests passed
- build:extension
- validate:bundle
```

## Runtime Evidence

Required because this changes browser player stability behavior.

- GNOME Shell version: 46.0
- Session type: X11
- Player: TIDAL Web through Google Chrome MPRIS
- Scenario(s):
  - Phase 2 observed stopped/empty transition during `Player.Next`.
  - Chrome later emitted `Heathens` metadata and LyricBar recovered.
- Artifact path(s):
  - `docs/players/tidal.md`
  - `_WIP/tidal-client-support-analysis-plan.md`
  - `tests/fixtures/mpris/chromium-browser-transition-empty-stopped.json`
- Notes: Post-change live runtime re-test is optional unless requested; fixture coverage captures the observed D-Bus state.

## Risks And Mitigations

- Risk: Some browser players may emit stopped/empty metadata for harmless short churn.
  - Mitigation: Only stopped/empty snapshots clear; non-stopped empty snapshots still retain prior stable metadata.
- Risk: Clearing stable state may briefly show fallback/idle during transitions.
  - Mitigation: This is preferable to showing stale synced lyrics from the previous song.
- Risk: Behavior affects all browser profiles, not only TIDAL.
  - Mitigation: The observed state is generic Chrome MPRIS behavior and belongs in the shared browser stability reducer.

## Completion Notes

Superseded. Stopped/empty browser metadata now uses bounded retention plus position suppression, while persistent stopped/empty metadata clears after timeout.

## Follow-Ups

- [ ] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md` if runtime re-test or broader browser fixture coverage remains open.
