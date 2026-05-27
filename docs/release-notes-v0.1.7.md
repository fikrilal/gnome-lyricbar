# LyricBar v0.1.7

Update notification and self-update release to help users stay on the latest version.

## Added

- Update notification in preferences that checks GitHub Releases daily.
- Update Now button in preferences when the auto-updater is installed.
- Recommended auto-update prompt during installation.
- State file at `~/.local/state/lyricbar/update-check.json` for caching update checks.

## Changed

- README now recommends installing with `--install-updater` flag for automatic daily updates.
- Install script prompts users to enable auto-updater after installation.

## Verification

- `npm run verify`
- Preferences update check with network available.
- Update Now button with `~/.local/bin/lyricbar-update` present and absent.
