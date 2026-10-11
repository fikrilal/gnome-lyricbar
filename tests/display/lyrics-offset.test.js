import { describe, expect, it } from 'vitest';

import { applyLyricsOffset } from '../../src/domain/display/lyrics-offset.js';
import { displayStateFromSyncedPosition } from '../../src/domain/display/lyrics-state.js';

/**
 * @import { PlayerSnapshot } from '../../src/domain/mpris/types.js'
 * @import { LyricsProviderResult } from '../../src/domain/lyrics/types.js'
 */

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function snapshot(overrides) {
  return {
    busName: 'org.mpris.MediaPlayer2.spotify',
    title: 'Yellow',
    artist: 'Coldplay',
    album: 'Parachutes',
    durationMs: 266773,
    trackId: '/com/spotify/track/abc',
    url: null,
    playbackStatus: 'Playing',
    ...overrides,
  };
}

/** @type {Extract<LyricsProviderResult, { kind: 'synced' }>} */
const syncedLookup = {
  kind: 'synced',
  track: {
    trackName: 'Yellow',
    artistName: 'Coldplay',
    albumName: 'Parachutes',
    durationMs: 266773,
  },
  lines: [
    { timeMs: 10000, text: 'Look at the stars' },
    { timeMs: 20000, text: 'Look how they shine for you' },
  ],
  plainText: 'Look at the stars\nLook how they shine for you',
};

describe('applyLyricsOffset', () => {
  it('returns the position unchanged for a zero offset', () => {
    expect(applyLyricsOffset(19_500, 0)).toBe(19_500);
  });

  it('delays line selection for positive offsets', () => {
    expect(applyLyricsOffset(19_500, 1_000)).toBe(20_500);
  });

  it('advances line selection for negative offsets', () => {
    expect(applyLyricsOffset(20_500, -1_000)).toBe(19_500);
  });

  it('clamps the adjusted position at zero', () => {
    expect(applyLyricsOffset(500, -5_000)).toBe(0);
  });
});

describe('offset applied to synced line selection', () => {
  it('moves the displayed line later for a positive offset', () => {
    const state = displayStateFromSyncedPosition(
      snapshot({}),
      syncedLookup,
      applyLyricsOffset(19_500, 1_000),
    );

    expect(state).toEqual({
      kind: 'lyrics',
      line: 'Look how they shine for you',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });

  it('moves the displayed line earlier for a negative offset', () => {
    const state = displayStateFromSyncedPosition(
      snapshot({}),
      syncedLookup,
      applyLyricsOffset(20_500, -1_000),
    );

    expect(state).toEqual({
      kind: 'lyrics',
      line: 'Look at the stars',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });

  it('falls back to the first line when the offset reaches before the first timestamp', () => {
    const state = displayStateFromSyncedPosition(
      snapshot({}),
      syncedLookup,
      applyLyricsOffset(500, -5_000),
    );

    expect(state).toEqual({
      kind: 'lyrics',
      line: 'Look at the stars',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });
});
