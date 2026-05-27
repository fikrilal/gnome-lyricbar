import { shouldUseSyncedLyricsTiming } from './sync-position-policy.js';

/**
 * @import { LyricsProviderResult } from '../lyrics/types.js'
 * @import { PlayerSnapshot } from '../mpris/types.js'
 * @import { BrowserPlayerService } from '../settings/types.js'
 */

/**
 * Browser MPRIS implementations can expose a valid, advancing Position while
 * PlaybackStatus is missing, stale, or late. Once synced lyrics exist, the
 * position read itself is the reliable source of truth; paused or stopped
 * players are cheap to poll because stable positions do not trigger line
 * changes.
 *
 * @param {{
 *   enabled: boolean,
 *   player: PlayerSnapshot | null,
 *   lookup: LyricsProviderResult | null,
 *   browserPlayerService?: BrowserPlayerService | null | undefined,
 * }} state
 * @returns {boolean}
 */
export function shouldPollSyncedLyrics(state) {
  return (
    state.enabled &&
    state.player !== null &&
    state.lookup?.kind === 'synced' &&
    shouldUseSyncedLyricsTiming(state.player, {
      browserPlayerService: state.browserPlayerService ?? 'auto',
    })
  );
}
