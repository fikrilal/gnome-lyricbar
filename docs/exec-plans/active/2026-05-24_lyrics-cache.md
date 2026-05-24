# Plan: Lyrics Cache

Date: 2026-05-24  
Owner: Dante  
Status: active  
Risk class: medium  
Related issue/PR: N/A  
Parent plan: `docs/exec-plans/active/2026-05-23_end-to-end-product-implementation.md` (Phase 11)  
Depends on: `docs/exec-plans/completed/2026-05-23_lrclib-response-parsing.md` (Phase 9), `docs/exec-plans/active/2026-05-24_lrclib-runtime-provider.md` (Phase 10)

## Objective

Add a local cache for `LyricsProviderResult` values so a track that
has already been looked up does not re-hit LRCLIB. The cache keys on
the existing `buildLyricsCacheKey` (artist | title | album |
duration-seconds), persists positive and negative results with a
TTL, honors the `cache-enabled` user setting, and tolerates corrupt
data without throwing.

The cache is the storage layer between the Phase 10 provider and the
Phase 12 lyrics service. It does not yet wire into either; Phase 12
will compose them.

## Constraints

- Architectural constraints:
  - Pure cache policy (key building, entry validation, TTL math,
    schema versioning) lives under `src/domain/lyrics/`.
  - Filesystem I/O lives under `src/runtime/lyrics/cache.js`. No
    `src/domain/` file imports `Gio`, `GLib`, `node:fs`, or anything
    related to disk.
  - Cache files live under
    `${GLib.get_user_cache_dir()}/lyricbar/cache-v1/`. The schema
    version bumps when the on-disk layout changes.
  - Each cache key maps to one JSON file named after a stable hash of
    the key (filesystem-safe). The file content is a typed
    `CacheEntry` envelope: `{ schema, savedAt, expiresAt, result }`.
  - Reads and writes use `Gio.File`'s async APIs and a per-call
    `Gio.Cancellable` registered with `LifecycleRegistry`.
  - Corrupt JSON, missing fields, schema mismatch, expired entries,
    and unreadable files all yield a cache miss. The cache never
    throws.
  - Honors `cache-enabled` from settings: when disabled, `get` is a
    no-op miss and `put` is a no-op.
  - Negative results (`not-found`, `error`) and positive results
    (`synced`, `plain`, `instrumental`) get separate TTL constants so
    a transient provider failure does not lock LyricBar out of a
    track for the positive TTL window.
- Product/runtime constraints:
  - Default positive TTL: 30 days.
  - Default negative TTL: 6 hours.
  - Cache directory creation is best-effort; if it fails, the cache
    operates in pass-through mode (every call is a miss, writes are
    silent).
  - The cache must not write secrets or PII. Only normalized track
    metadata and lyric text reach disk. No session bus names, no
    user identifiers, no timestamps beyond the entry envelope.
- Out of scope:
  - Lookup orchestration, request deduplication, stale-result
    replacement (Phase 12).
  - Eviction by size or LRU policy (out of v1 scope).
  - Cache export, debug viewer, manual purge UI (Phase 15
    diagnostics may surface a "clear cache" affordance later).

## Acceptance Criteria

1. `src/domain/lyrics/cache-policy.js` exports:
   - `buildCacheFileName(query): string` — stable hash-based filename.
   - `buildCacheEntry(result, now): CacheEntry` — wraps a result with
     `savedAt` and `expiresAt` derived from positive / negative TTLs.
   - `parseCacheEntry(value, now): LyricsProviderResult | null` —
     defensive parse that returns `null` on missing fields, schema
     mismatch, or expiration.
   - Constants: `CACHE_SCHEMA_VERSION`, `POSITIVE_TTL_MS`,
     `NEGATIVE_TTL_MS`.
2. `src/runtime/lyrics/cache.js` exports `LyricsCache` class with:
   - Constructor `(extension, lifecycle, settings, options?)`.
   - `get(query, callback)` — invokes callback exactly once with
     `LyricsProviderResult | null` (`null` indicates miss).
   - `put(query, result)` — fire-and-forget write (errors swallowed).
   - `clear(callback?)` — removes the cache directory contents;
     callback signals completion.
