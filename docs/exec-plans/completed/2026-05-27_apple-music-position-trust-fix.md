# Plan: Apple Music Position Trust Fix

Date: 2026-05-27  
Owner: Codex  
Status: implemented  
Risk class: medium  
Related issue/PR: N/A

## Objective

Fix Apple Music Web synced lyrics being stuck by separating browser duration trust from synced playback position trust.

## Problem

The current local Apple Music changes treat untrusted Apple Music Web duration as proof that synced lyric timing is unusable. That blocks the sync loop and downgrades synced LRCLIB results to the track-title fallback, so Apple Music can fetch synced lyrics but never advance live lyric lines.

## Constraints

- Do not scrape Apple Music or browser DOM state.
- Keep browser support based on MPRIS metadata and `Position`.
- Keep Apple Music duration out of LRCLIB lookup, identity, and negative-cache decisions.
- Do not make duration trust a prerequisite for synced lyric position selection.

## Acceptance Criteria

1. Apple Music Web still ignores browser `durationMs` for lyrics query and track/cache identity.
2. Apple Music Web synced LRCLIB results start the sync polling loop.
3. Apple Music Web positions are accepted when finite, non-negative, and within provider track-duration tolerance when provider duration is available.
4. Implausibly large Apple Music positions are skipped without disabling future polling.
5. Tests encode the intended product behavior instead of asserting stuck lyrics.
6. `npm run verify` passes.

## Implementation Checklist

- [x] Replace browser-duration-based synced timing rejection with provider-duration position validation.
- [x] Remove dead Apple Music duration threshold policy.
- [x] Stop downgrading synced lookup display state to track fallback solely because timing is untrusted.
- [x] Update unit and fixture tests for Apple Music Web synced polling.
- [x] Run focused tests.
- [x] Run full verification.

## Verification

```bash
npm test -- tests/display/sync-position-policy.test.js tests/display/sync-polling.test.js tests/display/lyrics-state.test.js tests/mpris/apple-music-fixtures.test.js
npm run verify
```

Result:

```text
npm test -- tests/display/sync-position-policy.test.js tests/display/sync-polling.test.js tests/display/lyrics-state.test.js tests/mpris/apple-music-fixtures.test.js
Test Files 4 passed (4)
Tests 43 passed (43)

npm run verify
Documentation structure is valid.
metadata.json is valid.
GSettings schema is valid.
Architecture guardrails passed.
All matched files use Prettier code style.
ESLint passed.
Typecheck passed.
Vitest: Test Files 32 passed (32), Tests 328 passed (328)
Built dist/lyricbar@fikrilal.github.io.zip
Bundle metadata matches repo metadata (version-name: 0.1.7).
```

## Runtime Evidence

Not required for this code-only correction. If installed for desktop testing, inspect logs for:

```text
profile="apple-music-web"
provider-result kind="synced"
sync-loop-start
sync-line-selected
```

## Risk And Mitigation

- Risk: Apple Music browser can expose bad media-session positions.
- Mitigation: validate each position against provider track duration when available and skip only the bad sample instead of disabling the entire sync loop.

## Completion Notes

Implemented the policy split. Apple Music Web still ignores browser duration for lookup, identity, and negative-cache decisions, but synced lyric polling is now allowed and position samples are validated against provider track duration when available. Positions past the final lyric timestamp are allowed so long outros naturally keep the final lyric line selected.
