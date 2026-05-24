# Nested Runtime Harness Proposal

## Purpose

LyricBar needs visual runtime evidence because GNOME Shell panel behavior cannot be fully proven with unit tests or logs. The current manual loop of installing into the owner's primary desktop and logging out to reload Shell modules is too slow, risky, and frustrating.

The recommended harness is a disposable nested GNOME Shell session with screenshot capture, journal capture, and a mock MPRIS player. Agents should be able to run an end-to-end loop without touching the owner's primary desktop session.

## Recommendation

Build a first-class runtime harness around:

1. Nested GNOME Shell for visual UI execution.
2. Mock MPRIS player for deterministic track metadata, playback status, and playback position.
3. Screenshot capture of the nested Shell window or nested display.
4. Journal capture filtered to LyricBar and GNOME Shell errors.
5. Assertions for panel visibility, label width, and expected lyric text.

The harness should become the default way to validate Shell UI changes before any manual primary-session install.

## Goals

- Restart GNOME Shell freely without logging out of the main desktop.
- Let agents visually inspect panel behavior through screenshots.
- Reproduce MPRIS playback without depending on Spotify state.
- Preserve runtime evidence in docs for review.
- Turn known visual regressions into repeatable checks.

## Non-Goals

- Full CI execution on GitHub Actions. GNOME Shell nested runtime is a local evidence harness first.
- Replacing unit tests. Domain, MPRIS mapping, lyrics parsing, cache, and display-state logic should stay unit-tested.
- Testing every GNOME version. Start with the owner's current target: Ubuntu 24.04 / GNOME Shell 46.

## Architecture

```text
scripts/runtime/
  run-nested-evidence.mjs
  start-nested-shell.mjs
  install-extension.mjs
  mock-mpris-player.mjs
  capture-screenshot.mjs
  assert-panel-visible.mjs
  collect-logs.mjs

docs/exec-plans/completed/evidence/YYYY-MM-DD_runtime-harness/
  README.md
  gnome-shell.log
  mock-mpris.log
  screenshots/
```

### Nested Shell Runner

The runner starts a disposable Shell process:

```bash
dbus-run-session -- gnome-shell --nested --wayland
```

If nested Shell cannot share the host session bus safely, the runner should keep it isolated and rely on the mock MPRIS player inside the same `dbus-run-session`.

### Extension Installer

The installer should:

1. Run `npm run verify:safe`.
2. Build `dist/lyricbar@fikrilal.github.io.zip`.
3. Install the zip into the nested session.
4. Enable debug logging.
5. Enable LyricBar.
6. Set `panel-position=center`.

### Mock MPRIS Player

The mock player should expose:

```text
org.mpris.MediaPlayer2.lyricbarMock
/org/mpris/MediaPlayer2
org.mpris.MediaPlayer2
org.mpris.MediaPlayer2.Player
```

Required behavior:

- `PlaybackStatus`: `Playing`, `Paused`, `Stopped`.
- `Metadata`: title, artist, album, length, track id.
- `Position`: monotonic playback position in microseconds.
- `PropertiesChanged` signal for metadata, status, and position-relevant changes.
- Optional methods: `Play`, `Pause`, `PlayPause`, `Stop`, `Next`, `Previous`.

The first fixture should use a known synced lyric scenario:

```text
artist: Imagine Dragons
title: Follow You
status: Playing
position: advances every 500ms
```

The mock lets the harness test:

- no player
- player appears after extension enable
- active playing track
- track change
- pause/resume
- player disappears
- position changes across synced lyric timestamps

### Screenshot Capture

The harness should capture the nested session after each scenario:

```text
screenshots/
  01-no-player.png
  02-playing-track.png
  03-synced-line-advanced.png
  04-paused.png
```

The first assertion can be simple:

- screenshot file exists
- top panel is non-empty
- expected label region is not blank

Later assertions can use OCR or pixel comparison, but do not block phase one on OCR.

### Log Capture

Capture:

```bash
journalctl --user -f -o short-iso _COMM=gnome-shell
```

Filter for:

```text
LyricBar
JS ERROR
Gjs-CRITICAL
GLib-GIO-CRITICAL
Extension lyricbar
```

The evidence summary must include the exact commit SHA and the scenarios executed.

## Agent Loop

The agent workflow should be:

```bash
npm run runtime:evidence
```

Internally:

1. Run static harness.
2. Start nested Shell.
3. Start mock MPRIS player.
4. Install and enable LyricBar.
5. Run runtime scenarios.
6. Capture screenshots.
7. Collect logs.
8. Fail if Shell errors occur or the panel assertion fails.
9. Write evidence summary.

The agent can then patch and rerun this loop without asking the owner to logout.

## Acceptance Criteria

Phase one is complete when:

- `npm run runtime:evidence` starts a disposable runtime environment.
- The harness can enable LyricBar without touching the primary session.
- A mock MPRIS player is visible to LyricBar.
- At least one screenshot shows the top panel after a mocked playing track.
- Logs show lyric lookup/render flow or a deterministic provider fallback.
- The harness exits cleanly and preserves logs/screenshots.

Phase two is complete when:

- The harness asserts that the panel label is visually non-blank.
- The harness can run no-player, playing, pause, resume, track-change, and disable scenarios.
- A failed panel render produces a clear artifact bundle.

## Risks

- Nested GNOME Shell may not start under every compositor or GPU setup.
- Screenshot APIs may be blocked by desktop privacy settings.
- A nested isolated D-Bus session may not see host Spotify, which is why the mock MPRIS player is required.
- Visual assertions can be flaky if they depend on exact theme pixels. Start with coarse non-blank assertions.

## Decision

Use the nested runtime harness plus mock MPRIS player as the primary agent-visible feedback loop for Shell UI work. The owner's primary desktop session should be used only for final manual acceptance after the nested harness passes.
