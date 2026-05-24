# Plan: LRCLIB Runtime Provider

Date: 2026-05-24  
Owner: Dante  
Status: active  
Risk class: high  
Related issue/PR: N/A  
Parent plan: `docs/exec-plans/active/2026-05-23_end-to-end-product-implementation.md` (Phase 10)  
Depends on: `docs/exec-plans/completed/2026-05-23_lrclib-response-parsing.md` (Phase 9)

## Objective

Add a runtime adapter that fetches lyrics from LRCLIB over HTTPS,
applies a request timeout, runs through `Gio.Cancellable`, and returns
the provider-neutral `LyricsProviderResult` produced by the Phase 9
parser. The adapter is the only place in the codebase that performs
network I/O for lyrics. It does not touch the indicator, the
controller, the cache, or the synchronization loop in this phase;
those wires land in Phases 11-13.

## Constraints

- Architectural constraints:
  - All network code lives under `src/runtime/lyrics/`. No
    `src/domain/` file imports `Soup`, `Gio`, `GLib`, or anything
    network-related.
  - Pure helpers (URL building, status-code mapping, body extraction)
    live alongside the runtime adapter so they can be unit tested
    without a live Session, mirroring the Phase 6 / Phase 7 / Phase 9
    split between `discovery.js` / `service.js`,
    `player-mapping.js` / `player.js`, and
    `provider-result.js`.
  - Every `Gio.Cancellable` and any `connect(...)` introduced by this
    phase is registered with `LifecycleRegistry`. The Phase 6
    architecture guardrail (`src/runtime/` cleanup must reference
    `lifecycle.<method>(...)`) keeps passing.
  - Async callbacks check a guarded flag and return early after the
    adapter has been disposed; in-flight requests are cancelled
    through the lifecycle.
  - No global Session: each `LrclibProvider` instance owns its own
    `Soup.Session` and per-call `Gio.Cancellable`, so a controller-
    level disable cancels every in-flight request.
  - Default timeout is conservative (10s) and configurable through
    the constructor for tests.
  - The adapter never mutates the indicator, controller, or any
    shared state. It only invokes the supplied callback.
- Product/runtime constraints:
  - Initial supported platform is GNOME Shell 46 on Ubuntu 24.04
    (libsoup 3 is available system-wide).
  - LRCLIB v1 is HTTPS-only and the adapter must include a
    `User-Agent` header that identifies LyricBar plus its repository
    URL, per the LRCLIB rate-limit convention.
  - Network failures, timeouts, and malformed bodies must produce
    `LyricsProviderResult` values. Throwing an exception out of the
    callback is a bug.
  - No retry loop in this phase. Phase 12 owns negative caching and
    deduplication; retrying here would compound it.
- Out of scope:
  - Cache integration (Phase 11).
  - Lookup orchestration, request deduplication, stale-result
    handling (Phase 12).
  - Position-driven lyric line synchronization (Phase 13).
  - Indicator / controller wiring.
  - User-Agent customization through preferences.

## Acceptance Criteria

1. `src/runtime/lyrics/lrclib.js` exports `LrclibProvider` (or an
   equivalent module API).
2. `LrclibProvider` accepts a `Soup.Session`-shaped dependency and a
   `LifecycleRegistry`. The session is registrable for cleanup; if
   the provider creates a session, the provider also disposes it.
3. The provider exposes `lookup(query, callback)`:
   - `query` is the existing `LyricsQuery` shape (artist, title,
     album, optional `durationMs`).
   - `callback` receives a `LyricsProviderResult` and is invoked
     exactly once per successful in-flight call. Not invoked when the
     call is cancelled by lifecycle disposal.
4. URL building uses `https://lrclib.net/api/get`, includes
   `artist_name`, `track_name`, and (when present) `album_name` and
   `duration` (seconds, integer) query parameters, and is
   percent-encoded.
5. The pure URL builder rejects empty `artist_name` or `track_name`
   by returning `null`; the provider then short-circuits to a
   `not-found` result without sending the request.
6. Status-code handling:
   - HTTP 200 -> JSON-decode body, hand to `parseLrclibResponse`,
     emit the result.
   - HTTP 404 -> emit `{ kind: 'not-found' }`.
   - HTTP 4xx (non-404) / 5xx / network failure / parse failure /
     timeout -> emit `{ kind: 'error', reason }`.
