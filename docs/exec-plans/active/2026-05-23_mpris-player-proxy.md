# Plan: MPRIS Player Proxy

Date: 2026-05-23  
Owner: Dante  
Status: active  
Risk class: high  
Related issue/PR: N/A  
Parent plan: `docs/exec-plans/active/2026-05-23_end-to-end-product-implementation.md` (Phase 7)  
Depends on: `docs/exec-plans/active/2026-05-23_mpris-player-discovery.md` (Phase 6)

## Objective

Wrap a single MPRIS player exposed on the session bus and emit normalized
`PlayerSnapshot` updates whenever its metadata, playback status, or position
ownership changes. The wrapper must be safe to construct, dispose, and replace
within GNOME Shell, and must compose with the Phase 6 discovery service so the
controller (Phase 8) can treat the live player set as a stream of normalized
snapshots.

This phase introduces no controller wiring, no UI changes, no lyrics behavior,
and no network behavior. Reading is read-only; LyricBar does not invoke
`Play`, `Pause`, `Next`, or any other player command in v1.

## Constraints

- Architectural constraints:
  - New code lives under `src/runtime/mpris/` (GJS-aware).
  - Domain (`src/domain/`) stays platform-free. The proxy converts raw MPRIS
    properties into the existing `PlayerSnapshot` shape using
    `src/domain/mpris/normalize.js`.
  - Each `PlayerProxy` instance creates one `Gio.DBusProxy` for an exact bus
    name. No wildcard names. No reuse across players.
  - Every `proxy.connect(...)` for `g-properties-changed` and any
    `Gio.Cancellable` created during async construction is registered with
    `LifecycleRegistry`. The Phase-6 architecture guardrail
    (`src/runtime/` requires `lifecycle.<method>(...)` cleanup wiring)
    must keep passing.
  - Async construction callbacks check a guarded `enabled` flag. If the proxy
    is disposed before construction finishes, the result is dropped without
    mutating state.
  - The proxy must tolerate the player vanishing mid-call: cancellation
    errors and `org.freedesktop.DBus.Error.ServiceUnknown`-class failures
    must not throw out of callbacks.
  - The proxy must not poll. Position polling is Phase 13.
- Product/runtime constraints:
  - Initial supported platform is GNOME Shell 46 on Ubuntu 24.04.
  - Spotify Desktop is the primary target player but the proxy must work for
    any MPRIS player (the discovery service already accepts arbitrary MPRIS
    bus names).
  - No install, enable, disable, or Shell reload on the user desktop without
    explicit owner approval.
- Out of scope:
  - Controller wiring (Phase 8).
  - Lyrics behavior, network, cache (Phases 9-12).
  - Position polling and lyric sync (Phase 13).
  - Preferences UI (Phase 14).
  - Diagnostics surfaces (Phase 15).
  - Player command actions (Play/Pause/Next).

## Acceptance Criteria

1. `src/runtime/mpris/player.js` exposes a `PlayerProxy` class (or equivalent
   exported API) constructed against a session-bus dependency, a target MPRIS
   bus name, and a `LifecycleRegistry`.
2. The proxy exposes:
   - `start()` to kick off async construction.
   - `onSnapshot(callback)` to subscribe to normalized snapshots.
   - `snapshot()` returning the latest `PlayerSnapshot | null`.
   - `dispose()` (or full lifecycle teardown via the registry) to release
     handlers, the cancellable, and the proxy reference.
3. Snapshots are produced through a pure mapping from raw MPRIS property
   bags to the existing `PlayerSnapshot` shape (Phase 5 normalization). The
   mapping is exported and unit-tested.
4. The proxy reacts to `g-properties-changed` and re-emits an updated snapshot
   only when the relevant fields change (title, artist, album, duration,
   track id, playback status). Spurious changes do not flood listeners.
5. Async construction is cancellable. Disposing before the proxy is built
   cancels the call without throwing or emitting a stale snapshot.
6. Player disappearance (`ServiceUnknown` or equivalent) is handled by
   emitting `null` once and then ignoring further activity for that proxy.
