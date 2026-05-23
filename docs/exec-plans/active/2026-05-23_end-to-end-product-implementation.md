# Plan: End-To-End Product Implementation

Date: 2026-05-23  
Owner: Dante  
Status: active  
Risk class: high  
Related issue/PR: N/A

## Objective

Implement LyricBar end to end as a production-grade GNOME Shell extension that displays synchronized live lyrics in the GNOME top bar for Spotify and other MPRIS-compatible players.

The implementation should progress through commit-sized phases. Each phase must be independently reviewable, mechanically verified, and scoped so an agent can complete it without relying on hidden chat context.

## Constraints

- Architectural constraints:
  - GNOME Shell runtime code uses GJS JavaScript.
  - Pure logic stays under `src/domain/` and must remain platform-free.
  - GNOME Shell, GJS, D-Bus, filesystem, network, settings, and UI APIs stay outside `src/domain/`.
  - Runtime code must explicitly clean up signal handlers, D-Bus subscriptions, timeouts, cancellables, and actors on disable.
  - Async callbacks must be guarded so they cannot mutate destroyed extension state.
  - MPRIS discovery must use exact D-Bus names and `NameOwnerChanged`; never use wildcard names with `Gio.bus_watch_name`.
- Product/runtime constraints:
  - Initial supported platform is GNOME Shell 46 on Ubuntu 24.04.
  - Spotify Desktop support comes through MPRIS, not private Spotify APIs.
  - Synced lyrics come from LRCLIB in v1.
  - Lyric lookup sends track metadata to LRCLIB; privacy docs must make this explicit.
  - Do not install or reload the extension on a user desktop without explicit approval.
- Out of scope for v1:
  - Playback controls.
  - Full lyrics window.
  - Karaoke highlighting.
  - Spotify account integration.
  - Lyrics editing.
  - Non-GNOME desktop support.

## Acceptance Criteria

1. LyricBar can be built into a GNOME extension zip with `npm run build:extension`.
2. LyricBar can detect MPRIS players, select the active player, and track metadata/playback state.
3. LyricBar can fetch, cache, parse, and synchronize LRCLIB synced lyrics.
4. LyricBar renders one compact lyric line in the GNOME top bar with graceful fallback states.
5. Preferences cover max width, panel position, fallback mode, cache enabled, and debug logging.
6. Diagnostics make missing players, missing lyrics, provider failures, and lifecycle state understandable.
7. CI and local `npm run verify` stay green at every phase.
8. Medium/high-risk phases record runtime evidence before completion.

## Commit Rule

Each phase should land as one commit or one small PR. Use semantic scoped commit messages:

```text
type(scope): message
```

Allowed examples:

```text
feat(mpris): add player discovery service
feat(lyrics): add lrclib provider
feat(shell): render lyric display state
fix(lifecycle): guard async callbacks after disable
test(domain): cover lyric timeline selection
docs(product): document privacy behavior
ci(harness): add release bundle checks
```

## Implementation Phases

### Phase 1: Runtime Lifecycle Foundation

Commit:

```text
feat(lifecycle): add runtime controller foundation
```

Goal:

Create the extension runtime composition root without adding MPRIS or network behavior.

Implementation:

- Add `src/runtime/controller.js`.
- Add `src/runtime/lifecycle.js` or equivalent cleanup registry.
- Move Shell indicator ownership behind the controller.
- Add explicit `enable()` and `disable()` paths.
- Track cleanup disposables for future D-Bus signals, settings signals, timeouts, and cancellables.
- Ensure repeated enable/disable calls are idempotent.

Acceptance:

- Existing smoke indicator still renders static text.
- `disable()` destroys the indicator and clears references.
- Unit tests cover cleanup registry behavior where possible.
- `npm run verify` passes.

Runtime evidence:

- Not required unless the extension is manually installed.

Risk:

- Medium. This touches Shell lifecycle structure but should not add D-Bus/network behavior.

Status:

- Complete.
- Added `src/runtime/lifecycle.js` cleanup registry.
- Added `src/runtime/controller.js` runtime composition root.
- Moved indicator ownership from `extension.js` into the controller.
- Added lifecycle unit tests.
- Verification: `npm run verify` passed with 4 test files and 19 tests.

### Phase 2: Display State Domain Model

Commit:

```text
feat(domain): add display state model
```

