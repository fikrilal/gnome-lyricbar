/**
 * @import { LyricBarSettings } from './types.js'
 */

/**
 * @param {LyricBarSettings} previous
 * @param {LyricBarSettings} next
 * @returns {boolean}
 */
export function shouldRefreshPlayerSelection(previous, next) {
  return (
    !sameStringList(previous.playerPriority, next.playerPriority) ||
    previous.browserPlayerService !== next.browserPlayerService
  );
}

/**
 * @param {LyricBarSettings} previous
 * @param {LyricBarSettings} next
 * @returns {boolean}
 */
export function shouldRepositionPanelIndicator(previous, next) {
  return previous.panelPosition !== next.panelPosition;
}

/**
 * @param {LyricBarSettings} previous
 * @param {LyricBarSettings} next
 * @returns {boolean}
 */
export function shouldRefreshSettingsAccess(previous, next) {
  return previous.showSettingsIcon !== next.showSettingsIcon;
}

/**
 * @param {LyricBarSettings} previous
 * @param {LyricBarSettings} next
 * @returns {boolean}
 */
export function shouldRefreshSyncedLyrics(previous, next) {
  return previous.lyricsOffsetMs !== next.lyricsOffsetMs;
}

/**
 * @param {readonly string[]} left
 * @param {readonly string[]} right
 * @returns {boolean}
 */
function sameStringList(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
