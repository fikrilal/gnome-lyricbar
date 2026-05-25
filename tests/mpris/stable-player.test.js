import { describe, expect, it, vi } from 'vitest';

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

  it('delegates position reads to the raw player', () => {
    const harness = createHarness({
      busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
      nowMs: 1000,
    });
    const callback = vi.fn();

    harness.stable.readPosition(callback);

    expect(harness.raw.readPosition).toHaveBeenCalledWith(callback);
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
    playbackStatus: 'Playing',
    ...overrides,
  };
}
