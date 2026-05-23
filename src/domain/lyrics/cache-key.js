import { buildLyricsQuery } from './normalize.js';

export function buildLyricsCacheKey(metadata) {
  const query = buildLyricsQuery(metadata);
  const durationBucket =
    query.durationMs === null ? 'unknown' : String(Math.round(query.durationMs / 1000));

  return [query.artist, query.title, query.album, durationBucket]
    .map((part) => part.toLowerCase())
    .join('|');
}
