import { describe, expect, it } from 'vitest';

import {
  buildCacheEntry,
  buildCacheFileName,
  CACHE_SCHEMA_VERSION,
  NEGATIVE_TTL_MS,
  parseCacheEntry,
  POSITIVE_TTL_MS,
  shouldWriteLyricsCache,
} from '../../src/domain/lyrics/cache-policy.js';

const NOW = 1700000000000;

const fullQuery = {
  artist: 'Coldplay',
  title: 'Yellow',
  album: 'Parachutes',
  durationMs: 266773,
};

const altQuery = {
  artist: 'The Irrepressibles',
  title: 'In This Shirt',
  album: 'Mirror Mirror',
  durationMs: 335146,
};

/** @type {import('../../src/domain/lyrics/types.js').LyricsProviderResult} */
const syncedResult = {
  kind: 'synced',
  track: {
    trackName: 'Yellow',
    artistName: 'Coldplay',
    albumName: 'Parachutes',
    durationMs: 266773,
  },
  lines: [
    { timeMs: 1000, text: 'Look at the stars' },
    { timeMs: 4500, text: 'Look how they shine for you' },
  ],
  plainText: 'Look at the stars\nLook how they shine for you',
};

/** @type {import('../../src/domain/lyrics/types.js').LyricsProviderResult} */
const notFoundResult = { kind: 'not-found' };

describe('buildCacheFileName', () => {
  it('returns a stable hashed filename for the same query', () => {
    expect(buildCacheFileName(fullQuery)).toBe(buildCacheFileName(fullQuery));
  });

  it('produces different filenames for different queries', () => {
    expect(buildCacheFileName(fullQuery)).not.toBe(buildCacheFileName(altQuery));
  });

  it('uses an 8-character lowercase hex hash plus a .json suffix', () => {
    const name = buildCacheFileName(fullQuery);
    expect(name).toMatch(/^[0-9a-f]{8}\.json$/);
  });
});

describe('buildCacheEntry', () => {
  it('applies the positive TTL to synced results', () => {
    const entry = buildCacheEntry(syncedResult, NOW);
    expect(entry).toEqual({
      schema: CACHE_SCHEMA_VERSION,
      savedAt: NOW,
      expiresAt: NOW + POSITIVE_TTL_MS,
      result: syncedResult,
    });
  });

  it('applies the negative TTL to not-found results', () => {
    const entry = buildCacheEntry(notFoundResult, NOW);
    expect(entry).toEqual({
      schema: CACHE_SCHEMA_VERSION,
      savedAt: NOW,
      expiresAt: NOW + NEGATIVE_TTL_MS,
      result: notFoundResult,
    });
  });

  it('applies the negative TTL to error results', () => {
    const errorResult = /** @type {const} */ ({
      kind: 'error',
      reason: 'connection refused',
    });
    const entry = buildCacheEntry(errorResult, NOW);
    expect(entry.expiresAt).toBe(NOW + NEGATIVE_TTL_MS);
  });
});

