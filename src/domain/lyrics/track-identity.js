/**
 * @import { PlayerSnapshot } from '../mpris/types.js'
 */

/**
 * Builds a stable identity key for a player snapshot. Two snapshots that
 * share the same identity refer to the same logical track on the same
 * player, so the lyrics service can suppress duplicate lookups.
 *
 * @param {PlayerSnapshot | null | undefined} player
 * @returns {string | null}
 */
export function buildTrackIdentityKey(player) {
  if (player === null || player === undefined) {
    return null;
  }

  const title = normalize(player.title);
  const artist = normalize(player.artist);
  if (title === '' && artist === '') {
    return null;
  }

  const album = normalize(player.album);
  const trackId = typeof player.trackId === 'string' ? player.trackId : '';
  const duration =
    typeof player.durationMs === 'number' && Number.isFinite(player.durationMs)
      ? String(Math.round(player.durationMs / 1000))
      : '';

  return [player.busName, trackId, artist, title, album, duration]
    .map((part) => part.toLowerCase())
    .join('|');
}

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
function normalize(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}
