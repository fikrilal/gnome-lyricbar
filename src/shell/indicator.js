import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

/**
 * @import { IndicatorViewModel } from '../domain/display/view-model.js'
 */

class LyricBarIndicatorBase extends PanelMenu.Button {
  /** @type {InstanceType<typeof St.Label> | null} */
  #label = null;

  /** @override */
  _init() {
    super._init(0.0, 'LyricBar');
    removeActorChildren(this);

    this.#label = new St.Label({
      text: '',
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'lyricbar-label',
    });

    this.add_child(this.#label);
  }

  /**
   * @param {IndicatorViewModel} viewModel
   * @returns {void}
   */
  render(viewModel) {
    if (!this.#label) {
      return;
    }

    setActorVisible(this, viewModel.visible);
    setLabelText(this.#label, viewModel.text);
    setActorStyle(this.#label, `max-width: ${viewModel.maxWidth}px;`);
  }

  /** @override */
  destroy() {
    this.#label = null;
    super.destroy();
  }
}

export const LyricBarIndicator = /** @type {typeof LyricBarIndicatorBase} */ (
  GObject.registerClass(LyricBarIndicatorBase)
);

/**
 * @param {unknown} actor
 * @returns {void}
 */
function removeActorChildren(actor) {
  const remover = Reflect.get(/** @type {object} */ (actor), 'remove_all_children');
  if (typeof remover === 'function') {
    remover.call(actor);
  }
}

/**
 * @param {unknown} actor
 * @param {boolean} visible
 * @returns {void}
 */
function setActorVisible(actor, visible) {
  const setter = Reflect.get(/** @type {object} */ (actor), 'set_visible');
  if (typeof setter === 'function') {
    setter.call(actor, visible);
    return;
  }
  Reflect.set(/** @type {object} */ (actor), 'visible', visible);
}

/**
 * @param {InstanceType<typeof St.Label>} label
 * @param {string} text
 * @returns {void}
 */
function setLabelText(label, text) {
  const setter = Reflect.get(label, 'set_text');
  if (typeof setter === 'function') {
    setter.call(label, text);
    return;
  }
  Reflect.set(label, 'text', text);
}

/**
 * @param {unknown} actor
 * @param {string} style
 * @returns {void}
 */
function setActorStyle(actor, style) {
  const setter = Reflect.get(/** @type {object} */ (actor), 'set_style');
  if (typeof setter === 'function') {
    setter.call(actor, style);
    return;
  }
  Reflect.set(/** @type {object} */ (actor), 'style', style);
}
