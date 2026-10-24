import { describe, expect, it } from 'vitest';

import { buildLyricsCacheKey } from '../../src/domain/lyrics/cache-key.js';
import {
  buildLyricsQuery,
  normalizeTrackText,
  sanitizeSearchTitle,
} from '../../src/domain/lyrics/normalize.js';

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

describe('sanitizeSearchTitle', () => {
  it('strips parenthetical decorations', () => {
    expect(sanitizeSearchTitle('Melangitkanmu (Official Lyric Video)')).toBe('Melangitkanmu');
  });

  it('strips everything after a pipe character', () => {
    expect(
      sanitizeSearchTitle(
        'Bad Apple／ Lizz Robinett (English Cover) | Lyrics/Lyric Video [English]',
      ),
    ).toBe('Bad Apple/ Lizz Robinett');
  });

  it('strips square brackets and fullwidth brackets', () => {
    expect(sanitizeSearchTitle('Song [MV] 【Official】 （HD）')).toBe('Song');
  });

  it('preserves clean titles', () => {
    expect(sanitizeSearchTitle('Melangitkanmu')).toBe('Melangitkanmu');
  });

  it('handles null, non-string, or whitespace inputs', () => {
    expect(sanitizeSearchTitle(null)).toBe('');
    expect(sanitizeSearchTitle(undefined)).toBe('');
    expect(sanitizeSearchTitle('   ')).toBe('');
  });
});
