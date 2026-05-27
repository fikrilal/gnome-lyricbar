import { detectPlayerProfile, PLAYER_PROFILES } from '../mpris/profile.js';
import { shouldIgnoreAppleMusicDuration } from './duration-policy.js';

/**
 * @import { LyricsQuery } from './types.js'
 * @import { PlayerSnapshot } from '../mpris/types.js'
 * @import { BrowserPlayerService } from '../settings/types.js'
 *
 * @typedef {Readonly<{
 *   browserPlayerService?: BrowserPlayerService | null | undefined,
 * }>} LyricsQueryPolicyOptions
 */

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

  if (profile.id === PLAYER_PROFILES.appleMusicWeb.id && shouldIgnoreAppleMusicDuration()) {
    return {
      ...query,
      durationMs: null,
    };
  }

  return query;
}
