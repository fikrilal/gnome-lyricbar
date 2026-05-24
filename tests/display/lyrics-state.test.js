import { describe, expect, it } from 'vitest';

import {
  displayStateFromLookup,
  displayStateFromSyncedPosition,
} from '../../src/domain/display/lyrics-state.js';

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
    { timeMs: 1000, text: 'Look at the stars' },
    { timeMs: 4500, text: 'Look how they shine for you' },
  ],
  plainText: 'Look at the stars\nLook how they shine for you',
};

describe('displayStateFromLookup', () => {
  it('returns idle when player is null', () => {
    expect(displayStateFromLookup(null, syncedLookup)).toEqual({ kind: 'idle' });
  });

  it('returns loading when player exists and lookup is null', () => {
    expect(displayStateFromLookup(snapshot({}), null)).toEqual({
      kind: 'loading',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });

  it('returns the first synced line for a synced result', () => {
    expect(displayStateFromLookup(snapshot({}), syncedLookup)).toEqual({
      kind: 'lyrics',
      line: 'Look at the stars',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });

  it('falls back to plainText when synced lines are all empty', () => {
    expect(
      displayStateFromLookup(snapshot({}), {
        ...syncedLookup,
        lines: [{ timeMs: 1000, text: ' ' }],
        plainText: 'Plain fallback line\nSecond plain',
      }),
    ).toEqual({
      kind: 'lyrics',
      line: 'Plain fallback line',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });

  it('returns the first non-empty plain line for a plain result', () => {
    expect(
      displayStateFromLookup(snapshot({}), {
        kind: 'plain',
        track: {
          trackName: 'Song',
          artistName: 'Artist',
          albumName: '',
          durationMs: null,
        },
        text: '\n\nFirst real line\nSecond line',
      }),
    ).toEqual({
      kind: 'lyrics',
      line: 'First real line',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });

  it('returns track display for instrumental tracks', () => {
    expect(
      displayStateFromLookup(snapshot({}), {
        kind: 'instrumental',
        track: {
          trackName: 'Atmosphere',
          artistName: 'Joy Division',
          albumName: '',
          durationMs: null,
        },
      }),
    ).toEqual({
      kind: 'track',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });

  it('returns track display for not-found results', () => {
    expect(displayStateFromLookup(snapshot({}), { kind: 'not-found' })).toEqual({
      kind: 'track',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });

  it('returns error display for error results', () => {
    expect(
      displayStateFromLookup(snapshot({}), {
        kind: 'error',
        reason: 'connection refused',
      }),
    ).toEqual({
      kind: 'error',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });
});

describe('displayStateFromSyncedPosition', () => {
  it('selects the synced line at the current playback position', () => {
    expect(displayStateFromSyncedPosition(snapshot({}), syncedLookup, 5000)).toEqual({
      kind: 'lyrics',
      line: 'Look how they shine for you',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });

  it('falls back to the static synced display before the first timestamp', () => {
    expect(displayStateFromSyncedPosition(snapshot({}), syncedLookup, 500)).toEqual({
      kind: 'lyrics',
      line: 'Look at the stars',
      track: { title: 'Yellow', artist: 'Coldplay' },
    });
  });

  it('returns idle when player is missing', () => {
    expect(displayStateFromSyncedPosition(null, syncedLookup, 5000)).toEqual({ kind: 'idle' });
  });
});
