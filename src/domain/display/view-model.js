import { formatDisplayState } from './state.js';

/**
 * @import { DisplayState } from './types.js'
 * @import { LyricBarSettings } from '../settings/types.js'
 *
 * @typedef {Readonly<{
 *   text: string,
 *   visible: boolean,
 *   maxWidth: number,
 *   textAlign: import('../settings/types.js').TextAlign,
 *   textColorMode: import('../settings/types.js').TextColorMode,
 *   customTextColor: string,
 *   textShadowEnabled: boolean,
 * }>} IndicatorViewModel
 */

/**
 * @param {DisplayState} state
 * @param {LyricBarSettings} settings
 * @returns {IndicatorViewModel}
 */
export function buildIndicatorViewModel(state, settings) {
  const display = formatDisplayState(state, settings.fallbackMode);

  return {
    text: display.text,
    visible: display.visible,
    maxWidth: settings.maxWidth,
    textAlign: settings.textAlign,
    textColorMode: settings.textColorMode,
    customTextColor: settings.customTextColor,
    textShadowEnabled: settings.textShadowEnabled,
  };
}
