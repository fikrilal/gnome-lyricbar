import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import { mapHttpResultToProviderResult, mapHttpResultToSyncedSearchResult } from './http-result.js';
import { buildLrclibSearchUrl, buildLrclibUrl } from './url.js';

/**
 * @import { LifecycleRegistry } from '../lifecycle.js'
 * @import { RuntimeLogger } from '../logger.js'
 * @import { LyricsProviderResult, LyricsQuery } from '../../domain/lyrics/types.js'
 *
 * @typedef {(result: LyricsProviderResult) => void} LyricsLookupCallback
 */

const DEFAULT_TIMEOUT_MS = 10000;
const USER_AGENT = 'lyricbar/0.1.0 (+https://github.com/fikrilal/gnome-lyricbar)';

export class LrclibProvider {
  /** @type {any} */
  #session;

  /** @type {LifecycleRegistry} */
  #lifecycle;

  /** @type {boolean} */
  #enabled = true;

  /** @type {number} */
  #timeoutMs;

  /** @type {RuntimeLogger | null} */
  #logger = null;

  /**
   * @param {LifecycleRegistry} lifecycle
   * @param {{ session?: any, timeoutMs?: number, logger?: RuntimeLogger | undefined }} [options]
   */
  constructor(lifecycle, options = {}) {
    this.#lifecycle = lifecycle;
    this.#timeoutMs =
      typeof options.timeoutMs === 'number' ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
    this.#logger = options.logger ?? null;

    if (options.session) {
      this.#session = options.session;
    } else {
      this.#session = new Soup.Session({
        user_agent: USER_AGENT,
        timeout: Math.max(1, Math.round(this.#timeoutMs / 1000)),
      });
    }

    this.#lifecycle.add(() => {
      this.#logger?.debug('provider-dispose');
      this.#enabled = false;
      try {
        this.#session?.abort?.();
      } catch {
        // session already cleaned up; ignore
      }
      this.#session = null;
    });
  }

  /**
   * @param {LyricsQuery} query
   * @param {LyricsLookupCallback} callback
   * @returns {void}
   */
  lookup(query, callback) {
    if (!this.#enabled) {
      this.#logger?.debug('lookup-skipped', { reason: 'provider-disabled' });
      callback(Object.freeze({ kind: 'error', reason: 'provider disabled' }));
      return;
    }

    const url = buildLrclibUrl(query);
    if (url === null) {
      this.#logger?.debug('lookup-skipped', { reason: 'invalid-query' });
      callback(Object.freeze({ kind: 'not-found' }));
      return;
    }

    this.#send(url, (httpResult) => {
      const providerResult = mapHttpResultToProviderResult(httpResult);
      this.#logger?.debug('request-result', {
        kind: providerResult.kind,
        statusCode: httpResult.statusCode ?? null,
      });

      if (providerResult.kind === 'synced' || providerResult.kind === 'instrumental') {
        callback(providerResult);
        return;
      }

      if (providerResult.kind !== 'plain' && providerResult.kind !== 'not-found') {
        callback(providerResult);
        return;
      }

      this.#lookupSyncedSearchFallback(query, providerResult, callback);
    });
  }

  /**
   * @param {LyricsQuery} query
   * @param {LyricsProviderResult} fallback
   * @param {LyricsLookupCallback} callback
   * @returns {void}
   */
  #lookupSyncedSearchFallback(query, fallback, callback) {
    const searchUrl = buildLrclibSearchUrl(query);
    if (searchUrl === null) {
      callback(fallback);
      return;
    }

    this.#logger?.debug('search-fallback-start', {
      artist: query.artist,
      title: query.title,
    });

    this.#send(searchUrl, (httpResult) => {
      const searchResult = mapHttpResultToSyncedSearchResult(httpResult, query);
      if (searchResult === null) {
        this.#logger?.debug('search-fallback-result', { kind: 'none' });
        callback(fallback);
        return;
      }

      this.#logger?.debug('search-fallback-result', {
        kind: searchResult.kind,
        title: searchResult.track.trackName,
      });
      callback(searchResult);
    });
  }

  /**
   * @param {string} url
   * @param {(result: import('./http-result.js').HttpResult) => void} callback
   * @returns {void}
   */
  #send(url, callback) {
    const message = Soup.Message.new('GET', url);
    if (message === null) {
      this.#logger?.debug('lookup-skipped', { reason: 'invalid-url' });
      callback(Object.freeze({ statusCode: null, body: null, error: 'invalid lookup url' }));
      return;
    }

    this.#logger?.debug('request-send');

    const cancellable = new Gio.Cancellable();
    this.#lifecycle.addCancellable(() => cancellable);

    const timeoutMs = this.#timeoutMs;
    let timedOut = false;
    const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutMs, () => {
      timedOut = true;
      try {
        cancellable.cancel();
      } catch {
        // already cancelled
      }
      return GLib.SOURCE_REMOVE;
    });
    this.#lifecycle.addSource(
      () => timeoutId,
      (id) => GLib.source_remove(id),
    );

    const headers = message.get_request_headers?.();
    headers?.append?.('User-Agent', USER_AGENT);

    const session = this.#session;
    session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      cancellable,
      /**
       * @param {unknown} _source
       * @param {unknown} result
       * @returns {void}
       */
      (_source, result) => {
        try {
          GLib.source_remove(timeoutId);
        } catch {
          // already removed when timeout fired
        }

        if (!this.#enabled || cancellable.is_cancelled?.() === true) {
          if (timedOut) {
            this.#logger?.debug('request-timeout');
            callback(mapHttpResultToProviderResult({ timedOut: true }));
          }
          return;
        }

        let body;
        try {
          const bytes = session.send_and_read_finish(result);
          body = readBytes(bytes);
        } catch (error) {
          const providerResult = mapHttpResultToProviderResult({
            statusCode: null,
            body: null,
            error: describeError(error),
          });
          callback({
            statusCode: null,
            body: null,
            error: providerResult.kind === 'error' ? providerResult.reason : describeError(error),
          });
          return;
        }

        const statusCode = readStatusCode(message);
        callback({
          statusCode,
          body,
        });
      },
    );
  }
}

/**
 * @param {unknown} bytes
 * @returns {string}
 */
function readBytes(bytes) {
  if (bytes === null || bytes === undefined) {
    return '';
  }
  const candidate = /** @type {{ get_data?: unknown, toArray?: unknown }} */ (bytes);
  if (typeof candidate.get_data === 'function') {
    const raw = /** @type {{ get_data: () => unknown }} */ (candidate).get_data();
    if (raw === null || raw === undefined) {
      return '';
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(/** @type {Uint8Array} */ (raw));
  }
  return String(bytes);
}

/**
 * @param {any} message
 * @returns {number | null}
 */
function readStatusCode(message) {
  if (!message) {
    return null;
  }
  const status = message.get_status?.() ?? message.status_code ?? null;
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function describeError(value) {
  if (value instanceof Error) {
    return value.message;
  }
  return String(value);
}
