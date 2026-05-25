# LyricBar v0.1.5

## Highlights

- Improves Spotify Web profile inference for browser MPRIS players.
- Ignores unstable browser track IDs when deciding whether lyrics need a new lookup.
- Bounds browser advertisement retention so stale lyrics do not remain visible through long ad breaks.
- Adds `npm run inspect:mpris` for copy-pasteable MPRIS diagnostics.

## Compatibility

- GNOME Shell 46-49
- Spotify Desktop remains the primary target.
- Spotify Web support is improved through browser MPRIS metadata handling.

## Notes

The browser service preference defaults to Spotify Web behavior. Users can switch browser MPRIS handling to auto or generic mode in preferences.
