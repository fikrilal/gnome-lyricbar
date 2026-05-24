# Crash-Safe Runtime Evidence Protocol

## Purpose

LyricBar runs inside GNOME Shell. A bad runtime change can crash the
desktop session, so runtime evidence must be treated as a controlled
experiment, not as a normal local verification command.

This protocol defines how humans and agents collect runtime evidence
without putting the owner's primary desktop session at risk.

## Hard Rules

- Agents must not install, enable, disable, reload, or restart LyricBar
  in the owner's primary GNOME session.
- Agents must not run `gnome-extensions enable`, `gnome-extensions
disable`, `gnome-shell --replace`, Alt-F2 `r`, or equivalent Shell
  reload commands unless the human owner explicitly asks for that exact
  action in that turn.
- `npm run verify` and `npm run verify:safe` are static-safe commands.
  They build the extension bundle but do not prove runtime safety.
- Runtime evidence must be collected in a disposable environment first:
  VM, test machine, disposable GNOME user session, or another session
  the owner is prepared to lose.
- Any GNOME Shell `signal 11`, Shell restart loop, compositor crash, or
  forced logout immediately stops runtime evidence. Do not retry in the
  same primary session.

## Approved Environments

Preferred order:

1. Ubuntu 24.04 VM with GNOME Shell 46.
2. Separate Linux user on the same machine, logged into a fresh GNOME
   session with no important work open.
3. Spare machine with the target GNOME version.
4. Owner's primary session only after disposable evidence has passed
   and the owner explicitly accepts the risk.

Record the environment:

```bash
gnome-shell --version
echo "$XDG_SESSION_TYPE"
lsb_release -ds
```

## Preflight

Run static verification before any runtime action:

```bash
npm run verify:safe
```

Confirm the extension bundle exists:

```bash
ls -lh dist/lyricbar@fikrilal.github.io.zip
```

Start log capture in a separate terminal:

```bash
journalctl --user -f -o short-iso \
  | tee runtime-evidence-journal.log
```

Optional targeted Shell log view:

```bash
journalctl --user -f -o short-iso _COMM=gnome-shell \
  | tee runtime-evidence-gnome-shell.log
```

## Manual Runtime Checklist

Install only in the disposable session:

```bash
gnome-extensions install --force dist/lyricbar@fikrilal.github.io.zip
```

Scenarios:

1. Enable extension with no active music player.
2. Disable extension immediately.
3. Enable extension with Spotify already running.
4. Start Spotify after extension is enabled.
5. Play a track with LRCLIB synced lyrics.
6. Skip to a different track.
7. Pause and resume playback.
8. Quit Spotify while extension is enabled.
9. Change `player-priority` and confirm active selection refreshes.
10. Change `panel-position` between left, center, and right and confirm
    the indicator moves without duplicate panel items.
11. Disconnect network during lyric lookup and confirm the extension
    degrades without Shell errors.
12. Disable extension during an in-flight lyrics lookup.

After each scenario, inspect logs for:

- `GNOME Shell crashed`
- `signal 11`
- `Gjs-CRITICAL`
- `GLib-GIO-CRITICAL`
- `lyricbar` exceptions
- repeated Shell restart attempts

## Evidence Format

Runtime evidence should be stored under the relevant execution plan or
release evidence directory, for example:

```text
docs/exec-plans/completed/evidence/YYYY-MM-DD_phase-12/
  README.md
  runtime-evidence-journal.log
  runtime-evidence-gnome-shell.log
  screenshots/
```

The evidence `README.md` must include:

- date and tester
- git commit SHA
- GNOME Shell version
- OS version
- session type
- extension version or bundle path
- scenarios executed
- pass/fail result per scenario
- relevant log excerpts
- screenshots for panel UI changes
- known gaps

## Stop Conditions

Stop immediately if any of these happen:

- GNOME Shell crashes.
- The session logs out unexpectedly.
- The panel disappears or stops accepting input.
- The extension cannot be disabled normally.
- Journal logs show repeated fatal errors.

After a stop condition:

1. Do not retry in the same primary session.
2. Preserve the journal logs if possible.
3. Record the failing scenario and exact time.
4. Return to static analysis and targeted tests.

## Agent Boundary

Agents may:

- run `npm run verify:safe`
- build the extension zip
- inspect logs with `journalctl`
- write evidence plans and checklists
- summarize human-provided runtime logs

Agents may not:

- enable or disable the extension in the owner's primary session
- restart GNOME Shell
- run runtime scenarios without explicit owner approval
- claim runtime evidence passed when only static verification ran
