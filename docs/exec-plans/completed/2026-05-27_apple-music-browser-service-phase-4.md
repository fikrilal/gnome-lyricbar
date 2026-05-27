# Plan: Apple Music Browser Service Phase 4

Date: 2026-05-27  
Owner: Dante  
Status: completed  
Risk class: medium  
Related issue/PR: N/A

## Objective

Add `apple-music` as a valid `browser-player-service` setting and expose it in preferences, while keeping runtime classification on the existing browser-family profile until Phase 5 maps the service to `apple-music-web`.

## Constraints

- Architectural constraints:
  - Keep this phase settings/preferences focused.
  - Do not map `browser-player-service=apple-music` to `apple-music-web` yet.
  - Do not change lyrics lookup, cache, identity, or active-player selection behavior.
  - Avoid accidental auto-mode behavior when `apple-music` is selected.
- Product/runtime constraints:
  - Apple Music support remains MPRIS-only.
  - The preferences UI must keep the existing order and direct GSettings synchronization pattern.
- Out of scope:
  - Explicit Apple Music profile mapping.
  - Duration/query/identity sanitation.
  - Runtime evidence collection.

## Acceptance Criteria

1. `normalizeBrowserPlayerService('apple-music')` returns `apple-music`.
2. GSettings schema description includes `apple-music`.
3. Preferences exposes `Apple Music` in the Browser player service dropdown.
4. `browser-player-service=apple-music` keeps browser players on `chromium-browser` or `firefox-browser` until Phase 5.
5. Verification evidence is recorded before completion.

## Implementation Checklist

- [x] Add `apple-music` to settings type and normalization.
- [x] Update GSettings schema description.
- [x] Add `Apple Music` to preferences dropdown.
- [x] Keep Apple Music browser-service classification inert until Phase 5.
- [x] Add focused tests.
- [x] Run relevant verification.
- [x] Record follow-up debt.

## Decision Log

- 2026-05-27: Keep `apple-music` classification inert in Phase 4 -> the user-visible setting can land before Phase 5 without accidentally behaving like `auto`.

## Verification

List exact commands and outcomes.

```bash
npm test -- tests/settings/normalize.test.js tests/runtime/settings.test.js tests/mpris/profile.test.js
npm run validate:schema
npm run format:check
npm run lint
npm run verify:docs
```

Result:

```text
2026-05-27 11:04 Asia/Jakarta

- npm test -- tests/settings/normalize.test.js tests/runtime/settings.test.js tests/mpris/profile.test.js
  - passed: 3 test files, 38 tests
- npm run validate:schema
  - passed
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
- Scenario(s): schema/settings/profile tests
- Artifact path(s): not applicable
- Notes: Preferences runtime opening is deferred; this phase is mechanically covered by schema and unit tests.

## Risks And Mitigations

- Risk: `apple-music` falls through to auto service detection before Phase 5.
- Mitigation: add explicit test that configured `apple-music` remains browser-family classified until mapping is implemented.

## Completion Notes

Added `apple-music` as a valid browser player service setting, updated the GSettings schema description, and exposed `Apple Music` in the preferences dropdown. Added a temporary inert classification branch so `browser-player-service=apple-music` remains on the browser-family profile until Phase 5 maps it to `apple-music-web`.

## Follow-Ups

- [x] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md`.

No new debt from this phase. Explicit Apple Music profile mapping, duration/query policy, and identity/cache sanitation remain covered by `docs/apple-music-browser-support.md`.
