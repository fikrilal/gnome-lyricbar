# LyricBar Engineering Proposal

## Summary

LyricBar is a production-grade GNOME Shell extension that displays synchronized live lyrics in the GNOME top bar for MPRIS-compatible music players.

The extension should be implemented as a native GNOME Shell extension using GJS JavaScript. The runtime code must stay small, defensive, and aligned with GNOME Shell extension conventions, while pure business logic should be separated into testable modules.

The engineering goal is not just to display lyrics. The goal is to build a reliable desktop integration that can run inside GNOME Shell without destabilizing the user session.

## Engineering Goals

- Provide a stable top-bar lyric display for Spotify and other MPRIS-compatible players.
- Use native GNOME Shell APIs instead of window scraping, browser automation, or Spotify-specific UI hooks.
- Keep GNOME Shell lifecycle handling explicit and defensive.
- Make core logic testable outside GNOME Shell where possible.
- Ship with a repeatable build, test, package, and release workflow.
- Document privacy, runtime behavior, troubleshooting, and compatibility clearly.

## Non-Goals

- Building a standalone desktop application.
- Embedding a browser or web UI.
- Using Spotify private APIs.
- Scraping Spotify lyrics from the app or web player.
- Implementing playback controls in v1.
- Supporting non-GNOME desktop environments in v1.

## Runtime Stack

### GNOME Shell Extension Runtime

LyricBar should use **GJS JavaScript** as the extension runtime. GJS is the standard JavaScript runtime for GNOME Shell extensions and provides access to GNOME libraries through GObject Introspection.

Primary runtime APIs:

- `St` for Shell UI actors.
- `Clutter` for actor alignment and UI behavior.
- `GObject` for Shell-compatible classes and signal handling.
- `Gio` for D-Bus, settings, file access, and networking.
- `GLib` for timers, cancellation, paths, variants, and main-loop utilities.
- `PanelMenu` for top-bar panel integration.
- `PopupMenu` for extension menu items.

### Desktop Integration

Music player integration should use **MPRIS over D-Bus**.

MPRIS provides:

- Player discovery through session bus names.
- Track metadata through `org.mpris.MediaPlayer2.Player.Metadata`.
- Playback status through `PlaybackStatus`.
- Playback position through `Position`.
- Player lifecycle visibility through D-Bus name ownership changes.

LyricBar should not depend on Spotify-specific desktop internals. Spotify support should be achieved through Spotify's MPRIS implementation.

### Lyrics Provider

The default lyrics provider should be **LRCLIB**.

LRCLIB is suitable for v1 because:

- It provides synced lyrics when available.
- It does not require an API key.
- It supports simple metadata-based lookup.
- It is easy to document from a privacy perspective.

The provider layer should be abstracted enough that another lyrics source can be added later without rewriting the extension runtime.

## Architecture

LyricBar should use a small modular architecture with a clear split between Shell-specific code and pure logic.

```text
GNOME Shell
  |
  | loads
  v
extension.js
  |
  | owns lifecycle
  v
LyricBarController
  |
  | coordinates
  +--> MprisService
  +--> LyricsService
  +--> LyricsCache
  +--> PanelIndicator
  +--> Diagnostics
```

### Lifecycle Ownership

`extension.js` should own the GNOME extension lifecycle:

- create settings
- create controller
- enable controller
- disable controller
- release all references on disable

All long-lived resources must be tracked and disposed:

- D-Bus signal subscriptions
- D-Bus proxy signal handlers
- GLib timeouts
- cancellable async requests
- settings signal handlers
- UI actors

No async callback should mutate UI or state after the extension has been disabled.

### Player Discovery

Player discovery should be implemented with the session D-Bus API.

The extension should:

1. Call `org.freedesktop.DBus.ListNames`.
2. Filter names beginning with `org.mpris.MediaPlayer2.`.
3. Validate candidate players by creating MPRIS proxies.
4. Listen to `NameOwnerChanged` on `org.freedesktop.DBus`.
5. Re-scan players when MPRIS names appear or disappear.

The extension must not use wildcard D-Bus names with `Gio.bus_watch_name`. `Gio.bus_watch_name` expects one exact bus name and wildcard usage can trigger Shell-level runtime assertions.

### Active Player Selection

When multiple players exist, LyricBar should choose the active player deterministically.

Suggested priority:

1. A player with `PlaybackStatus === "Playing"`.
2. The previously selected player, if still available.
3. A player matching user-configured priority.
4. The first valid MPRIS player sorted by stable bus name.

This policy should live in pure logic so it can be unit tested.

### Track Identity

A track identity should be derived from normalized metadata:

- title
- artist
- album
- duration, when available
- MPRIS track id, when useful for detecting changes

Normalization should remove noisy suffixes only when safe. The first release should avoid aggressive title rewriting because it can create incorrect lyrics matches.

### Lyrics Lookup

Lyrics lookup should be triggered when the selected track identity changes.

Flow:

