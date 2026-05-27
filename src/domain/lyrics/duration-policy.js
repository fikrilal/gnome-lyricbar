/**
 * Apple Music Web exposes Chrome media-session timing, which can drift and
 * grow for the same visible track. Do not use it for identity, lookup, cache,
 * or negative-cache decisions until a stronger MPRIS signal exists.
 *
 * @returns {boolean}
 */
export function shouldIgnoreAppleMusicDuration() {
  return true;
}
