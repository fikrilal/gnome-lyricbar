# Plan: Apple Music Fixtures Phase 2

Date: 2026-05-27  
Owner: Dante  
Status: completed  
Risk class: low  
Related issue/PR: N/A

## Objective

Add Apple Music Web browser MPRIS fixtures and focused tests so later profile, duration, identity, and cache-policy work has concrete evidence to preserve.

## Constraints

- Architectural constraints:
  - Keep this phase fixture/test-only.
  - Do not add `apple-music-web` profile in this phase.
  - Do not add `browser-player-service=apple-music` in this phase.
  - Do not change runtime lookup, identity, cache, or selection behavior in this phase.
- Product/runtime constraints:
  - Fixtures must represent browser MPRIS state, not browser DOM, tabs, credentials, or private app state.
  - Capture the known Apple Music bogus-duration case from `docs/apple-music-browser-support.md`.
- Out of scope:
  - Diagnostics parser changes already completed in Phase 1.
  - Apple Music profile and settings support.
  - Profile-aware duration sanitation.

## Acceptance Criteria

1. Apple Music Web Chromium fixtures exist for normal, bogus-duration, empty-metadata, title-only, and stopped states.
2. Tests prove the fixtures map to the expected normalized snapshots.
3. Tests document current browser-family behavior before Apple-specific policy is introduced.
4. Verification evidence is recorded before completion.

## Implementation Checklist

- [x] Add Apple Music Chromium MPRIS fixture JSON files.
- [x] Add Apple Music fixture tests.
- [x] Run relevant verification.
- [x] Record follow-up debt.

## Decision Log

- 2026-05-27: Keep Phase 2 profile-free -> fixtures should provide the baseline for later behavior changes rather than mixing evidence with policy changes.

## Verification

List exact commands and outcomes.

```bash
npm test -- tests/mpris/apple-music-fixtures.test.js
npm run format:check
npm run lint
npm run verify:docs
```

Result:

```text
2026-05-27 10:56 Asia/Jakarta

- npm test -- tests/mpris/apple-music-fixtures.test.js
  - passed: 1 test file, 12 tests
- npm run format:check
  - passed
- npm run lint
  - passed
- npm run verify:docs
  - passed
```

## Runtime Evidence

Required when the change is medium/high-risk and behavior cannot be proven sufficiently by static checks alone.

- GNOME Shell version: not required
- Session type: not required
- Player: Apple Music Web fixture data from prior live R&D
- Scenario(s): fixture mapping and current browser behavior tests
- Artifact path(s):
  - tests/fixtures/mpris/apple-music-web-chromium-normal.json
  - tests/fixtures/mpris/apple-music-web-chromium-bogus-duration.json
  - tests/fixtures/mpris/apple-music-web-chromium-empty-metadata.json
  - tests/fixtures/mpris/apple-music-web-chromium-title-only.json
  - tests/fixtures/mpris/apple-music-web-chromium-stopped.json
- Notes: No runtime behavior changed in this phase.

## Risks And Mitigations

- Risk: fixtures accidentally encode desired future behavior instead of observed/current behavior.
- Mitigation: keep future Apple profile and duration sanitation out of Phase 2 assertions.

## Completion Notes

Added Apple Music Web Chromium fixtures for normal playback, bogus-duration playback, empty metadata, title-only metadata, and stopped metadata. Added fixture tests that map the fixtures through current MPRIS normalization and document current browser-family identity/cache behavior before Apple-specific policy is introduced.

## Follow-Ups

- [x] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md`.

No new debt from this phase. Later Apple Music profile, settings, duration policy, and identity/cache policy work remain covered by `docs/apple-music-browser-support.md`.
