# Runtime Agent Workflow

## Purpose

This guide tells an R&D agent exactly how to verify LyricBar GNOME Shell UI changes without using the owner's primary desktop session. Agents should follow this workflow before asking for human visual confirmation.

The goal is a tight loop:

```text
patch -> static verify -> nested Shell -> mock MPRIS -> screenshot -> inspect -> patch again
```

## Required Rule

Do not install, disable, enable, or reload LyricBar in the owner's primary desktop session for R&D. Use a nested GNOME Shell session.

## One-Agent Workflow

### 1. Start From A Dedicated Worktree

Use a separate worktree for R&D:

```bash
cd /home/fikrilal/devs/personal/gnome-lyricbar
git worktree add ../gnome-lyricbar-rnd -b rnd/runtime-visual-harness
cd ../gnome-lyricbar-rnd
```

If the worktree already exists, use it directly.

### 2. Run Static Verification

Before runtime work:

```bash
npm run verify:safe
```

Do not collect runtime evidence from a build that fails static verification.

### 3. Create An Isolated Runtime Root

Each runtime attempt needs isolated state:

```bash
export LYRICBAR_EVIDENCE_DIR="$PWD/docs/exec-plans/completed/evidence/$(date +%F_%H%M%S)_runtime-rnd"
export LYRICBAR_RUNTIME_HOME="/tmp/lyricbar-runtime-$USER-$$"

mkdir -p "$LYRICBAR_EVIDENCE_DIR/screenshots"
mkdir -p "$LYRICBAR_RUNTIME_HOME"
```

The final harness should set these automatically. Until then, agents must keep evidence paths explicit.

### 4. Start Nested GNOME Shell

Start nested Shell in its own D-Bus session:

```bash
dbus-run-session -- bash -lc 'gnome-shell --nested --wayland' \
  > "$LYRICBAR_EVIDENCE_DIR/gnome-shell.log" 2>&1
```

For manual R&D, run this in the background from the agent process and keep the session id so it can be stopped.

Successful startup signs in `gnome-shell.log`:

```text
Running GNOME Shell ... as a Wayland display server
Using public X11 display
GNOME Shell started
LyricBar controller-enable
```

### 5. Capture The Nested Shell Window

Find the nested Shell X11 child window:

```bash
xwininfo -root -tree
```

Look for a frame named `gnome-shell` with a child around `800x600`. Capture the child window:

```bash
xwd -silent -id "$NESTED_WINDOW_ID" -out "$LYRICBAR_EVIDENCE_DIR/screenshots/01-nested-shell.xwd"
```

Convert XWD to PNG with Python:

```bash
python3 scripts/runtime/xwd-to-png.py \
  "$LYRICBAR_EVIDENCE_DIR/screenshots/01-nested-shell.xwd" \
  "$LYRICBAR_EVIDENCE_DIR/screenshots/01-nested-shell.png"
```

Until `scripts/runtime/xwd-to-png.py` exists, use the known conversion logic from the R&D notes:

```python
import struct
from PIL import Image

data = open(input_path, 'rb').read()
vals = struct.unpack('>25I', data[:100])
offset = vals[0] + vals[19] * 12
raw = data[offset:offset + vals[12] * vals[5]]
img = Image.frombuffer('RGB', (vals[4], vals[5]), raw, 'raw', 'BGRX', vals[12], 1)
img.save(output_path)
```

Agent must inspect the PNG, not only logs.

### 6. Start Mock MPRIS Player

Start the mock MPRIS player on the nested Shell's D-Bus session.

Find the nested Shell process:

```bash
pgrep -af 'gnome-shell --nested --wayland'
```

Read its session bus:

```bash
NESTED_SHELL_PID="<pid>"
NESTED_DBUS="$(tr '\0' '\n' < "/proc/$NESTED_SHELL_PID/environ" | sed -n 's/^DBUS_SESSION_BUS_ADDRESS=//p')"
```

Run the mock:

