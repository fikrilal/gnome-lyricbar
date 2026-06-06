import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { shouldWriteLyricsCache } from '../../src/domain/lyrics/cache-policy.js';
import { buildTrackIdentityKey } from '../../src/domain/lyrics/track-identity.js';
import { detectPlayerProfile, PLAYER_PROFILES } from '../../src/domain/mpris/profile.js';
import { policyForPlayerProfile } from '../../src/domain/mpris/profile-policy.js';
import { selectActivePlayer } from '../../src/domain/mpris/selection.js';
import { reduceStablePlayerSnapshot } from '../../src/domain/mpris/stability.js';
import { LifecycleRegistry } from '../../src/runtime/lifecycle.js';
import { LyricsService } from '../../src/runtime/lyrics/service.js';
import { mapMprisProperties } from '../../src/runtime/mpris/player-mapping.js';
import { StablePlayerProxy } from '../../src/runtime/mpris/stable-player.js';

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

const beforeTransition = readFixture('chromium-browser-transition-before.json');
const transitionEmptyStopped = readFixture('chromium-browser-transition-empty-stopped.json');
const afterTransition = readFixture('chromium-browser-transition-after.json');

describe('Chromium browser transition MPRIS fixtures', () => {
  it('maps normal Chromium browser metadata into the expected snapshot', () => {
    expect(mapFixture(beforeTransition)).toEqual(beforeTransition.expectedSnapshot);
  });

  it('maps the stopped empty Chromium browser transition as low-confidence metadata', () => {
    const snapshot = requireSnapshot(mapFixture(transitionEmptyStopped));

    expect(snapshot).toEqual(transitionEmptyStopped.expectedSnapshot);
    expect(snapshot.playbackStatus).toBe('Stopped');
    expect(snapshot.title).toBe('');
    expect(snapshot.artist).toBe('');
    expect(snapshot.durationMs).toBe(0);
  });

  it('maps the next Chromium browser track after transition recovery', () => {
    expect(mapFixture(afterTransition)).toEqual(afterTransition.expectedSnapshot);
  });

  it('keeps Chromium transition fixtures on the generic Chromium profile in auto mode', () => {
    expect(detectPlayerProfile(requireSnapshot(mapFixture(beforeTransition)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
    expect(detectPlayerProfile(requireSnapshot(mapFixture(transitionEmptyStopped)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
    expect(detectPlayerProfile(requireSnapshot(mapFixture(afterTransition)))).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
  });

  it('keeps Chromium browser position samples monotonic for normal playback', () => {
    expect(isStrictlyIncreasing(beforeTransition.positionSamplesMs)).toBe(true);
    expect(isStrictlyIncreasing(afterTransition.positionSamplesMs)).toBe(true);
  });

  it('ignores reused generic Chromium track IDs but changes identity when metadata changes', () => {
    const first = requireSnapshot(mapFixture(beforeTransition));
    const next = requireSnapshot(mapFixture(afterTransition));

    expect(first.trackId).toBe(next.trackId);
    expect(buildTrackIdentityKey(first)).not.toBe(buildTrackIdentityKey(next));
  });

  it('does not cache not-found results for the stopped empty Chromium transition', () => {
    expect(
      shouldWriteLyricsCache(requireSnapshot(mapFixture(transitionEmptyStopped)), notFound),
    ).toBe(false);
  });

  it('allows not-found caching for high-confidence Chromium browser metadata', () => {
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(beforeTransition)), notFound)).toBe(
      true,
    );
    expect(shouldWriteLyricsCache(requireSnapshot(mapFixture(afterTransition)), notFound)).toBe(
      true,
    );
  });

  it('retains the previous stable track during the stopped empty transition grace period', () => {
    const previousStable = requireSnapshot(mapFixture(beforeTransition));
    const transition = requireSnapshot(mapFixture(transitionEmptyStopped));
    const policy = policyForPlayerProfile(PLAYER_PROFILES.chromiumBrowser);

    const first = reduceStablePlayerSnapshot({
      previousStable,
      pendingCandidate: null,
      candidate: transition,
      policy,
      nowMs: 1000,
    });

    expect(first).toEqual({
      stableSnapshot: previousStable,
      pendingCandidate: {
        snapshot: transition,
        firstSeenAtMs: 1000,
        kind: 'stopped-empty',
      },
      decision: 'retained-previous',
    });
    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate: first.pendingCandidate,
        candidate: transition,
        policy,
        nowMs: 4000,
      }),
    ).toEqual({
      stableSnapshot: null,
      pendingCandidate: null,
      decision: 'cleared',
    });
  });

  it('accepts the recovered next track after the browser debounce window elapses', () => {
    const previousStable = requireSnapshot(mapFixture(beforeTransition));
    const next = requireSnapshot(mapFixture(afterTransition));
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

  it('keeps Chrome active and avoids unrelated Spotify lookup through stopped recovery', () => {
    const lifecycle = new LifecycleRegistry();
    const before = requireSnapshot(mapFixture(beforeTransition));
    const stopped = requireSnapshot(mapFixture(transitionEmptyStopped));
    const after = requireSnapshot(mapFixture(afterTransition));
    const spotify = snapshot({
      busName: 'org.mpris.MediaPlayer2.spotify',
      title: 'ECHO',
      artist: 'STARSET',
      album: 'DIVISIONS',
      playbackStatus: 'Paused',
    });
    const rawChrome = createRawPlayer(before.busName);
    const scheduler = createScheduler(1000);
    const stableChrome = new StablePlayerProxy(/** @type {any} */ (rawChrome), lifecycle, {
      now: scheduler.now,
      schedule: scheduler.schedule,
    });
    const cache = {
      get: vi.fn((_query, callback) => {
        callback(null);
      }),
      put: vi.fn(),
    };
    const provider = {
      lookup: vi.fn((query, callback) => {
        callback(syncedResult(query.title, query.artist, query.album, query.durationMs));
      }),
    };
    const lyrics = new LyricsService(lifecycle, provider, cache);
    const positionDuringStopped = vi.fn();
    const positionDuringRecovery = vi.fn();
    const positionAfterRecovery = vi.fn();

    stableChrome.start();

    rawChrome.emit(before);
    scheduler.advance(350);
    expect(selectAndSetLyrics(stableChrome.snapshot(), spotify, lyrics)).toEqual(before);
    expect(queriedTitles(cache.get)).toEqual(['Carry On']);

    rawChrome.emit(stopped);
    stableChrome.readPosition(positionDuringStopped);
    expect(selectAndSetLyrics(stableChrome.snapshot(), spotify, lyrics)).toEqual(before);
    expect(positionDuringStopped).toHaveBeenCalledWith(null);
    expect(rawChrome.readPosition).not.toHaveBeenCalled();
    expect(queriedTitles(cache.get)).toEqual(['Carry On']);

    scheduler.advance(1000);
    rawChrome.emit(after);
    stableChrome.readPosition(positionDuringRecovery);
    expect(selectAndSetLyrics(stableChrome.snapshot(), spotify, lyrics)).toEqual(before);
    expect(positionDuringRecovery).toHaveBeenCalledWith(null);
    expect(rawChrome.readPosition).not.toHaveBeenCalled();
    expect(queriedTitles(cache.get)).toEqual(['Carry On']);

    scheduler.advance(350);
    expect(selectAndSetLyrics(stableChrome.snapshot(), spotify, lyrics)).toEqual(after);
    expect(queriedTitles(cache.get)).toEqual(['Carry On', 'Heathens']);
    expect(queriedTitles(provider.lookup)).toEqual(['Carry On', 'Heathens']);
    expect(cache.put).toHaveBeenCalledTimes(2);

    stableChrome.readPosition(positionAfterRecovery);
    expect(rawChrome.readPosition).toHaveBeenCalledWith(positionAfterRecovery);
    expect(queriedTitles(cache.get)).not.toContain('ECHO');

    lifecycle.dispose();
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

/**
 * @param {PlayerSnapshot | null} browser
 * @param {PlayerSnapshot} spotify
 * @param {LyricsService} lyrics
 * @returns {PlayerSnapshot | null}
 */
function selectAndSetLyrics(browser, spotify, lyrics) {
  const active = selectActivePlayer(
    [browser, spotify].filter(isPlayerSnapshot),
    browser?.busName ?? null,
    ['spotify'],
  );
  lyrics.setActivePlayer(active);
  return active;
}

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function snapshot(overrides) {
  return {
    busName: 'org.mpris.MediaPlayer2.chromium.instance4608',
    title: 'Carry On',
    artist: 'fun.',
    album: 'Some Nights',
    durationMs: 278488,
    trackId: '/org/chromium/MediaPlayer2/TrackList/TrackADA31A8E30FC47629D668EB1B187366E',
    playbackStatus: 'Playing',
    url: null,
    ...overrides,
  };
}

/**
 * @param {PlayerSnapshot | null} value
 * @returns {value is PlayerSnapshot}
 */
function isPlayerSnapshot(value) {
  return value !== null;
}

/**
 * @param {string} busName
 * @returns {{
 *   busName: string,
 *   snapshot: ReturnType<typeof vi.fn>,
 *   onSnapshot: ReturnType<typeof vi.fn>,
 *   readPosition: ReturnType<typeof vi.fn>,
 *   refreshProperties: ReturnType<typeof vi.fn>,
 *   start: ReturnType<typeof vi.fn>,
 *   emit(snapshot: PlayerSnapshot | null): void,
 * }}
 */
function createRawPlayer(busName) {
  /** @type {Array<(snapshot: PlayerSnapshot | null) => void>} */
  const listeners = [];
  /** @type {PlayerSnapshot | null} */
  let currentSnapshot = null;

  return {
    busName,
    snapshot: vi.fn(() => currentSnapshot),
    onSnapshot: vi.fn((callback) => {
      listeners.push(callback);
      callback(currentSnapshot);
    }),
    readPosition: vi.fn(),
    refreshProperties: vi.fn(),
    start: vi.fn(),
    emit(snapshotValue) {
      currentSnapshot = snapshotValue;
      for (const listener of listeners) {
        listener(currentSnapshot);
      }
    },
  };
}

/**
 * @param {number} initialNowMs
 * @returns {{
 *   now(): number,
 *   schedule(callback: () => void, delayMs: number): () => void,
 *   advance(deltaMs: number): void,
 * }}
 */
function createScheduler(initialNowMs) {
  let nowMs = initialNowMs;
  /** @type {Array<{ dueAtMs: number, callback: () => void, cancelled: boolean }>} */
  const tasks = [];

  return {
    now() {
      return nowMs;
    },
    schedule(callback, delayMs) {
      const task = {
        dueAtMs: nowMs + delayMs,
        callback,
        cancelled: false,
      };
      tasks.push(task);
      return () => {
        task.cancelled = true;
      };
    },
    advance(deltaMs) {
      nowMs += deltaMs;
      for (const task of tasks) {
        if (!task.cancelled && task.dueAtMs <= nowMs) {
          task.cancelled = true;
          task.callback();
        }
      }
    },
  };
}

/**
 * @param {ReturnType<typeof vi.fn>} spy
 * @returns {string[]}
 */
function queriedTitles(spy) {
  return spy.mock.calls.map((call) => {
    const query = /** @type {{ title: string }} */ (call[0]);
    return query.title;
  });
}

/**
 * @param {string} title
 * @param {string} artist
 * @param {string} album
 * @param {number | null} durationMs
 * @returns {LyricsProviderResult}
 */
function syncedResult(title, artist, album, durationMs) {
  return Object.freeze({
    kind: 'synced',
    track: {
      trackName: title,
      artistName: artist,
      albumName: album,
      durationMs,
    },
    lines: [{ timeMs: 0, text: 'first line' }],
    plainText: 'first line',
  });
}
