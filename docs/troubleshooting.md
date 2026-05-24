# Troubleshooting

## Extension Does Not Appear

Check that the extension is installed and enabled:

```bash
gnome-extensions info lyricbar@fikrilal.github.io
gnome-extensions enable lyricbar@fikrilal.github.io
```

If the extension was just updated, reload only LyricBar:

```bash
gnome-extensions disable lyricbar@fikrilal.github.io
gnome-extensions enable lyricbar@fikrilal.github.io
```

## Preferences Do Not Open

Run:

```bash
gnome-extensions prefs lyricbar@fikrilal.github.io
```

If GNOME reports a schema error, rebuild and reinstall the bundle:

```bash
npm run build:extension
gnome-extensions install --force dist/lyricbar@fikrilal.github.io.zip
```

## Wrong Player Is Selected

LyricBar prefers currently playing players. If multiple players are playing, the `player-priority` setting decides which one wins first.

Set Spotify first:

```bash
GSETTINGS_SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io/schemas" \
  gsettings set org.gnome.shell.extensions.lyricbar player-priority "['spotify']"
```

Pause or close browser tabs that expose MPRIS if they should not be candidates.

## Lyrics Do Not Sync

Check that the player exposes MPRIS metadata:

```bash
busctl --user list | grep org.mpris.MediaPlayer2
```

Enable debug logging temporarily:

```bash
GSETTINGS_SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io/schemas" \
  gsettings set org.gnome.shell.extensions.lyricbar debug-logging true

journalctl --user -f -o short-iso _COMM=gnome-shell | grep LyricBar
```

Turn debug logging off after troubleshooting:

```bash
GSETTINGS_SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io/schemas" \
  gsettings set org.gnome.shell.extensions.lyricbar debug-logging false
```

## Track Has No Synced Lyrics

Some tracks do not have synced LRCLIB results. LyricBar falls back according to `fallback-mode`:

- `track`: show artist and title
- `idle`: show quiet idle text
- `hidden`: hide the indicator

## Text Alignment Does Not Change

Confirm the setting changed:

```bash
GSETTINGS_SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io/schemas" \
  gsettings get org.gnome.shell.extensions.lyricbar text-align
```

If the value changes but the panel does not, reload LyricBar and check GNOME Shell logs for `LyricBar settings-changed`.

## Report Runtime Evidence

Useful reports include:

- GNOME Shell version
- session type, X11 or Wayland
- player name
- track title
- `gnome-extensions info lyricbar@fikrilal.github.io`
- relevant `journalctl --user _COMM=gnome-shell` lines
