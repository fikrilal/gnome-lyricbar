import { detectPlayerProfile } from '../mpris/profile.js';
import { isImplausibleAppleMusicDuration } from './duration-policy.js';

/**
 * @import { PlayerSnapshot } from '../mpris/types.js'
 * @import { BrowserPlayerService } from '../settings/types.js'
 *
 * @typedef {Readonly<{
 *   browserPlayerService?: BrowserPlayerService | null | undefined,
 * }>} TrackIdentityOptions
 */

/**
 * Builds a stable identity key for a player snapshot. Two snapshots that
 * share the same identity refer to the same logical track on the same
 * player, so the lyrics service can suppress duplicate lookups.
 *
 * @param {PlayerSnapshot | null | undefined} player
 * @param {TrackIdentityOptions} [options]
 * @returns {string | null}
 */
export function buildTrackIdentityKey(player, options = {}) {
  if (player === null || player === undefined) {
    return null;
  }

  const title = normalize(player.title);
  const artist = normalize(player.artist);
  if (title === '' && artist === '') {
    return null;
  }

  const album = normalize(player.album);
  const trackId = shouldUseTrackId(player, options)
    ? typeof player.trackId === 'string'
      ? player.trackId
      : ''
    : '';
  const duration = shouldUseDuration(player, options)
    ? typeof player.durationMs === 'number' && Number.isFinite(player.durationMs)
      ? String(Math.round(player.durationMs / 1000))
      : ''
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

/**
 * Browser MPRIS track IDs are browser implementation details. Chromium can
 * reuse generic object paths across different songs, and can also churn them
 * for the same logical song. Keep real desktop track IDs, but ignore browser
 * track IDs for lookup suppression.
 *
 * @param {PlayerSnapshot} player
 * @param {TrackIdentityOptions} options
 * @returns {boolean}
 */
function shouldUseTrackId(player, options) {
  const profile = detectPlayerProfile(player, {
    browserPlayerService: options.browserPlayerService ?? 'auto',
  });
  return profile.sourceKind !== 'browser';
}

/**
 * @param {PlayerSnapshot} player
 * @param {TrackIdentityOptions} options
 * @returns {boolean}
 */
function shouldUseDuration(player, options) {
  const profile = detectPlayerProfile(player, {
    browserPlayerService: options.browserPlayerService ?? 'auto',
  });
  return profile.id !== 'apple-music-web' || !isImplausibleAppleMusicDuration(player.durationMs);
}
