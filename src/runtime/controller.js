import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
  displayStateFromLookup,
  displayStateFromSyncedPosition,
} from '../domain/display/lyrics-state.js';
import { displayStateFromPlayer } from '../domain/display/player-state.js';
import { shouldPollSyncedLyrics } from '../domain/display/sync-polling.js';
import { buildIndicatorViewModel } from '../domain/display/view-model.js';
import { selectActivePlayer } from '../domain/mpris/selection.js';
import {
  shouldRefreshPlayerSelection,
  shouldRepositionPanelIndicator,
} from '../domain/settings/change.js';
import { LyricBarIndicator, LyricBarSettingsIndicator } from '../shell/indicator.js';
import { normalizePanelPosition } from '../domain/settings/normalize.js';
import { LifecycleRegistry } from './lifecycle.js';
import { LyricsCache } from './lyrics/cache.js';
import { LrclibProvider } from './lyrics/lrclib.js';
import { LyricsService } from './lyrics/service.js';
import { RuntimeLogger } from './logger.js';
import { MprisService } from './mpris/service.js';
import { PlayerProxy } from './mpris/player.js';
import { StablePlayerProxy } from './mpris/stable-player.js';
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
 *   openPreferences(): void,
 * }>} ExtensionHandle
 *
 * @typedef {Readonly<{
 *   render(viewModel: IndicatorViewModel): void,
 *   destroy(): void,
 * }>} IndicatorHandle
 *
 * @typedef {{
 *   proxy: StablePlayerProxy,
 *   lifecycle: LifecycleRegistry,
 * }} TrackedProxy
 */

const POSITION_POLL_INTERVAL_MS = 500;

export class LyricBarController {
  /** @type {ExtensionHandle} */
  #extension;

  /** @type {IndicatorHandle | null} */
  #indicator = null;

  /** @type {(() => void) | null} */
  #destroyIndicator = null;

  /** @type {any | null} */
  #settingsIndicator = null;

  /** @type {(() => void) | null} */
  #destroySettingsIndicator = null;

  /** @type {LifecycleRegistry | null} */
  #lifecycle = null;

  /** @type {SettingsAdapter | null} */
  #settings = null;

  /** @type {RuntimeLogger | null} */
  #logger = null;

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

  /** @type {number} */
  #syncSourceId = 0;

