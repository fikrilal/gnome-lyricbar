import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {
  buildCacheEntry,
  buildCacheFileName,
  parseCacheEntry,
} from '../../domain/lyrics/cache-policy.js';

/**
 * @import { LifecycleRegistry } from '../lifecycle.js'
 * @import { LyricsProviderResult, LyricsQuery } from '../../domain/lyrics/types.js'
 *
 * @typedef {(result: LyricsProviderResult | null) => void} LyricsCacheGetCallback
 *
 * @typedef {Readonly<{
 *   cacheEnabled: boolean,
 * }>} CacheSettingsView
 */

const CACHE_DIR_NAME = 'lyricbar';
const CACHE_SUBDIR_NAME = 'cache-v1';

export class LyricsCache {
  /** @type {LifecycleRegistry} */
  #lifecycle;

  /** @type {() => CacheSettingsView} */
  #readSettings;

  /** @type {string | null} */
  #cacheDirPath = null;

  /** @type {boolean} */
  #directoryReady = false;

  /** @type {boolean} */
  #directoryFailed = false;

  /** @type {boolean} */
  #enabled = true;

  /**
   * @param {LifecycleRegistry} lifecycle
   * @param {() => CacheSettingsView} readSettings
   */
  constructor(lifecycle, readSettings) {
    this.#lifecycle = lifecycle;
    this.#readSettings = readSettings;

    this.#lifecycle.add(() => {
      this.#enabled = false;
    });
  }

  /**
   * @param {LyricsQuery} query
   * @param {LyricsCacheGetCallback} callback
   * @returns {void}
   */
  get(query, callback) {
    if (!this.#enabled || !this.#readSettings().cacheEnabled) {
      callback(null);
      return;
    }

    const file = this.#fileForQuery(query);
    if (file === null) {
      callback(null);
      return;
    }

    const cancellable = new Gio.Cancellable();
    this.#lifecycle.addCancellable(() => cancellable);

    file.load_contents_async(
      cancellable,
      /**
       * @param {unknown} _source
       * @param {unknown} result
       * @returns {void}
       */
      (_source, result) => {
        if (!this.#enabled || cancellable.is_cancelled?.() === true) {
          callback(null);
          return;
        }

        let parsed;
        try {
          const [ok, contents] = file.load_contents_finish(result);
          if (!ok) {
            callback(null);
            return;
          }
          parsed = JSON.parse(decodeBytes(contents));
        } catch {
          callback(null);
          return;
        }

        callback(parseCacheEntry(parsed, Date.now()));
      },
    );
  }

  /**
   * @param {LyricsQuery} query
   * @param {LyricsProviderResult} result
   * @returns {void}
   */
  put(query, result) {
    if (!this.#enabled || !this.#readSettings().cacheEnabled) {
      return;
    }

    const file = this.#fileForQuery(query);
    if (file === null) {
      return;
    }

    const entry = buildCacheEntry(result, Date.now());
    let payload;
    try {
      payload = JSON.stringify(entry);
    } catch {
      return;
    }

    const cancellable = new Gio.Cancellable();
    this.#lifecycle.addCancellable(() => cancellable);

    const tempPath = `${file.get_path()}.tmp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const tempFile = Gio.File.new_for_path(tempPath);

    tempFile.replace_contents_bytes_async(
      encodeUtf8(payload),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      cancellable,
      /**
       * @param {unknown} _source
       * @param {unknown} writeResult
       * @returns {void}
       */
      (_source, writeResult) => {
        if (!this.#enabled || cancellable.is_cancelled?.() === true) {
          return;
        }

        try {
          tempFile.replace_contents_finish(writeResult);
          tempFile.move(file, Gio.FileCopyFlags.OVERWRITE, null, null);
        } catch {
          try {
            tempFile.delete(null);
          } catch {
            // best-effort cleanup; nothing to do
          }
        }
      },
    );
  }

  /**
   * @param {() => void} [callback]
   * @returns {void}
   */
  clear(callback) {
    const dir = this.#cacheDir();
    if (dir === null) {
      callback?.();
      return;
    }

    const cancellable = new Gio.Cancellable();
    this.#lifecycle.addCancellable(() => cancellable);

    let enumerator;
    try {
      enumerator = dir.enumerate_children(
        'standard::name,standard::type',
        Gio.FileQueryInfoFlags.NONE,
        cancellable,
      );
    } catch {
      callback?.();
      return;
    }

    let info;
    try {
      while ((info = enumerator.next_file(cancellable)) !== null) {
        const name = info.get_name?.();
        if (typeof name !== 'string') {
          continue;
        }
        const child = dir.get_child(name);
        try {
          child.delete(null);
        } catch {
          // best-effort; ignore individual failures
        }
      }
    } catch {
      // ignore enumerator errors; we did our best
    } finally {
      try {
        enumerator.close(null);
      } catch {
        // ignore
      }
    }

    callback?.();
  }

  /**
   * @param {LyricsQuery} query
   * @returns {any}
   */
  #fileForQuery(query) {
    const dir = this.#cacheDir();
    if (dir === null) {
      return null;
    }
    const fileName = buildCacheFileName(query);
    return dir.get_child(fileName);
  }

  /**
   * @returns {any}
   */
  #cacheDir() {
    if (this.#directoryFailed) {
      return null;
    }

    if (this.#cacheDirPath === null) {
      const userCacheDir = GLib.get_user_cache_dir();
      if (typeof userCacheDir !== 'string' || userCacheDir === '') {
        this.#directoryFailed = true;
        return null;
      }
      this.#cacheDirPath = GLib.build_filenamev([userCacheDir, CACHE_DIR_NAME, CACHE_SUBDIR_NAME]);
    }

    const dir = Gio.File.new_for_path(this.#cacheDirPath);
    if (!this.#directoryReady) {
      try {
        dir.make_directory_with_parents(null);
      } catch (error) {
        if (!isAlreadyExistsError(error)) {
          this.#directoryFailed = true;
          return null;
        }
      }
      this.#directoryReady = true;
    }
    return dir;
  }
}

/**
 * @param {unknown} bytes
 * @returns {string}
 */
function decodeBytes(bytes) {
  if (bytes === null || bytes === undefined) {
    return '';
  }
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(/** @type {Uint8Array} */ (bytes));
}

/**
 * @param {string} value
 * @returns {any}
 */
function encodeUtf8(value) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  return GLib.Bytes.new(bytes);
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isAlreadyExistsError(error) {
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const candidate = /** @type {{ matches?: unknown }} */ (error);
  if (typeof candidate.matches !== 'function') {
    return false;
  }
  try {
    return (
      /** @type {{ matches: (domain: unknown, code: unknown) => boolean }} */ (candidate).matches(
        Gio.IOErrorEnum,
        Gio.IOErrorEnum.EXISTS,
      ) === true
    );
  } catch {
    return false;
  }
}
