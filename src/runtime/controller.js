import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { buildIndicatorViewModel } from '../domain/display/view-model.js';
import { LyricBarIndicator } from '../shell/indicator.js';
import { normalizePanelPosition } from '../domain/settings/normalize.js';
import { LifecycleRegistry } from './lifecycle.js';
import { SettingsAdapter } from './settings.js';

/**
 * @import { DisplayState } from '../domain/display/types.js'
 * @import { IndicatorViewModel } from '../domain/display/view-model.js'
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
    lifecycle?.dispose();
    this.#indicator = null;
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