  /** @type {string | null} */
  #lastSyncedLine = null;

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
    this.#lifecycle.addSource(
      () => this.#syncSourceId,
      (id) => GLib.source_remove(id),
    );
    this.#settings = new SettingsAdapter(this.#extension.getSettings(), this.#lifecycle);
    this.#currentSettings = this.#settings.read();
    this.#logger = new RuntimeLogger(
      'LyricBar',
      () => this.#currentSettings?.debugLogging === true,
    );
    this.#logger.debug('controller-enable', { uuid: this.#extension.uuid });
    this.#settings.subscribe((settings) => {
      const previousSettings = this.#currentSettings;
      this.#currentSettings = settings;
      this.#logger?.debug('settings-changed', {
        browserPlayerService: settings.browserPlayerService,
        debugLogging: settings.debugLogging,
        maxWidth: settings.maxWidth,
        panelPosition: settings.panelPosition,
      });
      if (previousSettings !== null && shouldRepositionPanelIndicator(previousSettings, settings)) {
        this.#logger?.debug('indicator-reposition-requested', {
          from: previousSettings.panelPosition,
          to: settings.panelPosition,
        });
        this.#replaceIndicator();
      }
      if (previousSettings !== null && shouldRefreshPlayerSelection(previousSettings, settings)) {
        this.#refreshSelection();
        return;
      }
      this.#refreshDisplay();
    });

    this.#mountIndicator();
    this.#mountSettingsIndicator();

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
    this.#logger?.debug('controller-disable');
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
    this.#stopSyncLoop();
    this.#displayState = { kind: 'idle' };
    lifecycle?.dispose();
    this.#indicator = null;
    this.#destroyIndicator = null;
    this.#settingsIndicator = null;
    this.#destroySettingsIndicator = null;
    this.#logger = null;
  }

  /**
   * @returns {void}
   */
  #replaceIndicator() {
    if (!this.#enabled) {
      return;
    }

    this.#logger?.debug('indicator-replace');
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

    Main.panel.addToStatusArea(
      this.#extension.uuid,
      indicator,
      0,
      normalizePanelPosition(this.#currentSettings.panelPosition),
    );
    this.#logger?.debug('indicator-mounted', {
      panelPosition: this.#currentSettings.panelPosition,
    });
    this.#render();
    lifecycle.add(this.#destroyIndicator);
  }

  /**
   * @returns {void}
   */
  #mountSettingsIndicator() {
    const lifecycle = this.#lifecycle;
    if (lifecycle === null) {
      return;
    }

    const settingsIndicator = new LyricBarSettingsIndicator(
      this.#extension.getSettings(),
      this.#extension,
    );
    let destroyed = false;
    this.#settingsIndicator = settingsIndicator;
    this.#destroySettingsIndicator = () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      settingsIndicator.destroy();
      if (this.#settingsIndicator === settingsIndicator) {
        this.#settingsIndicator = null;
      }
    };

    Main.panel.addToStatusArea(`${this.#extension.uuid}-settings`, settingsIndicator, 0, 'right');
    this.#logger?.debug('settings-indicator-mounted');
    lifecycle.add(this.#destroySettingsIndicator);
  }

  /**
   * @returns {void}
   */
  #startLyricsService() {
    const lifecycle = this.#lifecycle;
    if (lifecycle === null) {
      return;
    }

    const logger = this.#logger?.child('lyrics');
    const provider = new LrclibProvider(lifecycle, { logger: logger?.child('lrclib') });
    const cache = new LyricsCache(
      lifecycle,
      () => ({
        cacheEnabled: this.#currentSettings?.cacheEnabled ?? true,
      }),
      { logger: logger?.child('cache') },
    );

    this.#lyricsService = new LyricsService(lifecycle, provider, cache, {
      getBrowserPlayerService: () => this.#currentSettings?.browserPlayerService ?? 'auto',
      logger,
    });
    this.#lyricsService.onLookupChanged((player, lookup) => {
      if (!this.#enabled) {
        return;
      }
      this.#activePlayer = player;
      this.#currentLookup = lookup;
      this.#refreshDisplay();
      this.#updateSyncLoop();
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
    this.#mprisService = new MprisService(this.#connection, lifecycle, {
      logger: this.#logger?.child('mpris'),
    });
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
    this.#logger?.debug('players-sync', { count: names.length });
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

    const rawProxy = new PlayerProxy(this.#connection, busName, child, {
      logger: this.#logger?.child('player'),
    });
    const proxy = new StablePlayerProxy(rawProxy, child, {
      getBrowserPlayerService: () => this.#currentSettings?.browserPlayerService ?? 'auto',
      logger: this.#logger?.child('player') ?? null,
      schedule: scheduleTimeout,
    });
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

    this.#logger?.debug('active-player-selected', {
      busName: active?.busName ?? null,
      title: active?.title ?? null,
    });

    this.#activePlayer = active;
    if (this.#lyricsService !== null) {
      this.#lyricsService.setActivePlayer(active);
    } else {
      this.#refreshDisplay();
    }
    this.#updateSyncLoop();
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
  #updateSyncLoop() {
    if (!this.#shouldPollSyncedLyrics()) {
      this.#stopSyncLoop();
      return;
    }

    if (this.#syncSourceId !== 0) {
      return;
    }

    this.#logger?.debug('sync-loop-start', {
      intervalMs: POSITION_POLL_INTERVAL_MS,
      title: this.#activePlayer?.title ?? null,
    });
    this.#lastSyncedLine = null;
    this.#pollSyncedPosition();
    this.#syncSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, POSITION_POLL_INTERVAL_MS, () => {
      if (!this.#shouldPollSyncedLyrics()) {
        this.#logger?.debug('sync-loop-stop');
        this.#syncSourceId = 0;
        this.#lastSyncedLine = null;
        return GLib.SOURCE_REMOVE;
      }
      this.#pollSyncedPosition();
      return GLib.SOURCE_CONTINUE;
    });
  }

  /**
   * @returns {boolean}
   */
  #shouldPollSyncedLyrics() {
    return shouldPollSyncedLyrics({
      enabled: this.#enabled,
      player: this.#activePlayer,
      lookup: this.#currentLookup,
    });
  }

  /**
   * @returns {void}
   */
  #stopSyncLoop() {
    if (this.#syncSourceId !== 0) {
      try {
        GLib.source_remove(this.#syncSourceId);
      } catch {
        // already removed by GLib
      }
      this.#logger?.debug('sync-loop-stop');
      this.#syncSourceId = 0;
    }
    this.#lastSyncedLine = null;
  }

  /**
   * @returns {void}
   */
  #pollSyncedPosition() {
    const player = this.#activePlayer;
    const lookup = this.#currentLookup;
    if (player === null || lookup?.kind !== 'synced') {
      return;
    }

    const tracked = this.#proxies.get(player.busName);
    if (tracked === undefined) {
      return;
    }

    tracked.proxy.readPosition((positionMs) => {
      if (
        !this.#shouldPollSyncedLyrics() ||
        this.#activePlayer !== player ||
        this.#currentLookup !== lookup ||
        positionMs === null
      ) {
        return;
      }

      const next = displayStateFromSyncedPosition(player, lookup, positionMs);
      const line = next.kind === 'lyrics' ? next.line : null;
      if (line === this.#lastSyncedLine) {
        return;
      }

      this.#lastSyncedLine = line;
      this.#logger?.debug('sync-line-selected', {
        positionMs,
        text: line,
      });
      this.#displayState = next;
      this.#render();
    });
  }

  /**
   * @returns {void}
   */
  #render() {
    if (!this.#indicator || !this.#currentSettings) {
      return;
    }

    const viewModel = buildIndicatorViewModel(this.#displayState, this.#currentSettings);
    this.#logger?.debug('indicator-render', {
      text: viewModel.text,
      visible: viewModel.visible,
    });
    this.#indicator.render(viewModel);
  }
}

/**
 * @param {() => void} callback
 * @param {number} delayMs
 * @returns {() => void}
 */
function scheduleTimeout(callback, delayMs) {
  let sourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
    sourceId = 0;
    callback();
    return GLib.SOURCE_REMOVE;
  });

  return () => {
    if (sourceId === 0) {
      return;
    }
    GLib.source_remove(sourceId);
    sourceId = 0;
  };
}