1. Build normalized lookup query.
2. Check local cache.
3. If cache miss, request lyrics from LRCLIB.
4. Prefer synced lyrics.
5. Parse LRC into timestamped lines.
6. Store successful and negative lookup results with TTL.
7. Update display state.

Network failures should not spam requests. The service should use timeout handling, request cancellation, and negative caching.

### Lyric Synchronization

The synchronization loop should be bounded and simple.

Options:

- Poll the active player's `Position` every 500ms while playing.
- Pause polling when playback is paused or stopped.
- Recompute the current lyric line from parsed LRC timestamps.
- Update the panel label only when the visible lyric line changes.

This avoids high-frequency UI churn and keeps Shell work predictable.

### UI Model

The top-bar UI should be a single compact panel item.

Panel display states:

- `idle`: no active player
- `track`: active track but no synced lyrics
- `lyrics`: synced lyric line available
- `loading`: lyrics lookup in progress, optional and subtle
- `error`: provider or player issue, visible only in diagnostics by default

The top-bar label should:

- have a configurable max width
- use ellipsis for overflow
- avoid layout shifts
- avoid multi-line text
- avoid rich formatting in v1

## Proposed Repository Structure

```text
gnome-lyricbar/
  README.md
  LICENSE
  metadata.json
  extension.js
  prefs.js
  stylesheet.css
  package.json
  eslint.config.js
  prettier.config.js
  justfile

  schemas/
    org.gnome.shell.extensions.lyricbar.gschema.xml

  src/
    controller.js
    indicator.js
    settings.js
    diagnostics.js

    mpris/
      service.js
      player.js
      selection.js
      metadata.js

    lyrics/
      service.js
      lrclib.js
      lrc.js
      cache.js
      normalize.js

  tests/
    lyrics/
      lrc.test.js
      normalize.test.js
      cache.test.js

    mpris/
      selection.test.js
      metadata.test.js

  docs/
    product.md
    engineering-proposal.md
    architecture.md
    privacy.md
    troubleshooting.md
    release.md

  scripts/
    build-extension.mjs
    validate-metadata.mjs
    validate-schema.sh
```

## Module Responsibilities

### `extension.js`

GNOME Shell entrypoint.

Responsibilities:

- instantiate settings
- create the controller
- add the panel indicator
- tear down all runtime state on disable

This file should stay thin.

### `src/controller.js`

Coordinates runtime services.

Responsibilities:

- connect MPRIS events to lyrics lookup
- connect lyrics state to indicator state
- manage polling lifecycle
- handle extension enable and disable

### `src/indicator.js`

Owns GNOME Shell UI actors.

Responsibilities:

- create top-bar panel item
- render display state
- apply max-width and overflow behavior
- expose a small API to update label/menu state
- destroy UI actors cleanly

### `src/mpris/service.js`

Owns D-Bus player discovery.

Responsibilities:

- list MPRIS bus names
- watch D-Bus `NameOwnerChanged`
- create and dispose player proxies
- emit stable player list updates

### `src/mpris/player.js`

Wraps one MPRIS player.

Responsibilities:

- read metadata
- read playback status
- read position
- listen for property changes
- expose normalized player snapshots
- disconnect signal handlers on dispose

### `src/mpris/selection.js`

Pure active-player selection logic.

Responsibilities:

- choose active player from snapshots
- apply deterministic priority rules
- remain unit-testable without GNOME Shell

### `src/lyrics/service.js`

Coordinates lyrics lookup and synchronization state.

Responsibilities:

- receive track identity
- check cache
- call provider
- parse synced lyrics
- expose lyric timeline
- handle negative lookups and provider failures

### `src/lyrics/lrclib.js`

LRCLIB provider adapter.

Responsibilities:

- build API requests
- apply request timeout
- parse provider responses
- return provider-neutral results

### `src/lyrics/lrc.js`

Pure LRC parser and lyric selection logic.

Responsibilities:

- parse LRC timestamps
- sort timestamped lines
- ignore invalid lines safely
- select current lyric line by playback position

### `src/lyrics/cache.js`

Local lyrics cache.

Responsibilities:

- persist successful lookup results
- persist negative lookup results
- enforce TTL
- version cache schema

### `src/diagnostics.js`

Runtime diagnostics store.

Responsibilities:

- record non-fatal errors
- record current player/provider state
- expose useful troubleshooting data in preferences or logs

## Settings

Settings should be stored through GSettings.

Initial settings:

- `panel-position`: `left`, `center`, or `right`
- `max-width`: integer pixel width
- `fallback-mode`: `track`, `idle`, or `hidden`
- `player-priority`: string array of preferred player bus-name fragments
- `lyrics-provider`: initially `lrclib`
- `cache-enabled`: boolean
- `debug-logging`: boolean

Settings should be conservative by default.

## Data Flow

```text
MPRIS player appears
  -> MprisService updates player list
  -> selection policy chooses active player
  -> active player metadata changes
  -> controller derives track identity
  -> LyricsService checks cache/provider
  -> LRC timeline is loaded
  -> playback position polling selects current line
  -> PanelIndicator updates label
```

