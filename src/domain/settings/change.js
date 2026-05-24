/**
 * @import { LyricBarSettings } from './types.js'
 */

/**
 * @param {LyricBarSettings} previous
 * @param {LyricBarSettings} next
 * @returns {boolean}
 */
export function shouldRefreshPlayerSelection(previous, next) {
  return !sameStringList(previous.playerPriority, next.playerPriority);
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
