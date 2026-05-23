import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { displayStateFromPlayer } from '../domain/display/player-state.js';
import { buildIndicatorViewModel } from '../domain/display/view-model.js';
import { selectActivePlayer } from '../domain/mpris/selection.js';
import { LyricBarIndicator } from '../shell/indicator.js';
import { normalizePanelPosition } from '../domain/settings/normalize.js';
import { LifecycleRegistry } from './lifecycle.js';
import { MprisService } from './mpris/service.js';
import { PlayerProxy } from './mpris/player.js';
import { SettingsAdapter } from './settings.js';

/**
 * @import { DisplayState } from '../domain/display/types.js'
 * @import { IndicatorViewModel } from '../domain/display/view-model.js'
 * @import { PlayerSnapshot } from '../domain/mpris/types.js'
 * @import { LyricBarSettings } from '../domain/settings/types.js'
 * @import { GSettingsBackend } from './settings.js'
 *
 * @typedef {Readonly<{
 *   uuid: string,
 *   getSettings(): GSettingsBackend,
 * }>} ExtensionHandle
 *
 * @typedef {Readonly<{
 *   render(viewModel: IndicatorViewModel): void,
 *   destroy(): void,
 * }>} IndicatorHandle
 *
 * @typedef {{
 *   proxy: PlayerProxy,
 *   lifecycle: LifecycleRegistry,
 * }} TrackedProxy
 */

export class LyricBarController {
  /** @type {ExtensionHandle} */
  #extension;

  /** @type {IndicatorHandle | null} */
  #indicator = null;

  /** @type {LifecycleRegistry | null} */
  #lifecycle = null;

  /** @type {SettingsAdapter | null} */
  #settings = null;

  /** @type {LyricBarSettings | null} */
  #currentSettings = null;

  /** @type {DisplayState} */
  #displayState = { kind: 'idle' };

  /** @type {boolean} */
  #enabled = false;

  /** @type {any} */
  #connection = null;

  /** @type {MprisService | null} */
  #mprisService = null;

  /** @type {Map<string, TrackedProxy>} */
  #proxies = new Map();

  /** @type {string | null} */
  #lastSelectedBusName = null;

  /**
   * @param {ExtensionHandle} extension
   */
  constructor(extension) {
    this.#extension = extension;
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
  enable() {
    if (this.#enabled) {
      return;
    }

    this.#enabled = true;
    this.#lifecycle = new LifecycleRegistry();
    this.#settings = new SettingsAdapter(this.#extension.getSettings(), this.#lifecycle);
    this.#currentSettings = this.#settings.read();
    this.#settings.subscribe((settings) => {
      this.#currentSettings = settings;
      this.#render();
    });

    this.#indicator = /** @type {IndicatorHandle} */ (new LyricBarIndicator());
    const indicator = this.#indicator;
    this.#render();

    Main.panel.addToStatusArea(
      this.#extension.uuid,
      indicator,
      0,
      normalizePanelPosition(this.#currentSettings.panelPosition),
    );
    this.#lifecycle.add(() => {
      indicator.destroy();
    });

    this.#startMprisDiscovery();
  }

  /**
   * @returns {void}
   */
  disable() {
    if (!this.#enabled) {
      return;
    }

    this.#enabled = false;
    const lifecycle = this.#lifecycle;
    this.#lifecycle = null;
    this.#settings = null;
    this.#currentSettings = null;
    this.#mprisService = null;
    this.#connection = null;
    this.#proxies.clear();
    this.#lastSelectedBusName = null;
    this.#displayState = { kind: 'idle' };
    lifecycle?.dispose();
    this.#indicator = null;
  }

  /**
   * @returns {void}
   */
  #startMprisDiscovery() {
    const lifecycle = this.#lifecycle;
    if (lifecycle === null) {
      return;
    }

    this.#connection = Gio.DBus.session;
    this.#mprisService = new MprisService(this.#connection, lifecycle);
    this.#mprisService.onPlayersChanged((names) => {
      this.#syncPlayers(names);
    });
    this.#mprisService.start();
  }

  /**
   * @param {readonly string[]} names
   * @returns {void}
   */
  #syncPlayers(names) {
    if (!this.#enabled || this.#lifecycle === null || this.#connection === null) {
      return;
    }

    const next = new Set(names);
    for (const [busName, tracked] of this.#proxies) {
      if (!next.has(busName)) {
        tracked.lifecycle.dispose();
        this.#proxies.delete(busName);
      }
    }

    for (const busName of names) {
      if (this.#proxies.has(busName)) {
        continue;
      }
      this.#registerProxy(busName);
    }

    this.#refreshSelection();
  }

  /**
   * @param {string} busName
   * @returns {void}
   */
  #registerProxy(busName) {
    const parent = this.#lifecycle;
    if (parent === null || this.#connection === null) {
      return;
    }

    const child = new LifecycleRegistry();
    parent.add(child);

    const proxy = new PlayerProxy(this.#connection, busName, child);
    proxy.onSnapshot(() => {
      this.#refreshSelection();
    });
    this.#proxies.set(busName, { proxy, lifecycle: child });
    proxy.start();
  }

  /**
   * @returns {void}
   */
  #refreshSelection() {
    if (!this.#enabled || this.#currentSettings === null) {
      return;
    }

    /** @type {PlayerSnapshot[]} */
    const snapshots = [];
    for (const tracked of this.#proxies.values()) {
      const snapshot = tracked.proxy.snapshot();
      if (snapshot !== null) {
        snapshots.push(snapshot);
      }
    }

    const active = selectActivePlayer(
      snapshots,
      this.#lastSelectedBusName,
      this.#currentSettings.playerPriority,
    );

    if (active !== null) {
      this.#lastSelectedBusName = active.busName;
    }

    this.#displayState = displayStateFromPlayer(active);
    this.#render();
  }

  /**
   * @returns {void}
   */
  #render() {
    if (!this.#indicator || !this.#currentSettings) {
      return;
    }

    this.#indicator.render(buildIndicatorViewModel(this.#displayState, this.#currentSettings));
  }
}
