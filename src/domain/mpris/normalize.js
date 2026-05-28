const MPRIS_BUS_PREFIX = 'org.mpris.MediaPlayer2.';
const PLAYBACK_STATUSES = new Set(['Playing', 'Paused', 'Stopped']);

/**
 * @import { PlaybackStatus, PlayerSnapshot } from './types.js'
 *
 * @typedef {Readonly<{
 *   busName?: unknown,
 *   title?: unknown,
 *   artist?: unknown,
 *   album?: unknown,
 *   durationMs?: unknown,
 *   trackId?: unknown,
 *   url?: unknown,
 *   playbackStatus?: unknown,
 * }>} RawSnapshot
 */

/**
 * @param {unknown} raw
 * @returns {PlayerSnapshot | null}
 */
export function normalizePlayerSnapshot(raw) {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }

  const candidate = /** @type {RawSnapshot} */ (raw);
  const busName = normalizeBusName(candidate.busName);
  if (busName === null) {
    return null;
  }

  return {
    busName,
    title: normalizeText(candidate.title),
    artist: normalizeText(candidate.artist),
    album: normalizeText(candidate.album),
    durationMs: normalizeDurationMs(candidate.durationMs),
    trackId: normalizeTrackId(candidate.trackId),
    url: normalizeUrl(candidate.url),
    playbackStatus: normalizePlaybackStatus(candidate.playbackStatus),
  };
}

/**
 * @param {readonly unknown[] | null | undefined} entries
 * @returns {PlayerSnapshot[]}
 */
export function normalizePlayerSnapshots(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  /** @type {PlayerSnapshot[]} */
  const snapshots = [];
  for (const entry of entries) {
    const snapshot = normalizePlayerSnapshot(entry);
    if (snapshot !== null) {
      snapshots.push(snapshot);
    }
  }

  return snapshots;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeBusName(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith(MPRIS_BUS_PREFIX) || trimmed.length === MPRIS_BUS_PREFIX.length) {
    return null;
  }

  return trimmed;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function normalizeDurationMs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeTrackId(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeUrl(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * @param {unknown} value
 * @returns {PlaybackStatus}
 */
function normalizePlaybackStatus(value) {
  if (typeof value === 'string' && PLAYBACK_STATUSES.has(value)) {
    return /** @type {PlaybackStatus} */ (value);
  }

  return 'Stopped';
}
