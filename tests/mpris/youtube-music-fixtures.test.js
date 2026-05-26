import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { shouldPollSyncedLyrics } from '../../src/domain/display/sync-polling.js';
import { shouldWriteLyricsCache } from '../../src/domain/lyrics/cache-policy.js';
import { buildTrackIdentityKey } from '../../src/domain/lyrics/track-identity.js';
import { detectPlayerProfile, PLAYER_PROFILES } from '../../src/domain/mpris/profile.js';
import { policyForPlayerProfile } from '../../src/domain/mpris/profile-policy.js';
import { mapMprisProperties } from '../../src/runtime/mpris/player-mapping.js';

/**
 * @import { LyricsProviderResult } from '../../src/domain/lyrics/types.js'
 * @import { PlayerSnapshot } from '../../src/domain/mpris/types.js'
 *
 * @typedef {Readonly<{
 *   name: string,
 *   description: string,
 *   busName: string,
 *   rootProperties: Readonly<Record<string, unknown>>,
 *   playerProperties: Readonly<Record<string, unknown>>,
 *   positionSamplesMs: readonly number[],
 *   expectedSnapshot: PlayerSnapshot,
 * }>} MprisFixture
 */

/** @type {LyricsProviderResult} */
const notFound = Object.freeze({ kind: 'not-found' });

/** @type {LyricsProviderResult} */
const syncedLookup = Object.freeze({
  kind: 'synced',
  track: Object.freeze({
    trackName: 'Let Me Love You',
    artistName: 'DJ Snake',
    albumName: '',
    durationMs: 205341,
  }),
  lines: Object.freeze([Object.freeze({ timeMs: 1000, text: 'I used to believe' })]),
  plainText: 'I used to believe',
});

const normal = readFixture('youtube-music-web-normal.json');
const emptyAlbum = readFixture('youtube-music-web-empty-album.json');
const transient = readFixture('youtube-music-web-transient-non-track.json');

describe('YouTube Music browser MPRIS fixtures', () => {
  it('maps normal YouTube Music browser metadata into the expected snapshot', () => {
    expect(mapFixture(normal)).toEqual(normal.expectedSnapshot);
  });

  it('maps empty-album YouTube Music browser metadata without requiring album data', () => {
    const snapshot = mapFixture(emptyAlbum);

    expect(snapshot).toEqual(emptyAlbum.expectedSnapshot);
    expect(snapshot?.album).toBe('');
  });

  it('classifies explicit YouTube Music browser service as youtube-music-web', () => {
    const snapshot = requireSnapshot(mapFixture(normal));

    expect(
      detectPlayerProfile(snapshot, {
        browserPlayerService: 'youtube-music',
      }),
    ).toBe(PLAYER_PROFILES.youtubeMusicWeb);
  });

  it('keeps transient short browser metadata on the generic Chromium profile', () => {
    const snapshot = requireSnapshot(mapFixture(transient));

    expect(
      detectPlayerProfile(snapshot, {
        browserPlayerService: 'youtube-music',
      }),
    ).toBe(PLAYER_PROFILES.chromiumBrowser);
  });

  it('keeps YouTube Music browser position samples monotonic for sync-loop harnesses', () => {
    expect(isStrictlyIncreasing(normal.positionSamplesMs)).toBe(true);
    expect(isStrictlyIncreasing(emptyAlbum.positionSamplesMs)).toBe(true);
  });

  it('uses browser policy that supports synced lyric position polling', () => {
    const profile = detectPlayerProfile(requireSnapshot(mapFixture(normal)), {
      browserPlayerService: 'youtube-music',
    });
    const policy = policyForPlayerProfile(profile);

    expect(policy.pollPositionWhenSynced).toBe(true);
    expect(
      shouldPollSyncedLyrics({
        enabled: policy.pollPositionWhenSynced,
        player: requireSnapshot(mapFixture(normal)),
        lookup: syncedLookup,
      }),
    ).toBe(true);
  });

  it('ignores generic Chromium track ID churn for YouTube Music identity', () => {
    const first = requireSnapshot(mapFixture(normal));
    const second = {
      ...first,
      trackId: '/org/chromium/MediaPlayer2/TrackList/TrackDifferent',
    };

    expect(buildTrackIdentityKey(first, { browserPlayerService: 'youtube-music' })).toBe(
      buildTrackIdentityKey(second, { browserPlayerService: 'youtube-music' }),
    );
  });

  it('changes identity when YouTube Music song metadata changes despite reused track ID', () => {
    const first = requireSnapshot(mapFixture(normal));
    const second = {
      ...requireSnapshot(mapFixture(emptyAlbum)),
      trackId: first.trackId,
    };

    expect(buildTrackIdentityKey(first, { browserPlayerService: 'youtube-music' })).not.toBe(
      buildTrackIdentityKey(second, { browserPlayerService: 'youtube-music' }),
    );
  });

  it('does not cache not-found results for transient non-track browser metadata', () => {
    expect(
      shouldWriteLyricsCache(requireSnapshot(mapFixture(transient)), notFound, {
        browserPlayerService: 'youtube-music',
      }),
    ).toBe(false);
  });

  it('allows not-found caching for high-confidence YouTube Music browser metadata', () => {
    expect(
      shouldWriteLyricsCache(requireSnapshot(mapFixture(normal)), notFound, {
        browserPlayerService: 'youtube-music',
      }),
    ).toBe(true);
  });
});

/**
 * @param {string} filename
 * @returns {MprisFixture}
 */
function readFixture(filename) {
  const url = new URL(`../fixtures/mpris/${filename}`, import.meta.url);
  return /** @type {MprisFixture} */ (JSON.parse(readFileSync(url, 'utf8')));
}

/**
 * @param {MprisFixture} fixture
 * @returns {PlayerSnapshot | null}
 */
function mapFixture(fixture) {
  return mapMprisProperties(fixture.busName, fixture.playerProperties);
}

/**
 * @param {PlayerSnapshot | null} snapshot
 * @returns {PlayerSnapshot}
 */
function requireSnapshot(snapshot) {
  if (snapshot === null) {
    throw new Error('Expected fixture to map to a PlayerSnapshot.');
  }
  return snapshot;
}

/**
 * @param {readonly number[]} values
 * @returns {boolean}
 */
function isStrictlyIncreasing(values) {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined || current <= previous) {
      return false;
    }
  }
  return true;
}
