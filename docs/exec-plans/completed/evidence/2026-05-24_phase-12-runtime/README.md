# Phase 12 Runtime Evidence

Date: 2026-05-24  
Tester: Dante + Codex  
Git commit: `34b61fb`, then fixes `b534d07`, `5a8841e`, `253e300`, `b8314c8`, and `0dd0710`  
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
- [x] Re-test lifecycle after fresh GNOME Shell login.
- [x] Change `panel-position` between left, center, and right.
- [x] Try Spotify metadata hydration with Spotify already running and playing.
- [x] Inspect logs for Shell crashes, JS errors, and GLib/GIO criticals.
- [x] Enable extension with no active music player.
- [x] Enable extension with Spotify already running and playing.
- [x] Start Spotify after extension is enabled.
- [x] Play a track with LRCLIB synced lyrics.
- [x] Confirm cache hit after synced lyrics are cached.
- [x] Skip to a different track.
- [x] Pause and resume playback.
- [x] Disable extension after active playback and lyric lookup.
- [ ] Quit Spotify while extension is enabled.
- [ ] Change `player-priority` and confirm active selection refreshes.
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
- After a fresh login, lifecycle enable/disable passed without the
  GObject handler warning, without Shell crash, and without LyricBar JS
  exceptions.
- Panel-position movement passed in the fresh session:
  - center -> left
  - left -> right
  - right -> center
  - disable after movement
- Spotify was playing and exposed populated MPRIS metadata over D-Bus:
  title `Daylight`, artist `David Kushner`, album `The Dichotomy`.
- LyricBar still hydrated an empty initial snapshot from
  `Gio.DBusProxy` cached properties, so lyrics lookup was skipped as
  `no-active-player`.
- A track skip changed Spotify's D-Bus metadata to title `Home`, artist
  `Edith Whiskers`, album `Stop Stealing The Covers!`, but LyricBar did
  not update the player snapshot in that loaded Shell process.
- Fix `253e300` adds explicit
  `org.freedesktop.DBus.Properties.GetAll` hydration after proxy startup.
- After another fresh login, retesting `253e300` still showed an empty
  LyricBar snapshot while Spotify exposed populated D-Bus metadata. This
  disproved the module-cache-only hypothesis.
- Fix `b8314c8` unwraps nested variant-like values before mapping MPRIS
  properties. Unit coverage now includes variant-wrapped `GetAll`
  metadata and variant-wrapped `PropertiesChanged` metadata.
- `npm run verify:safe` passed after `b8314c8`:
  - vitest: 21 test files, 178 tests passed
  - build:extension: `dist/lyricbar@fikrilal.github.io.zip`
- After another fresh login, runtime validation of `b8314c8` passed for
  Spotify hydration:
  - no MPRIS players present at enable: passed
  - Spotify started after extension enable: discovered via
    `player-owner-changed`
  - Spotify D-Bus metadata exposed title `Meet you at the Graveyard`,
    artist `Cleffy`, album `Clean Sheets, dirty walls`
  - LyricBar first emitted the empty cached snapshot, then updated to
    title `Meet you at the Graveyard` from explicit `GetAll` hydration
- Lyric lookup then started and reached the LRCLIB provider.
- LRCLIB lookup failed with:

  ```text
  JS ERROR: ReferenceError: URLSearchParams is not defined
  ```

- Fix `0dd0710` removes the `URLSearchParams` dependency from
  LRCLIB URL construction and preserves the existing query encoding
  contract. `npm run verify:safe` passed after this fix:
  - vitest: 21 test files, 178 tests passed
  - build:extension: `dist/lyricbar@fikrilal.github.io.zip`
- After another fresh login, runtime validation of `0dd0710` passed:
  - Spotify D-Bus metadata exposed title `The Scientist`, artist
    `Coldplay`, album `A Rush of Blood to the Head`.
  - LyricBar hydrated the snapshot with title `The Scientist`.
  - LRCLIB lookup started for artist `Coldplay`, title `The Scientist`.
  - LRCLIB returned `kind="synced"` with HTTP `statusCode=200`.
  - Lyrics cache wrote the synced result.
- Cache-hit validation passed after disable/re-enable:
  - LyricBar hydrated `The Scientist`.
  - Lyrics cache returned `cache-hit kind="synced"`.
  - No network provider request was needed for the cached track.
- Track-skip validation passed:
  - Spotify advanced to title `Mary On A Cross`, artist `Eibell`.
  - LyricBar emitted a new player snapshot for `Mary On A Cross`.
  - LRCLIB returned `kind="synced"` with HTTP `statusCode=200`.
  - Lyrics cache wrote the synced result.
- Pause/resume validation passed through MPRIS:
  - `PlaybackStatus` changed to `Paused`.
  - `PlaybackStatus` changed back to `Playing`.
- Disable-after-runtime validation passed:
  - LyricBar disabled cleanly after active Spotify playback and lyric
    lookups.
  - No `URLSearchParams` error, LyricBar JS exception, GLib/GIO critical,
    GObject handler warning, Shell crash, forced logout, or Shell restart
    occurred in the final runtime pass.
- Runtime evidence stopped before network-failure,
  disable-during-in-flight-lookup, Spotify-quit, and `player-priority`
  scenarios. Network disconnection was not run on the owner's main
  machine.
- The extension was disabled after the run.
- `org.gnome.shell disable-user-extensions` was restored to `true`, which
  was the value observed before enabling LyricBar.

This evidence completes the main happy-path runtime behavior for MPRIS
discovery, LRCLIB synced lookup, cache write, cache hit, track change,
pause/resume, and disable cleanup. Remaining scenarios should run in a
disposable GNOME session because they intentionally disturb network or
player lifecycle state.

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

Triggered first by repeated GObject cleanup warnings during disable, then
by blocked MPRIS metadata hydration. No crash, forced logout, Shell
restart loop, or disable failure occurred.
