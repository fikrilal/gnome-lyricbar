# Plan: Customize Lyric Appearance

Date: 2026-06-04  
Owner: Antigravity  
Status: completed  
Risk class: low  
Related issue/PR: https://github.com/fikrilal/gnome-lyricbar/issues/6

## Objective

Allow users to customize the appearance of the LyricBar panel text directly from the preferences window, including text color (system, presets, custom hex) and drop shadow.

## Constraints

- Keep default appearance unchanged (white text, text shadow active).
- Preferences UI must stay simple (no raw CSS editor).
- Added settings must be validated and safe for GNOME Shell runtime.
- Do not leak GSettings connections or GObject signals.

## Acceptance Criteria

1. Settings persist across sessions.
2. Safe defaults apply if invalid input (e.g. invalid hex color) is set.
3. The preferences window opens successfully and displays the new options.
4. `npm run verify` passes completely.
5. Inline style construction is fully unit-tested under various combinations.

## Implementation Checklist

- [x] Create execution plan and track task progress
- [x] Add GSchema configuration keys in `org.gnome.shell.extensions.lyricbar.gschema.xml`
- [x] Update `types.js` settings models
- [x] Implement settings validation and normalization in `normalize.js` and add/run unit tests
- [x] Map settings to the display view model in `view-model.js` and update tests
- [x] Read settings in `src/runtime/settings.js`
- [x] Implement dynamic inline style building in `src/shell/indicator.js`
- [x] Remove hardcoded color and shadow values from `stylesheet.css`
- [x] Update LibAdwaita preferences controls in `prefs.js` with new appearance settings
- [x] Address review feedback findings:
  - [x] Remove `styleTextOutline` setting and controls to avoid GNOME Shell CSS parsing limits
  - [x] Extract inline style construction to a pure helper in `src/domain/display/style.js`
  - [x] Add comprehensive unit tests for style construction in `tests/display/style.test.js`
  - [x] Update GSchema descriptions to specify "HEX color code" instead of "HEX or CSS color code"
  - [x] Fix Prettier formatting issue in execution plan
  - [x] Centralize appearance defaults and HEX validation in `src/domain/settings/appearance.js`
  - [x] Rename internal appearance settings to clearer domain names while keeping GSettings keys stable
  - [x] Rename "System Theme" preference label to "Theme default"
  - [x] Run full project verification (`npm run verify`) and record evidence

## Decision Log

- 2026-06-04: Created implementation plan. Color configuration will support "default" (keeps original behavior), "system" (transparent to theme styling), "white", "black", and "custom" (with custom Hex validation).
- 2026-06-04: Removed high-contrast simulated outline support because GNOME Shell's St.ThemeNode.get_text_shadow() parses a single shadow, meaning multi-shadow values (required for outline simulation) are invalid/ignored.
- 2026-06-04: Extracted inline style string building into a pure, unit-tested helper to ensure shell stability and test coverage.
- 2026-06-04: Kept the public GSettings keys stable but renamed the normalized domain fields to `textColorMode`, `customTextColor`, and `textShadowEnabled` for readability.

## Verification

```bash
npm run verify
```

Result:

```text
- docs structure ok
- metadata.json ok
- schemas/org.gnome.shell.extensions.lyricbar.gschema.xml ok
- architecture check ok
- prettier formatting ok
- eslint ok
- tsc typecheck ok
- vitest: 34 passed, 366 tests passed
- build:extension: dist/lyricbar@fikrilal.github.io.zip
- validate:bundle ok
```
