import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { shouldWriteLyricsCache } from '../../src/domain/lyrics/cache-policy.js';
import { buildTrackIdentityKey } from '../../src/domain/lyrics/track-identity.js';
import { detectPlayerProfile, PLAYER_PROFILES } from '../../src/domain/mpris/profile.js';
import { policyForPlayerProfile } from '../../src/domain/mpris/profile-policy.js';
import { reduceStablePlayerSnapshot } from '../../src/domain/mpris/stability.js';
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

const normal = readFixture('tidal-web-chromium-normal.json');
const transitionEmptyStopped = readFixture(
  'tidal-web-chromium-track-transition-empty-stopped.json',
);
const nextNormal = readFixture('tidal-web-chromium-next-normal.json');

describe('TIDAL Web Chrome MPRIS fixtures', () => {
  it('maps normal TIDAL Web Chrome metadata into the expected snapshot', () => {
    expect(mapFixture(normal)).toEqual(normal.expectedSnapshot);
  });

  it('maps the stopped empty TIDAL Web transition snapshot as low-confidence browser metadata', () => {
    const snapshot = requireSnapshot(mapFixture(transitionEmptyStopped));

    expect(snapshot).toEqual(transitionEmptyStopped.expectedSnapshot);
    expect(snapshot.playbackStatus).toBe('Stopped');
    expect(snapshot.title).toBe('');
    expect(snapshot.artist).toBe('');
    expect(snapshot.durationMs).toBe(0);
  });

  it('maps the next TIDAL Web track after transition recovery', () => {
    expect(mapFixture(nextNormal)).toEqual(nextNormal.expectedSnapshot);
  });

  it('keeps TIDAL Web Chrome fixtures on the generic Chromium profile in auto mode', () => {
    expect(detectPlayerProfile(requireSnapshot(mapFixture(normal)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
    expect(detectPlayerProfile(requireSnapshot(mapFixture(transitionEmptyStopped)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
    expect(detectPlayerProfile(requireSnapshot(mapFixture(nextNormal)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
  });

  it('keeps TIDAL Web Chrome position samples monotonic for normal playback', () => {
    expect(isStrictlyIncreasing(normal.positionSamplesMs)).toBe(true);
    expect(isStrictlyIncreasing(nextNormal.positionSamplesMs)).toBe(true);
  });

  it('ignores reused generic Chromium track IDs but changes identity when TIDAL metadata changes', () => {
    const first = requireSnapshot(mapFixture(normal));
    const next = requireSnapshot(mapFixture(nextNormal));

    expect(first.trackId).toBe(next.trackId);
    expect(buildTrackIdentityKey(first)).not.toBe(buildTrackIdentityKey(next));
  });

  it('does not cache not-found results for the stopped empty TIDAL Web transition', () => {
    expect(
      shouldWriteLyricsCache(requireSnapshot(mapFixture(transitionEmptyStopped)), notFound),
    ).toBe(false);
  });

  it('allows not-found caching for high-confidence TIDAL Web Chrome metadata', () => {
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(normal)), notFound)).toBe(true);
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(nextNormal)), notFound)).toBe(true);
  });

  it('clears the previous stable track for the stopped empty transition', () => {
    const previousStable = requireSnapshot(mapFixture(normal));
    const transition = requireSnapshot(mapFixture(transitionEmptyStopped));
    const policy = policyForPlayerProfile(PLAYER_PROFILES.chromiumBrowser);

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate: null,
        candidate: transition,
        policy,
        nowMs: 1000,
      }),
    ).toEqual({
      stableSnapshot: null,
      pendingCandidate: null,
      decision: 'cleared',
    });
  });

  it('accepts the recovered next track after the browser debounce window elapses', () => {
    const previousStable = requireSnapshot(mapFixture(normal));
    const next = requireSnapshot(mapFixture(nextNormal));
    const policy = policyForPlayerProfile(PLAYER_PROFILES.chromiumBrowser);
    const first = reduceStablePlayerSnapshot({
      previousStable,
      pendingCandidate: null,
      candidate: next,
      policy,
      nowMs: 1000,
    });

    expect(first.decision).toBe('held');
    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate: first.pendingCandidate,
        candidate: next,
        policy,
        nowMs: 1350,
      }),
    ).toEqual({
      stableSnapshot: next,
      pendingCandidate: null,
      decision: 'accepted',
    });
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