Goal:

Define the state machine that converts product/runtime conditions into top-bar display text.

Implementation:

- Add domain types for display states:
  - `idle`
  - `loading`
  - `track`
  - `lyrics`
  - `hidden`
  - `error`
- Add pure formatting logic for fallback behavior.
- Add tests for long text, empty text, missing track metadata, and fallback mode behavior.

Acceptance:

- Display state decisions are testable without GNOME Shell.
- No UI code contains product fallback rules.
- `npm run verify` passes.

Runtime evidence:

- Not required.

Risk:

- Low. Pure logic only.

Status:

- Complete.
- Added `src/domain/display/state.js` display-state formatter.
- Added `src/domain/display/types.js` display-state JSDoc contracts.
- Added display-state unit tests for lyrics, track fallback, idle, hidden, loading, error, and long text.
- Verification: `npm run verify` passed with 5 test files and 34 tests.

### Phase 3: Settings Adapter

Commit:

```text
feat(shell): add settings adapter
```

Goal:

Expose GSettings through a small runtime adapter with validated values and defaults.

Implementation:

- Add `src/runtime/settings.js`.
- Read `panel-position`, `max-width`, `fallback-mode`, `player-priority`, `cache-enabled`, and `debug-logging`.
- Validate enum-like values at the boundary.
- Subscribe to settings changes with tracked disconnect cleanup.
- Add tests for pure settings normalization if separated from GJS.

Acceptance:

- Invalid setting values fall back safely.
- Settings signal cleanup is tracked.
- Architecture guardrails pass.
- `npm run verify` passes.

Runtime evidence:

- Not required unless preferences are manually opened.

Risk:

- Medium. GSettings integration can break extension load if schema handling is wrong.

Status:

- Complete.
- Added `src/domain/settings/normalize.js` and `src/domain/settings/types.js`.
- Added `src/runtime/settings.js` GSettings adapter with lifecycle-tracked signal cleanup.
- Controller now reads settings, subscribes to settings changes, and applies `panel-position` on startup.
- Added settings normalization and runtime adapter tests.
- Verification: `npm run verify` passed with 7 test files and 46 tests.

### Phase 4: Panel Indicator Rendering

Commit:

```text
feat(shell): render top bar display states
```

Goal:

Render the display state model in the GNOME top bar.

Implementation:

- Update `src/shell/indicator.js` to accept display state updates.
- Apply max-width styling through settings.
- Use single-line text with ellipsis.
- Add subtle idle/fallback display behavior.
- Avoid nested menus or playback controls.

Acceptance:

- Indicator API accepts display state objects, not raw scattered strings.
- Label remains single-line and bounded.
- No business logic is embedded in the Shell actor.
- `npm run verify` passes.

Runtime evidence:

- Required before completion if manually installed:
  - enable extension
  - disable extension
  - confirm no Shell errors related to LyricBar

Risk:

- Medium. Shell UI changes run inside GNOME Shell.

### Phase 5: MPRIS Domain Selection

Commit:

```text
feat(mpris): harden player selection policy
```

Goal:

Complete pure MPRIS selection and metadata normalization before touching D-Bus.

Implementation:

- Expand `src/domain/mpris/selection.js`.
- Add metadata normalization for title, artist, album, duration, track id, playback status, and bus name.
- Define player snapshot shapes.
- Add tests for:
  - multiple playing players
  - previous selected player
  - preferred player fragments
  - invalid players
  - deterministic sorted fallback
  - missing metadata

Acceptance:

- Active player choice is deterministic and fully covered by tests.
- No runtime/GJS imports in domain code.
- `npm run verify` passes.

Runtime evidence:

- Not required.

Risk:

- Low. Pure logic only.

### Phase 6: MPRIS D-Bus Player Discovery

Commit:

```text
feat(mpris): add dbus player discovery
```

Goal:

Discover MPRIS-compatible players safely through session D-Bus.

Implementation:

- Add `src/runtime/mpris/service.js`.
- Call `org.freedesktop.DBus.ListNames`.
- Filter names beginning with `org.mpris.MediaPlayer2.`.
- Watch `NameOwnerChanged` on `org.freedesktop.DBus`.
- Re-scan when MPRIS names appear/disappear.
- Do not use wildcard `Gio.bus_watch_name`.
- Track all D-Bus subscriptions for cleanup.

