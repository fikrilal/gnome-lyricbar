import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { LyricBarIndicator } from '../shell/indicator.js';
import { LifecycleRegistry } from './lifecycle.js';

/**
 * @typedef {Readonly<{
 *   setText(text: string): void,
 *   destroy(): void,
 * }>} IndicatorHandle
 */

export class LyricBarController {
  /** @type {string} */
  #extensionUuid;

  /** @type {IndicatorHandle | null} */
  #indicator = null;

  /** @type {LifecycleRegistry | null} */
  #lifecycle = null;

  /** @type {boolean} */
  #enabled = false;

  /**
   * @param {Readonly<{ uuid: string }>} extension
   */
  constructor(extension) {
    this.#extensionUuid = extension.uuid;
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
    this.#indicator = /** @type {IndicatorHandle} */ (new LyricBarIndicator());
    const indicator = this.#indicator;
    indicator.setText('LyricBar');

    Main.panel.addToStatusArea(this.#extensionUuid, indicator, 0, 'center');
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
    lifecycle?.dispose();
    this.#indicator = null;
  }
}
