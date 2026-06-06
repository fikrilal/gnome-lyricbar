# TIDAL Support Re-analysis

Date: 2026-06-06  
Owner: Dante  
Status: remediation in progress  
Risk class: medium  
Related issue: https://github.com/fikrilal/gnome-lyricbar/issues/5

## Objective

Reassess the local TIDAL Web work against current Chrome MPRIS evidence and identify what must change before the commits are pushed or released.

The observed client is TIDAL Web playing through Google Chrome. Chrome exposes one generic browser MPRIS service and does not provide a TIDAL URL or service identity. The implementation must therefore remain generic browser-player behavior rather than claim or encode dedicated TIDAL detection.

## Branch State

The TIDAL work was found on local `main`, not on `development` as initially expected:

```text
e371107 docs(docs): document tidal chrome evidence
796b7f1 test(mpris): add tidal chrome fixtures
989b266 fix(mpris): clear stopped empty browser snapshots
```

On 2026-06-06, `development` was safely fast-forwarded to local `main`. Further remediation work should continue on `development`.

## Current Evidence

The live Chrome MPRIS owner is generic:

```text
org.mpris.MediaPlayer2.chromium.instance4276
Identity=Chrome
```

For the active TIDAL track, Chrome exposed complete metadata and advancing position:

```text
title=Breaking the Habit
artist=Linkin Park
album=Meteora
playbackStatus=Playing
durationMs=196248
positionMs=<advancing>
url=<missing>
```

This is enough for LyricBar's existing generic Chromium path to perform LRCLIB lookup and synchronized lyric display.

However, runtime logs also show the same Chrome MPRIS bus switching among TIDAL tracks and unrelated browser videos. Without `xesam:url` or another service identifier, LyricBar cannot prove which website owns the current Chrome media session.

## Findings

### P1: Immediate Clearing Can Select an Unrelated Paused Player

The new reducer behavior clears a browser snapshot immediately when all metadata is empty and `PlaybackStatus` is `Stopped`:

```js
if (candidate.playbackStatus === 'Stopped') {
  return {
    stableSnapshot: null,
    pendingCandidate: null,
    decision: 'cleared',
  };
}
```

Once the Chrome snapshot disappears, active-player selection can fall through to another remaining player. In the observed environment, paused Spotify Desktop is present and preferred by configuration. A short Chrome transition can therefore replace stale TIDAL lyrics with an unrelated paused Spotify track.

The current tests validate the reducer in isolation but do not validate this cross-player consequence.

Required correction:

- Introduce a bounded grace period for stopped/empty browser snapshots.
- Keep the previous browser snapshot during that grace period without restarting its lyric position at zero.
- Clear the browser only if stopped/empty metadata persists beyond the grace period.
- Ensure a transient browser transition does not select a paused competing player.

### P1: This Is Generic Chrome Compatibility, Not Dedicated TIDAL Support

The live session exposes no TIDAL-specific bus name, URL, application identity, or metadata marker. The same Chrome MPRIS bus can represent TIDAL, YouTube, social-video playback, or another media tab.

The current evidence supports this statement:

> TIDAL Web was smoke-tested while routed through Chrome's generic MPRIS service.

It does not support these claims:

- LyricBar can detect TIDAL Web.
- LyricBar has a TIDAL profile.
- The current fixtures protect TIDAL-specific behavior.
- TIDAL Desktop, wrappers, Flatpak clients, Firefox, or other browsers are supported.

Issue #5 should remain open until its intended scope is explicitly resolved. A TIDAL-specific profile or setting must not be added without stable identification evidence.

Resolution on 2026-06-06:

- The compatibility matrix now classifies this as an **Observed route**, not dedicated support.
- The player index distinguishes evidence entries from supported profiles.
- The TIDAL report states that the service name is capture provenance and is not visible to LyricBar at runtime.
- No TIDAL profile, adapter, preference, or runtime branch was added.

### P2: Fixture Names Encode an Identity That Is Not Present

The `tidal-web-chromium-*` fixtures contain generic Chrome MPRIS snapshots with no TIDAL identifier. Naming them as TIDAL-specific can mislead future contributors into believing the fixtures validate service detection or TIDAL-specific semantics.

Required correction:

- Rename transition fixtures around generic Chromium browser behavior.
- Preserve the TIDAL support report as the provenance of the observed runtime state.
- Keep only genuinely service-specific fixtures under a service-specific name.

Resolution on 2026-06-06:

- Renamed the captured transition fixture set to `chromium-browser-transition-*`.
- Renamed the test file to `tests/mpris/chromium-browser-transition-fixtures.test.js`.
- Updated fixture descriptions to state that TIDAL was externally observed but MPRIS exposed only Chrome identity.
- Kept the TIDAL report as provenance instead of encoding TIDAL into executable fixture names.

### P2: Missing Cross-player Integration Coverage

Add a test for the complete behavioral sequence:

```text
Chrome/TIDAL is Playing
Spotify Desktop is Paused and preferred
Chrome emits Stopped plus empty metadata
Chrome emits the next valid track shortly afterward
```

Expected behavior:

- no stale lyric restart at position zero
- no temporary switch to paused Spotify
- no lookup for unrelated Spotify metadata
- recovered Chrome metadata enters the normal debounce path
- the next Chrome track becomes active after stabilization

Testing the reducer and selector independently is insufficient because the regression occurs at their composition boundary.

Resolution on 2026-06-06:

- Added a composition test that drives `StablePlayerProxy`, `selectActivePlayer`, and `LyricsService` together.
- Covered Chrome playing with paused preferred Spotify present.
- Covered Chrome stopped/empty transition, raw position suppression, recovered Chrome metadata debounce, and final next-track acceptance.
- Verified lookup titles stay on `Carry On` and `Heathens`; paused Spotify `ECHO` is never queried.

