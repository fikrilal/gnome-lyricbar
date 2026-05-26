const DEFAULT_PANEL_POSITION = 'center';
const DEFAULT_MAX_WIDTH = 360;
const MIN_MAX_WIDTH = 120;
const MAX_MAX_WIDTH = 720;
const DEFAULT_FALLBACK_MODE = 'track';
const DEFAULT_PLAYER_PRIORITY = ['spotify'];
const DEFAULT_BROWSER_PLAYER_SERVICE = 'auto';
const DEFAULT_TEXT_ALIGN = 'left';

const PANEL_POSITIONS = new Set(['left', 'center', 'right']);
const FALLBACK_MODES = new Set(['track', 'idle', 'hidden']);
const BROWSER_PLAYER_SERVICES = new Set(['auto', 'spotify', 'youtube-music', 'generic']);
const TEXT_ALIGNS = new Set(['left', 'center', 'right']);

/**
 * @import {
 *   BrowserPlayerService,
 *   FallbackMode,
 *   LyricBarSettings,
 *   PanelPosition,
 *   RawSettings,
 *   TextAlign,
 * } from './types.js'
 */

/**
 * @param {RawSettings} raw
 * @returns {LyricBarSettings}
 */
export function normalizeSettings(raw) {
  return {
    panelPosition: normalizePanelPosition(raw.panelPosition),
    maxWidth: normalizeMaxWidth(raw.maxWidth),
    textAlign: normalizeTextAlign(raw.textAlign),
    fallbackMode: normalizeFallbackMode(raw.fallbackMode),
    playerPriority: normalizePlayerPriority(raw.playerPriority),
    browserPlayerService: normalizeBrowserPlayerService(raw.browserPlayerService),
    cacheEnabled: normalizeBoolean(raw.cacheEnabled, true),
    debugLogging: normalizeBoolean(raw.debugLogging, false),
  };
}

/**
 * @param {unknown} value
 * @returns {PanelPosition}
 */
export function normalizePanelPosition(value) {
  return typeof value === 'string' && PANEL_POSITIONS.has(value)
    ? /** @type {PanelPosition} */ (value)
    : DEFAULT_PANEL_POSITION;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeMaxWidth(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_WIDTH;
  }

  const rounded = Math.round(/** @type {number} */ (value));
  return Math.min(MAX_MAX_WIDTH, Math.max(MIN_MAX_WIDTH, rounded));
}

/**
 * @param {unknown} value
 * @returns {FallbackMode}
 */
export function normalizeFallbackMode(value) {
  return typeof value === 'string' && FALLBACK_MODES.has(value)
    ? /** @type {FallbackMode} */ (value)
    : DEFAULT_FALLBACK_MODE;
}

/**
 * @param {unknown} value
 * @returns {readonly string[]}
 */
export function normalizePlayerPriority(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_PLAYER_PRIORITY;
  }

  const normalized = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== '');

  return [...new Set(normalized)];
}

/**
 * @param {unknown} value
 * @returns {BrowserPlayerService}
 */
export function normalizeBrowserPlayerService(value) {
  return typeof value === 'string' && BROWSER_PLAYER_SERVICES.has(value)
    ? /** @type {BrowserPlayerService} */ (value)
    : DEFAULT_BROWSER_PLAYER_SERVICE;
}

/**
 * @param {unknown} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function normalizeBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * @param {unknown} value
 * @returns {TextAlign}
 */
export function normalizeTextAlign(value) {
  return typeof value === 'string' && TEXT_ALIGNS.has(value)
    ? /** @type {TextAlign} */ (value)
    : DEFAULT_TEXT_ALIGN;
}
