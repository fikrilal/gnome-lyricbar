const ENDPOINT = 'https://lrclib.net/api/get';

/**
 * @import { LyricsQuery } from '../../domain/lyrics/types.js'
 */

/**
 * @param {LyricsQuery} query
 * @returns {string | null}
 */
export function buildLrclibUrl(query) {
  const artist = normalize(query.artist);
  const title = normalize(query.title);
  if (artist === '' || title === '') {
    return null;
  }

  const params = new URLSearchParams();
  params.set('artist_name', artist);
  params.set('track_name', title);

  const album = normalize(query.album);
  if (album !== '') {
    params.set('album_name', album);
  }

  if (
    typeof query.durationMs === 'number' &&
    Number.isFinite(query.durationMs) &&
    query.durationMs > 0
  ) {
    params.set('duration', String(Math.round(query.durationMs / 1000)));
  }

  return `${ENDPOINT}?${params.toString()}`;
}

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
function normalize(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}
