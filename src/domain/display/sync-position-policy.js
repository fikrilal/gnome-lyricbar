import { detectPlayerProfile } from '../mpris/profile.js';

const POSITION_DURATION_TOLERANCE_MS = 10_000;

/**
 * @import { PlayerSnapshot } from '../mpris/types.js'
 * @import { BrowserPlayerService } from '../settings/types.js'
 *
 * @typedef {Readonly<{
 *   browserPlayerService?: BrowserPlayerService | null | undefined,
 *   hasPreviousSyncedLine?: boolean | undefined,
 *   trackDurationMs?: number | null | undefined,
 * }>} SyncedTimingOptions
 */

/**
 * @param {PlayerSnapshot | null | undefined} player
 * @param {SyncedTimingOptions} [options]
 * @returns {boolean}
 */
export function shouldUseSyncedLyricsTiming(player, options = {}) {
  if (player === null || player === undefined) {
    return false;
  }

  const profile = detectPlayerProfile(player, {
    browserPlayerService: options.browserPlayerService ?? 'auto',
  });

  return profile.id !== '';
}

/**
 * @param {PlayerSnapshot | null | undefined} player
 * @param {number | null | undefined} positionMs
 * @param {SyncedTimingOptions} [options]
 * @returns {boolean}
 */
export function shouldUseSyncedLyricsPosition(player, positionMs, options = {}) {
  if (
    typeof positionMs !== 'number' ||
    !Number.isFinite(positionMs) ||
    positionMs < 0 ||
    !shouldUseSyncedLyricsTiming(player, options)
  ) {
    return false;
  }

  if (isBeyondTrackDuration(positionMs, options.trackDurationMs)) {
    return false;
  }

  return true;
}

/**
 * Firefox browser MPRIS can emit a short low-confidence transition sample for
 * YouTube Music where playback is already "Playing", position is 0, and
 * duration is unavailable. Holding that sample prevents the previous line from
 * jumping back to the first lyric while the browser settles.
 *
 * @param {PlayerSnapshot | null | undefined} player
 * @param {number | null | undefined} positionMs
 * @param {SyncedTimingOptions} [options]
 * @returns {boolean}
 */
export function shouldHoldLowConfidenceSyncedPosition(player, positionMs, options = {}) {
  if (
    player === null ||
    player === undefined ||
    positionMs !== 0 ||
    options.hasPreviousSyncedLine !== true ||
    player.durationMs !== null ||
    player.playbackStatus !== 'Playing' ||
    !isFirefoxBrowser(player.busName)
  ) {
    return false;
  }

  const profile = detectPlayerProfile(player, {
    browserPlayerService: options.browserPlayerService ?? 'auto',
  });

  return profile.id === 'youtube-music-web';
}

/**
 * Apple Music Web can expose a cumulative browser media-session position
 * instead of a song-relative position after track changes. When the raw
 * position is only invalid because it is beyond provider duration, the runtime
 * may normalize it relative to the first observed raw position for the track.
 *
 * @param {PlayerSnapshot | null | undefined} player
 * @param {number | null | undefined} positionMs
 * @param {SyncedTimingOptions} [options]
 * @returns {boolean}
 */
export function shouldUseRelativeSyncedLyricsPosition(player, positionMs, options = {}) {
  if (
    typeof positionMs !== 'number' ||
    !Number.isFinite(positionMs) ||
    positionMs < 0 ||
    player === null ||
    player === undefined
  ) {
    return false;
  }

  const profile = detectPlayerProfile(player, {
    browserPlayerService: options.browserPlayerService ?? 'auto',
  });

  return (
    profile.id === 'apple-music-web' && isBeyondTrackDuration(positionMs, options.trackDurationMs)
  );
}

/**
 * @param {number} positionMs
 * @param {number | null | undefined} durationMs
 * @returns {boolean}
 */
function isBeyondTrackDuration(positionMs, durationMs) {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return false;
  }

  return positionMs > durationMs + POSITION_DURATION_TOLERANCE_MS;
}

/**
 * @param {string} busName
 * @returns {boolean}
 */
function isFirefoxBrowser(busName) {
  return (
    busName === 'org.mpris.MediaPlayer2.firefox' ||
    busName.startsWith('org.mpris.MediaPlayer2.firefox.')
  );
}