7. Timeout is applied through the per-call cancellable and a Soup
   timeout option. Default is 10s; tests pin a short timeout.
8. The architecture guardrail accepts the new module. Pure helpers
   (`buildLrclibUrl`, `mapHttpResultToProviderResult`) are unit tested
   without a live Session.
9. `npm run verify` passes (12+ test files, additional cases for the
   new module).

## Implementation Checklist

- [ ] Add `src/runtime/lyrics/url.js` (pure):
  - [ ] `buildLrclibUrl(query: LyricsQuery): string | null`.
  - [ ] Returns null for empty artist or title; otherwise builds the
        encoded URL, omitting empty / null fields.
- [ ] Add `src/runtime/lyrics/http-result.js` (pure):
  - [ ] `mapHttpResultToProviderResult({ statusCode, body, error }):
LyricsProviderResult`.
  - [ ] 200 with JSON-parseable body -> route through
        `parseLrclibResponse`.
  - [ ] 404 -> `{ kind: 'not-found' }`.
  - [ ] Non-404 4xx / 5xx -> `{ kind: 'error', reason }`.
  - [ ] Network / timeout / parse error -> `{ kind: 'error', reason }`.
- [ ] Add `src/runtime/lyrics/lrclib.js`:
  - [ ] `LrclibProvider` class with `#session`, `#lifecycle`,
        `#enabled`.
  - [ ] Constructor injects an existing `Soup.Session` or creates a
        new one (latter is registered for cleanup).
  - [ ] `lookup(query, callback)` short-circuits empty queries,
        otherwise builds the URL, creates a per-call
        `Gio.Cancellable`, registers it with the lifecycle, kicks off
        the async request, and routes the outcome through
        `mapHttpResultToProviderResult`.
  - [ ] Async callbacks guard on the `enabled` flag and on
        `cancellable.is_cancelled()`.
  - [ ] User-Agent: `lyricbar/0.1.0 (+https://github.com/fikrilal/gnome-lyricbar)`.
- [ ] Extend `types/gjs.d.ts` only if necessary. Keep declarations
      narrow.
- [ ] Add `tests/lyrics/url.test.js`:
  - [ ] Basic URL with artist and title.
  - [ ] Includes album when present.
  - [ ] Includes integer duration in seconds when present.
  - [ ] Percent-encodes special characters (apostrophes, &, spaces,
        unicode).
  - [ ] Returns null for empty / whitespace artist or title.
- [ ] Add `tests/lyrics/http-result.test.js`:
  - [ ] 200 + valid synced JSON -> synced result.
  - [ ] 200 + valid plain JSON -> plain result.
  - [ ] 200 + instrumental JSON -> instrumental result.
  - [ ] 200 + invalid JSON -> error result.
  - [ ] 404 -> not-found.
  - [ ] 503 -> error with status reason.
  - [ ] Network failure (no statusCode, just an error string) ->
        error.
  - [ ] Timeout (cancelled) -> error with timeout reason.
- [ ] Confirm `npm run check:architecture` still passes with the new
      module. Pure helper files must not import GJS.
- [ ] Run `npm run verify` and capture the test count delta.
- [ ] Update parent plan Phase 10 status block with verification
      evidence.

## Decision Log

- 2026-05-24: Use libsoup 3 via `gi://Soup` -> standard GNOME HTTP
  client, ships with the platform, no extra dependencies, and used
  by the existing GNOME extension ecosystem.
- 2026-05-24: Per-call `Gio.Cancellable` rather than a single
  provider-level cancellable -> Phase 12 will fan-in/out multiple
  lookups; per-call cancellation lets stale lookups cancel
  individually without disrupting newer calls.
- 2026-05-24: Pure URL builder + pure HTTP-result mapper next to the
  GJS-aware adapter -> matches the established Phase 6 / 7 / 9
  pattern and keeps the network surface to one file.
- 2026-05-24: No retry in this phase -> Phase 12 is the right home
  for negative caching and request dedup; retrying inside the
  adapter would compound those policies.
- 2026-05-24: User-Agent identifies LyricBar plus the repo URL ->
  matches the LRCLIB rate-limit convention and gives the maintainers
  a way to reach the project if the extension misbehaves.
- 2026-05-24: Empty artist / title short-circuits to `not-found`
  rather than `error` -> avoids spurious diagnostic noise when the
  active player has no metadata yet.

