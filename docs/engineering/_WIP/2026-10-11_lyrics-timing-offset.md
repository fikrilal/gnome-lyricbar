# Engineering Proposal: User-Adjustable Lyric Timing Offset

Date: 2026-10-11  
Owner: ahmad fikril  
Status: WIP draft — kept in `docs/engineering/_WIP/`, not yet promoted into the stable docs tree  
Risk class: medium  
Related: community feature request received by email (2026-10-11); not yet filed as a GitHub issue

## Summary

A user asked for the ability to display synced lyrics earlier or later to compensate for timing drift between their player and the lyric timestamps. The proposal adds one setting, `lyrics-offset-ms` (integer, default `0`, range `-5000..5000`), applied to the position used for lyric line selection **after** the existing browser-position normalization and immediately before display state computation.

Zero offset is exact current behavior. The offset is presentation-time only: it never touches track identity, cache keys, provider queries, or the browser position gates. The UI surface is one `Adw.SpinRow` in the existing Behavior preferences group.

## Context

### Current timing path

`LyricBarController` polls the active player's position every 500 ms (`#pollSyncedPosition`), resolves it through the browser-normalization policy (`#resolveSyncedPosition` — relative-offset establishment, low-confidence holding, stagnant-position estimation), and then computes display state via `displayStateFromSyncedPosition(player, lookup, effectivePositionMs)` → `selectLyricLine(lines, positionMs)` → panel label.

Only the final step is affected by this proposal:

```text
raw player position
  → browser normalization (unchanged; gates and estimator keep raw/normalized values)
  → + user offset, clamped to >= 0          ← this proposal
  → selectLyricLine(lines, positionMs)
  → panel label
```

### Evidence and repository facts

- `selectLyricLine()` returns `null` for negative positions, and `displayStateFromSyncedPosition()` then falls back to the first synced line — the same behavior as playing at track start. An aggressive negative offset therefore degrades gracefully instead of showing nothing.
- The settings stack has an established pattern to follow: schema key + `RawSettings`/`LyricBarSettings` typedefs + `normalizeSettings()` clamping (the `max-width` key clamps with the same shape) + `SETTING_KEYS` subscription list in the runtime adapter.
- The preferences UI already renders a `Gtk.Adjustment`-driven `Adw.SpinRow` bound with `settings.bind()` for `max-width`; the offset row mirrors that exactly.
- The controller reads `this.#currentSettings` on every poll, so a persisted offset applies without reintroducing player or lyrics state.
- The internal browser sync-offset machinery (`#syncPositionOffsetMs`) solves a different problem (absolute vs. track-relative browser positions). The user offset is a manual fine-tune and must not feed into those checks.

## Goals

- Shift synced lyric line selection earlier or later by a user-chosen amount, persisted across sessions.
- Default `0` reproduces today's behavior exactly.
- Adjustments become visible within one poll interval (≤500 ms) after changing the setting.
- Stay presentation-time only: no new network, privacy, cache, or identity surface.

## Non-Goals

- Per-track or per-player offsets.
- Automatic drift calibration.
- Retiming plain-lyric or other non-synced fallbacks.
- Adding offset controls to the panel quick menu (preferences only in v1).

## Constraints And Invariants

- The user offset is applied strictly after the browser normalization step; `shouldUseSyncedLyricsPosition()`, `shouldHoldLowConfidenceSyncedPosition()`, `shouldUseRelativeSyncedLyricsPosition()`, and the stagnant-position estimator must never observe the offset.
- The offset must never enter track identity, cache keys, provider queries, or diagnostics that are sent off-device.
- Domain purity: the offset math and settings normalization live under `src/domain/**` (no GJS imports).
- Sign convention (one source of truth, reused in UI subtitle and docs): positive values display lyrics later (delay), negative values display them earlier.
- The schema range and the `normalizeSettings()` clamp are both enforced, mirroring `max-width`.

## Proposed Design

### Setting

