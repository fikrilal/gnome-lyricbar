/**
 * @import { TextColorMode } from './types.js'
 */

/** @type {TextColorMode} */
export const DEFAULT_TEXT_COLOR_MODE = 'default';

export const DEFAULT_CUSTOM_TEXT_COLOR = '#ffffff';
export const DEFAULT_TEXT_SHADOW_ENABLED = true;
export const DEFAULT_TEXT_SHADOW = '0 1px 2px rgba(0, 0, 0, 0.8)';
export const WHITE_TEXT_COLOR = '#ffffff';
export const BLACK_TEXT_COLOR = '#000000';

/** @type {readonly TextColorMode[]} */
export const TEXT_COLOR_MODES = Object.freeze(['default', 'system', 'white', 'black', 'custom']);

export const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * @param {unknown} value
 * @returns {value is TextColorMode}
 */
export function isTextColorMode(value) {
  return (
    typeof value === 'string' && TEXT_COLOR_MODES.includes(/** @type {TextColorMode} */ (value))
  );
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isHexColor(value) {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim());
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function textColorModeIndex(value) {
  return isTextColorMode(value) ? TEXT_COLOR_MODES.indexOf(value) : -1;
}