### P3: Documentation Is Excessive and Inconsistently Organized

The committed `_WIP/tidal-client-support-analysis-plan.md` is approximately 746 lines and duplicates substantial parts of `docs/players/tidal.md` and the execution plan.

The transition plan remains under `docs/exec-plans/active/` even though it claims implementation and verification are complete.

Required correction:

- Consolidate durable evidence in `docs/players/tidal.md`.
- Remove the committed `_WIP` document after preserving unique evidence.
- Replace or supersede the old transition plan with this remediation plan.
- Move completed plans to `docs/exec-plans/completed/` only after post-change runtime evidence exists.

## Architecture Decision

Do not add TIDAL-specific branches to the controller, profile detector, settings, cache policy, or lyric provider from the current evidence.

The correct boundary is generic browser stability:

- browser MPRIS stabilization owns transient empty/stopped behavior
- active-player selection must not jump to an unrelated paused player during a transient browser transition
- service profiles remain evidence-driven
- documentation distinguishes observed compatibility from dedicated support

## Remediation Plan

### Progress: P1 Transition Selection Fix

Implemented on `development` on 2026-06-06:

- Added a 3000 ms stopped/empty retention policy for browser profiles.
- Added an explicit `stopped-empty` pending stability state.
- Kept the previous playing browser snapshot selectable during the grace period.
- Suppressed raw position reads during the stopped/empty state and the recovered track's metadata debounce.
- Restored position reads only after the recovered track is accepted or the stale browser is cleared.
- Added composition coverage proving paused preferred Spotify cannot replace the browser during the grace period.
- Preserved immediate clearing for desktop and generic non-browser profiles.

The remaining phases cover fixture naming, documentation consolidation, and live runtime evidence.

### Progress: P1 Support Classification

Completed on `development` on 2026-06-06:

- Added an **Observed route** compatibility status for externally known services that LyricBar cannot identify from MPRIS.
- Reclassified the TIDAL Web Chrome capture under that status.
- Updated the player index and evidence report to distinguish capture provenance from runtime detection.
- Confirmed that no TIDAL profile, adapter, preference, provider integration, or application-specific branch exists.

Fixture names were remediated in the P2 fixture-name phase.

### Progress: P2 Fixture Names And Composition Coverage

Completed on `development` on 2026-06-06:

- Renamed generic Chrome fixtures away from `tidal-web-chromium-*`.
- Added a full browser-transition composition test with paused preferred Spotify and recovered Chrome metadata.
- Updated TIDAL documentation to preserve provenance while pointing executable coverage at generic Chromium fixtures.

### Phase 1: Specify Transition Semantics

- Define the desired stopped/empty grace-period behavior as pure domain rules.
- Decide whether the pending state needs a new candidate kind such as `stopped-empty`.
- Define how the grace period interacts with metadata debounce and advertisement retention.
- Add tests before changing runtime behavior.

### Phase 2: Add Composition-level Tests

- Add the Chrome-playing plus paused-Spotify scenario.
- Cover recovery before timeout.
- Cover persistent stopped/empty state after timeout.
- Cover a browser with no competing player.
- Cover non-stopped empty metadata retention.
- Preserve Spotify, YouTube Music, Apple Music, Firefox, and generic-browser behavior.

### Phase 3: Implement the Minimal Generic Fix

- Replace immediate clearing with bounded stopped/empty stabilization.
- Keep lifecycle and timer ownership inside the existing stable-player machinery.
- Avoid controller-level application branching.
- Keep profile-specific policy explicit if different browsers eventually require different grace periods.

### Phase 4: Consolidate Documentation

- Rename generic fixtures.
- Condense `docs/players/tidal.md` to evidence and support boundaries.
- Remove `_WIP/tidal-client-support-analysis-plan.md` after migration.
- Update `docs/compatibility.md` wording if necessary.
- Keep issue #5 open or narrow its scope explicitly.

### Phase 5: Runtime Evidence

Test on the live Chrome session with paused Spotify present:

- normal TIDAL playback
- pause and resume
- seek
- next and previous track
- stopped/empty transition shorter than the grace period
- persistent stopped state
- switching Chrome media ownership between TIDAL and another tab

Record logs showing stable-snapshot decisions and active-player selection through each transition.

## Acceptance Criteria

1. A transient stopped/empty Chrome snapshot does not restart stale lyrics at zero.
2. A transient stopped/empty Chrome snapshot does not select paused Spotify or another unrelated player.
3. Persistent stopped/empty metadata eventually clears the browser snapshot.
4. Recovered Chrome metadata follows the normal debounce and lookup flow.
5. Tests cover reducer behavior and cross-player selection composition.
6. Documentation classifies TIDAL Web as an observed route through generic Chrome MPRIS, not a dedicated TIDAL profile.
7. Generic fixtures are not named as if they contain TIDAL identity evidence.
8. `npm run verify` passes.
9. Post-change live runtime evidence is recorded before release.

## Verification

The P1 remediation passes the complete repository gate:

```text
npm run verify
35 test files passed
381 tests passed
bundle metadata matches version-name 0.1.11
```

Focused transition tests also pass:

```text
npx vitest run tests/mpris/profile-policy.test.js tests/mpris/stability.test.js tests/mpris/stable-player.test.js tests/mpris/chromium-browser-transition-fixtures.test.js tests/mpris/selection.test.js
5 test files passed
60 tests passed
```

These tests now cover the identified cross-player regression. Live Chrome transition evidence remains required before release.

## Release Recommendation

Do not release the TIDAL compatibility work yet.

The P1 transition selection defect is remediated. Complete generic fixture naming, documentation cleanup, and live transition verification before release.
