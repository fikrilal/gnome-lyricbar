import { describe, expect, it, vi } from 'vitest';

import { selectActivePlayer } from '../../src/domain/mpris/selection.js';
import { LifecycleRegistry } from '../../src/runtime/lifecycle.js';
import { StablePlayerProxy } from '../../src/runtime/mpris/stable-player.js';

/**
 * @import { PlayerSnapshot } from '../../src/domain/mpris/types.js'
 */

describe('StablePlayerProxy', () => {
  it('emits Spotify Desktop snapshots immediately', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.spotify',
      nowMs: 1000,
    });

    harness.stable.start();
    harness.raw.emit(snapshot({ busName: 'org.mpris.MediaPlayer2.spotify' }));

    expect(harness.listener).toHaveBeenLastCalledWith(
      snapshot({ busName: 'org.mpris.MediaPlayer2.spotify' }),
    );
    expect(harness.scheduler.pendingCount()).toBe(0);
  });

  it('retains the previous browser snapshot when empty metadata arrives', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const stableSnapshot = snapshot({});

    harness.stable.start();
    harness.raw.emit(stableSnapshot);
    harness.scheduler.advance(350);
    harness.raw.emit(snapshot({ title: '', artist: '', album: '' }));

    expect(harness.listener).toHaveBeenLastCalledWith(stableSnapshot);
    expect(harness.listener).toHaveBeenCalledTimes(2);
  });

  it('clears the previous browser snapshot when advertisement metadata persists', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const stableSnapshot = snapshot({});

    harness.stable.start();
    harness.raw.emit(stableSnapshot);
    harness.scheduler.advance(350);
    harness.raw.emit(snapshot({ title: 'Advertisement', artist: '', album: '' }));

    expect(harness.listener).toHaveBeenLastCalledWith(stableSnapshot);

    harness.scheduler.advance(1999);
    expect(harness.listener).toHaveBeenLastCalledWith(stableSnapshot);

    harness.scheduler.advance(1);
    expect(harness.listener).toHaveBeenLastCalledWith(null);
    expect(harness.stable.snapshot()).toBeNull();
  });

  it('retains a stopped empty browser transition until the grace period expires', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const stableSnapshot = snapshot({});

    harness.stable.start();
    harness.raw.emit(stableSnapshot);
    harness.scheduler.advance(350);
    harness.raw.emit(stoppedEmptySnapshot());

    harness.scheduler.advance(2999);
    expect(harness.stable.snapshot()).toEqual(stableSnapshot);
    expect(harness.listener).toHaveBeenLastCalledWith(stableSnapshot);

    harness.scheduler.advance(1);
    expect(harness.stable.snapshot()).toBeNull();
    expect(harness.listener).toHaveBeenLastCalledWith(null);
  });

  it('keeps a playing browser selected over paused preferred Spotify during transition grace', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const browser = snapshot({});
    const spotify = snapshot({
      busName: 'org.mpris.MediaPlayer2.spotify',
      playbackStatus: 'Paused',
    });

    harness.stable.start();
    harness.raw.emit(browser);
    harness.scheduler.advance(350);
    harness.raw.emit(stoppedEmptySnapshot());

    expect(
      selectActivePlayer(
        [harness.stable.snapshot(), spotify].filter(isPlayerSnapshot),
        browser.busName,
        ['spotify'],
      ),
    ).toEqual(browser);

    harness.scheduler.advance(3000);
    expect(
      selectActivePlayer(
        [harness.stable.snapshot(), spotify].filter(isPlayerSnapshot),
        browser.busName,
        ['spotify'],
      ),
    ).toEqual(spotify);
  });

  it('suppresses position reads until a recovered browser track is accepted', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const previous = snapshot({});
    const next = snapshot({ title: 'Lampu Merah', artist: 'The Lantis' });
    const transitionCallback = vi.fn();
    const debounceCallback = vi.fn();
    const acceptedCallback = vi.fn();

    harness.stable.start();
    harness.raw.emit(previous);
    harness.scheduler.advance(350);
    harness.raw.emit(stoppedEmptySnapshot());

    harness.stable.readPosition(transitionCallback);
    expect(transitionCallback).toHaveBeenCalledWith(null);
    expect(harness.raw.readPosition).not.toHaveBeenCalled();

    harness.scheduler.advance(1000);
    harness.raw.emit(next);
    harness.stable.readPosition(debounceCallback);
    expect(debounceCallback).toHaveBeenCalledWith(null);
    expect(harness.raw.readPosition).not.toHaveBeenCalled();

    harness.scheduler.advance(350);
    expect(harness.stable.snapshot()).toEqual(next);

    harness.stable.readPosition(acceptedCallback);
    expect(harness.raw.readPosition).toHaveBeenCalledWith(acceptedCallback);
  });

  it('suppresses position reads during direct browser track metadata debounce', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const previous = snapshot({ title: 'Shadow of the Day', artist: 'Linkin Park' });
    const next = snapshot({
      title: 'From the Inside',
      artist: 'Linkin Park',
      album: 'Meteora',
      durationMs: 175621,
    });
    const debounceCallback = vi.fn();
    const acceptedCallback = vi.fn();

    harness.stable.start();
    harness.raw.emit(previous);
    harness.scheduler.advance(350);
    expect(harness.stable.snapshot()).toEqual(previous);

    harness.raw.emit(next);
    expect(harness.stable.snapshot()).toEqual(previous);

    harness.stable.readPosition(debounceCallback);
    expect(debounceCallback).toHaveBeenCalledWith(null);
    expect(harness.raw.readPosition).not.toHaveBeenCalled();

    harness.scheduler.advance(350);
    expect(harness.stable.snapshot()).toEqual(next);

    harness.stable.readPosition(acceptedCallback);
    expect(harness.raw.readPosition).toHaveBeenCalledWith(acceptedCallback);
  });

  it('holds full browser metadata until the debounce timer fires', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const candidate = snapshot({});

    harness.stable.start();
    harness.raw.emit(candidate);

    expect(harness.listener).toHaveBeenCalledTimes(1);
    expect(harness.stable.snapshot()).toBeNull();
    expect(harness.scheduler.pendingCount()).toBe(1);

    harness.scheduler.advance(349);
    expect(harness.listener).toHaveBeenCalledTimes(1);

    harness.scheduler.advance(1);
    expect(harness.listener).toHaveBeenLastCalledWith(candidate);
    expect(harness.stable.snapshot()).toEqual(candidate);
  });

  it('emits adapted Spotify Web metadata after the debounce timer fires', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const candidate = snapshot({
      title: 'Tewas Tertimbun Masa Lalu (TTM) - NDX A.K.A | Spotify',
      artist: '',
      album: '',
      trackId: '/com/spotify/track/browser',
    });

    harness.stable.start();
    harness.raw.emit(candidate);
    harness.scheduler.advance(350);

    expect(harness.listener).toHaveBeenLastCalledWith(
      snapshot({
        title: 'Tewas Tertimbun Masa Lalu (TTM)',
        artist: 'NDX A.K.A',
        album: '',
        trackId: '/com/spotify/track/browser',
      }),
    );
  });

  it('restarts debounce when browser candidate changes before acceptance', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const first = snapshot({ title: 'Nina', artist: '.Feast' });
    const second = snapshot({ title: 'Lampu Merah', artist: 'The Lantis' });

    harness.stable.start();
    harness.raw.emit(first);
    harness.scheduler.advance(100);
    harness.raw.emit(second);
    harness.scheduler.advance(349);

    expect(harness.stable.snapshot()).toBeNull();
    expect(harness.listener).toHaveBeenCalledTimes(1);

    harness.scheduler.advance(1);
    expect(harness.listener).toHaveBeenLastCalledWith(second);
    expect(harness.stable.snapshot()).toEqual(second);
  });

  it('accepts the latest browser playback status for the same pending track', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const stopped = snapshot({ playbackStatus: 'Stopped' });
    const playing = snapshot({ playbackStatus: 'Playing' });

    harness.stable.start();
    harness.raw.emit(stopped);
    harness.scheduler.advance(100);
    harness.raw.emit(playing);
    harness.scheduler.advance(249);

    expect(harness.stable.snapshot()).toBeNull();

    harness.scheduler.advance(1);
    expect(harness.listener).toHaveBeenLastCalledWith(playing);
    expect(harness.stable.snapshot()).toEqual(playing);
  });

  it('delegates position reads to the raw player', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const callback = vi.fn();

    harness.stable.readPosition(callback);

    expect(harness.raw.readPosition).toHaveBeenCalledWith(callback);
  });

  it('delegates property refreshes to the raw player', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });

    harness.stable.refreshProperties();

    expect(harness.raw.refreshProperties).toHaveBeenCalledTimes(1);
  });

  it('cancels pending timers on lifecycle disposal', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });

    harness.stable.start();
    harness.raw.emit(snapshot({}));
    expect(harness.scheduler.pendingCount()).toBe(1);

    harness.lifecycle.dispose();
    expect(harness.scheduler.pendingCount()).toBe(0);
  });
});