describe('parseCacheEntry', () => {
  it('returns the original result for a live entry', () => {
    const entry = buildCacheEntry(syncedResult, NOW);
    expect(parseCacheEntry(entry, NOW + 1000)).toEqual(syncedResult);
  });

  it('returns null for an expired entry', () => {
    const entry = buildCacheEntry(notFoundResult, NOW);
    expect(parseCacheEntry(entry, NOW + NEGATIVE_TTL_MS + 1)).toBeNull();
  });

  it('returns null for a schema mismatch', () => {
    const entry = { ...buildCacheEntry(syncedResult, NOW), schema: 999 };
    expect(parseCacheEntry(entry, NOW)).toBeNull();
  });

  it('returns null for missing fields', () => {
    expect(parseCacheEntry({ schema: CACHE_SCHEMA_VERSION }, NOW)).toBeNull();
    expect(
      parseCacheEntry({ schema: CACHE_SCHEMA_VERSION, savedAt: NOW, expiresAt: NOW + 1000 }, NOW),
    ).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(parseCacheEntry(null, NOW)).toBeNull();
    expect(parseCacheEntry('not json', NOW)).toBeNull();
    expect(parseCacheEntry(42, NOW)).toBeNull();
  });

  it('returns null when expiration is implausibly far in the future', () => {
    const tampered = {
      schema: CACHE_SCHEMA_VERSION,
      savedAt: NOW,
      expiresAt: NOW + POSITIVE_TTL_MS + 60 * 60 * 1000,
      result: syncedResult,
    };
    expect(parseCacheEntry(tampered, NOW)).toBeNull();
  });

  it('returns null when savedAt is implausibly far in the future', () => {
    const tampered = {
      schema: CACHE_SCHEMA_VERSION,
      savedAt: NOW + 5 * 60 * 1000,
      expiresAt: NOW + 5 * 60 * 1000 + POSITIVE_TTL_MS,
      result: syncedResult,
    };
    expect(parseCacheEntry(tampered, NOW)).toBeNull();
  });

  it('returns null when the embedded result is malformed', () => {
    const tampered = {
      schema: CACHE_SCHEMA_VERSION,
      savedAt: NOW,
      expiresAt: NOW + 1000,
      result: { kind: 'synced' },
    };
    expect(parseCacheEntry(tampered, NOW)).toBeNull();
  });

  it('round-trips a not-found result', () => {
    const entry = buildCacheEntry(notFoundResult, NOW);
    expect(parseCacheEntry(entry, NOW + 1000)).toEqual(notFoundResult);
  });

  it('round-trips an error result', () => {
    const errorResult = /** @type {const} */ ({
      kind: 'error',
      reason: 'connection refused',
    });
    const entry = buildCacheEntry(errorResult, NOW);
    expect(parseCacheEntry(entry, NOW + 1000)).toEqual(errorResult);
  });

  it('round-trips an instrumental result', () => {
    /** @type {import('../../src/domain/lyrics/types.js').LyricsProviderResult} */
    const instrumental = {
      kind: 'instrumental',
      track: {
        trackName: 'Atmosphere',
        artistName: 'Joy Division',
        albumName: '',
        durationMs: null,
      },
    };
    const entry = buildCacheEntry(instrumental, NOW);
    expect(parseCacheEntry(entry, NOW + 1000)).toEqual(instrumental);
  });
});

describe('shouldWriteLyricsCache', () => {
  it('allows desktop not-found results to be cached', () => {
    expect(shouldWriteLyricsCache(playerSnapshot({}), notFoundResult)).toBe(true);
  });

  it('allows high-confidence browser not-found results to be cached', () => {
    expect(
      shouldWriteLyricsCache(browserSnapshot({}), notFoundResult, {
        browserPlayerService: 'youtube-music',
      }),
    ).toBe(true);
  });

  it('blocks low-confidence browser not-found results from being cached', () => {
    expect(
      shouldWriteLyricsCache(
        browserSnapshot({
          title: 'Advertisement',
          artist: 'YouTube Music',
        }),
        notFoundResult,
        { browserPlayerService: 'youtube-music' },
      ),
    ).toBe(false);
  });

  it('blocks short browser not-found results from being cached', () => {
    expect(
      shouldWriteLyricsCache(
        browserSnapshot({
          durationMs: 10_000,
        }),
        notFoundResult,
        { browserPlayerService: 'spotify' },
      ),
    ).toBe(false);
  });

  it('allows positive browser results to be cached even when metadata confidence is low', () => {
    expect(
      shouldWriteLyricsCache(
        browserSnapshot({
          title: 'Advertisement',
          artist: 'YouTube Music',
        }),
        syncedResult,
        { browserPlayerService: 'youtube-music' },
      ),
    ).toBe(true);
  });
});

/**
 * @param {Partial<import('../../src/domain/mpris/types.js').PlayerSnapshot>} overrides
 * @returns {import('../../src/domain/mpris/types.js').PlayerSnapshot}
 */
function playerSnapshot(overrides) {
  return {
    busName: 'org.mpris.MediaPlayer2.spotify',
    title: 'Yellow',
    artist: 'Coldplay',
    album: 'Parachutes',
    durationMs: 266773,
    trackId: '/com/spotify/track/yellow',
    playbackStatus: 'Playing',
    ...overrides,
  };
}

/**
 * @param {Partial<import('../../src/domain/mpris/types.js').PlayerSnapshot>} overrides
 * @returns {import('../../src/domain/mpris/types.js').PlayerSnapshot}
 */
function browserSnapshot(overrides) {
  return playerSnapshot({
    busName: 'org.mpris.MediaPlayer2.chromium.instance6544',
    title: 'Let Me Love You',
    artist: 'DJ Snake',
    album: '',
    durationMs: 205341,
    trackId: '/org/chromium/MediaPlayer2/TrackList/Track22C9441C7D270DC57830A101D2310234',
    ...overrides,
  });
}
