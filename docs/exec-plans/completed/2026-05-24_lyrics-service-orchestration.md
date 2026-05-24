# Plan: Lyrics Service Orchestration

Date: 2026-05-24  
Owner: Dante  
Status: active  
Risk class: high  
Related issue/PR: N/A  
Parent plan: `docs/exec-plans/active/2026-05-23_end-to-end-product-implementation.md` (Phase 12)  
Depends on:

- `docs/exec-plans/completed/2026-05-23_lrclib-response-parsing.md` (Phase 9)
- `docs/exec-plans/active/2026-05-24_lrclib-runtime-provider.md` (Phase 10)
- `docs/exec-plans/active/2026-05-24_lyrics-cache.md` (Phase 11)

## Objective

Add a `LyricsService` runtime class that ties the active-player
metadata stream from the controller to the LRCLIB provider and the
local cache, and exposes a `LyricsProviderResult | null` stream for
the controller to render.

The service must:

- Build a `LyricsQuery` from a `PlayerSnapshot`.
- Check the cache first; on hit, emit the cached result.
- On miss, call the provider, write the result to the cache, and
  emit it.
- Suppress stale lookup callbacks on track change and cancel all
  in-flight provider/cache work on disable through lifecycle cleanup.
- Treat empty / partial metadata as an immediate `not-found` without
  hitting the network or filesystem.
- Never throw out of an async callback.
- Cooperate with `LifecycleRegistry` so disable releases everything
  cleanly.

This phase also wires the service into `LyricBarController` and adds
a pure mapping from `(player snapshot, lyrics result)` into the
existing display state model so the indicator can transition between
`loading`, `track`, `lyrics`, and `error` without lyric-line
selection (Phase 13 owns line synchronization).

This phase captures the combined Phase 10 + Phase 11 + Phase 12
runtime evidence.

## Constraints

- Architectural constraints:
  - Pure logic for (snapshot, result) → display state lives under
    `src/domain/display/` so the controller stays an orchestrator.
  - Service code lives under `src/runtime/lyrics/service.js` with no
    direct UI references.
  - The service depends on the existing `LrclibProvider`,
    `LyricsCache`, and `LyricsQuery` boundaries; it does not import
    `Soup`, `Gio`, or `GLib` directly except where strictly necessary
    for cancellation.
  - Each in-flight lookup carries a generation counter; only the
    most recent lookup is allowed to emit. Earlier lookups are
    dropped on completion if a newer query has started. Phase 12 does
    not expose per-track cancellables through the service boundary;
    per-call cancellation remains owned by provider/cache adapters and
    is triggered by lifecycle disposal.
  - The controller emits a synthetic `not-found` result when the
    active player becomes null so the indicator falls back through
    Phase 2 display rules.
  - Disable cancels in-flight requests; cancellation is observable
    via the per-call cancellable already wired by the provider
    and cache.
  - The architecture cleanup guardrail keeps passing
    (`src/runtime/lyrics/service.js` registers any cancellables and
    timers it creates).
- Product/runtime constraints:
  - Initial supported platform is GNOME Shell 46 on Ubuntu 24.04.
  - LRCLIB calls remain the only network egress.
  - Cache writes happen only after a successful round-trip (positive
    or negative). The `error` kind is also cached but with the short
    negative TTL so transient failures expire quickly.
  - No retry on `error`; Phase 12 deliberately keeps a single attempt
    per track identity and lets the negative TTL carry the cooldown.
  - No position polling here — Phase 13 owns the synchronization
    loop.
- Out of scope:
  - Position polling and lyric line selection updates (Phase 13).
  - Preferences UI changes (Phase 14).
  - Diagnostics surfaces (Phase 15).
  - Telemetry / analytics — none.

## Acceptance Criteria

1. `src/domain/display/lyrics-state.js` exports
   `displayStateFromLookup(player, lookup)` returning a `DisplayState`:
   - Player is null → `{ kind: 'idle' }`.
   - Lookup is null and player is non-null → `{ kind: 'loading', track }`.
   - Lookup is `synced` → `{ kind: 'lyrics', track, line }` where
     `line` is the first parsed lyric line text (Phase 13 will
     replace the line-selection step with a position-driven update).
   - Lookup is `plain` → `{ kind: 'lyrics', track, line }` where
     `line` is the first non-empty plain line (or `''` if none).
   - Lookup is `instrumental` → `{ kind: 'track', track }` (the
     existing fallback formatter renders the track text).
   - Lookup is `not-found` → `{ kind: 'track', track }`.
   - Lookup is `error` → `{ kind: 'error', track }`.
2. `src/runtime/lyrics/service.js` exports a `LyricsService` class:
   - Constructor `(lifecycle, provider, cache)`.
   - `setActivePlayer(player)` — call when the controller's selection
     changes; bumps the generation counter, suppresses stale lookup
     callbacks, and emits the latest `LyricsProviderResult | null` to
     listeners after the cache + provider chain completes.
   - `onLookupChanged(callback)` — register a listener; immediately
     invoked with the current state.
   - `dispose()` is implicit through the lifecycle parent.
