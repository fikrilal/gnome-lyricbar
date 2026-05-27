# Plan: Apple Music Profile Phase 3

Date: 2026-05-27  
Owner: Dante  
Status: completed  
Risk class: low  
Related issue/PR: N/A

## Objective

Add the first-class `apple-music-web` browser profile and map it to the shared browser metadata-stability policy, without changing browser-service settings or runtime classification behavior yet.

## Constraints

- Architectural constraints:
  - Keep this phase profile/policy-only.
  - Do not add `browser-player-service=apple-music` in this phase.
  - Do not classify Apple Music automatically from generic Chromium metadata.
  - Do not change lyrics lookup, cache, identity, or runtime selection behavior.
- Product/runtime constraints:
  - Apple Music support remains MPRIS-only.
  - Browser metadata remains browser-family classified until explicit preference support is added in later phases.
- Out of scope:
  - Settings schema and preferences UI.
  - Explicit Apple Music browser-service mapping.
  - Duration/query/identity sanitation.

## Acceptance Criteria

1. `PLAYER_PROFILES.appleMusicWeb.id === 'apple-music-web'`.
2. `apple-music-web` has `sourceKind: 'browser'`.
3. `policyForPlayerProfile(PLAYER_PROFILES.appleMusicWeb)` uses the shared browser policy.
4. Auto mode does not classify current Apple Music Chromium fixtures as Apple Music.
5. Verification evidence is recorded before completion.

## Implementation Checklist

- [x] Add `apple-music-web` profile.
- [x] Add browser policy mapping for `apple-music-web`.
- [x] Add focused tests.
- [x] Run relevant verification.
- [x] Record follow-up debt.

## Decision Log

- 2026-05-27: Keep settings and explicit mapping out of Phase 3 -> profile presence can land independently and later phases can wire user-visible behavior.

## Verification

List exact commands and outcomes.

```bash
npm test -- tests/mpris/profile.test.js tests/mpris/profile-policy.test.js tests/mpris/apple-music-fixtures.test.js
npm run format:check
npm run lint
npm run verify:docs
```

Result:

```text
2026-05-27 11:00 Asia/Jakarta

- npm test -- tests/mpris/profile.test.js tests/mpris/profile-policy.test.js tests/mpris/apple-music-fixtures.test.js
  - passed: 3 test files, 41 tests
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
- Scenario(s): pure profile/policy tests
- Artifact path(s): not applicable
- Notes: No runtime behavior changed in this phase.

## Risks And Mitigations

- Risk: adding the profile could accidentally imply automatic Apple Music classification.
- Mitigation: tests assert current Apple Music Chromium fixtures remain `chromium-browser` in auto mode.

## Completion Notes

Added `PLAYER_PROFILES.appleMusicWeb` with `id: 'apple-music-web'` and `sourceKind: 'browser'`. Mapped the profile to the shared browser policy. Added tests for profile shape, policy coverage, and current auto-mode behavior staying on `chromium-browser` for Apple Music Chromium fixtures.

## Follow-Ups

- [x] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md`.

No new debt from this phase. Settings, explicit Apple Music mapping, duration policy, and identity/cache sanitation remain covered by `docs/apple-music-browser-support.md`.
