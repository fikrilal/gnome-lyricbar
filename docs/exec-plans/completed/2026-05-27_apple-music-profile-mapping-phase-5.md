# Plan: Apple Music Profile Mapping Phase 5

Date: 2026-05-27  
Owner: Dante  
Status: completed  
Risk class: medium  
Related issue/PR: N/A

## Objective

Map explicit `browser-player-service=apple-music` browser playback to the `apple-music-web` profile when browser metadata is music-like, while keeping auto mode conservative.

## Constraints

- Architectural constraints:
  - Keep this phase limited to profile classification.
  - Do not change lyrics lookup, cache, identity, duration sanitation, or active-player selection policy.
  - Do not auto-detect Apple Music from generic Chromium metadata.
- Product/runtime constraints:
  - Apple Music support remains MPRIS-only.
  - Low-confidence browser metadata must remain on the browser-family profile.
- Out of scope:
  - Apple Music duration/query policy.
  - Apple Music identity/cache sanitation.
  - Runtime evidence collection.

## Acceptance Criteria

1. Chromium music-like metadata maps to `apple-music-web` when `browser-player-service=apple-music`.
2. Firefox music-like metadata maps to `apple-music-web` when `browser-player-service=apple-music`.
3. Auto mode does not infer Apple Music from current Apple Music Chromium fixture evidence.
4. Advertisement, stopped, and incomplete metadata stay on browser-family profiles.
5. Verification evidence is recorded before completion.

## Implementation Checklist

- [x] Map explicit Apple Music service to `apple-music-web`.
- [x] Update profile tests.
- [x] Update Apple Music fixture tests.
- [x] Run relevant verification.
- [x] Record follow-up debt.

## Decision Log

- 2026-05-27: Keep auto mode conservative -> current MPRIS evidence exposes Chrome, not `music.apple.com`.

## Verification

List exact commands and outcomes.

```bash
npm test -- tests/mpris/profile.test.js tests/mpris/apple-music-fixtures.test.js
npm run format:check
npm run lint
npm run verify:docs
```

Result:

```text
2026-05-27 11:08 Asia/Jakarta

- npm test -- tests/mpris/profile.test.js tests/mpris/apple-music-fixtures.test.js
  - passed: 2 test files, 37 tests
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
- Player: not required
- Scenario(s): pure profile classification tests
- Artifact path(s): not applicable
- Notes: Runtime evidence is deferred until the later runtime evidence phase.

## Risks And Mitigations

- Risk: Apple Music service selection accidentally classifies low-confidence browser metadata as Apple Music.
- Mitigation: tests cover advertisement, stopped, and title-only metadata staying browser-family.

## Completion Notes

Mapped explicit `browser-player-service=apple-music` to `apple-music-web` for music-like Chromium and Firefox browser metadata. Auto mode remains conservative, and low-confidence Apple Music fixtures remain on the browser-family profile.

## Follow-Ups

- [x] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md`.

No new debt from this phase. Duration/query policy and identity/cache sanitation remain covered by `docs/apple-music-browser-support.md`.
