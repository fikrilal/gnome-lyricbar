import { describe, expect, it } from 'vitest';

import {
  normalizePlayerSnapshot,
  normalizePlayerSnapshots,
} from '../../src/domain/mpris/normalize.js';

describe('normalizePlayerSnapshot', () => {
  it('normalizes a complete MPRIS snapshot', () => {
    expect(
      normalizePlayerSnapshot({
        busName: 'org.mpris.MediaPlayer2.spotify',
        title: '  Song   Title  ',
        artist: ' Artist ',
        album: ' Album ',
        durationMs: 201000,
        trackId: '/com/spotify/track/abc',
        url: ' https://open.spotify.com/track/abc ',
        playbackStatus: 'Playing',
      }),
    ).toEqual({
      busName: 'org.mpris.MediaPlayer2.spotify',
      title: 'Song Title',
      artist: 'Artist',
      album: 'Album',
      durationMs: 201000,
      trackId: '/com/spotify/track/abc',
      url: 'https://open.spotify.com/track/abc',
      playbackStatus: 'Playing',
    });
  });

  it('fills missing metadata with empty strings and null fields', () => {
    expect(
      normalizePlayerSnapshot({
        busName: 'org.mpris.MediaPlayer2.firefox.instance1',
      }),
    ).toEqual({
      busName: 'org.mpris.MediaPlayer2.firefox.instance1',
      title: '',
      artist: '',
      album: '',
      durationMs: null,
      trackId: null,
      url: null,
      playbackStatus: 'Stopped',
    });
  });

  it('rejects bus names outside the MPRIS namespace', () => {
    expect(
      normalizePlayerSnapshot({
        busName: 'org.example.NotMpris',
        playbackStatus: 'Playing',
      }),
    ).toBeNull();
  });

  it('rejects empty MPRIS bus names', () => {
    expect(
      normalizePlayerSnapshot({
        busName: 'org.mpris.MediaPlayer2.',
      }),
    ).toBeNull();
  });

  it('rejects entries without a string bus name', () => {
    expect(normalizePlayerSnapshot({ busName: 42 })).toBeNull();
    expect(normalizePlayerSnapshot({})).toBeNull();
    expect(normalizePlayerSnapshot(null)).toBeNull();
  });

  it('drops invalid playback statuses to Stopped', () => {
    expect(
      normalizePlayerSnapshot({
        busName: 'org.mpris.MediaPlayer2.spotify',
        playbackStatus: 'Buffering',
      })?.playbackStatus,
    ).toBe('Stopped');
  });

  it('drops non-finite or negative durations to null', () => {
    expect(
      normalizePlayerSnapshot({
        busName: 'org.mpris.MediaPlayer2.spotify',
        durationMs: Number.POSITIVE_INFINITY,
      })?.durationMs,
    ).toBeNull();

    expect(
      normalizePlayerSnapshot({
        busName: 'org.mpris.MediaPlayer2.spotify',
        durationMs: -1,
      })?.durationMs,
    ).toBeNull();

    expect(
      normalizePlayerSnapshot({
        busName: 'org.mpris.MediaPlayer2.spotify',
        durationMs: 'long',
      })?.durationMs,
    ).toBeNull();
  });

  it('treats blank track ids as missing', () => {
    expect(
      normalizePlayerSnapshot({
        busName: 'org.mpris.MediaPlayer2.spotify',
        trackId: '   ',
      })?.trackId,
    ).toBeNull();
  });

  it('treats blank urls as missing', () => {
    expect(
      normalizePlayerSnapshot({
        busName: 'org.mpris.MediaPlayer2.firefox.instance1',
        url: '   ',
      })?.url,
    ).toBeNull();
  });
});

describe('normalizePlayerSnapshots', () => {
  it('drops invalid entries and keeps valid ones', () => {
    const snapshots = normalizePlayerSnapshots([
      { busName: 'org.example.NotMpris' },
      { busName: 'org.mpris.MediaPlayer2.spotify', playbackStatus: 'Playing' },
      null,
      { busName: 'org.mpris.MediaPlayer2.firefox.instance1' },
    ]);

    expect(snapshots.map((player) => player.busName)).toEqual([
      'org.mpris.MediaPlayer2.spotify',
      'org.mpris.MediaPlayer2.firefox.instance1',
    ]);
  });

  it('returns an empty array for non-array input', () => {
    expect(normalizePlayerSnapshots(null)).toEqual([]);
    expect(normalizePlayerSnapshots(undefined)).toEqual([]);
  });
});
