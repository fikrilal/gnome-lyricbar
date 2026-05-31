# Firefox Browser Support

## Live Finding

Inspection date: 2026-05-27

Environment:

- Host GNOME Shell: 46.0
- Installed LyricBar on host: 0.1.7
- Browser: Firefox
- Player: YouTube Music Web
- Test track: `In the End` by Linkin Park
- Firefox MPRIS bus: `org.mpris.MediaPlayer2.firefox.instance_1_237`

Firefox exposed useful metadata:

```text
PlaybackStatus=Playing
xesam:title=In the End
xesam:artist=Linkin Park
xesam:album=Hybrid Theory (Bonus Edition)
xesam:url=https://music.youtube.com/watch?v=BLZWkjBXfN8
mpris:artUrl=file:///home/fikrilal/snap/firefox/common/.mozilla/firefox/firefox-mpris/108203_4.png
```

Initial Firefox samples did not expose usable sync timing during a transition or ad-like state:

```text
mpris:length missing
Position=0
Position=0
Position=0
Position=0
Position=0
Position=0
```

Direct D-Bus sampling confirmed that `Position` stayed at `0` while playback remained `Playing`.

Longer sampling later showed a more precise behavior:

```text
xesam:title=Hall of Fame
xesam:artist=The Script
mpris:length=202000000
Position=35000000
Position=37000000
Position=39000000
Position=41000000
```

So Firefox can expose usable duration and position for YouTube Music after the real track state stabilizes.

This changes the diagnosis. Firefox support does not need an immediate always-on estimated clock. The visible bug is caused by transition windows where Firefox exposes ad/non-track/stale metadata and a zero or missing position before it eventually exposes a valid track position.

## Related Upstream Behavior

Firefox MPRIS position support has existing upstream history. Mozilla Bugzilla includes reports around missing or broken MPRIS position/seek behavior on Linux, and a newer regression report where YouTube metadata changes while position/length do not reset correctly.

There are also Firefox add-ons created specifically to force better YouTube/YouTube Music MPRIS updates. That is useful context, but LyricBar should not require a browser extension for basic support.

## Current LyricBar Gaps

1. `xesam:url` is available in Firefox MPRIS metadata, but LyricBar currently drops it during MPRIS mapping.
2. Auto mode cannot classify Firefox YouTube Music reliably even when the URL clearly identifies `music.youtube.com`.
3. The sync loop trusts Firefox transition-state `Position=0` as authoritative, so synced lyrics can temporarily jump to the first line.
4. If the user has `browser-player-service=apple-music`, Firefox YouTube Music can be mis-profiled as `apple-music-web` because explicit service settings override browser URL evidence.
5. Other active browser players can steal selection from Firefox because Chromium and Firefox both expose browser-family MPRIS players.
6. YouTube Music ad metadata can look like a normal track and may include a `music.youtube.com/watch` URL.

## Product Constraint

LyricBar should not scrape browser tabs or inspect the YouTube Music DOM. The support boundary should remain MPRIS-first.

Because Firefox may expose invalid timing before later exposing valid timing, LyricBar should prefer a stabilization strategy before a synthetic timing strategy.

The correct order is:

1. Preserve URL and timing metadata.
2. Detect service from URL.
3. Reject or hold low-confidence transition states.
4. Use real MPRIS position as soon as it becomes valid and advancing.
5. Only consider an estimated clock for confirmed long-running stagnant states.

That fallback has known limits:

- If LyricBar starts after the song is already mid-play, the estimated clock starts late.
- If the user seeks inside Firefox and Firefox still reports `Position=0`, LyricBar cannot know the new position.
- If Firefox pauses/resumes correctly, LyricBar can pause/resume the estimated clock from `PlaybackStatus`.
- If Firefox changes track metadata correctly, LyricBar can reset the estimated clock on track change.

## Recommended Implementation

### Phase 1: Preserve Browser URL Metadata

Commit:

```text
feat(mpris): preserve browser media url metadata
```

Implementation:

- Add optional `url` to `PlayerSnapshot`.
- Map `xesam:url` from MPRIS metadata.
- Include `url` in snapshot equality and stability decisions.
- Add tests for Firefox YouTube Music metadata with `xesam:url`.

Acceptance:

- `org.mpris.MediaPlayer2.firefox...` snapshots preserve `https://music.youtube.com/watch?...`.
- Existing Spotify Desktop and Chromium tests remain green.

### Phase 2: Auto-Detect Service From URL

Commit:

```text
feat(mpris): detect browser music service from media url
```

Implementation:

- Detect `youtube-music-web` when browser snapshot URL hostname is `music.youtube.com`.
- Detect `apple-music-web` when browser snapshot URL hostname is `music.apple.com`.
- Detect `spotify-web` when browser snapshot URL hostname is `open.spotify.com`.
- Let strong URL evidence override explicit stale browser service preference.

Acceptance:

- Firefox YouTube Music maps to `youtube-music-web` in `auto` mode.
- Firefox YouTube Music does not map to `apple-music-web` when URL proves YouTube Music.
- Chromium behavior remains unchanged when URL is missing.

### Phase 3: Add Firefox Transition Timing Policy

Commit:

```text
fix(sync): hold firefox browser transition positions
```

Implementation:

- Treat Firefox browser position `0` with missing duration as low-confidence when a synced line already exists for the same or recently accepted track.
- Hold the previous synced lyric line instead of jumping back to the first lyric line during low-confidence transition windows.
- Accept Firefox position once either:
  - `mpris:length` is present and position is positive, or
  - position advances monotonically across multiple polls.
- Reset normally when a stable new music track is accepted.

Acceptance:

- Firefox YouTube Music no longer jumps to the first lyric line during ad/track transitions.
- Firefox YouTube Music uses real MPRIS position when duration and position become available.
- Logs identify skipped low-confidence timing, for example `sync-position-held-low-confidence`.
- Chromium/Spotify Desktop/Apple Music Web behavior remains unchanged.

### Optional Phase 4: Estimated Clock For Long Stagnation

Commit:

```text
fix(sync): estimate firefox browser position after prolonged stagnation
```

Only implement this if field evidence shows Firefox can stay at `Position=0` for the full track, not just during transitions.

Implementation:

- Add a runtime-only estimated clock for Firefox browser players after a configurable stagnation threshold.
- Start the estimate only after stable music metadata is accepted.
- Prefer real MPRIS position immediately once it becomes positive or monotonic.
- Log estimated timing clearly.

Acceptance:

- Long-running Firefox `Position=0` sessions still progress lyrics.
- Normal Firefox sessions continue using real MPRIS timing.

### Phase 5: Compatibility Matrix Update

Commit:

```text
docs(product): document firefox browser compatibility
```

Implementation:

- Mark YouTube Music Web on Firefox as supported with caveats after live verification.
- Keep Spotify Web Firefox and Apple Music Web Firefox as `Needs test` until inspected.

## Recommended User-Facing Language

Firefox support should be described conservatively:

```text
YouTube Music on Firefox is supported with a timing fallback. Firefox can expose track metadata without a reliable MPRIS playback position, so LyricBar estimates lyric timing after the track is detected. For the most accurate sync, Chromium-based browsers and Spotify Desktop remain better tested.
```