7. Pure logic (the property bag to snapshot mapping plus diff helpers) is
   covered by unit tests. Wire-level proxy behavior is verified through the
   Phase 8 runtime evidence path, not by mocking GJS.
8. `npm run verify` passes (including `check:architecture` with the
   runtime cleanup guardrail).

## Implementation Checklist

- [ ] Add `src/runtime/mpris/player-mapping.js` (pure):
  - [ ] `mapMprisProperties(busName, properties)` returns `PlayerSnapshot | null`.
  - [ ] `applyPropertyChanges(snapshot, changes)` returns the next snapshot or
        `null` if the snapshot identity becomes invalid.
  - [ ] `snapshotsEqual(a, b)` for change detection. Compares the
        normalized fields LyricBar consumes; ignores fields it does not use.
- [ ] Add `src/runtime/mpris/player.js` (GJS-aware):
  - [ ] `PlayerProxy` class with `#busName`, `#connection`, `#lifecycle`,
        `#enabled`, `#cancellable`, `#proxy`, `#snapshot`, `#listeners`.
  - [ ] `start()` runs `Gio.DBusProxy.new` (async) against
        `org.mpris.MediaPlayer2.Player` for the target bus name.
  - [ ] On success, build the initial snapshot from the cached properties,
        emit it, then subscribe to `g-properties-changed`.
  - [ ] On `g-properties-changed`, fold the change set into the current
        snapshot and emit only when `snapshotsEqual` is false.
  - [ ] On any error treated as player gone, emit `null` once and stop.
  - [ ] Register signal disconnect, cancellable cancel, and listener removal
        through `LifecycleRegistry`.
- [ ] Add `tests/mpris/player-mapping.test.js`:
  - [ ] Maps a fully populated property bag into a `PlayerSnapshot`.
  - [ ] Drops blank track ids, non-finite durations, and unknown playback
        statuses through the existing normalizer.
  - [ ] `applyPropertyChanges` updates only the fields present in the
        change set; preserves other fields.
  - [ ] `snapshotsEqual` returns true when only ignored fields differ.
- [ ] Extend `types/gjs.d.ts` only if necessary, kept narrow and permissive.
- [ ] Confirm `npm run check:architecture` still passes against
      `src/runtime/mpris/player.js`.
- [ ] Run the full verify gate and capture the test count delta in this plan.
- [ ] Update parent plan Phase 7 status block once verification is recorded.

## Decision Log

- 2026-05-23: Per-proxy lifecycle ownership over a shared registry ->
  the controller (Phase 8) will create and dispose proxies as players come
  and go, and the Lifecycle pattern lets each proxy participate in the same
  cleanup contract without inventing a parallel one.
- 2026-05-23: Pure mapping module separated from the GJS proxy ->
  property-bag handling is the part most likely to need targeted tests, and
  isolating it keeps the GJS surface area small.
- 2026-05-23: Emit `null` on player disappearance instead of throwing ->
  the controller can treat absence as a snapshot value rather than an
  error, which composes cleanly with Phase 8 selection logic.
- 2026-05-23: No commands, no position polling in this phase ->
  position polling is bounded by Phase 13 and command surfaces are out of
  scope for v1.

## Verification

Static gate:

```bash
npm run verify
```

Result:

```text
2026-05-23 21:11 — npm run verify passed
- verify:docs ok
- validate:metadata ok
- validate:schema ok
- check:architecture ok (runtime cleanup guardrail covers src/runtime/mpris/player.js)
- format:check ok
- lint ok
- typecheck ok
- vitest: 11 test files, 92 tests passed
- build:extension: dist/lyricbar@fikrilal.github.io.zip
  - bundle includes src/runtime/mpris/player.js
  - bundle includes src/runtime/mpris/player-mapping.js
```

Targeted checks during iteration:

```bash
npm run check:architecture
npm run lint
npm test
```

Commit lint check before pushing:

```bash
npx commitlint --from HEAD~1 --to HEAD --verbose
```

