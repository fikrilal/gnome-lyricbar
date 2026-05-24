import { buildLyricsQuery } from './normalize.js';

/**
 * @import { TrackMetadataInput } from './types.js'
 */

/**
 * @param {TrackMetadataInput | null | undefined} metadata
 * @returns {string}
 */
export function buildLyricsCacheKey(metadata) {
  const query = buildLyricsQuery(metadata);
  const durationBucket =
    query.durationMs === null ? 'unknown' : String(Math.round(query.durationMs / 1000));

  return [query.artist, query.title, query.album, durationBucket]
    .map((part) => part.toLowerCase())
    .join('|');
}
