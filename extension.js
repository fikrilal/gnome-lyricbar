import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { LyricBarController } from './src/runtime/controller.js';

export default class LyricBarExtension extends Extension {
  /** @type {LyricBarController | null} */
  #controller = null;

  enable() {
    this.#controller ??= new LyricBarController(this);
    this.#controller.enable();
  }

  disable() {
    this.#controller?.disable();
    this.#controller = null;
  }
}
