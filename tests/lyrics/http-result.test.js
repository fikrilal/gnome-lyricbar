import { describe, expect, it } from 'vitest';

import {
  mapHttpResultToProviderResult,
  mapHttpResultToSyncedSearchResult,
} from '../../src/runtime/lyrics/http-result.js';

describe('mapHttpResultToProviderResult', () => {
  it('routes a 200 response with synced lyrics through the LRCLIB parser', () => {
    const body = JSON.stringify({
      trackName: 'Yellow',
      artistName: 'Coldplay',
      albumName: 'Parachutes',
      duration: 266.773,
      syncedLyrics: '[00:01.00]Look at the stars\n[00:04.50]Look how they shine for you',
      plainLyrics: 'Look at the stars\nLook how they shine for you',
    });

    const result = mapHttpResultToProviderResult({ statusCode: 200, body });

    expect(result.kind).toBe('synced');
    if (result.kind === 'synced') {
      expect(result.lines).toHaveLength(2);
      expect(result.track.trackName).toBe('Yellow');
      expect(result.plainText).toBe('Look at the stars\nLook how they shine for you');
    }
  });

  it('routes a 200 response with plain lyrics through the LRCLIB parser', () => {
    const body = JSON.stringify({
      trackName: 'Song',
      artistName: 'Artist',
      plainLyrics: 'Line one',
    });

    expect(mapHttpResultToProviderResult({ statusCode: 200, body })).toEqual({
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

  it('routes a 200 instrumental response through the LRCLIB parser', () => {
    const body = JSON.stringify({
      trackName: 'Atmosphere',
      artistName: 'Joy Division',
      instrumental: true,
    });

    expect(mapHttpResultToProviderResult({ statusCode: 200, body })).toEqual({
      kind: 'instrumental',
      track: {
        trackName: 'Atmosphere',
        artistName: 'Joy Division',
        albumName: '',
        durationMs: null,
      },
    });
  });

  it('returns an error result for invalid JSON in a 200 body', () => {
    const result = mapHttpResultToProviderResult({ statusCode: 200, body: 'not json' });

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.reason).toMatch(/^invalid json:/);
    }
  });

  it('returns not-found for a 404 status', () => {
    expect(mapHttpResultToProviderResult({ statusCode: 404, body: 'gone' })).toEqual({
      kind: 'not-found',
    });
  });

  it('returns an error result for a 503', () => {
    expect(mapHttpResultToProviderResult({ statusCode: 503, body: 'oops' })).toEqual({
      kind: 'error',
      reason: 'status 503',
    });
  });

  it('returns an error result for a transport-level failure', () => {
    expect(
      mapHttpResultToProviderResult({
        statusCode: null,
        body: null,
        error: 'connection refused',
      }),
    ).toEqual({
      kind: 'error',
      reason: 'connection refused',
    });
  });

  it('returns an error result for a timeout', () => {
    expect(
      mapHttpResultToProviderResult({
        timedOut: true,
        statusCode: null,
        body: null,
      }),
    ).toEqual({
      kind: 'error',
      reason: 'request timed out',
    });
  });

  it('returns an error result when status is missing', () => {
    expect(mapHttpResultToProviderResult({})).toEqual({
      kind: 'error',
      reason: 'missing http status',
    });
  });

  it('returns an error result for an empty body on 200', () => {
    expect(mapHttpResultToProviderResult({ statusCode: 200, body: '' })).toEqual({
      kind: 'error',
      reason: 'empty response body',
    });
  });
});

describe('mapHttpResultToSyncedSearchResult', () => {
  it('maps a search response to the best safe synced result', () => {
    const body = JSON.stringify([
      {
        trackName: 'Tewas Tertimbun Masa Lalu',
        artistName: 'NDX A.K.A.',
        albumName: 'NDX A.K.A. Familia',
        duration: 244,
        syncedLyrics: '[00:07.56] Kowe tau ning uripku',
      },
    ]);

    const result = mapHttpResultToSyncedSearchResult(
      { statusCode: 200, body },
      {
        artist: 'NDX A.K.A.',
        title: 'Tewas Tertimbun Masa Lalu (TTM)',
        album: 'NDX A.K.A. Familia',
        durationMs: 244297,
      },
    );

    expect(result?.kind).toBe('synced');
  });

  it('returns null for failed search responses', () => {
    expect(
      mapHttpResultToSyncedSearchResult(
        { statusCode: 503, body: 'oops' },
        {
          artist: 'NDX A.K.A.',
          title: 'Tewas Tertimbun Masa Lalu (TTM)',
          album: 'NDX A.K.A. Familia',
          durationMs: 244297,
        },
      ),
    ).toBeNull();
  });
});
