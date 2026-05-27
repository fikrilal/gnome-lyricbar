import { detectPlayerProfile, PLAYER_PROFILES } from '../mpris/profile.js';

/**
 * @import { LyricsQuery } from './types.js'
 * @import { PlayerSnapshot } from '../mpris/types.js'
 * @import { BrowserPlayerService } from '../settings/types.js'
 *
 * @typedef {Readonly<{
 *   browserPlayerService?: BrowserPlayerService | null | undefined,
 * }>} LyricsQueryPolicyOptions
 */

const APPLE_MUSIC_IMPLAUSIBLE_DURATION_MS = 15 * 60 * 1000;

/**
 * Applies profile-aware lookup policy to a normalized lyrics query.
 *
 * @param {PlayerSnapshot | null | undefined} player
 * @param {LyricsQuery} query
 * @param {LyricsQueryPolicyOptions} [options]
 * @returns {LyricsQuery}
 */
export function applyLyricsQueryPolicy(player, query, options = {}) {
  const profile = detectPlayerProfile(player, {
    browserPlayerService: options.browserPlayerService ?? 'auto',
  });

  if (
    profile.id === PLAYER_PROFILES.appleMusicWeb.id &&
    isImplausibleAppleMusicDuration(query.durationMs)
  ) {
    return {
      ...query,
      durationMs: null,
    };
  }

  return query;
}

/**
 * @param {number | null} durationMs
 * @returns {boolean}
 */
function isImplausibleAppleMusicDuration(durationMs) {
  return (
    typeof durationMs === 'number' &&
    Number.isFinite(durationMs) &&
    durationMs > APPLE_MUSIC_IMPLAUSIBLE_DURATION_MS
  );
}
