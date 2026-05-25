const GET_ENDPOINT = 'https://lrclib.net/api/get';
const SEARCH_ENDPOINT = 'https://lrclib.net/api/search';

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

  /** @type {[string, string][]} */
  const params = [
    ['artist_name', artist],
    ['track_name', title],
  ];

  const album = normalize(query.album);
  if (album !== '') {
    params.push(['album_name', album]);
  }

  if (
    typeof query.durationMs === 'number' &&
    Number.isFinite(query.durationMs) &&
    query.durationMs > 0
  ) {
    params.push(['duration', String(Math.round(query.durationMs / 1000))]);
  }

  return `${GET_ENDPOINT}?${encodeFormQuery(params)}`;
}

/**
 * @param {LyricsQuery} query
 * @returns {string | null}
 */
export function buildLrclibSearchUrl(query) {
  const artist = normalize(query.artist);
  const title = normalizeSearchTitle(query.title);
  if (artist === '' || title === '') {
    return null;
  }

  /** @type {[string, string][]} */
  const params = [
    ['artist_name', artist],
    ['track_name', title],
  ];

  return `${SEARCH_ENDPOINT}?${encodeFormQuery(params)}`;
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

/**
 * Parenthetical suffixes are often release decorations in Spotify titles
 * while LRCLIB's synced entries may store the base title.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
function normalizeSearchTitle(value) {
  return normalize(value)
    .replace(/(?:^|\s+)\([^)]{1,32}\)\s*$/u, '')
    .trim();
}

/**
 * GJS does not expose browser URLSearchParams, so encode the small LRCLIB
 * query shape directly using application/x-www-form-urlencoded spacing.
 *
 * @param {readonly (readonly [string, string])[]} params
 * @returns {string}
 */
function encodeFormQuery(params) {
  return params
    .map(([key, value]) => `${encodeFormComponent(key)}=${encodeFormComponent(value)}`)
    .join('&');
}

/**
 * @param {string} value
 * @returns {string}
 */
function encodeFormComponent(value) {
  return encodeURIComponent(value).replaceAll("'", '%27').replaceAll('%20', '+');
}