```bash
DBUS_SESSION_BUS_ADDRESS="$NESTED_DBUS" \
  python3 scripts/runtime/mock-mpris-player.py \
  > "$LYRICBAR_EVIDENCE_DIR/mock-mpris.log" 2>&1
```

The mock must own:

```text
org.mpris.MediaPlayer2.lyricbarMock
/org/mpris/MediaPlayer2
org.mpris.MediaPlayer2
org.mpris.MediaPlayer2.Player
org.freedesktop.DBus.Properties
```

Required properties:

```text
PlaybackStatus=Playing
Metadata.xesam:title
Metadata.xesam:artist
Position
CanPlay
CanPause
CanControl
```

### 7. Verify LyricBar Saw The Mock

In `gnome-shell.log`, look for:

```text
LyricBar:mpris player-owner-changed name="org.mpris.MediaPlayer2.lyricbarMock"
LyricBar:player proxy-ready busName="org.mpris.MediaPlayer2.lyricbarMock"
LyricBar:player snapshot-changed ... title="..."
LyricBar indicator-render text="..."
```

If `properties-get-all-failed` appears, the mock MPRIS implementation is wrong. Fix the mock before debugging LyricBar UI.

### 8. Capture Visual Evidence After Mock Playback

Capture another screenshot:

```bash
xwd -silent -id "$NESTED_WINDOW_ID" -out "$LYRICBAR_EVIDENCE_DIR/screenshots/02-mock-playing.xwd"
python3 scripts/runtime/xwd-to-png.py \
  "$LYRICBAR_EVIDENCE_DIR/screenshots/02-mock-playing.xwd" \
  "$LYRICBAR_EVIDENCE_DIR/screenshots/02-mock-playing.png"
```

Inspect the PNG. The panel must show either the current lyric, track fallback, or an intentional visible fallback. A stuck constructor label like `LyricBar` is a failure when mock metadata has already been detected.

### 9. Stop Runtime Processes

Always clean up:

```bash
pkill -f 'mock-mpris-player.py' || true
pkill -f 'gnome-shell --nested --wayland' || true
```

Confirm:

```bash
ps -eo pid,ppid,cmd | rg 'mock-mpris-player|gnome-shell --nested' || true
```

## Multi-Agent Concurrency

Multiple agents can run nested GNOME Shell, but only with isolated runtime state.

Each agent needs:

- separate git worktree
- separate branch
- separate evidence directory
- separate `dbus-run-session`
- separate mock MPRIS process
- separate temp files under `/tmp/lyricbar-runtime-*`

Agents must not share:

- one checkout
- one evidence directory
- one mock MPRIS process
- one nested Shell process

Nested GNOME Shell windows can coexist, but agents must discover their own window id from their own process tree and not capture another agent's window.

## Current Proven Facts

This workflow has been manually smoke-tested on the owner's machine:

- Ubuntu GNOME Shell 46 under an X11 primary session.
- `dbus-run-session -- gnome-shell --nested --wayland` starts successfully.
- Nested Shell loads LyricBar.
- `xwd` can capture the nested Shell X11 window.
- Python/Pillow can convert the XWD capture to PNG.
- A mock MPRIS player on the nested D-Bus session is visible to LyricBar.
- The current panel-rendering bug reproduces visually inside nested Shell.

## Minimum Evidence Bundle

Every R&D agent must produce:

```text
evidence/
  README.md
  gnome-shell.log
  mock-mpris.log
  screenshots/
    01-nested-shell.png
    02-mock-playing.png
```

The evidence `README.md` must include:

- branch
- commit SHA
- GNOME Shell version
- primary session type
- nested command used
- mock MPRIS scenario
- screenshot filenames
- pass/fail result
- remaining uncertainty

## Exit Criteria

An agent can claim runtime success only when:

- `npm run verify:safe` passes.
- nested GNOME Shell starts.
- mock MPRIS is detected by LyricBar.
- screenshots are captured and inspected.
- panel text is visually correct in the screenshot.
- logs show no LyricBar JavaScript error.

Logs alone are not enough for Shell UI work.
