import { describe, expect, it } from 'vitest';

import {
  buildLrclibFreeTextQueries,
  buildLrclibQuerySearchUrl,
  buildLrclibSearchUrl,
  buildLrclibUrl,
} from '../../src/runtime/lyrics/url.js';

describe('buildLrclibUrl', () => {
  it('builds a basic URL with artist and title', () => {
    expect(
      buildLrclibUrl({
        artist: 'Coldplay',
        title: 'Yellow',
        album: '',
        durationMs: null,
      }),
    ).toBe('https://lrclib.net/api/get?artist_name=Coldplay&track_name=Yellow');
  });

  it('includes album when present', () => {
    expect(
      buildLrclibUrl({
        artist: 'Coldplay',
        title: 'Yellow',
        album: 'Parachutes',
        durationMs: null,
      }),
    ).toBe(
      'https://lrclib.net/api/get?artist_name=Coldplay&track_name=Yellow&album_name=Parachutes',
    );
  });

  it('includes integer duration in seconds when present', () => {
    expect(
      buildLrclibUrl({
        artist: 'Coldplay',
        title: 'Yellow',
        album: '',
        durationMs: 266773,
      }),
    ).toBe('https://lrclib.net/api/get?artist_name=Coldplay&track_name=Yellow&duration=267');
  });

  it('percent-encodes special characters', () => {
    expect(
      buildLrclibUrl({
        artist: "I Don't & Won't",
        title: 'Spring Wind 春の風',
        album: '',
        durationMs: null,
      }),
    ).toBe(
      'https://lrclib.net/api/get?artist_name=I+Don%27t+%26+Won%27t&track_name=Spring+Wind+%E6%98%A5%E3%81%AE%E9%A2%A8',
    );
  });

  it('returns null for empty artist', () => {
    expect(
      buildLrclibUrl({
        artist: '',
        title: 'Yellow',
        album: '',
        durationMs: null,
      }),
    ).toBeNull();
  });

  it('returns null for whitespace-only title', () => {
    expect(
      buildLrclibUrl({
        artist: 'Coldplay',
        title: '   ',
        album: '',
        durationMs: null,
      }),
    ).toBeNull();
  });

  it('omits zero / negative durations', () => {
    expect(
      buildLrclibUrl({
        artist: 'Coldplay',
        title: 'Yellow',
        album: '',
        durationMs: 0,
      }),
    ).toBe('https://lrclib.net/api/get?artist_name=Coldplay&track_name=Yellow');

    expect(
      buildLrclibUrl({
        artist: 'Coldplay',
        title: 'Yellow',
        album: '',
        durationMs: -1,
      }),
    ).toBe('https://lrclib.net/api/get?artist_name=Coldplay&track_name=Yellow');
  });
});

describe('buildLrclibSearchUrl', () => {
  it('builds a structured search URL with a parenthetical suffix removed from the title', () => {
    expect(
      buildLrclibSearchUrl({
        artist: 'NDX A.K.A.',
        title: 'Tewas Tertimbun Masa Lalu (TTM)',
        album: 'NDX A.K.A. Familia',
        durationMs: 244297,
      }),
    ).toBe(
      'https://lrclib.net/api/search?artist_name=NDX+A.K.A.&track_name=Tewas+Tertimbun+Masa+Lalu',
    );
  });

  it('returns null when the stripped search title is empty', () => {
    expect(
      buildLrclibSearchUrl({
        artist: 'Artist',
        title: ' (Live)',
        album: '',
        durationMs: null,
      }),
    ).toBeNull();
  });
});

describe('buildLrclibQuerySearchUrl', () => {
  it('builds a query URL with encoded text', () => {
    expect(buildLrclibQuerySearchUrl('Melangitkanmu Ghea Indrawari')).toBe(
      'https://lrclib.net/api/search?q=Melangitkanmu+Ghea+Indrawari',
    );
  });

  it('returns null for empty or whitespace text', () => {
    expect(buildLrclibQuerySearchUrl('')).toBeNull();
    expect(buildLrclibQuerySearchUrl('   ')).toBeNull();
    expect(buildLrclibQuerySearchUrl(null)).toBeNull();
  });
});

describe('buildLrclibFreeTextQueries', () => {
  it('returns title with artist and bare title', () => {
    expect(
      buildLrclibFreeTextQueries({
        artist: 'Ghea Indrawari',
        title: 'Melangitkanmu (Official Lyric Video)',
        album: '',
        durationMs: 275000,
      }),
    ).toEqual(['Melangitkanmu Ghea Indrawari', 'Melangitkanmu']);
  });

  it('returns only title when artist is empty', () => {
    expect(
      buildLrclibFreeTextQueries({
        artist: '',
        title: 'Melangitkanmu',
        album: '',
        durationMs: 275000,
      }),
    ).toEqual(['Melangitkanmu']);
  });

  it('returns empty array when sanitized title is empty', () => {
    expect(
      buildLrclibFreeTextQueries({
        artist: 'Artist',
        title: '(Live)',
        album: '',
        durationMs: null,
      }),
    ).toEqual([]);
  });
});
