import { describe, expect, it } from 'vitest';

import { parseLrclibResponse } from '../../src/domain/lyrics/provider-result.js';

describe('parseLrclibResponse', () => {
  it('returns synced lyrics with plain fallback when both are present', () => {
    const result = parseLrclibResponse({
      trackName: 'Yellow',
      artistName: 'Coldplay',
      albumName: 'Parachutes',
      duration: 266.773,
      instrumental: false,
      plainLyrics: 'Look at the stars\nLook how they shine for you',
      syncedLyrics: '[00:01.00]Look at the stars\n[00:04.50]Look how they shine for you',
    });

    expect(result).toEqual({
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
    });
  });

  it('returns synced lyrics with empty plainText when only synced is present', () => {
    const result = parseLrclibResponse({
      trackName: 'Song',
      artistName: 'Artist',
      syncedLyrics: '[00:01.00]Line one\n[00:02.00]Line two',
    });

    expect(result.kind).toBe('synced');
    if (result.kind === 'synced') {
      expect(result.lines).toHaveLength(2);
      expect(result.plainText).toBe('');
    }
  });

  it('returns plain lyrics when only plain is present', () => {
    const result = parseLrclibResponse({
      trackName: 'Song',
      artistName: 'Artist',
      plainLyrics: 'Line one\nLine two',
    });

    expect(result).toEqual({
      kind: 'plain',
      track: {
        trackName: 'Song',
        artistName: 'Artist',
        albumName: '',
        durationMs: null,
      },
      text: 'Line one\nLine two',
    });
  });

  it('returns instrumental result when the flag is true', () => {
    const result = parseLrclibResponse({
      trackName: 'Atmosphere',
      artistName: 'Joy Division',
      instrumental: true,
      syncedLyrics: '[00:01.00]Should be ignored',
      plainLyrics: 'Should also be ignored',
    });

    expect(result).toEqual({
      kind: 'instrumental',
      track: {
        trackName: 'Atmosphere',
        artistName: 'Joy Division',
        albumName: '',
        durationMs: null,
      },
    });
  });

  it('returns not-found for an HTTP 404 response body', () => {
    expect(
      parseLrclibResponse({
        statusCode: 404,
        name: 'TrackNotFound',
        message: 'Failed to find specified track',
      }),
    ).toEqual({ kind: 'not-found' });
  });

  it('returns not-found for an empty object', () => {
    expect(parseLrclibResponse({})).toEqual({ kind: 'not-found' });
  });

  it('returns not-found for null and undefined input', () => {
    expect(parseLrclibResponse(null)).toEqual({ kind: 'not-found' });
    expect(parseLrclibResponse(undefined)).toEqual({ kind: 'not-found' });
  });

  it('returns an error result for non-object input', () => {
    expect(parseLrclibResponse('not json')).toEqual({
      kind: 'error',
      reason: 'response was not a JSON object',
    });
    expect(parseLrclibResponse(42)).toEqual({
      kind: 'error',
      reason: 'response was not a JSON object',
    });
  });

  it('returns an error result for a 500-level provider failure', () => {
    expect(
      parseLrclibResponse({
        statusCode: 500,
        name: 'InternalError',
      }),
    ).toEqual({
      kind: 'error',
      reason: 'status 500: InternalError',
    });
  });

  it('falls back to plain lyrics when synced body has no parseable lines', () => {
    const result = parseLrclibResponse({
      trackName: 'Song',
      artistName: 'Artist',
      syncedLyrics: '[ar:Artist]\n[ti:Song]\n[al:Album]',
      plainLyrics: 'Line one',
    });

    expect(result).toEqual({
      kind: 'plain',
      track: {
        trackName: 'Song',
        artistName: 'Artist',
        albumName: '',
        durationMs: null,
      },
      text: 'Line one',
    });
  });

  it('returns not-found when synced parsing fails and no plain text exists', () => {
    expect(
      parseLrclibResponse({
        trackName: 'Song',
        artistName: 'Artist',
        syncedLyrics: '[ar:Artist]\n[ti:Song]',
      }),
    ).toEqual({ kind: 'not-found' });
  });

  it('parses a realistic LRCLIB-style payload with metadata tags and synced lines', () => {
    // Fixture mirrors the public LRCLIB API shape returned for matched tracks.
    const result = parseLrclibResponse({
      id: 1234,
      trackName: 'In This Shirt',
      artistName: 'The Irrepressibles',
      albumName: 'Mirror Mirror',
      duration: 335.146,
      instrumental: false,
      plainLyrics: 'In this shirt\nI can be you\nIn this shirt\nI can\u2019t lose',
      syncedLyrics: [
        '[ar:The Irrepressibles]',
        '[ti:In This Shirt]',
        '[al:Mirror Mirror]',
        '[length:05:35.14]',
        '[00:14.20]In this shirt',
        '[00:18.00]I can be you',
        '[00:21.50]In this shirt',
        '[00:25.10]I can\u2019t lose',
      ].join('\n'),
    });

    expect(result.kind).toBe('synced');
    if (result.kind === 'synced') {
      expect(result.track).toEqual({
        trackName: 'In This Shirt',
        artistName: 'The Irrepressibles',
        albumName: 'Mirror Mirror',
        durationMs: 335146,
      });
      expect(result.lines).toEqual([
        { timeMs: 14200, text: 'In this shirt' },
        { timeMs: 18000, text: 'I can be you' },
        { timeMs: 21500, text: 'In this shirt' },
        { timeMs: 25100, text: 'I can\u2019t lose' },
      ]);
      expect(result.plainText).toBe(
        'In this shirt\nI can be you\nIn this shirt\nI can\u2019t lose',
      );
    }
  });

  it('drops invalid duration values to null', () => {
    const result = parseLrclibResponse({
      trackName: 'Song',
      artistName: 'Artist',
      duration: -1,
      plainLyrics: 'Line',
    });

    expect(result.kind).toBe('plain');
    if (result.kind === 'plain') {
      expect(result.track.durationMs).toBeNull();
    }
  });
});
