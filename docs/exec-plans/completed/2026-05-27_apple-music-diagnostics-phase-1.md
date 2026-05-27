# Plan: Apple Music Diagnostics Phase 1

Date: 2026-05-27  
Owner: Dante  
Status: completed  
Risk class: low  
Related issue/PR: N/A

## Objective

Fix the MPRIS inspection diagnostics used by Apple Music browser R&D so GVariant strings rendered with either single quotes or double quotes are reported correctly.

## Constraints

- Architectural constraints:
  - Keep the change diagnostic-only.
  - Do not change runtime player selection, lyrics lookup, cache, or identity behavior in this phase.
  - Keep parsing logic testable outside GNOME Shell.
- Product/runtime constraints:
  - The inspector remains a Node.js CLI script.
  - Apple Music browser support continues to use MPRIS only; no browser scraping or private app state.
- Out of scope:
  - `apple-music-web` profile.
  - `browser-player-service=apple-music`.
  - Apple Music duration/query/identity policy.
  - Runtime evidence collection beyond optional local inspector output.

## Acceptance Criteria

1. `scripts/inspect-mpris.mjs` reports double-quoted GVariant strings such as `<"I'll Be Missing You">`.
2. Existing single-quoted GVariant string parsing such as `<'Radioactive'>` still works.
3. Targeted tests cover both string renderings.
4. Verification evidence is recorded before completion.

## Implementation Checklist

- [x] Extract string-property parsing into a small tested helper.
- [x] Update `scripts/inspect-mpris.mjs` to use the helper.
- [x] Add diagnostic parser tests.
- [x] Run relevant verification.
- [x] Record follow-up debt.

## Decision Log

- 2026-05-27: Scope this as diagnostic-only -> later Apple Music behavior depends on reliable evidence, but runtime policy changes belong to later phases.

## Verification

List exact commands and outcomes.

```bash
npm test -- tests/scripts/gdbus-output.test.js
npm run lint
npm run verify:docs
```

Result:

```text
2026-05-27 10:51 Asia/Jakarta

- npm test -- tests/scripts/gdbus-output.test.js
  - passed: 1 test file, 4 tests
- npm run format:check
  - passed
- npm run lint
  - passed
- npm run verify:docs
  - passed
- npm run inspect:mpris
  - passed
  - observed normalized double-quoted title: `title=I'll Be Missing You`
```

## Runtime Evidence

Required when the change is medium/high-risk and behavior cannot be proven sufficiently by static checks alone.

- GNOME Shell version: not required for this low-risk parser change
- Session type: not required
- Player: not required
- Scenario(s): optional `npm run inspect:mpris` after implementation
- Artifact path(s): command output in agent session
- Notes: Unit tests cover the parser; live inspector output also confirmed the double-quoted Spotify title now appears in the normalized snapshot.

## Risks And Mitigations

- Risk: ad hoc regex changes can regress single-quoted gdbus output.
- Mitigation: cover single-quoted and double-quoted forms in tests.

## Completion Notes

Added `scripts/lib/gdbus-output.mjs` with tested string-property parsing for single-quoted and double-quoted GVariant output. Updated `scripts/inspect-mpris.mjs` to use the helper. Added `tests/scripts/gdbus-output.test.js`.

## Follow-Ups

- [x] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md`.

No new debt from this phase. Later Apple Music profile, fixtures, duration policy, and identity/cache work remain covered by `docs/apple-music-browser-support.md`.
