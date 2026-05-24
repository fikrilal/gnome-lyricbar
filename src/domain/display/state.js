const DEFAULT_IDLE_TEXT = 'LyricBar';
const DEFAULT_LOADING_PREFIX = 'Loading lyrics';
const DEFAULT_ERROR_TEXT = 'Lyrics unavailable';
const UNKNOWN_TRACK_TEXT = 'Unknown track';

/**
 * @import {
 *   DisplayState,
 *   DisplayText,
 *   DisplayTrack,
 *   FallbackMode,
 * } from './types.js'
 */

/**
 * @param {DisplayState} state
 * @param {FallbackMode} fallbackMode
 * @returns {DisplayText}
 */
export function formatDisplayState(state, fallbackMode) {
  if (state.kind === 'hidden') {
    return hiddenText();
  }

  if (state.kind === 'lyrics') {
    const line = normalizeText(state.line);
    if (line !== '') {
      return visibleText(line);
    }

    return formatFallbackTrack(state.track, fallbackMode);
  }

  if (state.kind === 'track') {
    return formatFallbackTrack(state.track, fallbackMode);
  }

  if (state.kind === 'loading') {
    const trackText = formatTrackText(state.track);
    if (trackText === null) {
      return visibleText(DEFAULT_LOADING_PREFIX);
    }

    return visibleText(`${DEFAULT_LOADING_PREFIX}: ${trackText}`);
  }

  if (state.kind === 'error') {
    if (fallbackMode === 'hidden') {
      return hiddenText();
    }

    if (fallbackMode === 'track') {
      return formatFallbackTrack(state.track, fallbackMode);
    }

    return visibleText(DEFAULT_ERROR_TEXT);
  }

  return fallbackMode === 'hidden' ? hiddenText() : visibleText(DEFAULT_IDLE_TEXT);
}

/**
 * @param {DisplayTrack | null | undefined} track
 * @param {FallbackMode} fallbackMode
 * @returns {DisplayText}
 */
function formatFallbackTrack(track, fallbackMode) {
  if (fallbackMode === 'hidden') {
    return hiddenText();
  }

  if (fallbackMode === 'idle') {
    return visibleText(DEFAULT_IDLE_TEXT);
  }

  return visibleText(formatTrackText(track) ?? UNKNOWN_TRACK_TEXT);
}

/**
 * @param {DisplayTrack | null | undefined} track
 * @returns {string | null}
 */
export function formatTrackText(track) {
  const artist = normalizeText(track?.artist);
  const title = normalizeText(track?.title);

  if (artist !== '' && title !== '') {
    return `${artist} - ${title}`;
  }

  if (title !== '') {
    return title;
  }

  if (artist !== '') {
    return artist;
  }

  return null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text
 * @returns {DisplayText}
 */
function visibleText(text) {
  return { text, visible: true };
}

/**
 * @returns {DisplayText}
 */
function hiddenText() {
  return { text: '', visible: false };
}
