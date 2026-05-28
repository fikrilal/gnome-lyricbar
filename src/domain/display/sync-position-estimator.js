const DEFAULT_STAGNANT_POSITION_THRESHOLD_MS = 2_500;

/**
 * @typedef {Readonly<{
 *   trackKey: string,
 *   basePositionMs: number,
 *   startedAtMs: number,
 * }>} StagnantSyncedPositionEstimate
 *
 * @typedef {Readonly<{
 *   canEstimate: boolean,
 *   lastAcceptedPositionMs?: number | null | undefined,
 *   nowMs: number,
 *   rawPositionMs: number,
 *   thresholdMs?: number | undefined,
 *   trackKey: string,
 * }>} StagnantSyncedPositionEstimateInput
 *
 * @typedef {Readonly<{
 *   estimated: boolean,
 *   positionMs: number | null,
 *   state: StagnantSyncedPositionEstimate | null,
 * }>} StagnantSyncedPositionEstimateResult
 */

/**
 * Advances a runtime-only estimated clock for browser players whose MPRIS
 * position is stuck at 0 after a stable synced line has already been accepted.
 *
 * @param {StagnantSyncedPositionEstimate | null} state
 * @param {StagnantSyncedPositionEstimateInput} input
 * @returns {StagnantSyncedPositionEstimateResult}
 */
export function updateStagnantSyncedPositionEstimate(state, input) {
  if (!input.canEstimate || input.rawPositionMs !== 0) {
    return { estimated: false, positionMs: null, state: null };
  }

  const nextState =
    state !== null && state.trackKey === input.trackKey
      ? state
      : {
          trackKey: input.trackKey,
          basePositionMs: normalizeBasePosition(input.lastAcceptedPositionMs),
          startedAtMs: input.nowMs,
        };

  const thresholdMs = input.thresholdMs ?? DEFAULT_STAGNANT_POSITION_THRESHOLD_MS;
  const elapsedMs = Math.max(0, input.nowMs - nextState.startedAtMs);
  if (elapsedMs < thresholdMs) {
    return { estimated: false, positionMs: null, state: nextState };
  }

  return {
    estimated: true,
    positionMs: nextState.basePositionMs + elapsedMs,
    state: nextState,
  };
}

/**
 * @param {number | null | undefined} positionMs
 * @returns {number}
 */
function normalizeBasePosition(positionMs) {
  if (typeof positionMs !== 'number' || !Number.isFinite(positionMs) || positionMs < 0) {
    return 0;
  }
  return positionMs;
}
