# LyricBar

LyricBar is a GNOME Shell extension that displays synchronized live lyrics in the top bar for MPRIS-compatible music players.

It is built for GNOME Shell 46-49 and supports Spotify Desktop, Spotify Web, YouTube Music Web, Apple Music Web, and other MPRIS players. Lyrics are fetched from LRCLIB, cached locally, and rendered as a single glanceable line in the panel.

![LyricBar screenshot](docs/assets/lyricbar-panel.png)

![LyricBar demo](docs/assets/lyricbar-demo.gif)

## Features

- Synced one-line lyric display in the GNOME top bar.
- MPRIS player selection with configurable player priority.
- Browser player profiles for Spotify Web, YouTube Music Web, and Apple Music Web.
- Apple Music Web position normalization for browsers that expose cumulative media-session position.
- LRCLIB synced lyric lookup with local cache.
- Fallback modes for tracks without synced lyrics.
- Preferences for panel position, maximum width, text alignment, fallback behavior, browser player service, cache, player priority, and debug logging.
- Small panel menu for quick position/alignment changes and preferences access.
- Strict local harness: formatting, linting, type checking, architecture checks, unit tests, schema validation, and bundle build.

## Compatibility

| Target               | Status        |
| -------------------- | ------------- |
| GNOME Shell 46-49    | Supported     |
| Ubuntu 24.04         | Supported     |
| Fedora GNOME         | Supported     |
| Spotify Desktop      | Supported     |
| Spotify Web          | Supported     |
| YouTube Music Web    | Supported     |
| Apple Music Web      | Supported     |
| Other MPRIS players  | Best effort   |
| Non-GNOME desktops   | Not supported |
| Browser/website APIs | Not used      |

Broader GNOME Shell versions should be added only after runtime testing. GNOME Shell extension APIs are not stable enough for blanket compatibility claims.

Browser support is powered by the browser's MPRIS integration. LyricBar does not scrape tabs, inspect page DOM, read browser history, or use private Spotify, YouTube, or Apple APIs. If a browser player is ambiguous, use Preferences -> Browser player service to select the intended service.

## Install

Recommended install (includes automatic daily updates):

```bash
curl -fsSL https://raw.githubusercontent.com/fikrilal/gnome-lyricbar/main/scripts/install.sh | bash -s -- --install-updater
```

LyricBar is in active development with frequent bug fixes and new features. Auto-update ensures you always have the latest version.

Install without auto-update:

```bash
curl -fsSL https://raw.githubusercontent.com/fikrilal/gnome-lyricbar/main/scripts/install.sh | bash
```

Open preferences:

```bash
gnome-extensions prefs lyricbar@fikrilal.github.io
```

Manual update command:

```bash
~/.local/bin/lyricbar-update
```

Uninstall:

```bash
gnome-extensions disable lyricbar@fikrilal.github.io
rm -rf ~/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io
curl -fsSL https://raw.githubusercontent.com/fikrilal/gnome-lyricbar/main/scripts/install.sh | bash -s -- --uninstall-updater
```

## Development

Requirements:

- GNOME Shell 46-49
- Node.js 22+
- `glib-compile-schemas`
- `zip`

Build and install:

```bash
npm ci
npm run verify
gnome-extensions install --force dist/lyricbar@fikrilal.github.io.zip
gnome-extensions enable lyricbar@fikrilal.github.io
```

The generated bundle is written to `dist/lyricbar@fikrilal.github.io.zip`.

## Privacy

LyricBar does not use telemetry and does not require a Spotify account. For lyric lookup, it sends track metadata such as artist, title, album, and duration to LRCLIB. See [Privacy](docs/privacy.md).

## Troubleshooting

If the panel is blank, lyrics do not sync, or the wrong player is selected, see [Troubleshooting](docs/troubleshooting.md).

## Documentation

- [Product overview](docs/product.md)
- [Engineering proposal](docs/engineering-proposal.md)
- [Player profile architecture](docs/player-profile-architecture.md)
- [Agent harness](docs/harness/agent-harness.md)
- [Runtime evidence workflow](docs/harness/runtime-evidence.md)
- [Release checklist](docs/release-checklist.md)

## License

MIT