/**
 * @param {{
 *   busName: string,
 *   nowMs: number,
 * }} options
 * @returns {{
 *   lifecycle: LifecycleRegistry,
 *   raw: ReturnType<typeof createRawPlayer>,
 *   scheduler: ReturnType<typeof createScheduler>,
 *   stable: StablePlayerProxy,
 *   listener: ReturnType<typeof vi.fn>,
 * }}
 */
function createHarness(options) {
  const lifecycle = new LifecycleRegistry();
  const raw = createRawPlayer(options.busName);
  const scheduler = createScheduler(options.nowMs);
  const stable = new StablePlayerProxy(/** @type {any} */ (raw), lifecycle, {
    now: scheduler.now,
    schedule: scheduler.schedule,
  });
  const listener = vi.fn();
  stable.onSnapshot(listener);

  return { lifecycle, raw, scheduler, stable, listener };
}

/**
 * @param {string} busName
 * @returns {{
 *   busName: string,
 *   snapshot: ReturnType<typeof vi.fn>,
 *   onSnapshot: ReturnType<typeof vi.fn>,
 *   readPosition: ReturnType<typeof vi.fn>,
 *   refreshProperties: ReturnType<typeof vi.fn>,
 *   start: ReturnType<typeof vi.fn>,
 *   emit(snapshot: PlayerSnapshot | null): void,
 * }}
 */
