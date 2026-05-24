import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { applyNameOwnerChange, filterMprisNames } from './discovery.js';

/**
 * @import { LifecycleRegistry } from '../lifecycle.js'
 * @import { RuntimeLogger } from '../logger.js'
 * @import { NameOwnerChange } from './discovery.js'
 *
 * @typedef {(names: readonly string[]) => void} PlayersChangedCallback
 */

const DBUS_NAME = 'org.freedesktop.DBus';
const DBUS_PATH = '/org/freedesktop/DBus';
const DBUS_IFACE = 'org.freedesktop.DBus';

export class MprisService {
  /** @type {any} */
  #connection;

  /** @type {LifecycleRegistry} */
  #lifecycle;

  /** @type {boolean} */
  #enabled = false;

  /** @type {Set<string>} */
  #names = new Set();

  /** @type {Set<PlayersChangedCallback>} */
  #listeners = new Set();

  /** @type {any} */
  #cancellable = null;

  /** @type {RuntimeLogger | null} */
  #logger = null;

  /** @type {number} */
  #signalId = 0;

  /**
   * @param {any} connection
   * @param {LifecycleRegistry} lifecycle
   * @param {{ logger?: RuntimeLogger | undefined }} [options]
   */
  constructor(connection, lifecycle, options = {}) {
    this.#connection = connection;
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
   * @returns {void}
   */
  start() {
    if (this.#enabled) {
      return;
    }
    this.#enabled = true;
    this.#logger?.debug('service-start');

    this.#cancellable = new Gio.Cancellable();
    this.#lifecycle.addCancellable(() => this.#cancellable);

    this.#signalId = this.#connection.signal_subscribe(
      DBUS_NAME,
      DBUS_IFACE,
      'NameOwnerChanged',
      DBUS_PATH,
      null,
      Gio.DBusSignalFlags.NONE,
      /**
       * @param {unknown} _connection
       * @param {unknown} _sender
       * @param {unknown} _path
       * @param {unknown} _iface
       * @param {unknown} _signal
       * @param {unknown} parameters
       * @returns {void}
       */
      (_connection, _sender, _path, _iface, _signal, parameters) => {
        if (!this.#enabled) {
          return;
        }
        const change = readNameOwnerChange(parameters);
        if (change === null) {
          return;
        }
        this.#applyChange(change);
      },
    );
    this.#lifecycle.add(() => {
      this.#logger?.debug('service-dispose');
      this.#enabled = false;
      this.#connection.signal_unsubscribe(this.#signalId);
    });

    this.#connection.call(
      DBUS_NAME,
      DBUS_PATH,
      DBUS_IFACE,
      'ListNames',
      null,
      new GLib.VariantType('(as)'),
      Gio.DBusCallFlags.NONE,
      -1,
      this.#cancellable,
      /**
       * @param {unknown} _source
       * @param {unknown} result
       * @returns {void}
       */
      (_source, result) => {
        if (!this.#enabled) {
          return;
        }
        try {
          const reply = this.#connection.call_finish(result);
          const unpacked = reply?.deep_unpack?.();
          const names = Array.isArray(unpacked) ? unpacked[0] : null;
          if (Array.isArray(names)) {
            this.#logger?.debug('list-names-result', { count: names.length });
            this.#applyInitialNames(names);
          }
        } catch (error) {
          if (!isCancelledError(error)) {
            console.error('LyricBar: ListNames failed', error);
          }
        }
      },
    );
  }

  /**
   * @param {PlayersChangedCallback} callback
   * @returns {void}
   */
  onPlayersChanged(callback) {
    this.#listeners.add(callback);
    this.#lifecycle.add(() => {
      this.#listeners.delete(callback);
    });
    callback(this.#snapshot());
  }

  /**
   * @returns {readonly string[]}
   */
  snapshot() {
    return this.#snapshot();
  }

  /**
   * @param {readonly unknown[]} names
   * @returns {void}
   */
  #applyInitialNames(names) {
    const filtered = filterMprisNames(names);
    this.#logger?.debug('initial-players-filtered', { count: filtered.length });
    let changed = false;
    for (const name of filtered) {
      if (!this.#names.has(name)) {
        this.#names.add(name);
        changed = true;
      }
    }
    if (changed) {
      this.#emit();
    }
  }

  /**
   * @param {NameOwnerChange} change
   * @returns {void}
   */
  #applyChange(change) {
    const next = applyNameOwnerChange(this.#names, change);
    if (next === null) {
      return;
    }
    this.#logger?.debug('player-owner-changed', { name: change.name });
    this.#names = next;
    this.#emit();
  }

  /**
   * @returns {readonly string[]}
   */
  #snapshot() {
    return [...this.#names].sort((left, right) => left.localeCompare(right));
  }

  /**
   * @returns {void}
   */
  #emit() {
    const snapshot = this.#snapshot();
    this.#logger?.debug('players-changed', { count: snapshot.length });
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }
}

/**
 * @param {any} parameters
 * @returns {NameOwnerChange | null}
 */
function readNameOwnerChange(parameters) {
  if (parameters === null || typeof parameters !== 'object') {
    return null;
  }
  if (typeof parameters.deep_unpack !== 'function') {
    return null;
  }

  const unpacked = parameters.deep_unpack();
  if (!Array.isArray(unpacked) || unpacked.length < 3) {
    return null;
  }

  const [name, oldOwner, newOwner] = unpacked;
  if (typeof name !== 'string' || typeof newOwner !== 'string') {
    return null;
  }

  return {
    name,
    oldOwner: typeof oldOwner === 'string' ? oldOwner : '',
    newOwner,
  };
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
    return candidate.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED) === true;
  } catch {
    return false;
  }
}
