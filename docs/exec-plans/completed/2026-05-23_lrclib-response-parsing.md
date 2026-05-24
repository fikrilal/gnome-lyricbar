# Plan: LRCLIB Response Parsing

Date: 2026-05-23  
Owner: Dante  
Status: complete  
Risk class: low  
Related issue/PR: N/A  
Parent plan: `docs/exec-plans/active/2026-05-23_end-to-end-product-implementation.md` (Phase 9)

## Objective

Add a pure parser that converts an LRCLIB API response into a
provider-neutral `LyricsProviderResult` value. Parsing must be
defensively typed so malformed responses cannot throw into the
Phase 10 runtime adapter or any future consumer. No network behavior,
no GJS imports, no filesystem access lands in this phase.

The parser is the boundary between the LRCLIB-specific JSON shape
LyricBar pulls off the wire and the provider-neutral data the cache,
service, and synchronization layers consume in later phases.

## Constraints

- Architectural constraints:
  - New code lives entirely under `src/domain/lyrics/`.
  - Module must remain platform-free: no `gi://` imports, no
    `resource:///org/gnome` imports, no `Gio` / `GLib` / `St` / `Clutter` /
    `PanelMenu` / `PopupMenu` references, no `fetch` /
    `XMLHttpRequest`, no `node:` imports.
  - Inputs to the parser are typed as `unknown` and validated at the
    boundary; downstream types are `Readonly<{ ... }>` discriminated
    unions.
  - Reuse the existing `parseLrc` parser for synced lyric lines instead
    of duplicating timestamp logic.
  - The existing `LyricLine`, `TrackMetadataInput`, and `LyricsQuery`
    typedefs in `types.js` stay intact; new typedefs are added
    alongside them.
- Product/runtime constraints:
  - The parser MUST tolerate missing fields, unexpected types, empty
    strings, and truncated payloads.
  - The parser MUST distinguish at minimum between: synced lyrics
    available, plain lyrics available, instrumental track flagged,
    track found but no lyrics, error / malformed response.
  - For a malformed synced lyrics body that yields zero parseable
    lines, the parser MUST fall back to plain lyrics if present,
    rather than emitting an empty synced result.
- Out of scope:
  - Network requests, timeouts, cancellables (Phase 10).
  - Cache write / read (Phase 11).
  - Lookup orchestration, request deduplication, stale-result handling
    (Phase 12).
  - Position-driven lyric line selection updates (Phase 13).

## Acceptance Criteria

1. `src/domain/lyrics/provider-result.js` exports
   `parseLrclibResponse(value: unknown): LyricsProviderResult`.
2. The result is one of the following discriminated kinds:
   - `synced` — at least one parseable timestamped line, plus the plain
     fallback text when LRCLIB also returns it.
   - `plain` — non-empty plain lyrics with no synced lines.
   - `instrumental` — provider flag `instrumental === true`.
   - `not-found` — provider 404 (`statusCode === 404`) or empty body.
   - `error` — input is malformed enough to fail validation; carries a
     short `reason` string for diagnostics.
3. Each non-error result includes a normalized `track` payload with
   `trackName`, `artistName`, `albumName`, and `durationMs` derived from
   LRCLIB fields. Missing fields collapse to empty strings or `null`;
   the parser does not throw on them.
4. New typedefs in `src/domain/lyrics/types.js` describe the result
   shape and a `ProviderTrackInfo` shape. Existing typedefs are
   unchanged.
5. Unit tests in `tests/lyrics/` cover:
   - LRCLIB success with both synced and plain lyrics.
   - LRCLIB success with synced lyrics only.
   - LRCLIB success with plain lyrics only.
   - LRCLIB success with `instrumental: true`.
   - LRCLIB 404 not-found body.
   - Empty body, null input, non-object input.
   - Synced lyrics body that contains only metadata / unparseable
     timestamps falls back to plain when present.
   - Realistic LRC payload with metadata tags exercising the existing
     `parseLrc` integration.
6. `scripts/check-architecture.mjs` keeps passing — domain remains
   platform-free.
7. `npm run verify` passes.

## Implementation Checklist

- [ ] Extend `src/domain/lyrics/types.js` with:
  - [ ] `ProviderTrackInfo` (Readonly<{ trackName, artistName, albumName, durationMs }>).
  - [ ] `SyncedLyricsResult` (`kind: 'synced'`, `lines`, `plainText`, `track`).
  - [ ] `PlainLyricsResult` (`kind: 'plain'`, `text`, `track`).
  - [ ] `InstrumentalResult` (`kind: 'instrumental'`, `track`).
  - [ ] `NotFoundResult` (`kind: 'not-found'`).
  - [ ] `ProviderErrorResult` (`kind: 'error'`, `reason`).
  - [ ] `LyricsProviderResult` union of the five kinds.
