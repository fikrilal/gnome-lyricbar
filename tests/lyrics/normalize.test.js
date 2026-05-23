import { describe, expect, it } from 'vitest';

import { buildLyricsCacheKey } from '../../src/domain/lyrics/cache-key.js';
import { buildLyricsQuery, normalizeTrackText } from '../../src/domain/lyrics/normalize.js';

describe('normalizeTrackText', () => {
  it('normalizes whitespace', () => {
    expect(normalizeTrackText('  Artist   Name  ')).toBe('Artist Name');
  });

  it('returns an empty string for non-string values', () => {
    expect(normalizeTrackText(null)).toBe('');
  });
});

describe('buildLyricsQuery', () => {
  it('normalizes track metadata conservatively', () => {
    expect(
      buildLyricsQuery({
        artist: ' Artist ',
        title: ' Song  Title ',
        album: ' Album ',
        durationMs: 201000,
      }),
    ).toEqual({
      artist: 'Artist',
      title: 'Song Title',
      album: 'Album',
      durationMs: 201000,
    });
  });
});

describe('buildLyricsCacheKey', () => {
  it('builds a stable lowercase key', () => {
    expect(
      buildLyricsCacheKey({
        artist: 'Artist',
        title: 'Song',
        album: 'Album',
        durationMs: 200600,
      }),
    ).toBe('artist|song|album|201');
  });
});
