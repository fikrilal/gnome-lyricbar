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

  it('lowercases the produced key for case-insensitive matching', () => {
    const key = buildTrackIdentityKey(snapshot({ title: 'YELLOW', artist: 'COLDPLAY' }));
    expect(key).toBe(key?.toLowerCase());
  });
});
