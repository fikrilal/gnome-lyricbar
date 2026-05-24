import Gio from 'gi://Gio';

import { applyPropertyChanges, mapMprisProperties, snapshotsEqual } from './player-mapping.js';

/**
 * @import { LifecycleRegistry } from '../lifecycle.js'
 * @import { RuntimeLogger } from '../logger.js'
 * @import { PlayerSnapshot } from '../../domain/mpris/types.js'
 *
 * @typedef {(snapshot: PlayerSnapshot | null) => void} PlayerSnapshotCallback
 */

const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';
const PLAYER_PATH = '/org/mpris/MediaPlayer2';

export class PlayerProxy {
  /** @type {any} */
  #connection;

  /** @type {string} */
  #busName;

  /** @type {LifecycleRegistry} */
  #lifecycle;

  /** @type {boolean} */
  #enabled = false;

  /** @type {boolean} */
  #gone = false;

  /** @type {any} */
  #cancellable = null;

  /** @type {RuntimeLogger | null} */
  #logger = null;

  /** @type {any} */
  #proxy = null;

  /** @type {number} */
  #propertiesSignalId = 0;

  /** @type {PlayerSnapshot | null} */
  #snapshot = null;

  /** @type {Set<PlayerSnapshotCallback>} */
  #listeners = new Set();

  /**
   * @param {any} connection
   * @param {string} busName
   * @param {LifecycleRegistry} lifecycle
   * @param {{ logger?: RuntimeLogger | undefined }} [options]
   */
  constructor(connection, busName, lifecycle, options = {}) {
    this.#connection = connection;
    this.#busName = busName;
    this.#lifecycle = lifecycle;
    this.#logger = options.logger ?? null;
  }

  /**
   * @returns {boolean}
   */
  get enabled() {
    return this.#enabled;
  }

  /**
   * @returns {string}
   */
  get busName() {
    return this.#busName;
  }

  /**
   * @returns {PlayerSnapshot | null}
   */
  snapshot() {
    return this.#snapshot;
  }

  /**
   * @returns {void}
   */
  start() {
    if (this.#enabled) {
      return;
    }
    this.#enabled = true;
    this.#logger?.debug('proxy-start', { busName: this.#busName });

    this.#cancellable = new Gio.Cancellable();
    this.#lifecycle.addCancellable(() => this.#cancellable);
    this.#lifecycle.add(() => {
      this.#logger?.debug('proxy-dispose', { busName: this.#busName });
      this.#enabled = false;
      this.#disconnectPropertiesSignal();
      this.#proxy = null;
    });

    Gio.DBusProxy.new(
      this.#connection,
      Gio.DBusProxyFlags.NONE,
      null,
      this.#busName,
      PLAYER_PATH,
      PLAYER_IFACE,
      this.#cancellable,
      /**
       * @param {unknown} _source
       * @param {unknown} result
       * @returns {void}
       */
      (_source, result) => {
        if (!this.#enabled || this.#gone) {
          return;
        }
        try {
          this.#proxy = Gio.DBusProxy.new_finish(result);
          this.#logger?.debug('proxy-ready', { busName: this.#busName });
          this.#bindProxy(this.#proxy);
        } catch (error) {
          if (!isCancelledError(error)) {
            this.#emitGone();
            console.error(`LyricBar: failed to create MPRIS proxy for ${this.#busName}`, error);
          }
        }
      },
    );
  }

  /**
   * @param {PlayerSnapshotCallback} callback
   * @returns {void}
   */
  onSnapshot(callback) {
    this.#listeners.add(callback);
    this.#lifecycle.add(() => {
      this.#listeners.delete(callback);
    });
    callback(this.#snapshot);
  }

  /**
   * @param {any} proxy
   * @returns {void}
   */
  #bindProxy(proxy) {
    const initial = readCachedProperties(proxy);
    const snapshot = mapMprisProperties(this.#busName, initial);
    this.#updateSnapshot(snapshot);

    this.#propertiesSignalId = proxy.connect(
      'g-properties-changed',
      /**
       * @param {unknown} _proxy
       * @param {unknown} changedProperties
       * @returns {void}
       */
      (_proxy, changedProperties) => {
        if (!this.#enabled || this.#gone) {
          return;
        }
        const changes = unpackChangedProperties(changedProperties);
        if (changes === null) {
          return;
        }
        this.#applyChanges(changes);
      },
    );
    this.#lifecycle.addSignal(
      () => this.#proxy,
      () => this.#propertiesSignalId,
    );
  }

  /**
   * @param {{ [key: string]: unknown }} changes
   * @returns {void}
   */
  #applyChanges(changes) {
    if (this.#snapshot === null) {
      const next = mapMprisProperties(this.#busName, changes);
      this.#updateSnapshot(next);
      return;
    }

    const next = applyPropertyChanges(this.#snapshot, changes);
    this.#updateSnapshot(next);
  }

  /**
   * @param {PlayerSnapshot | null} next
   * @returns {void}
   */
  #updateSnapshot(next) {
    if (snapshotsEqual(this.#snapshot, next)) {
      return;
    }
    this.#snapshot = next;
    this.#logger?.debug('snapshot-changed', {
      busName: this.#busName,
      title: next?.title ?? null,
    });
    for (const listener of this.#listeners) {
      listener(next);
    }
  }

  /**
   * @returns {void}
   */
  #emitGone() {
    if (this.#gone) {
      return;
    }
    this.#gone = true;
    this.#disconnectPropertiesSignal();
    this.#updateSnapshot(null);
  }

  /**
   * @returns {void}
   */
  #disconnectPropertiesSignal() {
    if (this.#proxy && this.#propertiesSignalId !== 0) {
      try {
        this.#proxy.disconnect(this.#propertiesSignalId);
      } catch {
        // proxy already gone, nothing to clean up
      }
      this.#propertiesSignalId = 0;
    }
  }
}

/**
 * @param {any} proxy
 * @returns {{ [key: string]: unknown }}
 */
function readCachedProperties(proxy) {
  /** @type {{ [key: string]: unknown }} */
  const result = {};
  if (!proxy || typeof proxy.get_cached_property_names !== 'function') {
    return result;
  }

  const names = proxy.get_cached_property_names();
  if (!Array.isArray(names)) {
    return result;
  }

  for (const name of names) {
    if (typeof name !== 'string') {
      continue;
    }
    const value = proxy.get_cached_property?.(name);
    if (value === null || value === undefined) {
      continue;
    }
    result[name] = typeof value.deep_unpack === 'function' ? value.deep_unpack() : value;
  }
  return result;
}

/**
 * @param {unknown} variant
 * @returns {{ [key: string]: unknown } | null}
 */
function unpackChangedProperties(variant) {
  if (variant === null || variant === undefined) {
    return null;
  }
  const candidate = /** @type {{ deep_unpack?: unknown }} */ (variant);
  if (typeof candidate.deep_unpack !== 'function') {
    return null;
  }
  const unpacked = /** @type {{ deep_unpack: () => unknown }} */ (candidate).deep_unpack();
  if (unpacked === null || typeof unpacked !== 'object') {
    return null;
  }
  return /** @type {{ [key: string]: unknown }} */ (unpacked);
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isCancelledError(error) {
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
        Gio.IOErrorEnum.CANCELLED,
      ) === true
    );
  } catch {
    return false;
  }
}
