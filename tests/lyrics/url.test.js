import { describe, expect, it } from 'vitest';

import { buildLrclibUrl } from '../../src/runtime/lyrics/url.js';

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
