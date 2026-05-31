import { normalizePlayerSnapshot } from '../../domain/mpris/normalize.js';

/**
 * @import { PlayerSnapshot } from '../../domain/mpris/types.js'
 *
 * @typedef {Readonly<{ [key: string]: unknown }>} PropertyBag
 */

const KEY_METADATA = 'Metadata';
const KEY_PLAYBACK_STATUS = 'PlaybackStatus';
const KEY_TITLE = 'xesam:title';
const KEY_ARTIST = 'xesam:artist';
const KEY_ALBUM = 'xesam:album';
const KEY_LENGTH = 'mpris:length';
const KEY_TRACK_ID = 'mpris:trackid';
const KEY_URL = 'xesam:url';

/**
 * @param {string} busName
 * @param {PropertyBag | null | undefined} properties
 * @returns {PlayerSnapshot | null}
 */
export function mapMprisProperties(busName, properties) {
  const bag = readPropertyBag(properties);
  const metadata = readMetadata(get(bag, KEY_METADATA));

  return normalizePlayerSnapshot({
    busName,
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    durationMs: metadata.durationMs,
    trackId: metadata.trackId,
    url: metadata.url,
    playbackStatus: get(bag, KEY_PLAYBACK_STATUS),
  });
}

/**
 * @param {PlayerSnapshot} snapshot
 * @param {PropertyBag | null | undefined} changes
 * @returns {PlayerSnapshot | null}
 */
export function applyPropertyChanges(snapshot, changes) {
  if (changes === null || changes === undefined) {
    return snapshot;
  }
  const bag = readPropertyBag(changes);

  /**
   * @type {{
   *   busName: string,
   *   title: unknown,
   *   artist: unknown,
   *   album: unknown,
   *   durationMs: unknown,
   *   trackId: unknown,
   *   url: unknown,
   *   playbackStatus: unknown,
   * }}
   */
  const merged = {
    busName: snapshot.busName,
    title: snapshot.title,
    artist: snapshot.artist,
    album: snapshot.album,
    durationMs: snapshot.durationMs,
    trackId: snapshot.trackId,
    url: snapshot.url,
    playbackStatus: snapshot.playbackStatus,
  };

  if (Object.hasOwn(bag, KEY_METADATA)) {
    const metadata = readMetadata(get(bag, KEY_METADATA));
    merged.title = metadata.title ?? snapshot.title;
    merged.artist = metadata.artist ?? snapshot.artist;
    merged.album = metadata.album ?? snapshot.album;
    merged.durationMs = metadata.durationMs ?? snapshot.durationMs;
    merged.trackId = metadata.trackId ?? snapshot.trackId;
    merged.url = metadata.url ?? snapshot.url;
  }

  if (Object.hasOwn(bag, KEY_PLAYBACK_STATUS)) {
    merged.playbackStatus = get(bag, KEY_PLAYBACK_STATUS);
  }

  return normalizePlayerSnapshot(merged);
}

/**
 * @param {PlayerSnapshot | null} a
 * @param {PlayerSnapshot | null} b
 * @returns {boolean}
 */
export function snapshotsEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }

  return (
    a.busName === b.busName &&
    a.title === b.title &&
    a.artist === b.artist &&
    a.album === b.album &&
    a.durationMs === b.durationMs &&
    a.trackId === b.trackId &&
    a.url === b.url &&
    a.playbackStatus === b.playbackStatus
  );
}

/**
 * @param {unknown} value
 * @returns {{
 *   title: unknown,
 *   artist: unknown,
 *   album: unknown,
 *   durationMs: unknown,
 *   trackId: unknown,
 *   url: unknown,
 * }}
 */
function readMetadata(value) {
  const bag = readPropertyBag(value);

  return {
    title: get(bag, KEY_TITLE),
    artist: readArtist(get(bag, KEY_ARTIST)),
    album: get(bag, KEY_ALBUM),
    durationMs: microsecondsToMilliseconds(get(bag, KEY_LENGTH)),
    trackId: get(bag, KEY_TRACK_ID),
    url: get(bag, KEY_URL),
  };
}

/**
 * @param {unknown} value
 * @returns {PropertyBag}
 */
function readPropertyBag(value) {
  const unpacked = unpackVariantTree(value);
  return isPropertyBag(unpacked) ? unpacked : {};
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function readArtist(value) {
  if (Array.isArray(value)) {
    const strings = value.filter((item) => typeof item === 'string').map((item) => item.trim());
    const nonEmpty = strings.filter((item) => item !== '');
    if (nonEmpty.length === 0) {
      return null;
    }
    return nonEmpty.join(', ');
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function microsecondsToMilliseconds(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value / 1000);
}

/**
 * @param {PropertyBag} bag
 * @param {string} key
 * @returns {unknown}
 */
function get(bag, key) {
  return Object.hasOwn(bag, key) ? unpackVariantTree(Reflect.get(bag, key)) : undefined;
}

/**
 * @param {unknown} value
 * @returns {value is PropertyBag}
 */
function isPropertyBag(value) {
  return typeof value === 'object' && value !== null;
}

/**
 * GVariant dictionaries returned by D-Bus can contain nested Variant values,
 * especially for `a{sv}` replies from org.freedesktop.DBus.Properties.GetAll.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function unpackVariantTree(value) {
  if (value === null || value === undefined) {
    return value;
  }

  const maybeVariant = /** @type {{ deep_unpack?: unknown }} */ (value);
  if (typeof maybeVariant.deep_unpack === 'function') {
    return unpackVariantTree(
      /** @type {{ deep_unpack: () => unknown }} */ (maybeVariant).deep_unpack(),
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => unpackVariantTree(item));
  }

  if (typeof value !== 'object') {
    return value;
  }

  /** @type {{ [key: string]: unknown }} */
  const result = {};
  for (const [key, entryValue] of Object.entries(value)) {
    result[key] = unpackVariantTree(entryValue);
  }
  return result;
}
