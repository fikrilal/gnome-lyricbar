# Plan: MPRIS Player Discovery

Date: 2026-05-23  
Owner: Dante  
Status: active  
Risk class: high  
Related issue/PR: N/A  
Parent plan: `docs/exec-plans/active/2026-05-23_end-to-end-product-implementation.md` (Phase 6)

## Objective

Add a runtime D-Bus service that discovers MPRIS-compatible media players on the
GNOME session bus and emits a stable list of MPRIS bus names to the controller.

Discovery must be safe to enable and disable inside GNOME Shell, must not use
wildcard D-Bus name watching, and must clean up every signal handler, proxy
subscription, and cancellable through the existing `LifecycleRegistry`.

This phase introduces no UI behavior, no controller wiring, and no player
property reading. Reading metadata/playback state happens in Phase 7. Connecting
discovery to the controller and indicator happens in Phase 8.

## Constraints

- Architectural constraints:
  - New code lives under `src/runtime/mpris/` (GJS-aware runtime layer).
  - Domain (`src/domain/`) must remain platform-free; no GJS imports added there.
  - Discovery uses `org.freedesktop.DBus.ListNames` plus a `NameOwnerChanged`
    subscription on `org.freedesktop.DBus`. Wildcard `Gio.bus_watch_name` is
    forbidden by `eslint.config.js` and `scripts/check-architecture.mjs`.
  - All `connect(...)`, `Gio.Cancellable`, and async-callback resources must be
    tracked by `LifecycleRegistry` so disable releases everything.
  - Async callbacks must be guarded against post-disable state mutation.
  - The service must not read player metadata, playback status, or position in
    this phase. Those concerns belong to Phase 7.
  - The controller is not modified in this phase. Wiring belongs to Phase 8.
- Product/runtime constraints:
  - Initial supported platform is GNOME Shell 46 on Ubuntu 24.04.
  - Spotify Desktop is the primary target player but discovery must work for any
    MPRIS-compatible player.
  - No install, enable, disable, or Shell reload on the user desktop without
    explicit approval.
- Out of scope:
  - Reading `Metadata`, `PlaybackStatus`, or `Position`.
  - Active-player selection (already implemented in Phase 5 domain).
  - Lyrics behavior, network behavior, cache behavior.
  - Indicator rendering changes.
  - Preferences UI changes.
  - Diagnostics surfaces.

## Acceptance Criteria

1. `src/runtime/mpris/service.js` exposes an `MprisService` (or equivalent
   exported API) that, when started against a `LifecycleRegistry` and a session
   D-Bus connection, emits the current set of `org.mpris.MediaPlayer2.*` bus
   names.
2. The service handles three runtime scenarios without leaking handlers, hanging
   the Shell, or throwing into a callback:
   1. Zero MPRIS players present at start.
   2. An MPRIS player appears after start.
   3. An MPRIS player disappears while running.
3. The service uses exact D-Bus names: subscription is on `org.freedesktop.DBus`
   with `NameOwnerChanged` filtering for the MPRIS prefix in JavaScript. No
   wildcard `Gio.bus_watch_name` usage anywhere in runtime code.
4. All `connect(...)` calls and any `Gio.Cancellable` instances introduced by
   this phase are tracked through `LifecycleRegistry`. The architecture checker
   verifies that runtime files using `.connect()` or `Gio.Cancellable` also
   reference `lifecycle.*(` (e.g., `addSignal`, `addCancellable`) for cleanup
   wiring.
5. Async `ListNames` callbacks check a guarded `enabled` flag (or equivalent
   cancellable result handling) and never mutate service state after dispose.
6. Pure logic that can be unit tested (MPRIS-prefix filtering, set diffing,
   change-event shaping) is exported and covered by tests under
   `tests/mpris/`. Wire-level D-Bus behavior is verified through runtime
   evidence rather than unit tests.
7. `npm run verify` passes (validate-docs, validate-metadata, validate-schema,
   check-architecture, prettier, eslint, tsc, vitest, build:extension).
