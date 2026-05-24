import { describe, expect, it } from 'vitest';

import {
  applyPropertyChanges,
  mapMprisProperties,
  snapshotsEqual,
} from '../../src/runtime/mpris/player-mapping.js';

const BUS_NAME = 'org.mpris.MediaPlayer2.spotify';

/**
 * @param {unknown} value
 * @returns {{ deep_unpack: () => unknown }}
 */
function variant(value) {
  return {
    deep_unpack() {
      return value;
    },
  };
}

describe('mapMprisProperties', () => {
  it('maps a fully populated property bag into a normalized snapshot', () => {
    expect(
      mapMprisProperties(BUS_NAME, {
        PlaybackStatus: 'Playing',
        Metadata: {
          'xesam:title': '  Song   Title  ',
          'xesam:artist': [' Artist One ', '', 'Artist Two'],
          'xesam:album': ' Album ',
          'mpris:length': 201_000_000,
          'mpris:trackid': '/com/spotify/track/abc',
        },
      }),
    ).toEqual({
      busName: BUS_NAME,
      title: 'Song Title',
      artist: 'Artist One, Artist Two',
      album: 'Album',
      durationMs: 201000,
      trackId: '/com/spotify/track/abc',
      playbackStatus: 'Playing',
    });
  });

  it('unwraps nested variant values from D-Bus GetAll replies', () => {
    expect(
      mapMprisProperties(BUS_NAME, {
        PlaybackStatus: variant('Playing'),
        Metadata: variant({
          'xesam:title': variant('Daylight'),
          'xesam:artist': variant([variant('David Kushner')]),
          'xesam:album': variant('The Dichotomy'),
          'mpris:length': variant(212_953_000),
          'mpris:trackid': variant('/com/spotify/track/4Gg1tYCl7rWR4laKbdtPA4'),
        }),
      }),
    ).toEqual({
      busName: BUS_NAME,
      title: 'Daylight',
      artist: 'David Kushner',
      album: 'The Dichotomy',
      durationMs: 212953,
      trackId: '/com/spotify/track/4Gg1tYCl7rWR4laKbdtPA4',
      playbackStatus: 'Playing',
    });
  });

  it('falls back to defaults when properties are missing', () => {
    expect(mapMprisProperties(BUS_NAME, {})).toEqual({
      busName: BUS_NAME,
      title: '',
      artist: '',
      album: '',
      durationMs: null,
      trackId: null,
      playbackStatus: 'Stopped',
    });
  });

  it('returns null for non-MPRIS bus names', () => {
    expect(
      mapMprisProperties('org.example.NotMpris', {
        PlaybackStatus: 'Playing',
      }),
    ).toBeNull();
  });

  it('drops invalid duration and blank track ids', () => {
    const snapshot = mapMprisProperties(BUS_NAME, {
      Metadata: {
        'xesam:title': 'Song',
        'mpris:length': -1,
        'mpris:trackid': '   ',
      },
      PlaybackStatus: 'Buffering',
    });

    expect(snapshot).toEqual({
      busName: BUS_NAME,
      title: 'Song',
      artist: '',
      album: '',
      durationMs: null,
      trackId: null,
      playbackStatus: 'Stopped',
    });
  });
});

describe('applyPropertyChanges', () => {
  const base = /** @type {const} */ ({
    busName: BUS_NAME,
    title: 'Old Title',
    artist: 'Old Artist',
    album: 'Old Album',
    durationMs: 100000,
    trackId: '/old',
    playbackStatus: 'Playing',
  });

  it('merges Metadata changes into the existing snapshot', () => {
    expect(
      applyPropertyChanges(base, {
        Metadata: {
          'xesam:title': 'New Title',
          'xesam:artist': ['New Artist'],
          'xesam:album': 'New Album',
          'mpris:length': 150_000_000,
          'mpris:trackid': '/new',
        },
      }),
    ).toEqual({
      busName: BUS_NAME,
      title: 'New Title',
      artist: 'New Artist',
      album: 'New Album',
      durationMs: 150000,
      trackId: '/new',
      playbackStatus: 'Playing',
    });
  });

  it('updates only PlaybackStatus when only that key changes', () => {
    expect(
      applyPropertyChanges(base, {
        PlaybackStatus: 'Paused',
      }),
    ).toEqual({
      ...base,
      playbackStatus: 'Paused',
    });
  });

  it('unwraps nested variant values from changed properties', () => {
    expect(
      applyPropertyChanges(base, {
        Metadata: variant({
          'xesam:title': variant('Home'),
          'xesam:artist': variant([variant('Edith Whiskers')]),
          'xesam:album': variant('Stop Stealing The Covers!'),
          'mpris:length': variant(195_000_000),
          'mpris:trackid': variant('/com/spotify/track/new'),
        }),
        PlaybackStatus: variant('Playing'),
      }),
    ).toEqual({
      busName: BUS_NAME,
      title: 'Home',
      artist: 'Edith Whiskers',
      album: 'Stop Stealing The Covers!',
      durationMs: 195000,
      trackId: '/com/spotify/track/new',
      playbackStatus: 'Playing',
    });
  });

  it('returns the same snapshot when no relevant keys are present', () => {
    const changed = applyPropertyChanges(base, { Volume: 0.7 });
    expect(changed).toEqual(base);
  });
});

describe('snapshotsEqual', () => {
  const snapshot = /** @type {const} */ ({
    busName: BUS_NAME,
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    durationMs: 200000,
    trackId: '/track',
    playbackStatus: 'Playing',
  });

  it('returns true for identical snapshots', () => {
    expect(snapshotsEqual(snapshot, { ...snapshot })).toBe(true);
  });

  it('returns false when any tracked field differs', () => {
    expect(snapshotsEqual(snapshot, { ...snapshot, title: 'Other' })).toBe(false);
    expect(snapshotsEqual(snapshot, { ...snapshot, playbackStatus: 'Paused' })).toBe(false);
  });

  it('returns false when only one side is null', () => {
    expect(snapshotsEqual(snapshot, null)).toBe(false);
    expect(snapshotsEqual(null, snapshot)).toBe(false);
  });

  it('returns true when both sides are null', () => {
    expect(snapshotsEqual(null, null)).toBe(true);
  });
});