3. Filesystem layout:
   - Base directory: `${user-cache-dir}/lyricbar/cache-v1/`.
   - One file per key: `${hash}.json`.
   - Atomic writes via temp file + rename.
4. Disabled cache (`cacheEnabled === false`):
   - `get` always invokes the callback with `null`.
   - `put` is a no-op.
   - `clear` still works (so the user can wipe lingering cache after
     disabling).
5. Pure helpers in `src/domain/lyrics/cache-policy.js` are unit
   tested. Filesystem behavior is verified through Phase 12 runtime
   evidence rather than mocks.
6. `npm run verify` passes; the architecture cleanup guardrail
   accepts the new runtime module.

## Implementation Checklist

- [ ] Add `src/domain/lyrics/cache-policy.js`:
  - [ ] FNV-1a-style stable string hash (or equivalent) implemented
        in pure JS for filename generation.
  - [ ] `buildCacheFileName(query)` -> `${hash}.json` (lowercased).
  - [ ] `buildCacheEntry(result, now)` -> `{ schema, savedAt,
expiresAt, result }` with TTL chosen by result kind.
  - [ ] `parseCacheEntry(value, now)` -> normalized result or `null`.
  - [ ] Constants exported.
- [ ] Add `src/domain/lyrics/cache-policy.test.js` (in `tests/lyrics/`)
      covering:
  - [ ] Stable filename for the same query.
  - [ ] Different queries produce different filenames.
  - [ ] Positive TTL applied to synced / plain / instrumental.
  - [ ] Negative TTL applied to not-found / error.
  - [ ] Expired entries parse to `null`.
  - [ ] Schema mismatch parses to `null`.
  - [ ] Missing or extra fields parse to `null`.
  - [ ] A live (non-expired) round-trip preserves the result.
- [ ] Add `src/runtime/lyrics/cache.js`:
  - [ ] `LyricsCache` class.
  - [ ] Lazy directory creation.
  - [ ] Async file read with cancellable; on success, run
        `parseCacheEntry`; on miss, return `null`.
  - [ ] Async file write via temp + rename.
  - [ ] Honors `cacheEnabled`.
  - [ ] All cancellables registered through `LifecycleRegistry`.
- [ ] Confirm `npm run check:architecture` passes.
- [ ] Run `npm run verify` and capture the test count delta.
- [ ] Update parent plan Phase 11 status block.

## Decision Log

- 2026-05-24: Pure cache policy is separate from runtime I/O ->
  matches the Phase 6 / 7 / 9 / 10 split between platform-free
  helpers and GJS-aware adapters; keeps unit tests fast and
  honest.
- 2026-05-24: One file per key rather than a single JSON document ->
  cheaper to invalidate individual entries, no read-modify-write race
  on the index, and corrupt files only kill that one entry.
- 2026-05-24: FNV-1a hash for filenames -> deterministic, no crypto
  dependency, short fixed-length output, safe in filesystem paths.
  Not a security primitive; collision risk is acceptable for the v1
  cache size.
- 2026-05-24: Negative TTL much shorter than positive TTL -> a 503
  from LRCLIB or a transient network failure should expire long
  before a real synced lyric we already pulled.
- 2026-05-24: Atomic writes via temp + rename -> a partial write or
  crash mid-update leaves the previous (or no) entry, never a
  corrupt one.
- 2026-05-24: Cache directory under `${user-cache-dir}/lyricbar/` ->
  XDG-compliant location, survives extension upgrades, easily wiped
  by the user, and cleared by GNOME's cache hygiene tools.
- 2026-05-24: Schema version bump on layout change rather than
  in-place migration -> migrations across user installs is
  unjustified work; bumping the directory wins all the same lyrics
  back from the provider within minutes.

## Verification

Static gate:

```bash
npm run verify
```

Result:

