# Release Checklist

Use this checklist before tagging a public LyricBar release.

## Static Gates

Run:

```bash
npm ci
npm run verify
npm audit
```

Expected:

- docs validation passes
- metadata validation passes
- schema validation passes
- architecture guardrails pass
- Prettier passes
- ESLint passes
- TypeScript check passes
- unit tests pass
- extension bundle builds
- dependency audit has no actionable vulnerabilities

## Bundle Inspection

Run:

```bash
unzip -l dist/lyricbar@fikrilal.github.io.zip
```

The bundle should include only runtime files:

- `metadata.json`
- `extension.js`
- `prefs.js`
- `stylesheet.css`
- `schemas/`
- `src/domain/`
- `src/runtime/`
- `src/shell/`
- `build-manifest.json`

It should not include tests, docs, `.git`, `node_modules`, screenshots, or local evidence directories.

## Clean Install

Run:

```bash
gnome-extensions install --force dist/lyricbar@fikrilal.github.io.zip
gnome-extensions enable lyricbar@fikrilal.github.io
gnome-extensions info lyricbar@fikrilal.github.io
```

Expected:

- extension is enabled
- state is `ACTIVE`
- no immediate LyricBar JavaScript errors in GNOME Shell logs

## Runtime Scenarios

Record GNOME Shell version, OS version, session type, player, and bundle path.

Required scenarios:

- no player available
- Spotify starts after LyricBar is enabled
- synced lyrics render in the panel
- track change updates lyric lookup and sync loop
- pause and resume do not leak timers
- missing synced lyrics uses configured fallback
- browser MPRIS plus Spotify selects Spotify when priority is `spotify`
- panel position changes at runtime
- text alignment changes at runtime
- max width changes at runtime
- preferences open from GNOME Extensions
- preferences open from the LyricBar panel menu
- disable and enable round trip
- logout and login survival

## Privacy And Docs

Confirm the README links:

- install instructions
- privacy behavior
- troubleshooting
- release checklist
- license

Confirm `debug-logging` defaults to false.

## Tag

Only tag after the static gates and runtime scenarios pass:

```bash
git tag v0.1.0
```
