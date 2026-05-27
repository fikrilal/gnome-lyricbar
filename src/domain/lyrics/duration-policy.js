export const APPLE_MUSIC_IMPLAUSIBLE_DURATION_MS = 15 * 60 * 1000;

/**
 * @param {number | null | undefined} durationMs
 * @returns {boolean}
 */
export function isImplausibleAppleMusicDuration(durationMs) {
  return (
    typeof durationMs === 'number' &&
    Number.isFinite(durationMs) &&
    durationMs > APPLE_MUSIC_IMPLAUSIBLE_DURATION_MS
  );
}
