import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { displayStateFromLookup } from '../domain/display/lyrics-state.js';
import { displayStateFromPlayer } from '../domain/display/player-state.js';
import { buildIndicatorViewModel } from '../domain/display/view-model.js';
import { selectActivePlayer } from '../domain/mpris/selection.js';
import {
  shouldRefreshPlayerSelection,
  shouldRepositionPanelIndicator,
} from '../domain/settings/change.js';
import { LyricBarIndicator } from '../shell/indicator.js';
import { normalizePanelPosition } from '../domain/settings/normalize.js';
import { LifecycleRegistry } from './lifecycle.js';
import { LyricsCache } from './lyrics/cache.js';
import { LrclibProvider } from './lyrics/lrclib.js';
import { LyricsService } from './lyrics/service.js';
import { MprisService } from './mpris/service.js';
import { PlayerProxy } from './mpris/player.js';
import { SettingsAdapter } from './settings.js';

/**
 * @import { DisplayState } from '../domain/display/types.js'
 * @import { IndicatorViewModel } from '../domain/display/view-model.js'
 * @import { LyricsProviderResult } from '../domain/lyrics/types.js'
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

  /** @type {(() => void) | null} */
  #destroyIndicator = null;

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

  /** @type {LyricsService | null} */
  #lyricsService = null;

  /** @type {PlayerSnapshot | null} */
  #activePlayer = null;

  /** @type {LyricsProviderResult | null} */
  #currentLookup = null;

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
      const previousSettings = this.#currentSettings;
      this.#currentSettings = settings;
      if (previousSettings !== null && shouldRepositionPanelIndicator(previousSettings, settings)) {
        this.#replaceIndicator();
      }
      if (previousSettings !== null && shouldRefreshPlayerSelection(previousSettings, settings)) {
        this.#refreshSelection();
        return;
      }
      this.#refreshDisplay();
    });

    this.#mountIndicator();

    this.#startLyricsService();
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
    this.#lyricsService = null;
    this.#activePlayer = null;
    this.#currentLookup = null;
    this.#displayState = { kind: 'idle' };
    lifecycle?.dispose();
    this.#indicator = null;
    this.#destroyIndicator = null;
  }

  /**
   * @returns {void}
   */
  #replaceIndicator() {
    if (!this.#enabled) {
      return;
    }

    this.#destroyIndicator?.();
    this.#destroyIndicator = null;
    this.#mountIndicator();
  }

  /**
   * @returns {void}
   */
  #mountIndicator() {
    const lifecycle = this.#lifecycle;
    if (lifecycle === null || this.#currentSettings === null) {
      return;
    }

    const indicator = /** @type {IndicatorHandle} */ (new LyricBarIndicator());
    let destroyed = false;
    this.#indicator = indicator;
    this.#destroyIndicator = () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      indicator.destroy();
      if (this.#indicator === indicator) {
        this.#indicator = null;
      }
    };

    this.#render();

    Main.panel.addToStatusArea(
      this.#extension.uuid,
      indicator,
      0,
      normalizePanelPosition(this.#currentSettings.panelPosition),
    );
    lifecycle.add(this.#destroyIndicator);
  }

  /**
   * @returns {void}
   */
  #startLyricsService() {
    const lifecycle = this.#lifecycle;
    if (lifecycle === null) {
      return;
    }

    const provider = new LrclibProvider(lifecycle);
    const cache = new LyricsCache(lifecycle, () => ({
      cacheEnabled: this.#currentSettings?.cacheEnabled ?? true,
    }));

    this.#lyricsService = new LyricsService(lifecycle, provider, cache);
    this.#lyricsService.onLookupChanged((player, lookup) => {
      if (!this.#enabled) {
        return;
      }
      this.#activePlayer = player;
      this.#currentLookup = lookup;
      this.#refreshDisplay();
    });
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

    this.#activePlayer = active;
    if (this.#lyricsService !== null) {
      this.#lyricsService.setActivePlayer(active);
    } else {
      this.#refreshDisplay();
    }
  }

  /**
   * @returns {void}
   */
  #refreshDisplay() {
    if (!this.#enabled) {
      return;
    }

    if (this.#activePlayer === null) {
      this.#displayState = displayStateFromPlayer(null);
    } else if (this.#currentLookup === null) {
      this.#displayState = displayStateFromPlayer(this.#activePlayer);
    } else {
      this.#displayState = displayStateFromLookup(this.#activePlayer, this.#currentLookup);
    }

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
