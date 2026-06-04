import { BLACK_TEXT_COLOR, DEFAULT_TEXT_SHADOW, WHITE_TEXT_COLOR } from '../settings/appearance.js';

/**
 * @typedef {{
 *   maxWidth: number,
 *   textAlign: import('../settings/types.js').TextAlign,
 *   textColorMode: import('../settings/types.js').TextColorMode,
 *   customTextColor: string,
 *   textShadowEnabled: boolean,
 * }} LabelStyleOptions
 */

/**
 * Builds the inline CSS style string for the LyricBar top-bar label.
 *
 * @param {LabelStyleOptions} options
 * @returns {string} The CSS style string.
 */
export function buildLabelStyleString(options) {
  let style = `width: ${options.maxWidth}px; min-width: 1px; text-align: ${options.textAlign};`;

  if (options.textColorMode === 'default' || options.textColorMode === 'white') {
    style += ` color: ${WHITE_TEXT_COLOR};`;
  } else if (options.textColorMode === 'black') {
    style += ` color: ${BLACK_TEXT_COLOR};`;
  } else if (options.textColorMode === 'custom' && options.customTextColor) {
    style += ` color: ${options.customTextColor};`;
  }

  if (options.textShadowEnabled) {
    style += ` text-shadow: ${DEFAULT_TEXT_SHADOW};`;
  } else {
    style += ' text-shadow: none;';
  }

  return style;
}