8. Runtime evidence is captured on GNOME Shell 46 before the parent plan
   marks Phase 6 complete (zero players, player launch, player quit, D-Bus
   names listed). Evidence is recorded in this plan's Runtime Evidence section
   and linked from the parent plan.

## Implementation Checklist

- [ ] Add `src/runtime/mpris/service.js` with `MprisService` class:
  - [ ] `constructor(connection, lifecycle)` accepts a `Gio.DBusConnection`-shaped
        dependency and a `LifecycleRegistry`.
  - [ ] `start()` triggers an initial `ListNames` call and subscribes to
        `NameOwnerChanged`.
  - [ ] `onPlayersChanged(callback)` registers a listener and returns nothing
        (cleanup handled by lifecycle).
  - [ ] Exposes a guarded `enabled` flag and a `Gio.Cancellable` for the initial
        `ListNames` call.
  - [ ] Emits a stable `readonly string[]` of MPRIS bus names on every change.
- [ ] Add `src/runtime/mpris/discovery.js` (or split helpers inline) for pure
      bus-name filtering and set-diff logic, importable into tests.
- [ ] Add `tests/mpris/discovery.test.js` covering:
  - [ ] MPRIS prefix filtering (accepts `org.mpris.MediaPlayer2.spotify`,
        rejects `org.example.NotMpris`, rejects `org.mpris.MediaPlayer2.`).
  - [ ] Set-diff of previous vs current MPRIS names.
  - [ ] `NameOwnerChanged`-shaped event reduction (player added when old owner
        empty and new owner present, player removed when new owner empty).
- [ ] Extend `types/gjs.d.ts` with the minimal `Gio.DBusConnection` and
      `Gio.Cancellable` shapes the service uses, keeping them narrow.
- [ ] Confirm `scripts/check-architecture.mjs` recognises `connect(...)` and
      `Gio.Cancellable` usage in `src/runtime/` as cleanup-tracked when wired to
      `LifecycleRegistry`.
- [ ] Run `npm run verify` and capture the test count delta.
- [ ] Build the extension bundle through `npm run build:extension` and verify
      the bundle includes `src/runtime/mpris/`.
- [ ] Pause for explicit approval before any install/enable/disable on the
      user desktop, then capture runtime evidence.
- [ ] Update parent plan Phase 6 status with implementation summary and
      evidence link once runtime evidence is complete.

## Decision Log

- 2026-05-23: Use `ListNames` + `NameOwnerChanged` on `org.freedesktop.DBus`
  instead of `Gio.bus_watch_name` -> the codebase forbids wildcard watching and
  per-player `bus_watch_name` would not surface unknown future players.
- 2026-05-23: Phase emits raw bus-name sets rather than `PlayerSnapshot`s ->
  metadata reading is Phase 7's responsibility, and keeping the surfaces
  separate makes lifecycle reasoning simpler.
- 2026-05-23: Pure helpers (filter, diff) live next to the runtime service but
  stay free of GJS imports so they can be exercised by vitest without mocking
  D-Bus.
- 2026-05-23: Runtime evidence will be captured by the human owner; agent will
  not run `gnome-extensions install`, `gnome-extensions enable`, or any Shell
  reload command.

## Verification

Static gate:

```bash
npm run verify
```

Result:

