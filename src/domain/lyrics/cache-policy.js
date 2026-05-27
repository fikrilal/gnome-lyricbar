import { buildLyricsCacheKey } from './cache-key.js';
import { detectPlayerProfile } from '../mpris/profile.js';
import { shouldIgnoreAppleMusicDuration } from './duration-policy.js';

/**
 * @import { LyricsProviderResult, TrackMetadataInput } from './types.js'
 * @import { PlayerSnapshot } from '../mpris/types.js'
 * @import { BrowserPlayerService } from '../settings/types.js'
 *
 * @typedef {Readonly<{
 *   schema: number,
 *   savedAt: number,
 *   expiresAt: number,
 *   result: LyricsProviderResult,
 * }>} CacheEntry
 *
 * @typedef {Readonly<{
 *   browserPlayerService?: BrowserPlayerService | null | undefined,
 * }>} CacheDecisionOptions
 */

export const CACHE_SCHEMA_VERSION = 2;
export const POSITIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const POSITIVE_KINDS = new Set(['synced', 'plain', 'instrumental']);

/**
 * @param {TrackMetadataInput | null | undefined} metadata
 * @returns {string}
 */
export function buildCacheFileName(metadata) {
  const key = buildLyricsCacheKey(metadata);
  return `${hashString(key)}.json`;
}

/**
 * @param {LyricsProviderResult} result
 * @param {number} now
 * @returns {CacheEntry}
 */
export function buildCacheEntry(result, now) {
  const ttl = POSITIVE_KINDS.has(result.kind) ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
  return Object.freeze({
    schema: CACHE_SCHEMA_VERSION,
    savedAt: now,
    expiresAt: now + ttl,
    result,
  });
}

/**
 * Decides whether a provider result should be persisted. Browser MPRIS can emit
 * short-lived non-track metadata, so low-confidence browser misses must not
 * poison the negative cache. Positive results remain cacheable because the
 * provider already found a usable lyric payload.
 *
 * @param {PlayerSnapshot | null | undefined} player
 * @param {LyricsProviderResult} result
 * @param {CacheDecisionOptions} [options]
 * @returns {boolean}
 */
export function shouldWriteLyricsCache(player, result, options = {}) {
  if (result.kind !== 'not-found') {
    return true;
  }

  if (player === null || player === undefined) {
    return true;
  }

  if (!isBrowserSnapshot(player, options)) {
    return true;
  }

  return isHighConfidenceBrowserSnapshot(player, options);
}

/**
 * @param {unknown} value
 * @param {number} now
 * @returns {LyricsProviderResult | null}
 */
export function parseCacheEntry(value, now) {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const candidate = /** @type {Readonly<{ [key: string]: unknown }>} */ (value);

  const schema = read(candidate, 'schema');
  if (schema !== CACHE_SCHEMA_VERSION) {
    return null;
  }

  const savedAt = readFiniteNumber(candidate, 'savedAt');
  const expiresAt = readFiniteNumber(candidate, 'expiresAt');
  if (savedAt === null || expiresAt === null) {
    return null;
  }
  if (expiresAt <= now) {
    return null;
  }
  if (expiresAt - savedAt > POSITIVE_TTL_MS + 60 * 1000) {
    return null;
  }
  if (savedAt > now + 60 * 1000) {
    return null;
  }

  const result = read(candidate, 'result');
  if (!isValidResult(result)) {
    return null;
  }

  return /** @type {LyricsProviderResult} */ (result);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidResult(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const candidate = /** @type {Readonly<{ [key: string]: unknown }>} */ (value);
  const kind = read(candidate, 'kind');
  if (typeof kind !== 'string') {
    return false;
  }

  switch (kind) {
    case 'synced':
      return (
        Array.isArray(read(candidate, 'lines')) &&
        typeof read(candidate, 'plainText') === 'string' &&
        isValidTrack(read(candidate, 'track'))
      );
    case 'plain':
      return typeof read(candidate, 'text') === 'string' && isValidTrack(read(candidate, 'track'));
    case 'instrumental':
      return isValidTrack(read(candidate, 'track'));
    case 'not-found':
      return true;
    case 'error':
      return typeof read(candidate, 'reason') === 'string';
    default:
      return false;
  }
}

/**
 * @param {PlayerSnapshot | null | undefined} player
 * @param {CacheDecisionOptions} options
 * @returns {boolean}
 */
function isBrowserSnapshot(player, options) {
  if (player === null || player === undefined) {
    return false;
  }

  const profile = detectPlayerProfile(player, {
    browserPlayerService: options.browserPlayerService ?? 'auto',
  });
  return profile.sourceKind === 'browser';
}

/**
 * @param {PlayerSnapshot} player
 * @param {CacheDecisionOptions} options
 * @returns {boolean}
 */
function isHighConfidenceBrowserSnapshot(player, options) {
  const title = normalizeMaybeText(player.title);
  const artist = normalizeMaybeText(player.artist);
  if (title === null || artist === null) {
    return false;
  }

  if (title.toLowerCase() === 'advertisement') {
    return false;
  }

  if (player.playbackStatus === 'Stopped') {
    return false;
  }

  const profile = detectPlayerProfile(player, {
    browserPlayerService: options.browserPlayerService ?? 'auto',
  });
  if (profile.id === 'apple-music-web' && shouldIgnoreAppleMusicDuration()) {
    return false;
  }

  if (typeof player.durationMs !== 'number' || !Number.isFinite(player.durationMs)) {
    return true;
  }

  return player.durationMs >= 30_000;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeMaybeText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidTrack(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const track = /** @type {Readonly<{ [key: string]: unknown }>} */ (value);
  const trackName = read(track, 'trackName');
  const artistName = read(track, 'artistName');
  const albumName = read(track, 'albumName');
  const durationMs = read(track, 'durationMs');
  return (
    typeof trackName === 'string' &&
    typeof artistName === 'string' &&
    typeof albumName === 'string' &&
    (durationMs === null ||
      (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0))
  );
}

/**
 * @param {Readonly<{ [key: string]: unknown }>} bag
 * @param {string} key
 * @returns {unknown}
 */
function read(bag, key) {
  return Object.hasOwn(bag, key) ? Reflect.get(bag, key) : undefined;
}

/**
 * @param {Readonly<{ [key: string]: unknown }>} bag
 * @param {string} key
 * @returns {number | null}
 */
function readFiniteNumber(bag, key) {
  const value = read(bag, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param {string} input
 * @returns {string}
 */
function hashString(input) {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
