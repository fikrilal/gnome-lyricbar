/**
 * @import { LyricsQuery, TrackMetadataInput } from './types.js'
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeTrackText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/**
 * @param {TrackMetadataInput | null | undefined} metadata
 * @returns {LyricsQuery}
 */
export function buildLyricsQuery(metadata) {
  const durationMs = metadata?.durationMs;

  return {
    artist: normalizeTrackText(metadata?.artist),
    title: normalizeTrackText(metadata?.title),
    album: normalizeTrackText(metadata?.album),
    durationMs: typeof durationMs === 'number' && Number.isFinite(durationMs) ? durationMs : null,
  };
}

/**
 * Strips release decorations and YouTube-style noise from track titles:
 * everything after a '|' and any bracketed expressions '()', '[]', '【】', '（）'.
 *
 * Adopts the sanitization logic used by Limusic's search_title.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeSearchTitle(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const beforePipe = value.split('|')[0] ?? '';
  let depth = 0;
  let out = '';
  for (const char of beforePipe) {
    if (char === '(' || char === '[' || char === '【' || char === '（') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '】' || char === '）') {
      if (depth > 0) {
        depth -= 1;
      }
    } else if (depth === 0) {
      out += char;
    }
  }

  return normalizeTrackText(out);
}
