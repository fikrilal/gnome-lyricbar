# Plan: Preferences UI

Date: 2026-05-24  
Owner: Antigravity  
Status: active  
Risk class: medium  
Related issue/PR: N/A  
Parent plan: `docs/exec-plans/active/2026-05-23_end-to-end-product-implementation.md` (Phase 14)

## Objective

Expose all v1 schema settings through the GNOME extension preferences UI (`prefs.js`) using native GTK4 and Libadwaita widgets. Ensure settings are bound dynamically and cleanly.

## Constraints

- Architectural constraints:
  - All UI elements must stay under `prefs.js`.
  - Must not leak GSettings listeners or connections.
  - Follow the GJS guidelines for Libadwaita in GNOME 46.
- Product/runtime constraints:
  - Supports GNOME Shell 46 (Ubuntu 24.04).
  - Uses standard Libadwaita `Adw.PreferencesPage`, `Adw.PreferencesGroup`, `Adw.ComboRow`, `Adw.SpinRow`, `Adw.EntryRow`, and `Adw.SwitchRow`.
- Out of scope:
  - Diagnostics page or diagnostic logging viewer in this phase (belongs to Phase 15).
  - Telemetry options.

## Acceptance Criteria

1. `prefs.js` opens successfully through `gnome-extensions prefs lyricbar@fikrilal.github.io`.
2. All settings from GSchema are exposed:
   - `panel-position`: `Adw.ComboRow` with Left, Center, Right choices.
   - `max-width`: `Adw.SpinRow` with range 120-720.
   - `fallback-mode`: `Adw.ComboRow` with Show track title, Show static idle text, Hide indicator.
   - `player-priority`: `Adw.EntryRow` displaying/editing comma-separated values, updated on apply.
   - `cache-enabled`: `Adw.SwitchRow`.
   - `debug-logging`: `Adw.SwitchRow`.
3. Bidirectional data sync:
   - Modifying a setting in the preferences window updates GSettings instantly.
   - Modifying GSettings externally updates the preferences window if open.
4. Clean build: `npm run verify` passes.
5. Verification evidence is recorded before completion.

## Implementation Checklist

- [x] Housekeeping: Move completed sub-plans (Phases 10, 11, 12) to `docs/exec-plans/completed/`.
- [x] Housekeeping: Update status of Phase 10-13 to complete in `docs/exec-plans/active/2026-05-23_end-to-end-product-implementation.md`.
- [x] Modify `prefs.js` to implement:
  - [x] `panel-position` ComboRow and bidirectional settings sync.
  - [x] `fallback-mode` ComboRow and bidirectional settings sync.
  - [x] `player-priority` EntryRow with `show_apply_button: true` and bidirectional settings sync.
  - [x] `cache-enabled` SwitchRow bound directly.
  - [x] `debug-logging` SwitchRow bound directly.
- [x] Run verification gate: `npm run verify`.
- [ ] Capture manual runtime evidence:
  - [ ] Open prefs window.
  - [ ] Check options against current GSettings.
  - [ ] Modify settings and verify dconf updates via `gsettings get`.
  - [ ] Modify settings via `gsettings set` and verify UI updates.

## Decision Log

- 2026-05-24: Manual synchronization for ComboRows -> avoids GSettings type mismatches since `Adw.ComboRow` has integer selection index while GSettings has string enums.
- 2026-05-24: Use `Adw.EntryRow` with `show_apply_button: true` for `player-priority` -> prevents thrashing settings on every key stroke and updates GSettings cleanly when user applies changes.

## Verification

List exact commands and outcomes.

```bash
npm run verify
```

Result:

```text
2026-05-24 17:49 — npm run verify passed
- verify:docs ok
- validate:metadata ok
- validate:schema ok
- check:architecture ok (connect/disconnect matches tracked cleanup rule)
- format:check ok
- lint ok
- typecheck ok
- vitest: 21 test files, 181 tests passed
- build:extension: dist/lyricbar@fikrilal.github.io.zip
```

## Runtime Evidence

Required to prove that settings map correctly.

- GNOME Shell version: GNOME Shell 46.0
- Session type: X11 / Wayland
- Player: Spotify Desktop / Mock MPRIS
- Scenario(s):
  - [ ] Preferences window opens without error.
  - [ ] Changing panel position updates GSettings and repositions indicator instantly.
  - [ ] EntryRow correctly splits comma-separated string array and saves.
- Artifact path(s): pending
- Notes: Manual runtime evidence is deferred to the owner in their live desktop environment.

## Risks And Mitigations

- Risk: Libadwaita changes/APIs are slightly different across GNOME versions.
  - Mitigation: Target GNOME 46 API specifically (standard on Ubuntu 24.04). Keep widgets simple and use widely supported properties like `show-apply-button`.
- Risk: Memory leaks from settings connection listeners.
  - Mitigation: GSettings connections will clean up when the prefs process exits, but we can structure connections cleanly.

## Completion Notes

Implemented all GSettings controls in `prefs.js` using `Adw.ComboRow`, `Adw.SpinRow`, `Adw.EntryRow`, and `Adw.SwitchRow`. Added connection tracking to clean up listeners on preferences window destroy to prevent warnings and leaks. Moved completed sub-plans for Phases 10-12 to `docs/exec-plans/completed/`.

## Follow-Ups

- [ ] Add unresolved debt to `docs/exec-plans/tech-debt-tracker.md`.