## Error Handling

Error handling should be explicit and non-disruptive.

Expected failures:

- no MPRIS players
- player disappears during a D-Bus request
- missing metadata
- missing playback position
- LRCLIB network failure
- LRCLIB no-result response
- malformed LRC data
- GNOME settings schema unavailable during development

Handling policy:

- never throw unhandled errors from callbacks
- prefer fallback display state over visible errors
- record diagnostics for troubleshooting
- avoid repeated network retries for the same failing track
- clean up resources on disable even after partial startup failure

## Privacy and Security

Lyric lookup sends track metadata to the configured lyrics provider.

The repository should document:

- what fields are sent
- when network requests happen
- how cache data is stored
- how to disable cache
- that no telemetry is collected

The extension should not:

- read Spotify credentials
- access browser cookies
- scrape windows
- collect listening history beyond local cache needs
- send analytics

## Testing Strategy

GNOME Shell extensions are hard to fully test outside a live Shell session, so tests should focus on isolating pure logic.

### Unit Tests

Use Node.js and Vitest for pure modules:

- LRC parsing
- current lyric selection by timestamp
- metadata normalization
- cache key generation
- active player selection
- LRCLIB response parsing

### Static Checks

- ESLint for JavaScript quality.
- Prettier for formatting.
- JSON validation for `metadata.json`.
- XML validation for GSettings schema.
- Build script validation for extension bundle contents.

### Manual Runtime Checks

Manual checks are required before release:

- enable extension
- disable extension
- logout/login
- start Spotify before extension
- start Spotify after extension
- quit Spotify while lyrics are visible
- switch tracks quickly
- pause/resume playback
- disconnect network
- test no-lyrics tracks
- test long lyric lines
- test multiple MPRIS players

Manual checks should be documented in `docs/release.md`.

## Build and Release

The release process should produce a GNOME Extensions-compatible zip bundle.

Build steps:

1. clean build directory
2. copy runtime files
3. compile GSettings schemas
4. validate metadata
5. validate schema
6. create extension zip
7. run tests and static checks

Release artifacts:

- `lyricbar@fikrilal.github.io.shell-extension.zip` or similar UUID-based bundle
- changelog entry
- compatibility notes
- known issues

The extension UUID should be stable from the first public release.

## CI

GitHub Actions should run on pull requests and pushes to `main`.

Suggested jobs:

- install dependencies
- run lint
- run format check
- run unit tests
- validate metadata
- validate schema
- build extension bundle

Release workflow:

- triggered by version tag
- runs all checks
- builds zip
- attaches artifact to GitHub release

## Compatibility

Initial support should target:

- GNOME Shell 46
- Ubuntu 24.04
- Spotify Desktop via MPRIS

Additional GNOME versions should be added only after explicit runtime testing.

Compatibility should be documented in the README and release notes. GNOME Shell internals change between releases, so broad version claims should be avoided.

## Implementation Phases

### Phase 1: Foundation

- repository metadata
- extension skeleton
- GSettings schema
- build scripts
- lint and format setup
- test runner setup

### Phase 2: Core Logic

- LRC parser
- lyric line selection
- metadata normalization
- player selection policy
- cache key generation
- unit tests

### Phase 3: MPRIS Runtime

- D-Bus player discovery
- player proxy wrapper
- metadata/status/position reads
- player lifecycle cleanup
- multiple-player behavior

### Phase 4: Lyrics Runtime

- LRCLIB adapter
- cache implementation
- timeout and failure handling
- negative lookup caching

### Phase 5: Shell UI

- top-bar indicator
- preferences UI
- display states
- max-width and overflow behavior
- diagnostics display

### Phase 6: Hardening and Release

- manual runtime test matrix
- privacy documentation
- troubleshooting guide
- release workflow
- screenshots and README polish

## Engineering Risks

### GNOME Shell Stability

Risk: extension bugs can affect the desktop shell.

Mitigation:

- defensive lifecycle cleanup
- no unhandled async errors
- bounded timers
- no invalid D-Bus watcher usage
- manual enable/disable testing

### Lyrics Mismatch

Risk: provider returns incorrect lyrics for remixes, live versions, or ambiguous tracks.

Mitigation:

- include duration when available
- keep normalization conservative
- expose fallback behavior
- cache negative and positive results separately

### Provider Availability

Risk: LRCLIB can be unavailable or rate-limited.

Mitigation:

- timeout requests
- cache results
- avoid aggressive retry loops
- design provider abstraction for future alternatives

### GNOME Version Drift

Risk: Shell APIs change across GNOME versions.

Mitigation:

- explicit support matrix
- version-specific testing
- avoid private Shell APIs where possible
- keep UI integration minimal

## Quality Bar

LyricBar should be treated as production software from the first commit.

Minimum bar before public v1:

- documented architecture
- testable core modules
- CI checks
- deterministic build
- privacy documentation
- release checklist
- no known Shell assertions
- clean enable/disable lifecycle
- no leaked timers or signal handlers

The project should optimize for reliability and maintainability over feature count.
