import { sanitizeSearchTitle } from '../../domain/lyrics/normalize.js';

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
  const title = sanitizeSearchTitle(query.title);
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
 * @param {string | null | undefined} queryText
 * @returns {string | null}
 */
export function buildLrclibQuerySearchUrl(queryText) {
  const text = normalize(queryText);
  if (text === '') {
    return null;
  }

  return `${SEARCH_ENDPOINT}?q=${encodeFormComponent(text)}`;
}

/**
 * Returns candidate free-text search queries for fuzzy fallback matching:
 * 1. "{sanitizedTitle} {artist}"
 * 2. "{sanitizedTitle}"
 *
 * @param {LyricsQuery} query
 * @returns {string[]}
 */
export function buildLrclibFreeTextQueries(query) {
  const title = sanitizeSearchTitle(query.title);
  const artist = normalize(query.artist);
  if (title === '') {
    return [];
  }

  const queries = [];
  if (artist !== '') {
    queries.push(`${title} ${artist}`.trim());
  }
  queries.push(title);
  return queries;
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