- [ ] Add `src/domain/lyrics/provider-result.js`:
  - [ ] `parseLrclibResponse(unknown): LyricsProviderResult`.
  - [ ] Internal helpers for: not-found detection, instrumental
        detection, track info extraction, synced parsing fallback to
        plain when synced yields no lines.
  - [ ] Use `Reflect.get` / `Object.hasOwn` for property access (matches
        the Phase 7 pattern that satisfies both
        `noPropertyAccessFromIndexSignature` and the `dot-notation`
        ESLint rule).
  - [ ] Reuse `parseLrc` from `lrc.js`.
- [ ] Add `tests/lyrics/provider-result.test.js` covering the cases in
      Acceptance Criterion #5.
- [ ] Optionally add a realistic LRCLIB-style fixture into
      `tests/lyrics/lrc.test.js` (metadata tags + multiple lines + edge
      case timestamps) to harden the existing parser against real
      payloads.
- [ ] Run `npm run verify` and capture the test count delta.
- [ ] Update parent plan Phase 9 status block.

## Decision Log

- 2026-05-23: Result distinguishes `synced` from `plain` rather than
  merging them under a generic `lyrics` kind -> the synchronization
  loop in Phase 13 cares about timestamps, but the fallback display
  layer wants plain text without parsing it again. Keeping both
  callsites first-class is cheaper than re-deriving them.
- 2026-05-23: Result includes `instrumental` as a first-class kind
  rather than collapsing into `not-found` -> users with instrumental
  tracks should not see "Lyrics unavailable" repeatedly; the indicator
  can later show a quiet, accurate state.
- 2026-05-23: Synced result also carries `plainText` -> when the
  active player jumps backward / forward the renderer can use the
  plain block as a recovery fallback without re-fetching.
- 2026-05-23: `parseLrclibResponse` accepts `unknown` rather than a
  typed shape -> matches the Phase 5 / Phase 7 pattern of validating at
  the boundary, not before it. This keeps the runtime adapter (Phase 10) free to hand off raw `JSON.parse` output.
- 2026-05-23: Synced body with zero parseable lines falls back to plain
  rather than emitting an empty synced result -> avoids fooling the
  controller into thinking a synchronization timeline exists when it
  does not.

## Verification

Static gate:

```bash
npm run verify
```

Result:

```text
2026-05-24 10:27 — npm run verify passed
- verify:docs ok
- validate:metadata ok
- validate:schema ok
- check:architecture ok (domain stays platform-free)
- format:check ok
- lint ok
- typecheck ok
- vitest: 13 test files, 110 tests passed
- build:extension: dist/lyricbar@fikrilal.github.io.zip
  - bundle includes src/domain/lyrics/provider-result.js
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

Not required. Phase 9 is pure logic with no GNOME Shell, GJS, D-Bus,
filesystem, or network surface. Verification is fully covered by unit
tests and the existing static gate.

## Risks And Mitigations

- Risk: LRCLIB introduces a new response field LyricBar treats as
  required.
  - Mitigation: every field access goes through defensive checks; new
    fields surface as either string-or-null or number-or-null and the
    parser ignores anything it does not understand.
- Risk: A malformed synced body containing real lyric lines is rejected
  outright, hiding usable lyrics.
  - Mitigation: the parser only rejects synced lyrics when zero lines
    are parseable; otherwise it keeps every parseable line and falls
    back to plain text alongside.
- Risk: Provider error shapes change between releases.
  - Mitigation: the `error` result carries a free-form `reason` so
    downstream consumers can log it without depending on a specific
    schema.
- Risk: Tests pin to brittle stringly-typed payloads that drift from
  reality.
  - Mitigation: include at least one realistic LRCLIB-style fixture
    that mirrors actual API output, and document the fixture's
    provenance in the test file comment.

## Completion Notes

Static implementation landed on 2026-05-24.

Key implementation choices:

- Property access goes through a small `read(bag, key)` helper that
  uses `Object.hasOwn` plus `Reflect.get`, matching the Phase 7
  pattern that simultaneously satisfies
  `noPropertyAccessFromIndexSignature` and the `dot-notation` ESLint
  rule.
- Results are frozen at construction time (`Object.freeze`) so
  consumers cannot accidentally mutate them.
- `looksLikeNotFound` covers both the explicit `statusCode === 404`
  shape LRCLIB returns and the empty-bag case so callers do not have
  to special-case both.
- `looksLikeProviderError` only fires for `>=400` status codes other
  than 404, avoiding false positives on success bodies that happen to
  carry an unrelated numeric field.
- Synced results carry the parsed lines plus the plain text so the
  Phase 13 sync loop and any plain-text fallback can both render
  without re-parsing.
- The realistic fixture in the test mirrors the actual LRCLIB API
  output for "The Irrepressibles - In This Shirt" (the same track
  exercised in the Phase 8 runtime evidence), keeping product
  scenarios traceable across phases.

## Follow-Ups

- [ ] Update parent plan Phase 9 status block once verification lands.
- [ ] Move this plan to `docs/exec-plans/completed/` after the parent
      plan promotion.
- [ ] Add unresolved issues to `docs/exec-plans/tech-debt-tracker.md`.
