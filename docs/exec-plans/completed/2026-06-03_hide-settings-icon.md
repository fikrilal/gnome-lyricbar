# Plan: Hide Settings Icon

Date: 2026-06-03  
Owner: Dante  
Status: implemented  
Risk class: medium  
Related issue/PR: https://github.com/fikrilal/gnome-lyricbar/issues/4

## Objective

Add a preference that lets users hide the separate LyricBar settings icon in the GNOME top bar. When the icon is hidden, the visible lyric/fallback text should become clickable and open LyricBar preferences.

## Constraints

- Architectural constraints:
  - Setting must flow through schema, settings normalization, preferences UI, and runtime controller.
  - Runtime behavior should stay idempotent across enable, disable, and setting changes.
  - Shell-specific click behavior stays inside `src/shell`.
- Product/runtime constraints:
  - Default behavior remains unchanged: settings icon visible and lyric text passive.
  - Hiding the icon must not remove all preference access; GNOME Extensions and clickable lyric text remain available.
  - Lyric rendering, MPRIS selection, lyrics lookup, and sync timing must remain unchanged.
- Out of scope:
  - Text styling customization.
  - New top-bar menus.
  - Changing GNOME Extensions preferences access.

## Acceptance Criteria

1. New preference defaults to showing the settings icon.
2. When enabled, the separate settings icon appears and lyric text remains passive.
3. When disabled, the separate settings icon is not mounted and lyric/fallback text opens preferences when clicked.
4. Runtime setting changes mount/unmount the settings icon without logout.
5. Static verification passes before completion.

## Implementation Checklist

- [x] Add `show-settings-icon` to GSettings schema.
- [x] Add normalized setting and settings adapter subscription.
- [x] Add preferences UI switch.
- [x] Add runtime mount/unmount logic for the settings indicator.
- [x] Add clickable lyric action when settings icon is hidden.
- [x] Add focused tests for settings normalization and change handling.
- [x] Run relevant verification.
- [x] Record runtime evidence or note why static verification is sufficient.

## Decision Log

- 2026-06-03: Default to visible settings icon -> avoids changing behavior for existing users.
- 2026-06-03: Make lyric text clickable only when the settings icon is hidden -> keeps the default lyric label passive while preserving a clean-mode path to preferences.

## Verification

```bash
npm run verify
```

Result:

```text
npm run verify
Documentation structure is valid.
metadata.json is valid.
GSettings schema is valid.
Architecture guardrails passed.
All matched files use Prettier code style.
ESLint passed.
Typecheck passed.
Vitest: Test Files 33 passed (33), Tests 357 passed (357)
Built dist/lyricbar@fikrilal.github.io.zip
Bundle metadata matches repo metadata (version-name: 0.1.10).
```

## Runtime Evidence

- GNOME Shell version:
- Session type:
- Player:
- Scenario(s):
- Artifact path(s):
- Notes: Not run. Static tests cover settings normalization/change handling, and full verification covers schema, architecture, typecheck, lint, and bundle validity. Live install should be done before release because this touches GNOME Shell indicator lifecycle.

## Risks And Mitigations

- Risk: Users hide the settings icon and cannot find preferences.
- Mitigation: Visible lyric/fallback text opens preferences in clean mode; GNOME Extensions still exposes preferences.
- Risk: Runtime indicator lifecycle leaks a stale settings indicator.
- Mitigation: Reuse controller-owned destroy function and idempotent mount/unmount checks.

## Completion Notes

Implemented `show-settings-icon` as a default-on setting. When enabled, LyricBar keeps the separate settings indicator and lyric text remains passive. When disabled, the settings indicator is unmounted and the lyric/fallback indicator opens preferences on click.

## Follow-Ups

- [ ] Consider documenting the command-line recovery path: `gnome-extensions prefs lyricbar@fikrilal.github.io`.
