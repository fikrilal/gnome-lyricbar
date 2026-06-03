import { normalizeSettings } from '../domain/settings/normalize.js';

/**
 * @import { LyricBarSettings } from '../domain/settings/types.js'
 * @import { LifecycleRegistry } from './lifecycle.js'
 *
 * @typedef {Readonly<{
 *   get_string(key: string): string,
 *   get_int(key: string): number,
 *   get_strv(key: string): string[],
 *   get_boolean(key: string): boolean,
 *   connect(signal: string, callback: () => void): number,
 *   disconnect(id: number): void,
 * }>} GSettingsBackend
 */

const SETTING_KEYS = [
  'panel-position',
  'max-width',
  'text-align',
  'fallback-mode',
  'show-settings-icon',
  'player-priority',
  'browser-player-service',
  'cache-enabled',
  'debug-logging',
];

export class SettingsAdapter {
  #settings;
  #lifecycle;

  /**
   * @param {GSettingsBackend} settings
   * @param {LifecycleRegistry} lifecycle
   */
  constructor(settings, lifecycle) {
    this.#settings = settings;
    this.#lifecycle = lifecycle;
  }

  /**
   * @returns {LyricBarSettings}
   */
  read() {
    return normalizeSettings({
      panelPosition: this.#settings.get_string('panel-position'),
      maxWidth: this.#settings.get_int('max-width'),
      textAlign: this.#settings.get_string('text-align'),
      fallbackMode: this.#settings.get_string('fallback-mode'),
      showSettingsIcon: this.#settings.get_boolean('show-settings-icon'),
      playerPriority: this.#settings.get_strv('player-priority'),
      browserPlayerService: this.#settings.get_string('browser-player-service'),
      cacheEnabled: this.#settings.get_boolean('cache-enabled'),
      debugLogging: this.#settings.get_boolean('debug-logging'),
    });
  }

  /**
   * @param {(settings: LyricBarSettings) => void} callback
   * @returns {void}
   */
  subscribe(callback) {
    for (const key of SETTING_KEYS) {
      const signalId = this.#settings.connect(`changed::${key}`, () => {
        callback(this.read());
      });
      this.#lifecycle.addSignal(
        () => this.#settings,
        () => signalId,
      );
    }
  }
}
