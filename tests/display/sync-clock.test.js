import { describe, expect, it } from 'vitest';

import {
  getInterpolatedClockPosition,
  updateSyncedClock,
} from '../../src/domain/display/sync-clock.js';

describe('sync-clock', () => {
  it('initializes clock state for a track', () => {
    const clock = updateSyncedClock(null, {
      trackKey: 'track-1',
      rawPositionMs: 5000,
      nowMs: 10000,
      playbackStatus: 'Playing',
    });

    expect(clock).toEqual({
      trackKey: 'track-1',
      basePositionMs: 5000,
      baseTimestampMs: 10000,
      lastSampledRawMs: 5000,
      playbackStatus: 'Playing',
    });
    expect(getInterpolatedClockPosition(clock, 10200)).toBe(5200);
  });

  it('advances clock position smoothly during active playback', () => {
    const clock = updateSyncedClock(null, {
      trackKey: 'track-1',
      rawPositionMs: 10000,
      nowMs: 20000,
      playbackStatus: 'Playing',
    });

    expect(getInterpolatedClockPosition(clock, 20100)).toBe(10100);
    expect(getInterpolatedClockPosition(clock, 20350)).toBe(10350);
    expect(getInterpolatedClockPosition(clock, 20500)).toBe(10500);
  });

  it('keeps advancing when player reports identical position due to throttling (e.g. Limusic 2s gate)', () => {
    const clock1 = updateSyncedClock(null, {
      trackKey: 'track-1',
      rawPositionMs: 10000,
      nowMs: 20000,
      playbackStatus: 'Playing',
    });

    // 500ms later, Limusic still reports rawPositionMs = 10000
    const clock2 = updateSyncedClock(clock1, {
      trackKey: 'track-1',
      rawPositionMs: 10000,
      nowMs: 20500,
      playbackStatus: 'Playing',
    });

    // Clock state must remain identical so monotonic advance is not pulled back
    expect(clock2).toBe(clock1);
    expect(getInterpolatedClockPosition(clock2, 20500)).toBe(10500);

    // 1000ms later, Limusic still reports rawPositionMs = 10000
    const clock3 = updateSyncedClock(clock2, {
      trackKey: 'track-1',
      rawPositionMs: 10000,
      nowMs: 21000,
      playbackStatus: 'Playing',
    });
    expect(clock3).toBe(clock1);
    expect(getInterpolatedClockPosition(clock3, 21000)).toBe(11000);

    // 2100ms later, Limusic finally pushes rawPositionMs = 12100
    const clock4 = updateSyncedClock(clock3, {
      trackKey: 'track-1',
      rawPositionMs: 12100,
      nowMs: 22100,
      playbackStatus: 'Playing',
    });
    expect(clock4.basePositionMs).toBe(12100);
    expect(clock4.lastSampledRawMs).toBe(12100);
    expect(getInterpolatedClockPosition(clock4, 22200)).toBe(12200);
  });

  it('does not pull clock position backward when receiving slightly delayed position samples', () => {
    const clock1 = updateSyncedClock(null, {
      trackKey: 'track-1',
      rawPositionMs: 10000,
      nowMs: 20000,
      playbackStatus: 'Playing',
    });

    // Clock reaches 11000ms at nowMs = 21000.
    expect(getInterpolatedClockPosition(clock1, 21000)).toBe(11000);

    // Player poll returns 10900ms (100ms behind current clock estimate due to D-Bus latency).
    const clock2 = updateSyncedClock(clock1, {
      trackKey: 'track-1',
      rawPositionMs: 10900,
      nowMs: 21000,
      playbackStatus: 'Playing',
    });

    // Base position and timestamp must not be pulled backward:
    expect(clock2.basePositionMs).toBe(10000);
    expect(clock2.baseTimestampMs).toBe(20000);
    expect(clock2.lastSampledRawMs).toBe(10900);
    expect(getInterpolatedClockPosition(clock2, 21000)).toBe(11000);
    expect(getInterpolatedClockPosition(clock2, 21100)).toBe(11100);
  });

  it('re-anchors when a seek forward occurs', () => {
    const clock1 = updateSyncedClock(null, {
      trackKey: 'track-1',
      rawPositionMs: 10000,
      nowMs: 20000,
      playbackStatus: 'Playing',
    });

    // User seeks to 60000ms
    const clock2 = updateSyncedClock(clock1, {
      trackKey: 'track-1',
      rawPositionMs: 60000,
      nowMs: 20500,
      playbackStatus: 'Playing',
    });

    expect(clock2.basePositionMs).toBe(60000);
    expect(clock2.baseTimestampMs).toBe(20500);
    expect(getInterpolatedClockPosition(clock2, 20600)).toBe(60100);
  });

  it('re-anchors backward when a seek backward occurs', () => {
    const clock1 = updateSyncedClock(null, {
      trackKey: 'track-1',
      rawPositionMs: 50000,
      nowMs: 20000,
      playbackStatus: 'Playing',
    });

    // User seeks back to 10000ms (drift = 40000ms >= SEEK_DRIFT_THRESHOLD_MS)
    const clock2 = updateSyncedClock(clock1, {
      trackKey: 'track-1',
      rawPositionMs: 10000,
      nowMs: 20500,
      playbackStatus: 'Playing',
    });

    expect(clock2.basePositionMs).toBe(10000);
    expect(clock2.baseTimestampMs).toBe(20500);
    expect(getInterpolatedClockPosition(clock2, 20600)).toBe(10100);
  });

  it('freezes position when playback transitions to Paused', () => {
    const clock1 = updateSyncedClock(null, {
      trackKey: 'track-1',
      rawPositionMs: 10000,
      nowMs: 20000,
      playbackStatus: 'Playing',
    });

    // Paused at 20300ms
    const clock2 = updateSyncedClock(clock1, {
      trackKey: 'track-1',
      rawPositionMs: 10300,
      nowMs: 20300,
      playbackStatus: 'Paused',
    });

    expect(clock2.playbackStatus).toBe('Paused');
    expect(getInterpolatedClockPosition(clock2, 20300)).toBe(10300);
    // Even if time passes, paused position stays frozen
    expect(getInterpolatedClockPosition(clock2, 25000)).toBe(10300);
  });

  it('resets clock on track changes', () => {
    const clock1 = updateSyncedClock(null, {
      trackKey: 'track-1',
      rawPositionMs: 10000,
      nowMs: 20000,
      playbackStatus: 'Playing',
    });

    const clock2 = updateSyncedClock(clock1, {
      trackKey: 'track-2',
      rawPositionMs: 0,
      nowMs: 25000,
      playbackStatus: 'Playing',
    });

    expect(clock2.trackKey).toBe('track-2');
    expect(clock2.basePositionMs).toBe(0);
    expect(clock2.baseTimestampMs).toBe(25000);
  });
});
