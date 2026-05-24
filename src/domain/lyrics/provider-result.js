import { parseLrc } from './lrc.js';

/**
 * @import {
 *   LyricsProviderResult,
 *   ProviderTrackInfo,
 * } from './types.js'
 *
 * @typedef {Readonly<{ [key: string]: unknown }>} ResponseBag
 */

const KEY_STATUS_CODE = 'statusCode';
const KEY_NAME = 'name';
const KEY_INSTRUMENTAL = 'instrumental';
const KEY_SYNCED_LYRICS = 'syncedLyrics';
const KEY_PLAIN_LYRICS = 'plainLyrics';
const KEY_TRACK_NAME = 'trackName';
const KEY_ARTIST_NAME = 'artistName';
const KEY_ALBUM_NAME = 'albumName';
const KEY_DURATION = 'duration';

/**
 * @param {unknown} value
 * @returns {LyricsProviderResult}
 */
export function parseLrclibResponse(value) {
  if (value === null || value === undefined) {
    return notFound();
  }

  if (typeof value !== 'object') {
    return error('response was not a JSON object');
  }

  const bag = /** @type {ResponseBag} */ (value);

  if (looksLikeNotFound(bag)) {
    return notFound();
  }

  if (looksLikeProviderError(bag)) {
    return error(readErrorReason(bag));
  }

  const track = readTrack(bag);

  if (readBoolean(bag, KEY_INSTRUMENTAL)) {
    return Object.freeze({ kind: 'instrumental', track });
  }

  const synced = readNonEmptyString(bag, KEY_SYNCED_LYRICS);
  const plain = readNonEmptyString(bag, KEY_PLAIN_LYRICS);

  if (synced !== null) {
    const lines = parseLrc(synced);
    if (lines.length > 0) {
      return Object.freeze({
        kind: 'synced',
        track,
        lines: Object.freeze(lines),
        plainText: plain ?? '',
      });
    }
  }

  if (plain !== null) {
    return Object.freeze({ kind: 'plain', track, text: plain });
  }

  return notFound();
}

/**
 * @param {ResponseBag} bag
 * @returns {boolean}
 */
function looksLikeNotFound(bag) {
  const status = readNumber(bag, KEY_STATUS_CODE);
  if (status === 404) {
    return true;
  }

  const synced = readNonEmptyString(bag, KEY_SYNCED_LYRICS);
  const plain = readNonEmptyString(bag, KEY_PLAIN_LYRICS);
  const trackName = readNonEmptyString(bag, KEY_TRACK_NAME);
  const artistName = readNonEmptyString(bag, KEY_ARTIST_NAME);
  const instrumental = readBoolean(bag, KEY_INSTRUMENTAL);

  return (
    synced === null &&
    plain === null &&
    trackName === null &&
    artistName === null &&
    instrumental === false &&
    status === null
  );
}

/**
 * @param {ResponseBag} bag
 * @returns {boolean}
 */
function looksLikeProviderError(bag) {
  const status = readNumber(bag, KEY_STATUS_CODE);
  if (status === null) {
    return false;
  }

  return status >= 400 && status !== 404;
}

/**
 * @param {ResponseBag} bag
 * @returns {string}
 */
function readErrorReason(bag) {
  const name = readNonEmptyString(bag, KEY_NAME);
  const status = readNumber(bag, KEY_STATUS_CODE);
  const parts = [];
  if (typeof status === 'number') {
    parts.push(`status ${status}`);
  }
  if (name !== null) {
    parts.push(name);
  }
  return parts.length === 0 ? 'unknown provider error' : parts.join(': ');
}

/**
 * @param {ResponseBag} bag
 * @returns {ProviderTrackInfo}
 */
function readTrack(bag) {
  return Object.freeze({
    trackName: readNonEmptyString(bag, KEY_TRACK_NAME) ?? '',
    artistName: readNonEmptyString(bag, KEY_ARTIST_NAME) ?? '',
    albumName: readNonEmptyString(bag, KEY_ALBUM_NAME) ?? '',
    durationMs: readDurationMs(bag, KEY_DURATION),
  });
}

/**
 * @param {ResponseBag} bag
 * @param {string} key
 * @returns {string | null}
 */
function readNonEmptyString(bag, key) {
  const value = read(bag, key);
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * @param {ResponseBag} bag
 * @param {string} key
 * @returns {number | null}
 */
function readNumber(bag, key) {
  const value = read(bag, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param {ResponseBag} bag
 * @param {string} key
 * @returns {boolean}
 */
function readBoolean(bag, key) {
  return read(bag, key) === true;
}

/**
 * @param {ResponseBag} bag
 * @param {string} key
 * @returns {number | null}
 */
function readDurationMs(bag, key) {
  const value = read(bag, key);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value * 1000);
}

/**
 * @param {ResponseBag} bag
 * @param {string} key
 * @returns {unknown}
 */
function read(bag, key) {
  return Object.hasOwn(bag, key) ? Reflect.get(bag, key) : undefined;
}

/**
 * @returns {LyricsProviderResult}
 */
function notFound() {
  return Object.freeze({ kind: 'not-found' });
}

/**
 * @param {string} reason
 * @returns {LyricsProviderResult}
 */
function error(reason) {
  return Object.freeze({ kind: 'error', reason });
}