```text
2026-05-23 20:58 — npm run verify passed
- verify:docs ok
- validate:metadata ok
- validate:schema ok
- check:architecture ok
- format:check ok
- lint ok
- typecheck ok
- vitest: 10 test files, 81 tests passed
- build:extension: dist/lyricbar@fikrilal.github.io.zip
  - bundle includes src/runtime/mpris/discovery.js
  - bundle includes src/runtime/mpris/service.js
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

Required before Phase 6 is closed in the parent plan. Captured by the human
owner, not the agent.

- GNOME Shell version: pending
- Session type (X11 / Wayland): pending
- Distro: pending
- Player: Spotify Desktop (primary), other MPRIS players if available
- Scenarios:
  - [ ] Zero players running -> service starts, emits empty list, no errors in
        `journalctl --user -f`.
  - [ ] Spotify launched after extension enabled -> service emits a list
        containing `org.mpris.MediaPlayer2.spotify`.
  - [ ] Spotify quit while extension active -> service emits a list without
        `org.mpris.MediaPlayer2.spotify`, no orphaned signal handlers.
  - [ ] Disable extension while a player is running -> no Shell errors, no
        leaked timeouts/handlers.
- Commands used for diagnosis:

  ```bash
  gdbus call --session \
    --dest org.freedesktop.DBus \
    --object-path /org/freedesktop/DBus \
    --method org.freedesktop.DBus.ListNames

  journalctl --user -f -o cat | grep -i lyricbar
  ```

- Artifact path(s): pending
- Notes: pending

## Risks And Mitigations

- Risk: Bad D-Bus subscription handling can leak signal handlers in the GNOME
  Shell process.
  - Mitigation: every `connect(...)` / cancellable goes through
    `LifecycleRegistry`; `scripts/check-architecture.mjs` enforces the rule.
- Risk: Wildcard `bus_watch_name` would trigger Shell-level assertions.
  - Mitigation: no `bus_watch_name` usage; `eslint.config.js` blocks wildcard
    literals; static check fails the verify gate.
- Risk: Late-firing async `ListNames` callback fires after disable and mutates
  state on a destroyed service.
  - Mitigation: `Gio.Cancellable` cancelled by the lifecycle; service guards a
    boolean `enabled` flag and ignores results when disposed.
- Risk: Race between `NameOwnerChanged` events and the initial `ListNames`
  result causes duplicate or missing entries.
  - Mitigation: hold a single `Set<string>` of current names; reduce both
    `ListNames` results and `NameOwnerChanged` events into the same set;
    re-emit only on actual diffs.
- Risk: Different MPRIS players have unusual bus name suffixes (e.g. Firefox
  instances) that we filter incorrectly.
  - Mitigation: filter strictly on the `org.mpris.MediaPlayer2.` prefix and
    require at least one trailing character; cover with unit tests.
- Risk: Phase 7 / Phase 8 changes require the discovery API to grow in
  unexpected ways.
  - Mitigation: keep the surface area minimal (start, listener registration,
    bus-name list) and document the next-phase consumer expectations in the
    parent plan.

## Completion Notes

Static implementation landed on 2026-05-23. Pending owner-captured runtime
evidence on GNOME Shell 46 before this plan moves to `completed/`.

Key implementation choices:

- Two-file split inside `src/runtime/mpris/`: pure helpers in
  `discovery.js` (testable without GJS) and the GJS-aware `MprisService` in
  `service.js`.
- Initial state seeded with one async `ListNames` call against
  `org.freedesktop.DBus`, parsed from a `(as)` variant.
- Live updates driven by `signal_subscribe` on `NameOwnerChanged`; filter on
  the MPRIS prefix happens in JavaScript so subscription stays exact-name.
- All cleanup tracked through `LifecycleRegistry`: cancellable for the
  initial call, signal unsubscribe + `enabled` flag for the live
  subscription, and listener registrations removed on dispose.
- Async callbacks short-circuit when `enabled` is false; cancelled
  `ListNames` errors are swallowed, real errors hit `console.error`.

The service only emits raw bus-name lists. Phase 7 will wrap each name in a
`PlayerSnapshot` proxy. Phase 8 will subscribe the controller to player-list
updates.

## Follow-Ups

- [ ] Update parent plan Phase 6 status block with summary and verification
      evidence after completion.
- [ ] Add unresolved issues to `docs/exec-plans/tech-debt-tracker.md`.
- [ ] Move this plan to `docs/exec-plans/completed/` once runtime evidence is
      captured and parent plan is updated.
