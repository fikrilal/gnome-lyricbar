# Plan: Apple Music Duration Policy Phase 6

Date: 2026-05-27  
Owner: Dante  
Status: completed  
Risk class: medium  
Related issue/PR: N/A

## Objective

Add profile-aware lyrics query sanitation so Apple Music Web ignores implausible browser-reported durations before cache lookup and LRCLIB exact lookup.

## Constraints

- Architectural constraints:
  - Keep duration policy in pure domain logic.
  - Do not bake Apple Music behavior into the LRCLIB provider adapter.
  - Do not change active-player selection or browser profile detection.
  - Do not change track identity behavior in this phase; identity/cache stabilization is Phase 7.
- Product/runtime constraints:
  - Apple Music support remains MPRIS-only.
  - Spotify Desktop exact lookup behavior must remain unchanged.
  - Spotify Web and YouTube Music behavior must remain unchanged unless their profile policy opts in later.
- Out of scope:
  - Ranking LRCLIB search candidates beyond current behavior.
  - Track identity sanitation.
  - Cache write policy changes.

## Acceptance Criteria

1. Apple Music Web with `durationMs > 15 * 60 * 1000` builds a lyrics query with `durationMs: null`.
2. Apple Music `Radioactive` fixture duration `1172197ms` does not reach cache/provider query as `1172s`.
3. Plausible Apple Music durations are preserved.
4. Spotify Desktop duration query behavior is unchanged.
5. Verification evidence is recorded before completion.

## Implementation Checklist

- [x] Add pure lyrics query policy.
- [x] Wire `LyricsService` to use the policy.
- [x] Add focused unit tests.
- [x] Run relevant verification.
- [x] Record follow-up debt.

## Decision Log

- 2026-05-27: Use a conservative 15-minute threshold for Apple Music Web -> the live bad duration was about 19.5 minutes for a normal track, and the policy should avoid broad impact.

## Verification

List exact commands and outcomes.

```bash
npm test -- tests/lyrics/query-policy.test.js tests/lyrics/service.test.js
npm run format:check
npm run lint
npm run verify:docs
```

Result:

```text
2026-05-27 11:13 Asia/Jakarta

- npm test -- tests/lyrics/query-policy.test.js tests/lyrics/service.test.js
  - passed: 2 test files, 19 tests
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
- Scenario(s): query-policy and service tests
- Artifact path(s): not applicable
- Notes: Runtime evidence is deferred until the later Apple Music runtime evidence phase.

## Risks And Mitigations

- Risk: duration sanitation affects non-Apple browser services.
- Mitigation: policy only applies when profile detection resolves to `apple-music-web`.

## Completion Notes

Added `src/domain/lyrics/query-policy.js` and wired `LyricsService` through it. Explicit Apple Music Web lookups now omit implausible durations greater than 15 minutes before cache/provider lookup. Plausible Apple Music durations and Spotify Desktop durations remain unchanged.

## Follow-Ups

- [x] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md`.

No new debt from this phase. Track identity and cache-policy sanitation remain covered by Phase 7 in `docs/apple-music-browser-support.md`.
