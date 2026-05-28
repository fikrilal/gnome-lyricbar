import { describe, expect, it } from 'vitest';

import { updateStagnantSyncedPositionEstimate } from '../../src/domain/display/sync-position-estimator.js';

describe('updateStagnantSyncedPositionEstimate', () => {
  it('starts tracking stagnant zero-position samples without estimating before threshold', () => {
    const result = updateStagnantSyncedPositionEstimate(null, {
      canEstimate: true,
      lastAcceptedPositionMs: 0,
      nowMs: 1000,
      rawPositionMs: 0,
      thresholdMs: 2500,
      trackKey: 'track-a',
    });

    expect(result).toEqual({
      estimated: false,
      positionMs: null,
      state: {
        basePositionMs: 0,
        startedAtMs: 1000,
        trackKey: 'track-a',
      },
    });
  });

  it('returns an estimated position after the stagnation threshold', () => {
    const state = {
      basePositionMs: 0,
      startedAtMs: 1000,
      trackKey: 'track-a',
    };

    expect(
      updateStagnantSyncedPositionEstimate(state, {
        canEstimate: true,
        lastAcceptedPositionMs: 0,
        nowMs: 4000,
        rawPositionMs: 0,
        thresholdMs: 2500,
        trackKey: 'track-a',
      }),
    ).toEqual({
      estimated: true,
      positionMs: 3000,
      state,
    });
  });

  it('estimates from the last accepted synced position', () => {
    const initial = updateStagnantSyncedPositionEstimate(null, {
      canEstimate: true,
      lastAcceptedPositionMs: 42000,
      nowMs: 1000,
      rawPositionMs: 0,
      thresholdMs: 2500,
      trackKey: 'track-a',
    });

    expect(
      updateStagnantSyncedPositionEstimate(initial.state, {
        canEstimate: true,
        lastAcceptedPositionMs: 42000,
        nowMs: 4000,
        rawPositionMs: 0,
        thresholdMs: 2500,
        trackKey: 'track-a',
      }).positionMs,
    ).toBe(45000);
  });

  it('resets the estimate when the raw position recovers', () => {
    const state = {
      basePositionMs: 0,
      startedAtMs: 1000,
      trackKey: 'track-a',
    };

    expect(
      updateStagnantSyncedPositionEstimate(state, {
        canEstimate: true,
        lastAcceptedPositionMs: 0,
        nowMs: 4000,
        rawPositionMs: 1000,
        thresholdMs: 2500,
        trackKey: 'track-a',
      }),
    ).toEqual({ estimated: false, positionMs: null, state: null });
  });

  it('resets the estimate when estimation is not allowed', () => {
    const state = {
      basePositionMs: 0,
      startedAtMs: 1000,
      trackKey: 'track-a',
    };

    expect(
      updateStagnantSyncedPositionEstimate(state, {
        canEstimate: false,
        lastAcceptedPositionMs: 0,
        nowMs: 4000,
        rawPositionMs: 0,
        thresholdMs: 2500,
        trackKey: 'track-a',
      }),
    ).toEqual({ estimated: false, positionMs: null, state: null });
  });

  it('starts a fresh estimate when the track changes', () => {
    const state = {
      basePositionMs: 42000,
      startedAtMs: 1000,
      trackKey: 'track-a',
    };

    expect(
      updateStagnantSyncedPositionEstimate(state, {
        canEstimate: true,
        lastAcceptedPositionMs: 0,
        nowMs: 4000,
        rawPositionMs: 0,
        thresholdMs: 2500,
        trackKey: 'track-b',
      }),
    ).toEqual({
      estimated: false,
      positionMs: null,
      state: {
        basePositionMs: 0,
        startedAtMs: 4000,
        trackKey: 'track-b',
      },
    });
  });
});