Acceptance:

- Discovery handles zero players.
- Discovery handles player launch/quit.
- No wildcard D-Bus watcher usage.
- Architecture cleanup guardrails pass.
- `npm run verify` passes.

Runtime evidence:

- Required:
  - no player running
  - Spotify started after extension
  - Spotify quit while extension is active
  - DBus names listed for evidence

Risk:

- High. D-Bus watcher bugs can affect Shell stability.

### Phase 7: MPRIS Player Proxy

Commit:

```text
feat(mpris): track player metadata and playback state
```

Goal:

Wrap one MPRIS player and emit normalized snapshots for controller use.

Implementation:

- Add `src/runtime/mpris/player.js`.
- Create player proxy for exact bus names only.
- Read `Metadata`, `PlaybackStatus`, and `Position`.
- Subscribe to property changes.
- Handle player disappearance during requests.
- Disconnect proxy signal handlers on dispose.

Acceptance:

- Snapshot updates when track changes.
- Snapshot updates when playback pauses/resumes.
- Missing metadata is handled gracefully.
- `npm run verify` passes.

Runtime evidence:

- Required:
  - play Spotify track
  - pause/resume
  - skip track
  - quit Spotify during playback

Risk:

- High. D-Bus proxy lifecycle and Shell cleanup must be correct.

### Phase 8: Controller MPRIS Integration

Commit:

```text
feat(mpris): connect active player to controller
```

Goal:

Connect MPRIS discovery/player snapshots to the runtime controller and indicator fallback states.

Implementation:

- Controller receives player list updates.
- Controller selects active player through domain policy.
- Controller updates display state:
  - idle when no player
  - track when player has metadata but no lyrics yet
  - loading when lyric lookup starts in later phases
- No lyrics/network behavior yet.

Acceptance:

- Top bar can show track fallback for active player.
- No lyrics provider calls exist yet.
- `npm run verify` passes.

Runtime evidence:

- Required:
  - Spotify track shown as fallback
  - no-player state shown
  - pause/resume does not break UI

Risk:

- High. This is the first end-to-end runtime data path.

### Phase 9: LRCLIB Domain Response Parsing

Commit:

```text
feat(lyrics): add lrclib response parsing
```

Goal:

Parse LRCLIB responses into provider-neutral results without network behavior.

Implementation:

- Add `src/domain/lyrics/provider-result.js` or equivalent.
- Add LRCLIB response parser in pure logic if practical.
- Validate synced lyrics, plain lyrics, missing lyrics, and malformed responses.
- Expand LRC parser tests for realistic LRCLIB payloads.

Acceptance:

- Provider response parsing is covered by tests.
- Malformed provider data cannot crash runtime consumers.
- `npm run verify` passes.

Runtime evidence:

- Not required.

Risk:

- Low. Pure logic only.

### Phase 10: LRCLIB Runtime Provider

Commit:

```text
feat(lyrics): add lrclib provider adapter
```

Goal:

Fetch lyrics from LRCLIB through a small runtime adapter.

Implementation:

- Add `src/runtime/lyrics/lrclib.js`.
- Build query from normalized track metadata.
- Apply timeout.
- Use cancellable/guarded async behavior.
- Return provider-neutral result objects.
- Do not update UI directly from provider callbacks.
- Keep network behavior isolated to provider adapter.

Acceptance:

- Provider handles success, not found, malformed response, timeout, and network failure.
- No network calls outside provider adapter.
- Async callbacks are guarded after dispose.
- `npm run verify` passes.

Runtime evidence:

- Required once wired into controller in later phase.

Risk:

- High. Network callbacks inside Shell require careful guards.

### Phase 11: Lyrics Cache

Commit:

```text
feat(lyrics): add local lyrics cache
```

Goal:

Cache successful and negative lyric lookup results.

Implementation:

- Add `src/runtime/lyrics/cache.js`.
- Use a cache schema version.
- Store by normalized artist/title/album/duration key.
- Cache positive synced/plain results.
- Cache negative lookup results with TTL.
- Keep cache writes isolated to the cache module.
- Respect `cache-enabled`.

Acceptance:

- Cache keys are deterministic.
- Corrupt cache data is ignored safely.
- Negative cache prevents repeated failed lookups.
- `npm run verify` passes.

Runtime evidence:

