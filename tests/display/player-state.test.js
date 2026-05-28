import { describe, expect, it } from 'vitest';

import { displayStateFromPlayer } from '../../src/domain/display/player-state.js';

/**
 * @import { PlayerSnapshot } from '../../src/domain/mpris/types.js'
 */

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function snapshot(overrides) {
  return {
    busName: 'org.mpris.MediaPlayer2.spotify',
    title: '',
    artist: '',
    album: '',
    durationMs: null,
    trackId: null,
    url: null,
    playbackStatus: 'Stopped',
    ...overrides,
  };
}

describe('displayStateFromPlayer', () => {
  it('maps null to idle state', () => {
    expect(displayStateFromPlayer(null)).toEqual({ kind: 'idle' });
  });

  it('maps undefined to idle state', () => {
    expect(displayStateFromPlayer(undefined)).toEqual({ kind: 'idle' });
  });

  it('maps a snapshot with title and artist into a track state', () => {
    expect(
      displayStateFromPlayer(
        snapshot({
          title: 'Song',
          artist: 'Artist',
          playbackStatus: 'Playing',
        }),
      ),
    ).toEqual({
      kind: 'track',
      track: { title: 'Song', artist: 'Artist' },
    });
  });

  it('keeps empty title and artist on the track payload', () => {
    expect(displayStateFromPlayer(snapshot({}))).toEqual({
      kind: 'track',
      track: { title: '', artist: '' },
    });
  });

  it('preserves non-Latin metadata verbatim', () => {
    expect(
      displayStateFromPlayer(
        snapshot({
          title: '春の風',
          artist: '山田 太郎',
        }),
      ),
    ).toEqual({
      kind: 'track',
      track: { title: '春の風', artist: '山田 太郎' },
    });
  });
});
