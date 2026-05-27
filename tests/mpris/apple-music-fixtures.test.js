import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  shouldUseSyncedLyricsPosition,
  shouldUseSyncedLyricsTiming,
} from '../../src/domain/display/sync-position-policy.js';
import { shouldWriteLyricsCache } from '../../src/domain/lyrics/cache-policy.js';
import { buildTrackIdentityKey } from '../../src/domain/lyrics/track-identity.js';
import { detectPlayerProfile, PLAYER_PROFILES } from '../../src/domain/mpris/profile.js';
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

const normal = readFixture('apple-music-web-chromium-normal.json');
const bogusDuration = readFixture('apple-music-web-chromium-bogus-duration.json');
const emptyMetadata = readFixture('apple-music-web-chromium-empty-metadata.json');
const titleOnly = readFixture('apple-music-web-chromium-title-only.json');
const stopped = readFixture('apple-music-web-chromium-stopped.json');

describe('Apple Music browser MPRIS fixtures', () => {
  it('maps normal Apple Music browser metadata into the expected snapshot', () => {
    expect(mapFixture(normal)).toEqual(normal.expectedSnapshot);
  });

  it('preserves the observed bogus Apple Music browser duration as raw evidence', () => {
    const snapshot = requireSnapshot(mapFixture(bogusDuration));

    expect(snapshot).toEqual(bogusDuration.expectedSnapshot);
    expect(snapshot.durationMs).toBe(1172197);
  });

  it('maps empty Apple Music browser metadata into an empty stopped snapshot', () => {
    expect(mapFixture(emptyMetadata)).toEqual(emptyMetadata.expectedSnapshot);
  });

  it('maps title-only Apple Music browser metadata without inventing artist data', () => {
    const snapshot = requireSnapshot(mapFixture(titleOnly));

    expect(snapshot).toEqual(titleOnly.expectedSnapshot);
    expect(snapshot.artist).toBe('');
  });

  it('maps stopped Apple Music browser metadata without treating it as playing', () => {
    const snapshot = requireSnapshot(mapFixture(stopped));

    expect(snapshot).toEqual(stopped.expectedSnapshot);
    expect(snapshot.playbackStatus).toBe('Stopped');
  });

  it('keeps Apple Music browser fixtures on Chromium profile in auto mode', () => {
    expect(detectPlayerProfile(requireSnapshot(mapFixture(normal)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
    expect(detectPlayerProfile(requireSnapshot(mapFixture(bogusDuration)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
  });

  it('classifies explicit Apple Music browser service as apple-music-web', () => {
    expect(
      detectPlayerProfile(requireSnapshot(mapFixture(normal)), {
        browserPlayerService: 'apple-music',
      }),
    ).toBe(PLAYER_PROFILES.appleMusicWeb);
    expect(
      detectPlayerProfile(requireSnapshot(mapFixture(bogusDuration)), {
        browserPlayerService: 'apple-music',
      }),
    ).toBe(PLAYER_PROFILES.appleMusicWeb);
  });

  it('does not infer Apple Music Web from current Apple Music Chromium fixture evidence', () => {
    expect(detectPlayerProfile(requireSnapshot(mapFixture(normal)))).not.toBe(
      PLAYER_PROFILES.appleMusicWeb,
    );
    expect(detectPlayerProfile(requireSnapshot(mapFixture(bogusDuration)))).not.toBe(
      PLAYER_PROFILES.appleMusicWeb,
    );
  });

  it('keeps low-confidence Apple Music browser fixtures on Chromium profile', () => {
    const options = { browserPlayerService: /** @type {const} */ ('apple-music') };

    expect(detectPlayerProfile(requireSnapshot(mapFixture(emptyMetadata)), options)).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
    expect(detectPlayerProfile(requireSnapshot(mapFixture(titleOnly)), options)).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
    expect(detectPlayerProfile(requireSnapshot(mapFixture(stopped)), options)).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
  });

  it('keeps normal Apple Music browser position samples monotonic for sync-loop harnesses', () => {
    expect(isStrictlyIncreasing(normal.positionSamplesMs)).toBe(true);
    expect(isStrictlyIncreasing(bogusDuration.positionSamplesMs)).toBe(true);
  });

  it('ignores generic Chromium track ID churn for current Apple Music browser identity', () => {
    const first = requireSnapshot(mapFixture(normal));
    const second = {
      ...first,
      trackId: '/org/chromium/MediaPlayer2/TrackList/TrackDifferent',
    };

    expect(buildTrackIdentityKey(first)).toBe(buildTrackIdentityKey(second));
  });

  it('ignores bogus Apple Music duration in explicit Apple Music browser identity', () => {
    const first = requireSnapshot(mapFixture(bogusDuration));
    const second = {
      ...first,
      durationMs: 1000000,
    };

    expect(buildTrackIdentityKey(first, { browserPlayerService: 'apple-music' })).toBe(
      buildTrackIdentityKey(second, { browserPlayerService: 'apple-music' }),
    );
  });

  it('does not cache not-found results for low-confidence Apple Music browser metadata', () => {
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(emptyMetadata)), notFound)).toBe(
      false,
    );
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(titleOnly)), notFound)).toBe(false);
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(stopped)), notFound)).toBe(false);
  });

  it('does not cache not-found results for high-confidence Apple Music browser metadata', () => {
    expect(
      shouldWriteLyricsCache(requireSnapshot(mapFixture(normal)), notFound, {
        browserPlayerService: 'apple-music',
      }),
    ).toBe(false);
  });

  it('does not cache not-found results for implausible Apple Music browser duration', () => {
    expect(
      shouldWriteLyricsCache(requireSnapshot(mapFixture(bogusDuration)), notFound, {
        browserPlayerService: 'apple-music',
      }),
    ).toBe(false);
  });

  it('uses per-sample synced lyric position validation for bogus Apple Music browser duration', () => {
    const snapshot = requireSnapshot(mapFixture(bogusDuration));

    expect(
      shouldUseSyncedLyricsTiming(snapshot, {
        browserPlayerService: 'apple-music',
      }),
    ).toBe(true);
    expect(
      shouldUseSyncedLyricsPosition(snapshot, bogusDuration.positionSamplesMs[0], {
        browserPlayerService: 'apple-music',
        trackDurationMs: 180000,
      }),
    ).toBe(false);
  });

  it('uses synced lyric timing for plausible Apple Music browser positions', () => {
    const snapshot = requireSnapshot(mapFixture(normal));

    expect(
      shouldUseSyncedLyricsTiming(snapshot, {
        browserPlayerService: 'apple-music',
      }),
    ).toBe(true);
    expect(
      shouldUseSyncedLyricsPosition(snapshot, normal.positionSamplesMs[0], {
        browserPlayerService: 'apple-music',
        trackDurationMs: 180000,
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
