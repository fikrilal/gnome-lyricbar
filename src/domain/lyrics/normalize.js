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