3. The service short-circuits to `not-found` without touching the
   provider or cache when the player snapshot has empty title or
   artist.
4. Generation counter logic prevents stale results from emitting:
   - When `setActivePlayer` is called with a new track identity,
     the generation increments; in-flight callbacks check their
     generation against the current and return early on mismatch.
   - The same player snapshot does not retrigger a lookup; identity
     is determined by `(busName, trackId, title, artist, album,
durationMs)` so micro-changes (e.g. position-only updates)
     are ignored.
5. The controller wires the service:
   - On enable: instantiate `LrclibProvider`, `LyricsCache`, and
     `LyricsService` with the controller's `LifecycleRegistry`.
   - On every active-player change in `#refreshSelection`: call
     `service.setActivePlayer(active)`.
   - On every lookup result: build display state via
     `displayStateFromLookup` and call `#render`.
6. `npm run verify` passes (architecture cleanup guardrail,
   prettier, lint, tsc, vitest, build).
7. Combined runtime evidence captured on GNOME Shell 46 covering:
   - Spotify track with synced lyrics matched on LRCLIB → indicator
     shows the first lyric line.
   - Spotify track with no lyrics → indicator falls back to track
     text.
   - Network disconnected mid-lookup → indicator shows error
     fallback (or track text per fallback mode).
   - Repeat the same track twice → second lookup is a cache hit (no
     LRCLIB request observed in logs).
   - Disable extension during in-flight lookup → no Shell errors,
     no leaked cancellables.
8. Phase 10 and Phase 11 sub-plans get marked complete and moved to
   `docs/exec-plans/completed/` after evidence is recorded; Phase 12
   sub-plan does the same.

## Implementation Checklist

- [ ] Add `src/domain/display/lyrics-state.js` (pure):
  - [ ] `displayStateFromLookup(player, lookup): DisplayState`.
  - [ ] Helper `extractFirstLine(result): string` for synced and
        plain results.
- [ ] Add `tests/display/lyrics-state.test.js` covering every result
      kind plus null player and null lookup.
- [ ] Add helper `buildTrackIdentityKey(player)` (pure) in
      `src/domain/lyrics/track-identity.js` so `setActivePlayer` can
      detect "same track" cheaply.
- [ ] Add `tests/lyrics/track-identity.test.js`.
- [ ] Add `src/runtime/lyrics/service.js`:
  - [ ] `LyricsService` class with `#lifecycle`, `#provider`,
        `#cache`, `#listeners`, `#generation`, `#currentKey`,
        `#currentResult`, `#currentPlayer`.
  - [ ] `setActivePlayer(player)` short-circuit when key matches the
        current key. Increment generation otherwise.
  - [ ] Empty / partial metadata short-circuits to `not-found`
        without provider or cache calls.
  - [ ] Cache `get`; on hit, emit and return. On miss, provider
        `lookup`; on result, cache `put`, emit.
  - [x] Stale-result guard: every callback compares the captured
        generation to the current generation.
  - [ ] On disable, the `LifecycleRegistry` releases the provider's
        Soup session, the cache's cancellables, and the service's
        listener set.
- [ ] Update `src/runtime/controller.js`:
  - [ ] Instantiate `LrclibProvider`, `LyricsCache`, `LyricsService`
        on enable.
  - [ ] Subscribe to lookup changes; cache the latest in
        `#currentLookup` and rebuild the display state.
  - [ ] Replace `displayStateFromPlayer(active)` with a lookup-aware
        path: when no lookup is available yet for the active player,
        fall back to the existing track-only mapping.
- [ ] Run `npm run verify:safe` and capture the test count delta.
- [ ] Build the bundle and stop. Wait for explicit owner approval
      before any install / enable / disable / Shell reload.
- [ ] Capture combined runtime evidence on GNOME Shell 46 for
      Phases 10, 11, and 12.
- [ ] Mark Phase 10, Phase 11, and Phase 12 sub-plans complete and
      move them to `docs/exec-plans/completed/`.
- [ ] Update parent plan Phase 12 status block.

## Decision Log

- 2026-05-24: Generation counter rather than per-call cancellable
  for the "stale result" check -> cancellation already lives in the
  provider and cache; the service only needs to filter out late
  callbacks for tracks that have moved on.
- 2026-05-24: Track identity built from `(busName, trackId, title,
artist, album, durationMs)` -> the `trackId` alone is unstable
  across MPRIS players (Spotify uses paths, others use opaque ids),
  but adding the normalized fields gives a stable key without losing
  useful re-fetch behavior across providers.
- 2026-05-24: Empty metadata short-circuits to `not-found` rather
  than `error` -> when Spotify spins up but has no track yet,
  rendering "Lyrics unavailable" is misleading; the existing track
  fallback path is the right UX.
