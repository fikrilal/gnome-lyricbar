/**
 * Applies the user-configured lyric timing offset to a playback position.
 * Positive offsets delay line selection; negative offsets advance it. The
 * result never goes below zero, so an offset that reaches before the track
 * start keeps the existing first-line fallback behavior.
 *
 * @param {number} positionMs
 * @param {number} offsetMs
 * @returns {number}
 */
export function applyLyricsOffset(positionMs, offsetMs) {
  return Math.max(0, positionMs + offsetMs);
}
