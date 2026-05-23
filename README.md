# LyricBar

LyricBar is a GNOME Shell extension that displays synchronized live lyrics in the GNOME top bar for MPRIS-compatible music players.

The project is currently in scaffold stage. The first implementation target is a production-ready GNOME Shell extension for GNOME Shell 46 on Ubuntu 24.04, with Spotify Desktop support through MPRIS and synced lyrics from LRCLIB.

## Status

The repository is being built harness-first:

- documented product and engineering direction
- agent operating contract
- executable verification gate
- minimal GNOME Shell extension scaffold
- pure logic modules with unit tests

## Documentation

Start with:

- [Product overview](docs/product.md)
- [Engineering proposal](docs/engineering-proposal.md)
- [Agent harness](docs/harness/agent-harness.md)

## Development

Install dependencies:

```bash
npm install
```

Run the canonical verification gate:

```bash
npm run verify
```

Build a local extension bundle:

```bash
npm run build:extension
```

The generated bundle is written to `dist/`.
