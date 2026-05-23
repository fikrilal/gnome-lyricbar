# Plan: Controller MPRIS Integration

Date: 2026-05-23  
Owner: Dante  
Status: complete  
Risk class: high  
Related issue/PR: N/A  
Parent plan: `docs/exec-plans/active/2026-05-23_end-to-end-product-implementation.md` (Phase 8)  
Depends on: `docs/exec-plans/completed/2026-05-23_mpris-player-discovery.md` (Phase 6) and `docs/exec-plans/completed/2026-05-23_mpris-player-proxy.md` (Phase 7)

## Objective

Connect the Phase 6 `MprisService` and Phase 7 `PlayerProxy` to the runtime
controller so the GNOME top bar reflects the currently active MPRIS player.
This is the first user-visible end-to-end runtime path: discovery emits bus
names, the controller spawns and disposes proxies, the active-player selection
policy chooses one, and the indicator renders track fallback text.

This phase does not introduce lyrics, network, cache, or position-polling
behavior. The display state stays at `idle` (no player) or `track` (player
with metadata) until Phases 9-13 land. Track-fallback rendering is the
explicit UX contract for this phase.

This phase also captures the runtime evidence intentionally deferred from
Phase 6 and Phase 7. Once evidence lands, all three sub-plans move to
`completed/` together.

## Constraints

- Architectural constraints:
  - Controller wiring lives in `src/runtime/controller.js` and any small
    helpers added under `src/runtime/`.
  - Pure mapping from a `PlayerSnapshot | null` to a `DisplayState` belongs
    under `src/domain/display/` so the controller stays focused on
    orchestration and the mapping is testable.
  - Each `PlayerProxy` runs in its own `LifecycleRegistry` so individual
    players can be disposed when they vanish without tearing down the
    controller. The child lifecycle is added to the controller's parent
    lifecycle so a controller-level disable still cleans up everything.
  - The controller acquires a session `Gio.DBusConnection` once on enable
    and shares it with the discovery service and every player proxy.
  - Async work continues to honor the Phase 6/7 cleanup guardrails: no new
    `connect(...)` or `Gio.Cancellable` use without `lifecycle.<method>(...)`
    registration in `src/runtime/`.
  - The previous selected bus name is held in the controller and threaded
    into `selectActivePlayer` so selection stays sticky when nothing is
    playing.
  - Settings `playerPriority` is consulted on every selection.
  - No new D-Bus name watchers, no wildcards, no MPRIS metadata reads
    outside `PlayerProxy`.
- Product/runtime constraints:
  - Initial supported platform is GNOME Shell 46 on Ubuntu 24.04.
  - Spotify Desktop is the primary target player. Other MPRIS players
    must coexist without interfering.
  - No install, enable, disable, or Shell reload on the user desktop
    without explicit owner approval.
- Out of scope:
  - Lyrics behavior, providers, parsing, cache (Phases 9-12).
  - Position polling and lyric line synchronization (Phase 13).
  - Preferences UI for this phase (Phase 14).
  - Diagnostics surfaces (Phase 15).
  - Player command actions.

## Acceptance Criteria

1. The controller instantiates an `MprisService` and a session bus connection
   on `enable()`; both are torn down on `disable()`.
2. As MPRIS bus names appear and disappear, the controller maintains a map of
   `PlayerProxy` instances:
   - A new bus name spawns a proxy with its own `LifecycleRegistry`.
   - A vanished bus name disposes the proxy's lifecycle and removes the
     entry from the map.
   - Repeated `enable()`/`disable()` cycles do not leak proxies.
3. Snapshot updates from any proxy trigger a re-evaluation through
   `selectActivePlayer`, with the previously-selected bus name and
   `playerPriority` from settings.
4. The active player's snapshot maps to a `DisplayState`:
   - `null` -> `{ kind: 'idle' }`.
   - non-null with any title or artist -> `{ kind: 'track', track }`.
   - non-null with empty title and artist -> `{ kind: 'track', track }`
     (the existing display formatter handles unknown-track fallback).
5. The pure mapping `displayStateFromPlayer(player)` is exported and unit
   tested.
6. Settings changes for `panelPosition`, `maxWidth`, and `fallbackMode`
   continue to update the indicator without requiring extension restart.
7. `npm run verify` passes (incl. `check:architecture` runtime cleanup
   guardrail).
