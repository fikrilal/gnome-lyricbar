import { describe, expect, it } from 'vitest';

import { buildTrackIdentityKey } from '../../src/domain/lyrics/track-identity.js';

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
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    durationMs: 200000,
    trackId: '/com/spotify/track/abc',
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
    busName: 'org.mpris.MediaPlayer2.chromium.instance105121',
    title: 'Mangu',
    artist: 'Fourtwnty, Charita Utami',
    album: 'Nalar',
    durationMs: 261094,
    trackId: '/org/chromium/MediaPlayer2/TrackList/Track6E48368',
    ...overrides,
  });
}

describe('buildTrackIdentityKey', () => {
  it('returns null for null player', () => {
    expect(buildTrackIdentityKey(null)).toBeNull();
  });

  it('returns null when title and artist are both empty', () => {
    expect(buildTrackIdentityKey(snapshot({ title: '', artist: '' }))).toBeNull();
  });

  it('returns a stable key for the same snapshot', () => {
    const a = snapshot({});
    const b = snapshot({});
    expect(buildTrackIdentityKey(a)).toBe(buildTrackIdentityKey(b));
  });

  it('changes when the title differs', () => {
    expect(buildTrackIdentityKey(snapshot({ title: 'Song' }))).not.toBe(
      buildTrackIdentityKey(snapshot({ title: 'Other' })),
    );
  });

  it('changes when the bus name differs', () => {
    expect(buildTrackIdentityKey(snapshot({ busName: 'org.mpris.MediaPlayer2.spotify' }))).not.toBe(
      buildTrackIdentityKey(snapshot({ busName: 'org.mpris.MediaPlayer2.vlc' })),
    );
  });

  it('keeps desktop Spotify track ids as part of identity', () => {
    expect(buildTrackIdentityKey(snapshot({ trackId: '/com/spotify/track/a' }))).not.toBe(
      buildTrackIdentityKey(snapshot({ trackId: '/com/spotify/track/b' })),
    );
  });

  it('ignores browser track id churn for the same song', () => {
    const first = browserSnapshot({
      trackId: '/org/chromium/MediaPlayer2/TrackList/TrackA',
    });
    const second = browserSnapshot({
      trackId: '/org/chromium/MediaPlayer2/TrackList/TrackB',
    });

    expect(buildTrackIdentityKey(first, { browserPlayerService: 'spotify' })).toBe(
      buildTrackIdentityKey(second, { browserPlayerService: 'spotify' }),
    );
  });

  it('changes browser identity when song metadata changes even if track id is reused', () => {
    const reusedTrackId = '/org/chromium/MediaPlayer2/TrackList/Track6E48368';

    expect(
      buildTrackIdentityKey(
        browserSnapshot({
          title: 'Ramai Sepi Bersama',
          artist: 'Hindia',
          album: 'Ramai Sepi Bersama',
          durationMs: 188046,
          trackId: reusedTrackId,
        }),
        { browserPlayerService: 'spotify' },
      ),
    ).not.toBe(
      buildTrackIdentityKey(
        browserSnapshot({
          title: 'Mangu',
          artist: 'Fourtwnty, Charita Utami',
          album: 'Nalar',
          durationMs: 261094,
          trackId: reusedTrackId,
        }),
        { browserPlayerService: 'spotify' },
      ),
    );
  });

  it('treats playback status changes as the same identity', () => {
    expect(buildTrackIdentityKey(snapshot({ playbackStatus: 'Playing' }))).toBe(
      buildTrackIdentityKey(snapshot({ playbackStatus: 'Paused' })),
    );
  });

  it('rounds duration to seconds and ignores millisecond drift', () => {
    expect(buildTrackIdentityKey(snapshot({ durationMs: 200100 }))).toBe(
      buildTrackIdentityKey(snapshot({ durationMs: 200399 })),
    );
  });

  it('keeps changes across major duration jumps', () => {
    expect(buildTrackIdentityKey(snapshot({ durationMs: 200000 }))).not.toBe(
      buildTrackIdentityKey(snapshot({ durationMs: 320000 })),
    );
  });

  it('ignores Apple Music browser duration for identity', () => {
    const first = browserSnapshot({
      title: 'Radioactive',
      artist: 'Imagine Dragons',
      album: 'Night Visions (Deluxe)',
      durationMs: 1172197,
    });
    const second = {
      ...first,
      durationMs: 1000000,
    };

    expect(buildTrackIdentityKey(first, { browserPlayerService: 'apple-music' })).toBe(
      buildTrackIdentityKey(second, { browserPlayerService: 'apple-music' }),
    );
  });

  it('ignores plausible-looking Apple Music browser duration for identity', () => {
    const first = browserSnapshot({
      title: 'Natural',
      artist: 'Imagine Dragons',
      album: 'Origins (Deluxe Edition)',
      durationMs: 189515,
    });
    const second = {
      ...first,
      durationMs: 240000,
    };

    expect(buildTrackIdentityKey(first, { browserPlayerService: 'apple-music' })).toBe(
      buildTrackIdentityKey(second, { browserPlayerService: 'apple-music' }),
    );
  });

  it('lowercases the produced key for case-insensitive matching', () => {
    const key = buildTrackIdentityKey(snapshot({ title: 'YELLOW', artist: 'COLDPLAY' }));
    expect(key).toBe(key?.toLowerCase());
  });
});
