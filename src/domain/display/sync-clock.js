/**
 * @typedef {Readonly<{
 *   trackKey: string,
 *   basePositionMs: number,
 *   baseTimestampMs: number,
 *   lastSampledRawMs: number,
 *   playbackStatus: string,
 * }>} SyncedClockState
 *
 * @typedef {Readonly<{
 *   trackKey: string,
 *   rawPositionMs: number,
 *   nowMs: number,
 *   playbackStatus: string,
 * }>} SyncedClockSampleInput
 */

const MAX_STALE_THROTTLE_WINDOW_MS = 10000;
const SEEK_DRIFT_THRESHOLD_MS = 1500;

/**
 * Initializes or updates an interpolated clock state based on a new position sample from MPRIS.
 *
 * @param {SyncedClockState | null} state
 * @param {SyncedClockSampleInput} input
 * @returns {SyncedClockState}
 */
export function updateSyncedClock(state, input) {
  const rawPositionMs = Math.max(0, input.rawPositionMs);

  if (state === null || state.trackKey !== input.trackKey) {
    return Object.freeze({
      trackKey: input.trackKey,
      basePositionMs: rawPositionMs,
      baseTimestampMs: input.nowMs,
      lastSampledRawMs: rawPositionMs,
      playbackStatus: input.playbackStatus,
    });
  }

  if (state.playbackStatus !== input.playbackStatus) {
    const currentEstimated = getInterpolatedClockPosition(state, input.nowMs);
    return Object.freeze({
      trackKey: input.trackKey,
      basePositionMs: input.playbackStatus === 'Playing' ? rawPositionMs : currentEstimated,
      baseTimestampMs: input.nowMs,
      lastSampledRawMs: rawPositionMs,
      playbackStatus: input.playbackStatus,
    });
  }

  if (input.playbackStatus === 'Playing') {
    const currentEstimated = getInterpolatedClockPosition(state, input.nowMs);
    const backwardDrift = currentEstimated - rawPositionMs;
    const forwardDrift = rawPositionMs - currentEstimated;

    // If the player reported the identical raw position while playing, and drift is within
    // the throttle window, the player's MPRIS output is throttled (e.g. Limusic 2s push gate).
    // Maintain the running clock instead of pulling basePositionMs backward.
    if (
      rawPositionMs === state.lastSampledRawMs &&
      Math.abs(backwardDrift) < MAX_STALE_THROTTLE_WINDOW_MS
    ) {
      return state;
    }

    // A seek occurred (user jumped backward or forward significantly).
    if (backwardDrift >= SEEK_DRIFT_THRESHOLD_MS || forwardDrift >= SEEK_DRIFT_THRESHOLD_MS) {
      return Object.freeze({
        trackKey: input.trackKey,
        basePositionMs: rawPositionMs,
        baseTimestampMs: input.nowMs,
        lastSampledRawMs: rawPositionMs,
        playbackStatus: input.playbackStatus,
      });
    }

    // Minor backward latency / D-Bus sampling delay during continuous playback.
    // Never pull the running clock backward as it causes lyric line oscillation around line boundaries.
    if (backwardDrift > 0) {
      return Object.freeze({
        trackKey: input.trackKey,
        basePositionMs: state.basePositionMs,
        baseTimestampMs: state.baseTimestampMs,
        lastSampledRawMs: rawPositionMs,
        playbackStatus: input.playbackStatus,
      });
    }

    // Normal forward advance or calibration.
    return Object.freeze({
      trackKey: input.trackKey,
      basePositionMs: rawPositionMs,
      baseTimestampMs: input.nowMs,
      lastSampledRawMs: rawPositionMs,
      playbackStatus: input.playbackStatus,
    });
  }

  return Object.freeze({
    trackKey: input.trackKey,
    basePositionMs: rawPositionMs,
    baseTimestampMs: input.nowMs,
    lastSampledRawMs: rawPositionMs,
    playbackStatus: input.playbackStatus,
  });
}

/**
 * Calculates the current interpolated playback position in milliseconds.
 *
 * @param {SyncedClockState | null} state
 * @param {number} nowMs
 * @returns {number}
 */
export function getInterpolatedClockPosition(state, nowMs) {
  if (state === null) {
    return 0;
  }

  if (state.playbackStatus !== 'Playing') {
    return state.basePositionMs;
  }

  const elapsed = Math.max(0, nowMs - state.baseTimestampMs);
  return state.basePositionMs + elapsed;
}