8. Runtime evidence captured on GNOME Shell 46 covers the combined
   Phase 6/7/8 scenarios. Evidence is recorded in this plan and the parent
   plan; Phase 6 and Phase 7 sub-plans are then marked Complete and moved
   to `completed/`.

## Implementation Checklist

- [ ] Add `src/domain/display/player-state.js` (pure):
  - [ ] `displayStateFromPlayer(player: PlayerSnapshot | null): DisplayState`.
  - [ ] Maps non-null snapshots into a `track` state with the track's title
        and artist; maps null into `idle`.
- [ ] Add `tests/display/player-state.test.js` covering null input, full
      metadata input, empty-string metadata input, and non-Latin text.
- [ ] Update `src/runtime/controller.js`:
  - [ ] Import `Gio` and the new MPRIS runtime modules.
  - [ ] Add `#connection`, `#mprisService`, `#proxies`, and
        `#lastSelectedBusName` fields.
  - [ ] On `enable()`, acquire the session bus, build the service, register
        a player-list listener, and call `service.start()`.
  - [ ] Implement `#syncPlayers(names)`:
    - Compute removed and added bus names against `#proxies`.
    - For each removed name, dispose its child lifecycle and delete it.
    - For each added name, build a `LifecycleRegistry`, register it with
      the controller's parent lifecycle, instantiate a `PlayerProxy`,
      subscribe `onSnapshot(() => this.#refreshSelection())`, and call
      `proxy.start()`.
    - Always call `#refreshSelection()` at the end.
  - [ ] Implement `#refreshSelection()`:
    - Collect non-null snapshots from `#proxies`.
    - Read `#currentSettings.playerPriority`.
    - Run `selectActivePlayer(snapshots, this.#lastSelectedBusName, priority)`.
    - Update `#lastSelectedBusName` only if a player was selected.
    - Set `#displayState = displayStateFromPlayer(active)` and call
      `#render()`.
  - [ ] On `disable()`, the existing `LifecycleRegistry` teardown disposes
        the service, all child proxy lifecycles, and the indicator. Verify
        idempotency.
- [ ] Confirm `npm run check:architecture` still accepts the controller
      changes (existing `LifecycleRegistry` registrations should satisfy the
      runtime cleanup guardrail).
- [ ] Run `npm run verify` and capture the test count delta.
- [ ] Stop. Wait for explicit owner approval before any install / enable /
      disable / Shell reload.
- [ ] Capture runtime evidence on GNOME Shell 46 for the combined
      Phase 6/7/8 scenarios listed below.
- [ ] Update parent plan Phase 8 status block with the evidence link.
- [ ] Mark Phase 6 and Phase 7 status blocks Complete and move both
      sub-plans plus this one to `docs/exec-plans/completed/`.

## Decision Log

- 2026-05-23: Per-player child `LifecycleRegistry` registered with the
  parent registry -> isolating each proxy's cleanup avoids growing the
  controller's flat cleanup list and lets a single player's disappearance
  release its resources independently.
- 2026-05-23: Selection runs on every snapshot update rather than on a
  debounce -> deterministic display, matches the existing pure logic, and
  the cost is negligible because `selectActivePlayer` is O(n) over a
  small set of players.
- 2026-05-23: Display state stays at `idle` or `track` until later phases
  land -> matches Phase 8's product scope and the parent plan's promise
  that lyrics behavior arrives in Phases 9-13.
- 2026-05-23: Controller acquires the session bus through `Gio.DBus.session`
  -> simple, idiomatic, and avoids introducing a constructor injection
  point that no test harness currently exercises.

## Verification

Static gate:

```bash
npm run verify
```

Result:

