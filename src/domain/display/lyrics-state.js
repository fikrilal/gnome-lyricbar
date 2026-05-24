import { selectLyricLine } from '../lyrics/lrc.js';

/**
 * @import { PlayerSnapshot } from '../mpris/types.js'
 * @import { LyricsProviderResult } from '../lyrics/types.js'
 * @import { DisplayState, DisplayTrack } from './types.js'
 */

/**
 * @param {PlayerSnapshot | null | undefined} player
 * @param {LyricsProviderResult | null | undefined} lookup
 * @returns {DisplayState}
 */
export function displayStateFromLookup(player, lookup) {
  if (player === null || player === undefined) {
    return { kind: 'idle' };
  }

  /** @type {DisplayTrack} */
  const track = { title: player.title, artist: player.artist };

  if (lookup === null || lookup === undefined) {
    return { kind: 'loading', track };
  }

  switch (lookup.kind) {
    case 'synced':
      return { kind: 'lyrics', line: extractFirstSyncedLine(lookup), track };
    case 'plain':
      return { kind: 'lyrics', line: extractFirstPlainLine(lookup), track };
    case 'instrumental':
      return { kind: 'track', track };
    case 'not-found':
      return { kind: 'track', track };
    case 'error':
      return { kind: 'error', track };
    default:
      return { kind: 'track', track };
  }
}

/**
 * @param {PlayerSnapshot | null | undefined} player
 * @param {Extract<LyricsProviderResult, { kind: 'synced' }>} lookup
 * @param {number} positionMs
 * @returns {DisplayState}
 */
export function displayStateFromSyncedPosition(player, lookup, positionMs) {
  if (player === null || player === undefined) {
    return { kind: 'idle' };
  }

  /** @type {DisplayTrack} */
  const track = { title: player.title, artist: player.artist };
  const line = selectLyricLine(lookup.lines, positionMs);
  if (line !== null && line.text.trim() !== '') {
    return { kind: 'lyrics', line: line.text, track };
  }

  return displayStateFromLookup(player, lookup);
}

/**
 * @param {Extract<LyricsProviderResult, { kind: 'synced' }>} lookup
 * @returns {string}
 */
function extractFirstSyncedLine(lookup) {
  for (const line of lookup.lines) {
    if (line.text.trim() !== '') {
      return line.text;
    }
  }
  return extractFirstNonEmptyLine(lookup.plainText);
}

/**
 * @param {Extract<LyricsProviderResult, { kind: 'plain' }>} lookup
 * @returns {string}
 */
function extractFirstPlainLine(lookup) {
  return extractFirstNonEmptyLine(lookup.text);
}

/**
 * @param {string} text
 * @returns {string}
 */
function extractFirstNonEmptyLine(text) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed !== '') {
      return trimmed;
    }
  }
  return '';
}