```text
2026-05-24 10:53 — npm run verify passed
- verify:docs ok
- validate:metadata ok
- validate:schema ok
- check:architecture ok (runtime cleanup guardrail covers cache.js)
- format:check ok
- lint ok
- typecheck ok
- vitest: 16 test files, 144 tests passed
- build:extension: dist/lyricbar@fikrilal.github.io.zip
  - bundle includes src/domain/lyrics/cache-policy.js
  - bundle includes src/runtime/lyrics/cache.js
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

Captured by the human owner. Phase 11 runtime evidence is
**deferred to Phase 12**, where the controller wires the cache and
provider into the lyrics service and end-to-end behavior can be
exercised on disk. Until then this plan stays active and the parent
plan keeps Phase 11 marked In Progress.

Scenarios to capture in Phase 12:

- [ ] Repeat the same track twice; second lookup is a cache hit
      (no LRCLIB request observed in logs).
- [ ] `cache-enabled = false` causes every lookup to hit LRCLIB;
      cache directory is not written.
- [ ] Corrupt cache file (manually overwritten with garbage) results
      in a cache miss without Shell errors.
- [ ] Cache directory survives extension disable / re-enable.

## Risks And Mitigations

- Risk: Async cache writes complete after disable and mutate
  destroyed state.
  - Mitigation: per-call cancellable cancelled by lifecycle
    disposal; callbacks short-circuit on disabled state.
- Risk: A malformed entry on disk hides a future genuine result.
  - Mitigation: `parseCacheEntry` returns `null` rather than
    throwing; the runtime layer treats `null` as a miss and the next
    lookup overwrites the file via the temp + rename path.
- Risk: TTL math drifts when the system clock jumps backward.
  - Mitigation: `parseCacheEntry` treats negative TTL deltas as
    expired; future-dated `expiresAt` longer than `POSITIVE_TTL_MS`
    is also rejected as suspicious.
- Risk: Filesystem fills up over time.
  - Mitigation: out of v1 scope, but tracked as a known future
    concern in the tech debt tracker. The user can manually wipe
    `${user-cache-dir}/lyricbar/cache-v1/`.
- Risk: Tests pin to brittle filesystem mocks.
  - Mitigation: only the pure cache policy has unit tests. The
    runtime `LyricsCache` is exercised in Phase 12 against the real
    filesystem.

## Completion Notes

Static implementation landed on 2026-05-24. Sub-plan stays active
until Phase 12 records combined runtime evidence against the real
filesystem.

Key implementation choices:

- Pure cache policy (`cache-policy.js`) under `src/domain/lyrics/`
  exposes `buildCacheFileName`, `buildCacheEntry`, `parseCacheEntry`,
  and the TTL / schema constants. Runtime I/O (`cache.js`) under
  `src/runtime/lyrics/` adapts those primitives to `Gio.File`.
- Filename hashing uses a small FNV-1a implementation. Filename
  collisions are statistically irrelevant for this corpus and the
  hash is intentionally not used as a security primitive.
- Atomic writes use `Gio.File.replace_contents_bytes_async` to a
  sibling temp file, then `move(..., OVERWRITE)` to swap. A failed
  write is best-effort cleaned up; a previous valid entry is never
  partially overwritten.
- `parseCacheEntry` rejects: non-objects, schema mismatches, expired
  entries, future-dated `savedAt` values (clock-skew tampering),
  and embedded results that fail shape validation. The runtime
  layer treats `null` as a miss so a corrupt entry yields a normal
  refetch on the next lookup.
- TTLs: 30 days for positive results, 6 hours for negative ones, so
  a transient provider failure does not lock LyricBar out of a real
  match for the full positive window.
- The cache directory is created lazily on first use under
  `${user-cache-dir}/lyricbar/cache-v1/`. If creation fails the
  cache transitions to pass-through mode permanently rather than
  retrying every call.
- `cache-enabled` short-circuits both `get` and `put`; `clear` works
  regardless so the user can wipe lingering data after disabling.

## Follow-Ups

- [ ] Update parent plan Phase 11 status block once verification
      lands.
- [ ] Move this plan to `docs/exec-plans/completed/` after Phase 12
      records combined runtime evidence.
- [ ] Add unresolved issues to `docs/exec-plans/tech-debt-tracker.md`
      (cache size policy, manual purge affordance).
