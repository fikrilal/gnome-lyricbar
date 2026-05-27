import { describe, expect, it } from 'vitest';

import {
  shouldUseRelativeSyncedLyricsPosition,
  shouldUseSyncedLyricsPosition,
  shouldUseSyncedLyricsTiming,
} from '../../src/domain/display/sync-position-policy.js';

/**
 * @import { PlayerSnapshot } from '../../src/domain/mpris/types.js'
 */

describe('shouldUseSyncedLyricsTiming', () => {
  it('allows normal player timing', () => {
    expect(shouldUseSyncedLyricsTiming(snapshot({}))).toBe(true);
  });

  it('allows plausible Apple Music Web timing even when duration is ignored elsewhere', () => {
    expect(
      shouldUseSyncedLyricsTiming(browserSnapshot({ durationMs: 230000 }), {
        browserPlayerService: 'apple-music',
      }),
    ).toBe(true);
  });

  it('allows Apple Music Web timing decisions to be made per position sample', () => {
    expect(
      shouldUseSyncedLyricsTiming(browserSnapshot({ durationMs: 2308029 }), {
        browserPlayerService: 'apple-music',
      }),
    ).toBe(true);
  });

  it('does not reject generic Chromium timing without explicit Apple Music service', () => {
    expect(shouldUseSyncedLyricsTiming(browserSnapshot({ durationMs: 2308029 }))).toBe(true);
  });
});

describe('shouldUseSyncedLyricsPosition', () => {
  it('rejects missing and invalid positions', () => {
    expect(shouldUseSyncedLyricsPosition(snapshot({}), null)).toBe(false);
    expect(shouldUseSyncedLyricsPosition(snapshot({}), Number.NaN)).toBe(false);
    expect(shouldUseSyncedLyricsPosition(snapshot({}), -1)).toBe(false);
  });

  it('rejects positions beyond provider track duration tolerance', () => {
    expect(
      shouldUseSyncedLyricsPosition(browserSnapshot({ durationMs: 2308029 }), 2034713, {
        browserPlayerService: 'apple-music',
        trackDurationMs: 180000,
      }),
    ).toBe(false);
  });

  it('allows valid Apple Music Web positions within provider track duration', () => {
    expect(
      shouldUseSyncedLyricsPosition(browserSnapshot({ durationMs: 230000 }), 30000, {
        browserPlayerService: 'apple-music',
        trackDurationMs: 180000,
      }),
    ).toBe(true);
  });

  it('allows long outros after the final synced lyric line', () => {
    expect(
      shouldUseSyncedLyricsPosition(browserSnapshot({ durationMs: 230000 }), 220000, {
        browserPlayerService: 'apple-music',
        trackDurationMs: 230000,
      }),
    ).toBe(true);
  });

  it('allows positions when provider track duration is unavailable', () => {
    expect(
      shouldUseSyncedLyricsPosition(browserSnapshot({ durationMs: 230000 }), 220000, {
        browserPlayerService: 'apple-music',
        trackDurationMs: null,
      }),
    ).toBe(true);
  });
});

describe('shouldUseRelativeSyncedLyricsPosition', () => {
  it('allows Apple Music Web raw positions beyond provider duration to be normalized', () => {
    expect(
      shouldUseRelativeSyncedLyricsPosition(browserSnapshot({ durationMs: 734994 }), 496574, {
        browserPlayerService: 'apple-music',
        trackDurationMs: 173000,
      }),
    ).toBe(true);
  });

  it('does not normalize valid song-relative positions', () => {
    expect(
      shouldUseRelativeSyncedLyricsPosition(browserSnapshot({ durationMs: 230000 }), 30000, {
        browserPlayerService: 'apple-music',
        trackDurationMs: 180000,
      }),
    ).toBe(false);
  });

  it('does not normalize non-Apple browser positions', () => {
    expect(
      shouldUseRelativeSyncedLyricsPosition(browserSnapshot({ durationMs: 734994 }), 496574, {
        browserPlayerService: 'youtube-music',
        trackDurationMs: 173000,
      }),
    ).toBe(false);
  });
});

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function snapshot(overrides) {
  return {
    busName: 'org.mpris.MediaPlayer2.spotify',
    title: 'Natural',
    artist: 'Imagine Dragons',
    album: 'Origins (Deluxe Edition)',
    durationMs: 230000,
    trackId: '/com/spotify/track/natural',
    playbackStatus: 'Playing',
    ...overrides,
  };
}

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function browserSnapshot(overrides) {
  return snapshot({
    busName: 'org.mpris.MediaPlayer2.chromium.instance4621',
    trackId: '/org/chromium/MediaPlayer2/TrackList/Track01FC59808B7916991056915FDB535390',
    ...overrides,
  });
}