## Runtime Evidence

Captured by the human owner, not the agent. Phase 7 runtime evidence is
**deferred to Phase 8** where the controller subscribes to player snapshots
and the indicator reflects player presence. Until then this plan stays
active and the parent plan keeps Phase 7 marked In Progress.

Scenarios to capture in Phase 8:

- [ ] Spotify started, metadata reads correctly into the indicator track
      fallback display.
- [ ] Track skip mid-playback re-emits a snapshot with the new title and
      artist.
- [ ] Pause / resume changes `PlaybackStatus` between `Playing` and `Paused`
      in the snapshot stream.
- [ ] Quitting Spotify causes the proxy to emit a final snapshot or `null`
      and clean up without Shell errors.

## Risks And Mitigations

- Risk: `g-properties-changed` floods listeners during track changes.
  - Mitigation: emit only when `snapshotsEqual` is false; collapse change
    sets through a pure helper that ignores fields LyricBar does not use.
- Risk: Async `Gio.DBusProxy.new` resolves after disposal and mutates a
  destroyed proxy.
  - Mitigation: cancel the construction `Gio.Cancellable` in lifecycle
    teardown; guard the success callback with the `enabled` flag.
- Risk: Player disappearance during a property read throws into the
  callback.
  - Mitigation: catch error inside the callback, emit `null` once, and
    swallow further activity for this proxy.
- Risk: Strict TypeScript JSDoc checks reject permissive D-Bus property bag
  shapes.
  - Mitigation: model raw property bags as `Record<string, unknown>` at the
    boundary and narrow inside the pure mapper, mirroring the Phase 5
    normalize pattern.
- Risk: Different MPRIS players surface duration as int (microseconds) or
  float; sub-zero or NaN values appear in the wild.
  - Mitigation: convert MPRIS microsecond duration to milliseconds in the
    mapping layer and rely on the existing normalizer to clamp invalid
    values to `null`.
- Risk: Track-id strings differ across players (Spotify uses a path,
  others use opaque ids).
  - Mitigation: the normalizer already accepts arbitrary non-empty strings
    or `null`. The proxy uses the value only for change detection and
    cache keying upstream.

## Completion Notes

Static implementation landed on 2026-05-23. Sub-plan stays active until
Phase 8 captures the combined runtime evidence (Phase 6 evidence is also
deferred to Phase 8 for the same reason).

Key implementation choices:

- Pure mapper in `player-mapping.js` exposes `mapMprisProperties`,
  `applyPropertyChanges`, and `snapshotsEqual`. All tested without GJS.
- Property bag access uses a small `get(bag, key)` helper that both
  satisfies `noPropertyAccessFromIndexSignature` and the `dot-notation`
  ESLint rule by routing through `Reflect.get`.
- `merged` is typed with an explicit shape rather than
  `Record<string, unknown>` so dot-notation writes are safe.
- `microsecondsToMilliseconds` converts MPRIS `mpris:length` to the
  `durationMs` field LyricBar consumes, with negative/non-finite values
  collapsed to `null` by the existing normalizer.
- Artist arrays are joined with `, ` between non-empty trimmed entries.
  Spotify usually sends a single-element array; multi-artist tracks render
  as a comma-separated list.
- `PlayerProxy` in `player.js` owns one `Gio.DBusProxy`, one
  `Gio.Cancellable`, one `g-properties-changed` signal, and a listener
  set. All four are tracked through `LifecycleRegistry`.
- Async `Gio.DBusProxy.new` callback is guarded by `enabled` and `gone`
  flags. Cancellation is silent; other errors emit `null` once and stop.
- The proxy never polls. Position polling is bounded by Phase 13.

## Follow-Ups

- [ ] Update parent plan Phase 7 status block once verification lands.
- [ ] Add unresolved issues to `docs/exec-plans/tech-debt-tracker.md`.
- [ ] Move this plan to `docs/exec-plans/completed/` once Phase 8 captures
      the combined runtime evidence.
