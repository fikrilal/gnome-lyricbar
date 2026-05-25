import { describe, expect, it, vi } from 'vitest';

import { LyricsService } from '../../src/runtime/lyrics/service.js';
import { LifecycleRegistry } from '../../src/runtime/lifecycle.js';

/**
 * @import { LyricsProviderResult } from '../../src/domain/lyrics/types.js'
 * @import { PlayerSnapshot } from '../../src/domain/mpris/types.js'
 */

/** @type {LyricsProviderResult} */
const syncedResult = Object.freeze({
  kind: 'synced',
  track: Object.freeze({
    trackName: 'Yellow',
    artistName: 'Coldplay',
    albumName: 'Parachutes',
    durationMs: 266773,
  }),
  lines: Object.freeze([Object.freeze({ timeMs: 1000, text: 'Look at the stars' })]),
  plainText: 'Look at the stars',
});

/** @type {LyricsProviderResult} */
const plainResult = Object.freeze({
  kind: 'plain',
  track: Object.freeze({
    trackName: 'Yellow',
    artistName: 'Coldplay',
    albumName: 'Parachutes',
    durationMs: 266773,
  }),
  text: 'Look at the stars',
});

describe('LyricsService', () => {
  it('emits a cache hit without calling the provider', () => {
    const harness = createHarness({ cachedResult: syncedResult });

    harness.service.setActivePlayer(snapshot({}));

    expect(harness.cache.get).toHaveBeenCalledTimes(1);
    expect(harness.provider.lookup).not.toHaveBeenCalled();
    expect(harness.listener).toHaveBeenLastCalledWith(snapshot({}), syncedResult);
  });

  it('loads from the provider on cache miss, writes the cache, then emits the result', () => {
    const harness = createHarness({ cachedResult: null });

    harness.service.setActivePlayer(snapshot({}));
    harness.resolveProvider(plainResult);

    expect(harness.provider.lookup).toHaveBeenCalledTimes(1);
    expect(harness.cache.put).toHaveBeenCalledWith(
      {
        title: 'Yellow',
        artist: 'Coldplay',
        album: 'Parachutes',
        durationMs: 266773,
      },
      plainResult,
    );
    expect(harness.listener).toHaveBeenLastCalledWith(snapshot({}), plainResult);
  });

  it('ignores stale cache and provider callbacks after the active track changes', () => {
    const harness = createHarness({ deferCache: true });
    const first = snapshot({ title: 'Yellow', trackId: '/com/spotify/track/yellow' });
    const second = snapshot({ title: 'Trouble', trackId: '/com/spotify/track/trouble' });

    harness.service.setActivePlayer(first);
    harness.service.setActivePlayer(second);

    harness.resolveCache(0, syncedResult);
    harness.resolveCache(1, null);
    harness.resolveProvider(plainResult);

    expect(harness.listener).not.toHaveBeenCalledWith(first, syncedResult);
    expect(harness.listener).toHaveBeenLastCalledWith(second, plainResult);
  });

  it('short-circuits incomplete metadata without touching cache or provider', () => {
    const harness = createHarness({ cachedResult: syncedResult });
    const incomplete = snapshot({ artist: '' });

    harness.service.setActivePlayer(incomplete);

    expect(harness.cache.get).not.toHaveBeenCalled();
    expect(harness.cache.put).not.toHaveBeenCalled();
    expect(harness.provider.lookup).not.toHaveBeenCalled();
    expect(harness.listener).toHaveBeenLastCalledWith(
      incomplete,
      Object.freeze({ kind: 'not-found' }),
    );
  });

  it('does not emit after lifecycle disposal', () => {
    const harness = createHarness({ deferCache: true });

    harness.service.setActivePlayer(snapshot({}));
    harness.lifecycle.dispose();
    harness.resolveCache(0, syncedResult);

    expect(harness.listener).toHaveBeenCalledTimes(2);
    expect(harness.service.currentLookup()).toBeNull();
  });

  it('does not retrigger lookup for an identical active snapshot', () => {
    const harness = createHarness({ cachedResult: null });
    const player = snapshot({});

    harness.service.setActivePlayer(player);
    harness.service.setActivePlayer(player);

    expect(harness.cache.get).toHaveBeenCalledTimes(1);
    expect(harness.provider.lookup).toHaveBeenCalledTimes(1);
  });

  it('emits same-track playback status changes without retriggering lyrics lookup', () => {
    const harness = createHarness({ cachedResult: syncedResult });
    const stopped = snapshot({ playbackStatus: 'Stopped' });
    const playing = snapshot({ playbackStatus: 'Playing' });

    harness.service.setActivePlayer(stopped);
    harness.service.setActivePlayer(playing);

    expect(harness.cache.get).toHaveBeenCalledTimes(1);
    expect(harness.provider.lookup).not.toHaveBeenCalled();
    expect(harness.listener).toHaveBeenLastCalledWith(playing, syncedResult);
  });

  it('does not retrigger browser lookup when only generic browser track id changes', () => {
    const harness = createHarness({
      browserPlayerService: 'spotify',
      cachedResult: syncedResult,
    });
    const first = browserSnapshot({
      trackId: '/org/chromium/MediaPlayer2/TrackList/TrackA',
    });
    const second = browserSnapshot({
      trackId: '/org/chromium/MediaPlayer2/TrackList/TrackB',
    });

    harness.service.setActivePlayer(first);
    harness.service.setActivePlayer(second);

    expect(harness.cache.get).toHaveBeenCalledTimes(1);
    expect(harness.provider.lookup).not.toHaveBeenCalled();
    expect(harness.listener).toHaveBeenLastCalledWith(second, syncedResult);
  });

  it('does retrigger browser lookup when song metadata changes with reused browser track id', () => {
    const harness = createHarness({
      browserPlayerService: 'spotify',
      cachedResult: syncedResult,
    });
    const reusedTrackId = '/org/chromium/MediaPlayer2/TrackList/Track6E48368';
    const first = browserSnapshot({
      title: 'Ramai Sepi Bersama',
      artist: 'Hindia',
      album: 'Ramai Sepi Bersama',
      durationMs: 188046,
      trackId: reusedTrackId,
    });
    const second = browserSnapshot({
      title: 'Mangu',
      artist: 'Fourtwnty, Charita Utami',
      album: 'Nalar',
      durationMs: 261094,
      trackId: reusedTrackId,
    });

    harness.service.setActivePlayer(first);
    harness.service.setActivePlayer(second);

    expect(harness.cache.get).toHaveBeenCalledTimes(2);
    expect(harness.provider.lookup).not.toHaveBeenCalled();
    expect(harness.listener).toHaveBeenLastCalledWith(second, syncedResult);
  });
});

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function snapshot(overrides) {
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
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function browserSnapshot(overrides) {
  return snapshot({
    busName: 'org.mpris.MediaPlayer2.chromium.instance105121',
    title: 'Mangu',
    artist: 'Fourtwnty, Charita Utami',
    album: 'Nalar',
    durationMs: 261094,
    trackId: '/org/chromium/MediaPlayer2/TrackList/Track6E48368',
    ...overrides,
  });
}

/**
 * @typedef {Readonly<{
 *   cachedResult?: LyricsProviderResult | null,
 *   deferCache?: boolean,
 *   browserPlayerService?: import('../../src/domain/settings/types.js').BrowserPlayerService,
 * }>} HarnessOptions
 *
 * @param {HarnessOptions} options
 * @returns {{
 *   lifecycle: LifecycleRegistry,
 *   service: LyricsService,
 *   provider: { lookup: ReturnType<typeof vi.fn> },
 *   cache: { get: ReturnType<typeof vi.fn>, put: ReturnType<typeof vi.fn> },
 *   listener: ReturnType<typeof vi.fn>,
 *   resolveCache(index: number, result: LyricsProviderResult | null): void,
 *   resolveProvider(result: LyricsProviderResult): void,
 * }}
 */
function createHarness(options) {
  const lifecycle = new LifecycleRegistry();
  /** @type {Array<(result: LyricsProviderResult | null) => void>} */
  const cacheCallbacks = [];
  /** @type {Array<(result: LyricsProviderResult) => void>} */
  const providerCallbacks = [];

  const provider = {
    lookup: vi.fn((_query, callback) => {
      providerCallbacks.push(callback);
    }),
  };

  const cache = {
    get: vi.fn((_query, callback) => {
      if (options.deferCache === true) {
        cacheCallbacks.push(callback);
        return;
      }
      callback(options.cachedResult ?? null);
    }),
    put: vi.fn(),
  };

  const service = new LyricsService(lifecycle, provider, cache, {
    getBrowserPlayerService: () => options.browserPlayerService ?? 'auto',
  });
  const listener = vi.fn();
  service.onLookupChanged(listener);

  return {
    lifecycle,
    service,
    provider,
    cache,
    listener,
    resolveCache(index, result) {
      const callback = cacheCallbacks.at(index);
      if (callback === undefined) {
        throw new Error(`Missing cache callback at index ${index}`);
      }
      callback(result);
    },
    resolveProvider(result) {
      const callback = providerCallbacks.at(-1);
      if (callback === undefined) {
        throw new Error('Missing provider callback');
      }
      callback(result);
    },
  };
}
