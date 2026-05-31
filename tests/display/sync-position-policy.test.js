import { describe, expect, it } from 'vitest';

import {
  shouldHoldLowConfidenceSyncedPosition,
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

describe('shouldHoldLowConfidenceSyncedPosition', () => {
  it('holds Firefox YouTube Music zero-position transition samples after a line rendered', () => {
    expect(
      shouldHoldLowConfidenceSyncedPosition(firefoxYoutubeSnapshot({}), 0, {
        hasPreviousSyncedLine: true,
      }),
    ).toBe(true);
  });

  it('allows the first synced line to render at zero position', () => {
    expect(
      shouldHoldLowConfidenceSyncedPosition(firefoxYoutubeSnapshot({}), 0, {
        hasPreviousSyncedLine: false,
      }),
    ).toBe(false);
  });

  it('holds after a synced position was accepted even when the rendered line is unknown', () => {
    expect(
      shouldHoldLowConfidenceSyncedPosition(firefoxYoutubeSnapshot({}), 0, {
        hasAcceptedSyncedPosition: true,
        hasPreviousSyncedLine: false,
      }),
    ).toBe(true);
  });

  it('does not hold valid positive Firefox YouTube Music positions', () => {
    expect(
      shouldHoldLowConfidenceSyncedPosition(firefoxYoutubeSnapshot({}), 1500, {
        hasPreviousSyncedLine: true,
      }),
    ).toBe(false);
  });

  it('does not hold Firefox YouTube Music samples when duration is available', () => {
    expect(
      shouldHoldLowConfidenceSyncedPosition(firefoxYoutubeSnapshot({ durationMs: 202000 }), 0, {
        hasPreviousSyncedLine: true,
      }),
    ).toBe(false);
  });

  it('does not hold Chromium browser samples', () => {
    expect(
      shouldHoldLowConfidenceSyncedPosition(
        browserSnapshot({
          durationMs: null,
          url: 'https://music.youtube.com/watch?v=snx5qGUtVi8',
        }),
        0,
        {
          hasPreviousSyncedLine: true,
        },
      ),
    ).toBe(false);
  });

  it('does not hold non-YouTube Firefox browser samples', () => {
    expect(
      shouldHoldLowConfidenceSyncedPosition(
        firefoxYoutubeSnapshot({
          url: 'https://open.spotify.com/track/abc',
        }),
        0,
        {
          hasPreviousSyncedLine: true,
        },
      ),
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
    url: null,
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

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function firefoxYoutubeSnapshot(overrides) {
  return snapshot({
    busName: 'org.mpris.MediaPlayer2.firefox.instance_1_121',
    title: 'Hall of Fame',
    artist: 'The Script',
    album: 'Hall of Fame',
    durationMs: null,
    trackId: '/org/mpris/MediaPlayer2/firefox',
    url: 'https://music.youtube.com/watch?v=snx5qGUtVi8',
    playbackStatus: 'Playing',
    ...overrides,
  });
}
