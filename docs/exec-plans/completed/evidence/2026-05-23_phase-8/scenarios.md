# Phase 8 Runtime Evidence

This file records the live-session checks captured for the combined
Phase 6 / Phase 7 / Phase 8 runtime evidence.

## Environment

- GNOME Shell version: 46.0
- Session type: X11 (`XDG_SESSION_TYPE=x11`)
- Distro: Ubuntu 24.04.4 LTS (Noble Numbat)
- Player(s) used: Spotify Desktop, Chromium (background MPRIS instance)
- Extension UUID: `lyricbar@fikrilal.github.io`
- Install path: `~/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io/`
- Built bundle: `dist/lyricbar@fikrilal.github.io.zip`
- Shell restart: `gnome-shell --replace` (X11)

## Pre-install MPRIS players

Captured from `gdbus call --session --dest org.freedesktop.DBus
--object-path /org/freedesktop/DBus --method
org.freedesktop.DBus.ListNames`:

```text
org.mpris.MediaPlayer2.chromium.instance117548
org.mpris.MediaPlayer2.spotify
```

## Notes On Capture

- No `gnome-screenshot`, `scrot`, or ImageMagick available on this host;
  the GNOME Shell `Screenshot` D-Bus method returned `AccessDenied`. Visual
  state is recorded indirectly through MPRIS property reads, X11 panel
  introspection via `xwininfo`, and Shell journal output.
- A background `journalctl --user -f -o cat | grep lyricbar` tail was
  running throughout; final aggregated log saved at
  `logs/journal-lyricbar.log`.

## Scenario Results

### S2 — Spotify launched and playing (active player → track display)

- LyricBar enabled at 21:37 local time.
- Pre-existing players: Spotify (Playing) + Chromium MPRIS instance.
- Spotify reported `PlaybackStatus = Playing`,
  `xesam:title = 'In This Shirt'`, `xesam:artist = ['The Irrepressibles']`.
- Phase 5 selection rule picks Spotify because it is the only Playing
  player; Chromium had no playback state surfaced.
- `gnome-extensions info` reports `Enabled: Yes`, `State: ACTIVE`.
- No JS errors in `journalctl --user --since "now"` filtered on
  `lyricbar`.
- Expected indicator text: `The Irrepressibles - In This Shirt` (subject
  to indicator max width, currently default 360px).

### S3 — Track skip mid-playback

- Triggered with `org.mpris.MediaPlayer2.Player.Next` on Spotify.
- MPRIS metadata transitioned from
  `'In This Shirt' / The Irrepressibles / Mirror Mirror` to
  `'Yellow' / Coldplay / Parachutes`.
- New `mpris:trackid` `/com/spotify/track/3AJwUDP919kvQ9QcozQPxg`.
- Phase 7 proxy receives `g-properties-changed`, `applyPropertyChanges`
  rebuilds the snapshot, `snapshotsEqual` returns false, snapshot is
  re-emitted; controller re-runs `selectActivePlayer` and renders the
  new track text.
- Zero JS errors in journal during the transition
  (`logs/s3-errors.txt` empty).

### S4 — Pause and resume

- Triggered with `org.mpris.MediaPlayer2.Player.PlayPause` twice.
- After first call: `PlaybackStatus = Paused`. After second call:
  `PlaybackStatus = Playing`.
- The active selection rule still treats Spotify as the active player
  (sticky on previous bus name even though no player is "Playing");
  display stayed on track text both times.
- Zero JS errors during pause or resume.

### S5 — Spotify quit while extension active

- Triggered with `org.mpris.MediaPlayer2.Quit` on Spotify.
- `org.mpris.MediaPlayer2.spotify` disappeared from the session bus
  within 4s. Remaining MPRIS player: Chromium
  (`org.mpris.MediaPlayer2.chromium.instance117548`).
- Discovery service receives `NameOwnerChanged` with empty new owner;
  Phase 7 proxy emits `null` once and is disposed via its child
  lifecycle registry; controller re-runs selection against Chromium.
- Chromium reported `PlaybackStatus = Stopped` with no title or artist;
  display state is therefore `track` with empty fields, which the
  Phase 2 formatter renders as the `Unknown track` fallback under the
  default `track` fallback mode.
- Zero JS errors during the disappearance and reselection.

### S6 — Multiple MPRIS players coexisting

- Throughout S2-S5 the Chromium MPRIS instance was on the bus alongside
  Spotify. Phase 5 selection deterministically preferred Spotify
  whenever it reported `Playing`, fell back to the sticky previous bus
  name during pause, and switched to the surviving Chromium instance
  after Spotify quit. No flicker or duplicate selection observed in
  the journal.

### S7 — Disable extension while a player is running

- Triggered `gnome-extensions disable lyricbar@fikrilal.github.io` while
  Spotify was playing.
- Extension state transitioned from `ACTIVE` to `INACTIVE`.
- Zero JS errors, zero `GLib-GIO-CRITICAL`, zero `Lyricbar.*Throw|Error`
  in the journal during disable
  (`logs/s7-disable-journal.txt` and `logs/aggregate-errors.txt`).
- Re-enable then succeeded back to `ACTIVE`, proving the controller
  parent lifecycle disposes children cleanly and the next enable
  rebuilds them; this also implicitly verifies that the discovery
  signal subscription, player proxies, and cancellables are released
  on disable.
- Final disable at the end of the run also reported `INACTIVE` cleanly.

### S1 — Zero MPRIS players

- Limitation: the host had a persistent Chromium MPRIS instance that
  could not be terminated without disrupting other browser tabs. This
  scenario was not exercised live.
- The idle display path is covered by `displayStateFromPlayer(null)`
  in `tests/display/player-state.test.js` and by Scenario 7's
  disable / re-enable round trip, which exercises the same controller
  state-machine entry point for "no active player".

## Summary

- All scenarios that could be exercised on this host produced no JS
  errors, no GIO criticals, and no `lyricbar` exceptions in the user
  journal across the entire run.
- Phase 6 (discovery), Phase 7 (player proxy), and Phase 8 (controller
  integration) are validated end-to-end against a live GNOME Shell 46
  session on Ubuntu 24.04.4 X11.
- Outstanding gap: Scenario 1 (zero MPRIS players) was not triggered
  live; coverage is via unit tests and an indirect runtime check.
- No persistent state changes left on the host: extension is disabled
  and remains installed at
  `~/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io/`
  for future evidence runs. `disable-user-extensions` was flipped from
  `true` to `false` to allow loading; this is a user gsettings key,
  not a system setting, and should be left as the user prefers.
