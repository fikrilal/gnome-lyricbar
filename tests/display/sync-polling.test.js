import { describe, expect, it } from 'vitest';

import { shouldPollSyncedLyrics } from '../../src/domain/display/sync-polling.js';

/**
 * @import { LyricsProviderResult } from '../../src/domain/lyrics/types.js'
 * @import { PlayerSnapshot } from '../../src/domain/mpris/types.js'
 */

/** @type {LyricsProviderResult} */
const syncedLookup = Object.freeze({
  kind: 'synced',
  track: Object.freeze({
    trackName: 'Nina',
    artistName: '.Feast',
    albumName: 'Nina',
    durationMs: 277991,
  }),
  lines: Object.freeze([Object.freeze({ timeMs: 1000, text: 'Saat engkau tertidur' })]),
  plainText: 'Saat engkau tertidur',
});

/** @type {LyricsProviderResult} */
const plainLookup = Object.freeze({
  kind: 'plain',
  track: Object.freeze({
    trackName: 'Nina',
    artistName: '.Feast',
    albumName: 'Nina',
    durationMs: 277991,
  }),
  text: 'Saat engkau tertidur',
});

describe('shouldPollSyncedLyrics', () => {
  it('polls synced lyrics for playing players', () => {
    expect(
      shouldPollSyncedLyrics({
        enabled: true,
        player: snapshot({ playbackStatus: 'Playing' }),
        lookup: syncedLookup,
      }),
    ).toBe(true);
  });

  it('polls synced lyrics for paused browser players so a valid position can recover display', () => {
    expect(
      shouldPollSyncedLyrics({
        enabled: true,
        player: snapshot({ playbackStatus: 'Paused' }),
        lookup: syncedLookup,
      }),
    ).toBe(true);
  });

  it('polls synced lyrics for stopped browser players because position reads are authoritative', () => {
    expect(
      shouldPollSyncedLyrics({
        enabled: true,
        player: snapshot({ playbackStatus: 'Stopped' }),
        lookup: syncedLookup,
      }),
    ).toBe(true);
  });

  it('does not poll without a synced lookup', () => {
    expect(
      shouldPollSyncedLyrics({
        enabled: true,
        player: snapshot({ playbackStatus: 'Playing' }),
        lookup: plainLookup,
      }),
    ).toBe(false);
  });

  it('polls synced lyrics for Apple Music Web so per-sample position validation can recover display', () => {
    expect(
      shouldPollSyncedLyrics({
        enabled: true,
        player: snapshot({
          busName: 'org.mpris.MediaPlayer2.chromium.instance4621',
          durationMs: 2308029,
          trackId: '/org/chromium/MediaPlayer2/TrackList/TrackNatural',
        }),
        lookup: syncedLookup,
        browserPlayerService: 'apple-music',
      }),
    ).toBe(true);
  });
});

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function snapshot(overrides) {
  return {
    busName: 'org.mpris.MediaPlayer2.chromium.instance7080',
    title: 'Nina',
    artist: '.Feast',
    album: 'Nina',
    durationMs: 277991,
    trackId: '/org/chromium/MediaPlayer2/TrackList/Nina',
    url: null,
    playbackStatus: 'Playing',
    ...overrides,
  };
}