## Verification

Static gate:

```bash
npm run verify
```

Result:

```text
2026-05-24 10:43 — npm run verify passed
- verify:docs ok
- validate:metadata ok
- validate:schema ok
- check:architecture ok (runtime cleanup guardrail covers lrclib.js)
- format:check ok
- lint ok
- typecheck ok
- vitest: 15 test files, 127 tests passed
- build:extension: dist/lyricbar@fikrilal.github.io.zip
  - bundle includes src/runtime/lyrics/{url,http-result,lrclib}.js
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

Captured by the human owner. Phase 10 runtime evidence is
**deferred to Phase 12**, where the controller will wire the provider
into the lyrics service and end-to-end behavior can be exercised
against a real LRCLIB endpoint. Until then this plan stays active and
the parent plan keeps Phase 10 marked In Progress.

Scenarios to capture in Phase 12:

- [ ] Lookup for a known synced track (e.g. "Coldplay - Yellow")
      returns synced lyrics; indicator updates accordingly.
- [ ] Lookup for an unknown track returns `not-found` and the
      indicator falls back through the Phase 2 display rules.
- [ ] Network disconnected mid-lookup returns `error`; indicator
      falls back through the Phase 2 display rules.
- [ ] Disable extension during in-flight request leaves no
      `Soup.Session` warnings or `Gio.Cancellable` criticals in
      `journalctl --user`.

## Risks And Mitigations

- Risk: Async network callbacks fire after disable and mutate
  destroyed state.
  - Mitigation: per-call cancellable cancelled by lifecycle disposal,
    plus a guarded `enabled` flag; callback short-circuits on either.
- Risk: A long-running request hangs the lookup and blocks other
  callers.
  - Mitigation: timeout enforced through both Soup's request timeout
    option and the cancellable. Default 10s.
- Risk: LRCLIB returns malformed JSON or HTML error pages.
  - Mitigation: response parsing always returns
    `LyricsProviderResult` values; HTTP-result mapper recovers
    non-JSON bodies as `error`.
- Risk: User-Agent header missing or generic causes LRCLIB to
  rate-limit aggressively.
  - Mitigation: identify LyricBar by name and version; include the
    repo URL.
- Risk: Tests pin to brittle Soup-shape dependencies and break with
  libsoup updates.
  - Mitigation: tests cover only the pure helpers
    (`buildLrclibUrl`, `mapHttpResultToProviderResult`); the
    `LrclibProvider` wire path is exercised by Phase 12 runtime
    evidence rather than fragile mocks.

## Completion Notes

Static implementation landed on 2026-05-24. Sub-plan stays active
until Phase 12 records the combined runtime evidence against a real
LRCLIB endpoint.

Key implementation choices:

- Three-file split inside `src/runtime/lyrics/` mirrors the
  Phase 6 / 7 / 9 pattern: pure URL helper (`url.js`), pure
  HTTP-result mapper (`http-result.js`), and the GJS-aware adapter
  (`lrclib.js`).
- The mapper distinguishes 404 from other 4xx / 5xx so
  `LyricsProviderResult` consumers can render the correct fallback
  state without re-inspecting the status code.
- Timeout is enforced through a `GLib.timeout_add` watchdog that
  cancels the per-call `Gio.Cancellable` and is itself tracked with
  `LifecycleRegistry.addSource`. Both the cancellable and the
  watchdog are cleaned up on disable, satisfying the runtime
  cleanup guardrail.
- The provider tolerates an existing `Soup.Session` injected via the
  constructor option, which keeps the wire-level adapter testable
  through Phase 12 runtime evidence rather than fragile mocks.
- The User-Agent identifies LyricBar plus the repository URL, per
  the LRCLIB rate-limit convention.
- Async callback flow:
  1. Cancel the timeout watchdog source.
  2. If the call was cancelled by lifecycle disposal, return early
     unless we cancelled it ourselves due to timeout.
  3. Read the bytes via `Soup.Session.send_and_read_finish`,
     decode UTF-8, look up the status code, and route through the
     pure mapper.

## Follow-Ups

- [ ] Update parent plan Phase 10 status block once verification
      lands.
- [ ] Move this plan to `docs/exec-plans/completed/` after Phase 12
      records combined runtime evidence.
- [ ] Add unresolved issues to `docs/exec-plans/tech-debt-tracker.md`.