- Required when wired into controller:
  - repeat same track and confirm cache hit in diagnostics/logs

Risk:

- Medium. Filesystem use must stay isolated and recoverable.

### Phase 12: Lyrics Service Orchestration

Commit:

```text
feat(lyrics): orchestrate lookup and timeline state
```

Goal:

Create the lyrics service that combines cache, provider, parser, and track identity.

Implementation:

- Add `src/runtime/lyrics/service.js`.
- Trigger lookup when track identity changes.
- Avoid duplicate in-flight lookup for same track.
- Cancel/ignore stale requests on track change or disable.
- Prefer synced lyrics.
- Fall back to plain lyrics/track display.
- Expose timeline state to controller.

Acceptance:

- Track changes cannot apply stale lyrics to a new track.
- Disable during lookup is safe.
- Provider failures become fallback state, not Shell errors.
- `npm run verify` passes.

Runtime evidence:

- Required:
  - switch tracks quickly
  - disable extension during lookup
  - network disconnected

Risk:

- High. This phase combines async, network, and lifecycle behavior.

### Phase 13: Lyric Synchronization Loop

Commit:

```text
feat(lyrics): synchronize lyric line with playback
```

Goal:

Update the visible lyric line according to playback position.

Implementation:

- Poll active player position at a bounded interval, likely 500ms.
- Start polling only when synced lyrics exist and player is playing.
- Stop polling when paused/stopped/no lyrics/disabled.
- Update indicator only when visible line changes.
- Track timeout cleanup through lifecycle registry.

Acceptance:

- No leaked timeout after disable.
- Paused playback stops unnecessary updates.
- Current line selection is covered by pure domain tests.
- `npm run verify` passes.

Runtime evidence:

- Required:
  - lyric line advances while playing
  - line stops changing while paused
  - disable removes timeout without Shell errors

Risk:

- High. Timers inside Shell must be bounded and cleaned up.

### Phase 14: Preferences UI

Commit:

```text
feat(shell): complete preferences ui
```

Goal:

Expose v1 settings through GNOME preferences.

Implementation:

- Add controls for:
  - panel position
  - max width
  - fallback mode
  - cache enabled
  - debug logging
- Validate values through settings adapter.
- Keep preferences UI simple and native.

Acceptance:

- Preferences window opens without errors.
- Changing preferences updates runtime where applicable.
- Invalid settings remain safely handled.
- `npm run verify` passes.

Runtime evidence:

- Required:
  - open preferences
  - change max width
  - change fallback mode
  - disable/enable extension after preference changes

Risk:

- Medium. Preferences run in a separate GNOME extension preferences process.

### Phase 15: Diagnostics

Commit:

```text
feat(shell): add diagnostics state
```

Goal:

Make troubleshooting visible without noisy user-facing errors.

Implementation:

- Add diagnostics store.
- Track current player, track identity, lyrics provider status, cache status, and last non-fatal error.
- Show diagnostics in the extension menu or preferences.
- Honor `debug-logging`.
- Avoid logging sensitive data beyond track metadata already sent to LRCLIB.

Acceptance:

- Missing player, missing lyrics, network failure, and cache read failure are diagnosable.
- Debug logging is off by default.
- `npm run verify` passes.

Runtime evidence:

- Required:
  - no player
  - no lyrics result
  - network/provider failure

Risk:

- Medium. Diagnostics must help without creating privacy or noise issues.

### Phase 16: Privacy Documentation

Commit:

```text
docs(product): document privacy behavior
```

Goal:

Document what data LyricBar reads, stores, and sends.

Implementation:

- Add `docs/privacy.md`.
- Explain MPRIS metadata.
- Explain LRCLIB lookup fields.
- Explain local cache location and contents.
- Explain telemetry policy.
- Link privacy doc from README and docs index.

Acceptance:

- Users can understand network and cache behavior before installing.
- `npm run verify` passes.

Runtime evidence:

- Not required.

Risk:

- Low. Docs only.

### Phase 17: Troubleshooting Documentation

Commit:

```text
docs(product): add troubleshooting guide
```

Goal:

Document common operational failures and debugging commands.

Implementation:

- Add `docs/troubleshooting.md`.
- Include:
  - checking GNOME Shell version
  - checking session type
  - listing MPRIS players
  - viewing GNOME Shell logs
  - missing lyrics behavior
  - provider/network failures
  - safe install/uninstall commands