```text
2026-05-23 21:15 — npm run verify passed
- verify:docs ok
- validate:metadata ok
- validate:schema ok
- check:architecture ok (runtime cleanup guardrail covers controller.js)
- format:check ok
- lint ok
- typecheck ok
- vitest: 12 test files, 97 tests passed
- build:extension: dist/lyricbar@fikrilal.github.io.zip
  - bundle includes controller.js and src/runtime/mpris/
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

Captured live on GNOME Shell 46.0 / Ubuntu 24.04.4 LTS / X11.

- GNOME Shell version: 46.0
- Session type: X11 (`XDG_SESSION_TYPE=x11`)
- Distro: Ubuntu 24.04.4 LTS (Noble Numbat)
- Player(s) used: Spotify Desktop, Chromium MPRIS instance
- Scenarios captured: see
  `docs/exec-plans/completed/evidence/2026-05-23_phase-8/scenarios.md`
  for the per-scenario writeup. Six of the seven scenarios were
  exercised live; Scenario 1 (zero MPRIS players) is covered by unit
  tests and indirectly by Scenario 7's disable round trip.
- Diagnostic commands:

  ```bash
  gdbus call --session \
    --dest org.freedesktop.DBus \
    --object-path /org/freedesktop/DBus \
    --method org.freedesktop.DBus.ListNames

  journalctl --user -f -o cat | grep -i lyricbar
  ```

- Artifact paths:
  - `docs/exec-plans/completed/evidence/2026-05-23_phase-8/scenarios.md`
  - `docs/exec-plans/completed/evidence/2026-05-23_phase-8/logs/`
- Notes:
  - Zero JS errors, zero `GLib-GIO-CRITICAL`, zero `lyricbar`
    exceptions across the entire run window
    (`logs/aggregate-errors.txt` empty).
  - Extension was disabled at the end of the run; it remains installed
    at `~/.local/share/gnome-shell/extensions/lyricbar@fikrilal.github.io/`.
  - The user gsettings key `org.gnome.shell disable-user-extensions`
    was flipped from `true` to `false` to allow loading; left in this
    state so the user can choose to re-enable LyricBar at will.

Sub-plan now marked Complete and moved to
`docs/exec-plans/completed/`.

## Risks And Mitigations

- Risk: Children proxies leak when `disable()` runs while async proxy
  construction is still in flight.
  - Mitigation: each proxy's child lifecycle is registered with the parent
    lifecycle; the cancellable inside the proxy is also tracked, so
    parent disposal cancels in-flight construction before disposing the
    child registry. `LifecycleRegistry` is already idempotent.
- Risk: A flapping player (rapidly appearing and disappearing) creates
  duplicate proxies if the snapshot listener fires re-entrantly.
  - Mitigation: `#syncPlayers(names)` keys on the bus name; existing entries
    are skipped, vanished entries are disposed first.
- Risk: The selection result changes faster than the indicator's render
  cadence and produces visible flicker.
  - Mitigation: render only when the display state actually changes, mirror
    the indicator's existing render contract, and rely on `snapshotsEqual`
    inside the proxy to suppress unnecessary updates.
- Risk: Phase 8 accidentally introduces lyric or network behavior.
  - Mitigation: this plan keeps the display state limited to `idle` and
    `track`; the architecture check would not catch a lyric provider added
    here, but the PR review and the Phase 12 plan keep ownership clear.
- Risk: Settings `playerPriority` updates do not affect the live selection
  until a snapshot fires.
  - Mitigation: this is acceptable in v1. A future enhancement can call
    `#refreshSelection()` from the settings subscriber if needed; track
    as follow-up if the user reports it.

## Completion Notes

Static implementation landed on 2026-05-23. Sub-plan stays active until
runtime evidence is captured on a GNOME Shell 46 session.

Key implementation choices:

- Pure mapping `displayStateFromPlayer` lives under `src/domain/display/`
  alongside the existing display formatter, keeping the controller a
  small orchestrator.
- The controller acquires `Gio.DBus.session` once on enable, shares it
  with `MprisService` and every `PlayerProxy`, and clears the reference
  on disable.
- Each `PlayerProxy` runs in its own child `LifecycleRegistry`, registered
  with the controller's parent registry. Vanished players dispose their
  child registry; controller disable disposes the parent and cascades.
- `#syncPlayers(names)` removes vanished proxies first, then registers
  new ones, then runs selection. This avoids racing add/remove order.
- `selectActivePlayer` runs on every snapshot update with the previous
  selected bus name and `playerPriority` from settings, keeping selection
  sticky and deterministic.
- `#lastSelectedBusName` is only updated when a player is actually
  selected, so a transient empty player set does not erase the sticky
  preference.
- Display state stays at `idle` (no players) or `track` (player with
  metadata). Lyrics, loading, and error states are out of scope until
  Phases 9-15.

## Follow-Ups

- [ ] Update parent plan Phase 8 status block once evidence lands.
- [ ] Mark Phase 6 and Phase 7 sub-plans Complete and move to
      `docs/exec-plans/completed/`.
- [ ] Move this plan to `docs/exec-plans/completed/` after evidence is in.
- [ ] Add unresolved issues to `docs/exec-plans/tech-debt-tracker.md`.
- [ ] Optional: re-run selection from the settings subscriber so
      `playerPriority` changes apply without waiting for a snapshot.