- 2026-05-24: Errors are cached with the short negative TTL ->
  matches the Phase 11 cache-policy decision and prevents the
  service from hitting LRCLIB on every snapshot during sustained
  outages.
- 2026-05-24: First-line emission for synced and plain results in
  this phase -> the indicator shows something useful immediately;
  Phase 13 swaps the line-selection step with position-driven
  updates without changing the display-state shape.
- 2026-05-24: `displayStateFromLookup` is pure and lives under
  `src/domain/display/` -> consistent with `displayStateFromPlayer`
  and stays platform-free.

## Verification

Static safe gate:

```bash
npm run verify:safe
```

Result:

```text
2026-05-24 11:13 — npm run verify passed
- verify:docs ok
- validate:metadata ok
- validate:schema ok
- check:architecture ok (runtime cleanup guardrail covers service.js and controller.js)
- format:check ok
- lint ok
- typecheck ok
- vitest: 18 test files, 161 tests passed
- build:extension: dist/lyricbar@fikrilal.github.io.zip
  - bundle includes src/domain/display/lyrics-state.js
  - bundle includes src/domain/lyrics/track-identity.js
  - bundle includes src/runtime/lyrics/service.js
  - controller.js wires LrclibProvider + LyricsCache + LyricsService
```

2026-05-24 11:36 — targeted `npm test -- tests/lyrics/service.test.js` passed

- 1 test file
- 6 LyricsService orchestration tests passed

2026-05-24 11:36 — `npm run lint` passed after adding service tests

2026-05-24 11:37 — `npm run verify:safe` passed after service and settings-change coverage

- verify:docs ok
- validate:metadata ok
- validate:schema ok
- check:architecture ok
- format:check ok
- lint ok
- typecheck ok
- vitest: 20 test files, 171 tests passed
- build:extension: dist/lyricbar@fikrilal.github.io.zip

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

Captured by the human owner. This is the combined runtime evidence
for Phases 10, 11, and 12.

- GNOME Shell version: pending
- Session type (X11 / Wayland): pending
- Distro: pending
- Player(s) used: Spotify Desktop (primary), other MPRIS players if
  available
- Scenarios:
  - [ ] Spotify track with synced lyrics on LRCLIB → indicator
        shows the first lyric line.
  - [ ] Spotify track with no LRCLIB match → indicator shows track
        fallback text.
  - [ ] Network disconnected mid-lookup → indicator shows error or
        fallback text per fallback mode.
  - [ ] Repeat the same track twice → second lookup is a cache hit
        (no LRCLIB request observed in logs).
  - [ ] Disable extension while a lookup is in flight → no Shell
        errors in `journalctl --user -f`.
  - [ ] Cache directory `${user-cache-dir}/lyricbar/cache-v1/`
        exists with a JSON file per attempted track.
- Diagnostic commands:

  ```bash
  ls "${XDG_CACHE_HOME:-$HOME/.cache}/lyricbar/cache-v1/"
  cat "${XDG_CACHE_HOME:-$HOME/.cache}/lyricbar/cache-v1/<file>" \
    | python3 -m json.tool
  journalctl --user -f -o cat | grep -i lyricbar
  ```

- Artifact path(s): pending
- Notes: pending

## Risks And Mitigations

- Risk: Multiple in-flight lookups race and the older one wins.
  - Mitigation: generation counter; every callback short-circuits if
    its generation no longer matches the service's current
    generation.
- Risk: A flapping player produces lookup churn and exceeds LRCLIB
  rate limits.
  - Mitigation: track identity changes are filtered through the
    `(busName, trackId, ...metadata)` key, so micro-updates do not
    trigger re-fetch. Cache writes additionally absorb repeat lookups
    within the TTL window.
- Risk: An in-flight provider lookup completes after disable and
  mutates destroyed state.
  - Mitigation: provider already cancels the per-call cancellable on
    lifecycle disposal; the service callback also checks the
    generation counter and the lifecycle's disposed state through a
    boolean flag.
- Risk: Cache writes outlive the service.
  - Mitigation: the cache's per-call cancellable is registered with
    the lifecycle; disposal cancels in-flight writes.
- Risk: `displayStateFromLookup` emits `error` aggressively and the
  indicator looks unreliable.
  - Mitigation: errors are returned only for genuine provider /
    network failures; not-found and instrumental tracks fall back to
    track text. The Phase 2 display formatter already handles
    fallback mode preference.

## Completion Notes

Pending implementation.

## Follow-Ups

- [ ] Update parent plan Phase 12 status block once evidence lands.
- [ ] Mark Phase 10, Phase 11, and Phase 12 sub-plans complete and
      move to `docs/exec-plans/completed/`.
- [ ] Add unresolved issues to `docs/exec-plans/tech-debt-tracker.md`.
- [ ] Phase 13 will replace the first-line emission with
      position-driven line selection.