- Link from README and docs index.

Acceptance:

- A user can diagnose common failures without reading source code.
- `npm run verify` passes.

Runtime evidence:

- Not required.

Risk:

- Low. Docs only.

### Phase 18: Manual Runtime Harness

Commit:

```text
chore(harness): add manual runtime checklist
```

Goal:

Create a repeatable manual test harness for GNOME runtime behavior.

Implementation:

- Add `docs/harness/runtime-checklist.md`.
- Add commands for:
  - build zip
  - install locally
  - enable extension
  - disable extension
  - uninstall extension
  - inspect logs
  - list MPRIS players
- Include evidence table for releases.
- Make clear that Shell reload/install requires explicit approval.

Acceptance:

- Runtime evidence expectations are documented.
- PR template and execution-plan docs link to the checklist.
- `npm run verify` passes.

Runtime evidence:

- Not required for the doc itself.

Risk:

- Low. Harness docs only.

### Phase 19: Release Packaging Hardening

Commit:

```text
chore(release): harden extension bundle validation
```

Goal:

Make release artifacts harder to break.

Implementation:

- Extend build script to validate bundle contents.
- Reject accidental inclusion of:
  - tests
  - scripts
  - docs
  - `node_modules`
  - `.git`
- Verify compiled schemas exist in bundle.
- Verify `metadata.json` UUID matches zip name.
- Optionally add a `validate:bundle` script.

Acceptance:

- Bundle validation fails on missing required files or forbidden files.
- CI uploads only validated bundles.
- `npm run verify` passes.

Runtime evidence:

- Not required.

Risk:

- Medium. Release path changes can block CI if too strict.

### Phase 20: End-To-End Alpha Runtime Test

Commit:

```text
test(shell): record alpha runtime evidence
```

Goal:

Validate the complete v1 path manually on the target desktop.

Implementation:

- Run the manual runtime checklist on GNOME Shell 46.
- Capture evidence in `docs/exec-plans/completed/` or `docs/release-notes/alpha.md`.
- Record:
  - install
  - enable
  - no player
  - Spotify playing
  - lyrics found
  - lyrics missing
  - pause/resume
  - track skip
  - network failure
  - disable
  - uninstall

Acceptance:

- End-to-end behavior is proven on target environment.
- Known issues are documented.
- `npm run verify` passes.

Runtime evidence:

- Required.

Risk:

- High. This is the first full desktop runtime validation.

## Verification

Every phase must run:

```bash
npm run verify
```

Where relevant:

```bash
npm audit
npm run commitlint -- --from <base> --to <head>
```

For medium/high-risk runtime phases, also record manual runtime evidence in the phase PR or execution plan.

## Runtime Evidence

Runtime evidence should include:

- GNOME Shell version
- session type
- extension install path
- player used
- commands run
- logs checked
- scenarios executed
- screenshots or short recordings when UI behavior changed

Do not run install, enable, disable, Shell reload, or uninstall operations without explicit approval from the human owner.

## Risks And Mitigations

- Risk: GNOME Shell extension bugs can destabilize the desktop.
  - Mitigation: keep runtime phases small, run static guardrails, require runtime evidence, and avoid unsafe Shell reload commands.
- Risk: D-Bus player lifecycle is race-prone.
  - Mitigation: exact bus names only, guarded callbacks, cleanup registry, and quit/launch runtime tests.
- Risk: LRCLIB returns missing, malformed, or mismatched lyrics.
  - Mitigation: provider-neutral parser, fallback states, conservative normalization, and negative caching.
- Risk: Async network callbacks apply stale lyrics after track changes.
  - Mitigation: request tokens/cancellables and track identity checks before applying results.
- Risk: Preferences/schema drift breaks extension load.
  - Mitigation: schema validation, settings adapter validation, and preferences runtime evidence.
- Risk: Agents add behavior outside intended boundaries.
  - Mitigation: architecture guardrails, typecheck, JSDoc contracts, execution plans, and PR evidence requirements.

## Completion Notes

Pending implementation.

## Follow-Ups

- [ ] Create issue/PR labels for phase scopes.
- [ ] Decide whether release notes should live under `docs/release-notes/`.
- [ ] Decide whether to add local git hooks after commitlint has proven useful in CI.
