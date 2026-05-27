import { describe, expect, it } from 'vitest';

import { applyLyricsQueryPolicy } from '../../src/domain/lyrics/query-policy.js';

/**
 * @import { LyricsQuery } from '../../src/domain/lyrics/types.js'
 * @import { PlayerSnapshot } from '../../src/domain/mpris/types.js'
 */

describe('applyLyricsQueryPolicy', () => {
  it('removes implausible Apple Music Web duration from lyrics query', () => {
    expect(
      applyLyricsQueryPolicy(
        appleMusicSnapshot({ durationMs: 1172197 }),
        query({ durationMs: 1172197 }),
        { browserPlayerService: 'apple-music' },
      ),
    ).toEqual(query({ durationMs: null }));
  });

  it('preserves plausible Apple Music Web duration', () => {
    expect(
      applyLyricsQueryPolicy(
        appleMusicSnapshot({ durationMs: 189515 }),
        query({ durationMs: 189515 }),
        { browserPlayerService: 'apple-music' },
      ),
    ).toEqual(query({ durationMs: 189515 }));
  });

  it('keeps Spotify Desktop duration unchanged even when long', () => {
    const source = query({ durationMs: 1172197 });

    expect(applyLyricsQueryPolicy(spotifySnapshot({ durationMs: 1172197 }), source)).toBe(source);
  });

  it('keeps generic browser duration unchanged without explicit Apple Music service', () => {
    const source = query({ durationMs: 1172197 });

    expect(applyLyricsQueryPolicy(appleMusicSnapshot({ durationMs: 1172197 }), source)).toBe(
      source,
    );
  });
});

/**
 * @param {Partial<LyricsQuery>} overrides
 * @returns {LyricsQuery}
 */
function query(overrides) {
  return {
    artist: 'Imagine Dragons',
    title: 'Radioactive',
    album: 'Night Visions (Deluxe)',
    durationMs: 1172197,
    ...overrides,
  };
}

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function appleMusicSnapshot(overrides) {
  return {
    busName: 'org.mpris.MediaPlayer2.chromium.instance100256',
    title: 'Radioactive',
    artist: 'Imagine Dragons',
    album: 'Night Visions (Deluxe)',
    durationMs: 1172197,
    trackId: '/org/chromium/MediaPlayer2/TrackList/TrackAD881F63680FE0B3A97734DAC2ED7F63',
    playbackStatus: 'Playing',
    ...overrides,
  };
}

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function spotifySnapshot(overrides) {
  return {
    ...appleMusicSnapshot(overrides),
    busName: 'org.mpris.MediaPlayer2.spotify',
    trackId: '/com/spotify/track/radioactive',
  };
}