- Schema: `lyrics-offset-ms`, type `i`, default `0`, `<range min="-5000" max="5000"/>`, summary "Lyrics timing offset", description stating the sign convention.
- Types: `RawSettings.lyricsOffsetMs` and `LyricBarSettings.lyricsOffsetMs`.
- Normalization: `normalizeLyricsOffset(value)` rounds finite values, clamps to `-5000..5000`, and returns `0` for non-finite input (same style as `normalizeMaxWidth`).
- Adapter: `SettingsAdapter.read()` maps the key; `SETTING_KEYS` includes it so changes trigger the existing subscription path.

### Application

- New pure module `src/domain/display/lyrics-offset.js` exporting `applyLyricsOffset(positionMs, offsetMs)` returning `Math.max(0, positionMs + offsetMs)`. The clamp gives the helper a clean contract and pins the "earlier than track start" behavior.
- Controller change (single call site): in `#pollSyncedPosition`, pass `applyLyricsOffset(effectivePositionMs, currentSettings.lyricsOffsetMs)` into `displayStateFromSyncedPosition()`.
- Settings change handling: the existing `#settings.subscribe()` path already calls `#refreshDisplay()`; additionally trigger an immediate `#pollSyncedPosition()` when the sync loop is active so drag-to-adjust feels immediate. Whether this is a direct condition or a small `shouldRefreshSyncedLyrics()` predicate in `src/domain/settings/change.js` is an implementation decision for the plan.
- Extreme behavior (documented, tested): a negative adjusted position shows the first synced line via the existing fallback; a positive offset beyond the last line keeps the last line (existing `selectLyricLine` semantics).

### Preferences UI

- Behavior group, `Adw.SpinRow` "Lyrics offset", subtitle "Shift synced lyrics earlier or later (milliseconds). Positive values delay the lyrics.", adjustment lower `-5000`, upper `5000`, step `50`, page `500`, bound with `settings.bind('lyrics-offset-ms', row, 'value', Gio.SettingsBindFlags.DEFAULT)`.
- `buildDiagnosticsMarkdown()` gains a "Lyrics offset (ms)" row (the diagnostics table lists every setting).

### Documentation updates (during implementation)

- README feature list: one bullet.
- `docs/operations/troubleshooting.md`: an entry for "lyrics appear slightly early or late" pointing at the new setting.
- Release notes for the next version.

## Risks And Tradeoffs

- **Masking wrong-content matches.** An offset changes timing, not content; the modest ±5 s range limits the illusion of fixing a mismatched track.
- **Sign confusion.** Users may read "offset" either way; the UI subtitle, schema description, and troubleshooting entry all state positive = later.
- **Interaction with browser estimation.** The offset applies to estimated positions too; this is the intended behavior (the user fine-tunes what they see), and estimator internals remain untouched.
- **Scope creep toward calibration.** Auto-calibration and per-track offsets are explicitly deferred; the setting shape does not block a later iteration.

## Acceptance Criteria

1. Default `0` behaves exactly as before; every existing test passes unchanged.
2. New unit tests: `normalizeLyricsOffset` (rounding, clamping, non-finite), `applyLyricsOffset` (later, earlier, clamp at 0), a display-level test showing line selection shifts when the offset is applied, and updated `SettingsAdapter` tests (new key read, subscription count).
3. Preferences row persists through GSettings; the diagnostics block includes the value.
4. `npm run verify` passes.
5. Runtime evidence: with a synced track playing, adjusting the offset moves the displayed line earlier/later within one poll (nested runtime harness per `docs/harness/`, or a recorded owner desktop check).
6. No diff touches track identity, cache, or query surfaces.

## Open Questions

1. Range and step: `±5000 ms` with `50 ms` step proposed — confirm before implementation.
2. Panel quick-menu access: intentionally deferred; revisit only on community feedback.
3. GitHub issue for the request: file after proposal review. Public credit should avoid personal data — first name only if crediting, never the email address.
4. Per-track offsets: explicitly out of scope unless requested later.
