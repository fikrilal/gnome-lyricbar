import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

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

  it('keeps Apple Music browser fixtures on Chromium profile before Apple-specific profile support', () => {
    expect(detectPlayerProfile(requireSnapshot(mapFixture(normal)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
    expect(detectPlayerProfile(requireSnapshot(mapFixture(bogusDuration)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
  });

  it('keeps low-confidence Apple Music browser fixtures on Chromium profile', () => {
    expect(detectPlayerProfile(requireSnapshot(mapFixture(emptyMetadata)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
    expect(detectPlayerProfile(requireSnapshot(mapFixture(titleOnly)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
    expect(detectPlayerProfile(requireSnapshot(mapFixture(stopped)))).toBe(
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

  it('documents that bogus Apple Music duration currently affects browser identity', () => {
    const plausible = requireSnapshot(mapFixture(normal));
    const implausible = {
      ...plausible,
      durationMs: requireSnapshot(mapFixture(bogusDuration)).durationMs,
    };

    expect(buildTrackIdentityKey(plausible)).not.toBe(buildTrackIdentityKey(implausible));
  });

  it('does not cache not-found results for low-confidence Apple Music browser metadata', () => {
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(emptyMetadata)), notFound)).toBe(
      false,
    );
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(titleOnly)), notFound)).toBe(false);
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(stopped)), notFound)).toBe(false);
  });

  it('allows not-found caching for high-confidence Apple Music browser metadata under current policy', () => {
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(normal)), notFound)).toBe(true);
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(bogusDuration)), notFound)).toBe(true);
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
