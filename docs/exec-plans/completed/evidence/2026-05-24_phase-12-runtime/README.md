# Phase 12 Runtime Evidence

Date: 2026-05-24  
Tester: Dante + Codex  
Git commit: `34b61fb`, then lifecycle fixes `b534d07` and `5a8841e`  
Bundle: `dist/lyricbar@fikrilal.github.io.zip`

## Environment

- GNOME Shell: `GNOME Shell 46.0`
- OS: `Ubuntu 24.04.4 LTS`
- Session type: `x11`
- Evidence environment: owner's main GNOME session. The owner explicitly
  accepted this risk in chat. Runtime evidence stopped early after a
  cleanup warning was found.

## Static Preflight

Command:

```bash
npm run verify:safe
```

Result:

```text
2026-05-24 12:20 +07:00
- verify:docs ok
- validate:metadata ok
- validate:schema ok
- check:architecture ok
- format:check ok
- lint ok
- typecheck ok
- vitest: 21 test files, 176 tests passed
- build:extension: dist/lyricbar@fikrilal.github.io.zip
```

## Runtime Protocol

Runtime evidence must follow:

```text
docs/harness/runtime-evidence.md
```

Do not run these scenarios in the owner's primary GNOME session.

## Runtime Checklist

- [x] Confirm disposable GNOME environment.
  - Result: not disposable. Owner explicitly accepted main-session risk.
- [x] Start journal capture.
- [x] Install extension bundle.
- [x] Enable debug logging.
- [x] Enable extension with current players present.
- [x] Disable extension immediately.
- [x] Re-enable extension after disable.
- [x] Inspect logs for Shell crashes, JS errors, and GLib/GIO criticals.
- [ ] Enable extension with no active music player.
- [ ] Enable extension with Spotify already running and playing.
- [ ] Start Spotify after extension is enabled.
- [ ] Play a track with LRCLIB synced lyrics.
- [ ] Skip to a different track.
- [ ] Pause and resume playback.
- [ ] Quit Spotify while extension is enabled.
- [ ] Change `player-priority` and confirm active selection refreshes.
- [ ] Change `panel-position` between left, center, and right.
- [ ] Disconnect network during lyric lookup.
- [ ] Disable extension during an in-flight lyrics lookup.

## Results

Blocked.

Summary:

- `npm run verify:safe` passed before runtime.
- Extension installed successfully.
- Direct `gsettings` access failed without `GSETTINGS_SCHEMA_DIR` because
  the schema is extension-local. Setting `debug-logging` succeeded with:

  ```bash
  GSETTINGS_SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io/schemas" \
    gsettings set org.gnome.shell.extensions.lyricbar debug-logging true
  ```

- `org.gnome.shell disable-user-extensions` was initially `true`, so
  `gnome-extensions enable lyricbar@fikrilal.github.io` did not activate
  LyricBar until user extensions were globally re-enabled.
- LyricBar then loaded and emitted debug logs for:
  - controller enable
  - indicator mount at center
  - MPRIS service start
  - MPRIS `ListNames`
  - Chromium and Spotify player proxy creation
  - active-player selection
  - empty-metadata lyric lookup skip
- No GNOME Shell crash occurred during this run.
- No LyricBar JavaScript exception appeared during this run.
- Disable emitted GObject warnings:

  ```text
  ../../../gobject/gsignal.c:2685: instance '...' has no handler with id '...'
  ```

- The first fix, `b534d07`, removed duplicate `PlayerProxy`
  `addSignal(...)` cleanup.
- The second fix, `5a8841e`, guarded manual proxy disconnect with
  `GObject.signal_handler_is_connected(...)`.
- The warning persisted without a Shell restart. Inference: the running
  GNOME Shell likely retained an older imported GJS module instance. The
  fix needs validation after a fresh login, Shell restart, VM, or separate
  user session.
- Runtime evidence stopped before player playback, LRCLIB, cache,
  panel-position, and network-failure scenarios.
- The extension was disabled after the run.
- `org.gnome.shell disable-user-extensions` was restored to `true`, which
  was the value observed before enabling LyricBar.

This evidence does not complete Phases 10, 11, or 12.

## Logs

Store logs under:

```text
logs/
```

Expected files:

- `journal.log`
- `gnome-shell.log`
- scenario-specific excerpts as needed

Raw logs were captured locally but are not committed because they contain
unrelated machine and workspace paths. Commit sanitized excerpts only.

## Screenshots

Store screenshots under:

```text
screenshots/
```

Expected screenshots:

- panel center
- panel left
- panel right
- lyric line visible
- fallback track text visible

## Stop Conditions

Triggered by repeated GObject cleanup warnings during disable. No crash,
forced logout, Shell restart loop, or disable failure occurred.
