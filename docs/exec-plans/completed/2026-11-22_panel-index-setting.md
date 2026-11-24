# Plan: Configurable Panel Index Setting

Date: 2026-11-22  
Owner: fikrilal  
Status: completed  
Risk class: low  
Related issue/PR: #17

## Objective

Allow users to configure the indicator's 0-based order (`panel-index`) within the selected GNOME top-bar box (`left`, `center`, `right`), so placing LyricBar in the `left` box at index `1` positions it after the Activities button instead of hardcoding index `0`.

## Constraints

- Architectural constraints:
  - Pure logic under `src/domain/settings/` must not import GNOME Shell, GJS, D-Bus, filesystem, network, or UI APIs.
  - Runtime indicator repositioning must cleanly destroy and re-mount the indicator through the existing lifecycle registry.
- Product/runtime constraints:
  - Default `panel-index` must remain `0` to preserve existing behavior for current users.
  - Clamp `panel-index` to integer range `[-1, 20]` (`0` = first slot, `1..20` = 0-based index, `-1` = append to end of panel box).
- Out of scope:
  - Changing the separate settings shortcut indicator's placement (`right`, index `0`).

## Acceptance Criteria

1. `schemas/org.gnome.shell.extensions.lyricbar.gschema.xml` defines `panel-index` (`type="i"`, default `0`, range `-1..20`) and compiles cleanly with `glib-compile-schemas`.
2. `normalizePanelIndex` rounds finite numbers, clamps them to `[-1, 20]`, and falls back to `0` for non-finite inputs; `normalizeSettings` includes `panelIndex`.
3. `shouldRepositionPanelIndicator` returns `true` when either `panelPosition` or `panelIndex` changes.
4. `SettingsAdapter` reads and subscribes to `changed::panel-index`, and `LyricBarController` passes the normalized `panelIndex` to `Main.panel.addToStatusArea(...)`.
5. `prefs.js` exposes a `Panel index` `Adw.SpinRow` in the `Display` group and includes `Panel index` in `buildDiagnosticsMarkdown`.
6. Verification evidence (`npm run verify`) is recorded before completion.

## Implementation Checklist

- [x] Create execution plan in `docs/exec-plans/active/2026-11-22_panel-index-setting.md`
- [x] Add `panel-index` key to `schemas/org.gnome.shell.extensions.lyricbar.gschema.xml` and `scripts/validate-schema.mjs`
- [x] Update `src/domain/settings/types.js`, `src/domain/settings/normalize.js`, and `src/domain/settings/change.js`
- [x] Update `src/runtime/settings.js` and `src/runtime/controller.js`
- [x] Update `prefs.js` (`Adw.SpinRow` and diagnostics table)
- [x] Update unit tests in `tests/settings/normalize.test.js`, `tests/settings/change.test.js`, `tests/runtime/settings.test.js`, and `tests/display/view-model.test.js`
- [x] Run `npm run verify` and record verification output
- [x] Record follow-up debt (if any)

## Decision Log

- 2026-11-22: Use integer key `panel-index` with default `0` and range `[-1, 20]` -> matches GNOME Shell `Main.panel.addToStatusArea(role, indicator, position, box)` / `Clutter.Actor.insert_child_at_index` semantics while keeping existing default placement unchanged.

## Verification

```bash
npm run verify
```

Result:

```text
2026-11-22 — npm run verify passed (exit code 0):
- verify:docs: Documentation structure is valid.
- validate:metadata: metadata.json is valid.
- validate:schema: GSettings schema is valid.
- check:architecture: Architecture guardrails passed.
- format:check, lint, typecheck: passed.
- vitest: 38 test files, 437 tests passed.
- build:extension & validate:bundle: Built dist/lyricbar@fikrilal.github.io.zip and verified metadata.
```

## Runtime Evidence

Not strictly required for low-risk settings plumbing, but a live check was done before release.

- GNOME Shell version: 50.1 (Ubuntu 26.04.1 LTS)
- Session type: Wayland
- Player: N/A (placement only)
- Scenario(s): installed `dist/lyricbar@fikrilal.github.io.zip` locally, re-logged in, changed `panel-index` from Preferences and confirmed the indicator moves within the selected panel box; extension state `ACTIVE`.
- Artifact path(s): N/A
- Notes: Manual check by the maintainer on 2026-11-23.

## Risks And Mitigations

- Risk: Out-of-range or non-integer GSettings values passed to `addToStatusArea`.
- Mitigation: `normalizePanelIndex` rounds and clamps values to `[-1, 20]` with fallback `0`, and the GSettings schema enforces `<range min="-1" max="20"/>`.

## Completion Notes

Implemented configurable `panel-index` setting (`-1..20`, default `0`) across GSettings schema, domain settings normalization and change detection, runtime `SettingsAdapter` and `LyricBarController`, and `prefs.js` (`Adw.SpinRow` + diagnostics output), with unit tests and full verification passing. Shipped in v0.1.16.

## Follow-Ups

- [x] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md` (none required).
