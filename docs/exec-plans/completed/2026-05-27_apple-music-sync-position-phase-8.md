# Plan: Apple Music Sync Position Phase 8

Date: 2026-05-27  
Owner: Codex  
Status: completed  
Risk class: medium  
Related issue/PR: N/A

## Objective

Fix Apple Music Web synced-lyrics display when Chromium reports implausible MPRIS duration and position values. The bar should not reset to the first synced line on same-track browser refreshes, and it should avoid selecting lyrics from clearly bogus Apple Music Web positions.

## Constraints

- Architectural constraints: keep pure policy under `src/domain/`; runtime GNOME/GJS code stays under `src/runtime/`.
- Product/runtime constraints: use MPRIS only; do not scrape browser state or Apple Music private state.
- Out of scope: exact Apple Music position recovery when browser MPRIS itself reports bogus positions.

## Acceptance Criteria

1. Same-track synced lookup refreshes do not overwrite an already rendered synced line with the first lyric line.
2. Apple Music Web snapshots with implausible browser timing do not use raw MPRIS position for synced lyric selection.
3. Targeted unit tests cover the new policy and controller/display behavior.
4. Verification evidence is recorded before completion.

## Implementation Checklist

- [x] Add synced-position policy in domain logic.
- [x] Add unit tests for Apple Music Web implausible timing behavior.
- [x] Patch runtime controller refresh/sync behavior.
- [x] Run relevant verification.
- [x] Record follow-up debt.

## Decision Log

- 2026-05-27: Treat implausible Apple Music Web position as unusable for synced lyric selection -> live MPRIS evidence showed normal tracks reporting 30+ minute positions.
- 2026-05-27: Preserve current synced display during same-track refresh -> browser MPRIS emits repeated snapshots for the same track and should not visually reset lyric text.

## Verification

List exact commands and outcomes.

```bash
npm test
npm run verify
```

Result:

```text
Targeted tests passed:
npm test -- tests/display/sync-position-policy.test.js tests/display/sync-polling.test.js tests/display/lyrics-state.test.js tests/mpris/apple-music-fixtures.test.js
Test Files 4 passed (4)
Tests 42 passed (42)

Full verification passed:
npm run verify
Documentation structure is valid.
metadata.json is valid.
GSettings schema is valid.
Architecture guardrails passed.
All matched files use Prettier code style.
Vitest: Test Files 32 passed (32), Tests 326 passed (326)
Built dist/lyricbar@fikrilal.github.io.zip
Bundle metadata matches repo metadata (version-name: 0.1.7).
```

## Runtime Evidence

- GNOME Shell version: GNOME Shell 46.0
- Session type: user desktop session
- Player: Apple Music Web through Chrome, `org.mpris.MediaPlayer2.chromium.instance4621`
- Scenario(s): "Natural" by Imagine Dragons, Chrome reported durationMs=2308029 and positionMs=2034713.
- Artifact path(s): journal output in conversation; `npm run inspect:mpris`
- Notes: Fresh session loaded `profile="apple-music-web"` and LRCLIB returned synced lyrics, but raw MPRIS position was implausible.

## Risks And Mitigations

- Risk: disabling sync position for Apple Music Web may show track fallback rather than live synced lyrics when browser timing is bad.
- Mitigation: restrict the policy to Apple Music Web with implausible timing; leave Spotify Web, YouTube Music, and normal MPRIS players unchanged.

## Completion Notes

Added a domain synced-timing policy and wired it into the runtime controller. Apple Music Web snapshots with implausible browser timing no longer start the synced position polling loop or render a misleading first lyric line; they fall back to track display. Same-track synced refreshes preserve the currently displayed synced lyric when timing is usable, avoiding visual resets caused by repeated browser MPRIS snapshots.

## Follow-Ups

- [x] No unresolved follow-up debt from this phase.