function createRawPlayer(busName) {
  /** @type {Array<(snapshot: PlayerSnapshot | null) => void>} */
  const listeners = [];
  /** @type {PlayerSnapshot | null} */
  let currentSnapshot = null;

  return {
    busName,
    snapshot: vi.fn(() => currentSnapshot),
    onSnapshot: vi.fn((callback) => {
      listeners.push(callback);
      callback(currentSnapshot);
    }),
    readPosition: vi.fn(),
    refreshProperties: vi.fn(),
    start: vi.fn(),
    emit(snapshotValue) {
      currentSnapshot = snapshotValue;
      for (const listener of listeners) {
        listener(currentSnapshot);
      }
    },
  };
}

/**
 * @param {number} initialNowMs
 * @returns {{
 *   now(): number,
 *   schedule(callback: () => void, delayMs: number): () => void,
 *   advance(deltaMs: number): void,
 *   pendingCount(): number,
 * }}
 */
function createScheduler(initialNowMs) {
  let nowMs = initialNowMs;
  /** @type {Array<{ dueAtMs: number, callback: () => void, cancelled: boolean }>} */
  const tasks = [];

  return {
    now() {
      return nowMs;
    },
    schedule(callback, delayMs) {
      const task = {
        dueAtMs: nowMs + delayMs,
        callback,
        cancelled: false,
      };
      tasks.push(task);
      return () => {
        task.cancelled = true;
      };
    },
    advance(deltaMs) {
      nowMs += deltaMs;
      for (const task of tasks) {
        if (!task.cancelled && task.dueAtMs <= nowMs) {
          task.cancelled = true;
          task.callback();
        }
      }
    },
    pendingCount() {
      return tasks.filter((task) => !task.cancelled).length;
    },
  };
}

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function snapshot(overrides) {
  return {
    busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
    title: 'Nina',
    artist: '.Feast',
    album: 'Membangun & Menghancurkan',
    durationMs: 277991,
    trackId: '/org/chromium/MediaPlayer2/TrackList/Nina',
    url: null,
    playbackStatus: 'Playing',
    ...overrides,
  };
}

/** @returns {PlayerSnapshot} */
function stoppedEmptySnapshot() {
  return snapshot({
    title: '',
    artist: '',
    album: '',
    durationMs: 0,
    trackId: null,
    playbackStatus: 'Stopped',
  });
}

/**
 * @param {PlayerSnapshot | null} value
 * @returns {value is PlayerSnapshot}
 */
function isPlayerSnapshot(value) {
  return value !== null;
}
