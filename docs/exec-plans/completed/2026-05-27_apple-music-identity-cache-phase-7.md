# Plan: Apple Music Identity Cache Phase 7

Date: 2026-05-27  
Owner: Dante  
Status: completed  
Risk class: medium  
Related issue/PR: N/A

## Objective

Stabilize Apple Music Web identity and negative cache behavior so implausible browser-reported duration does not retrigger repeated lookups or poison not-found cache entries.

## Constraints

- Architectural constraints:
  - Keep policy in pure domain modules.
  - Do not change MPRIS runtime discovery or active-player selection.
  - Do not change LRCLIB provider internals.
  - Preserve Spotify Desktop identity and cache behavior.
- Product/runtime constraints:
  - Apple Music support remains MPRIS-only.
  - Positive Apple Music lyric results must remain cacheable.
- Out of scope:
  - LRCLIB search ranking improvements.
  - Runtime evidence collection.

## Acceptance Criteria

1. Apple Music Web snapshots for the same visible track do not change identity when only an implausible duration changes.
2. Plausible Apple Music Web duration remains part of identity.
3. Apple Music Web not-found results with implausible duration are not cached.
4. Positive Apple Music Web results remain cacheable.
5. Verification evidence is recorded before completion.

## Implementation Checklist

- [x] Share Apple Music duration policy between query, identity, and cache policy.
- [x] Sanitize implausible Apple Music duration in track identity.
- [x] Block not-found cache writes for implausible Apple Music duration.
- [x] Add focused tests.
- [x] Run relevant verification.
- [x] Record follow-up debt.

## Decision Log

- 2026-05-27: Share the Apple Music duration rule -> avoids query, identity, and cache policy drifting.

## Verification

List exact commands and outcomes.

```bash
npm test -- tests/lyrics/query-policy.test.js tests/lyrics/track-identity.test.js tests/lyrics/cache-policy.test.js tests/lyrics/service.test.js tests/mpris/apple-music-fixtures.test.js
npm run format:check
npm run lint
npm run verify:docs
```

Result:

```text
2026-05-27 11:18 Asia/Jakarta

- npm test -- tests/lyrics/query-policy.test.js tests/lyrics/track-identity.test.js tests/lyrics/cache-policy.test.js tests/lyrics/service.test.js tests/mpris/apple-music-fixtures.test.js
  - passed: 5 test files, 74 tests
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
- Scenario(s): pure policy and service tests
- Artifact path(s): not applicable
- Notes: Runtime evidence is deferred until the later Apple Music runtime evidence phase.

## Risks And Mitigations

- Risk: Apple Music duration policy accidentally changes Spotify or other browser services.
- Mitigation: tests cover Spotify Desktop and non-Apple browser behavior staying unchanged.

## Completion Notes

Shared the Apple Music implausible-duration threshold across query, identity, and cache policy. Apple Music Web identity now ignores implausible duration values, and not-found cache writes are blocked for Apple Music Web snapshots with implausible duration. Positive results remain cacheable.

## Follow-Ups

- [x] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md`.

No new debt from this phase. LRCLIB search ranking and runtime evidence remain covered by `docs/apple-music-browser-support.md`.
