import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

/**
 * @import { IndicatorViewModel } from '../domain/display/view-model.js'
 */

class LyricBarIndicatorBase extends PanelMenu.Button {
  /** @type {InstanceType<typeof St.Bin> | null} */
  _lyricBarBin = null;

  /** @type {InstanceType<typeof St.BoxLayout> | null} */
  _lyricBarContainer = null;

  /** @type {InstanceType<typeof St.Label> | null} */
  _lyricBarLabel = null;

  /** @override */
  _init() {
    super._init(0.0, null, true);

    this._lyricBarBin = new St.Bin({
      style_class: 'lyricbar-bin',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._lyricBarContainer = new St.BoxLayout({
      style_class: 'panel-status-menu-box lyricbar-container',
    });
    this._lyricBarLabel = new St.Label({
      text: '',
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'lyricbar-label',
    });

    this._lyricBarContainer.add_child(this._lyricBarLabel);
    this._lyricBarBin.set_child(this._lyricBarContainer);
    this.add_child(this._lyricBarBin);
    this.label_actor = this._lyricBarLabel;
  }

  /**
   * @param {IndicatorViewModel} viewModel
   * @returns {void}
   */
  render(viewModel) {
    if (!this._lyricBarLabel) {
      return;
    }

    setActorVisible(this, viewModel.visible);
    setLabelText(this._lyricBarLabel, viewModel.text);
    setActorStyle(this._lyricBarLabel, `max-width: ${viewModel.maxWidth}px;`);
  }

  /** @override */
  destroy() {
    this._lyricBarLabel = null;
    this._lyricBarContainer = null;
    this._lyricBarBin = null;
    super.destroy();
  }
}

export const LyricBarIndicator = /** @type {typeof LyricBarIndicatorBase} */ (
  GObject.registerClass(LyricBarIndicatorBase)
);

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
  Reflect.set(label, 'text', text);

  const setter = Reflect.get(label, 'set_text');
  if (typeof setter === 'function') {
    setter.call(label, text);
  }

  const clutterText = Reflect.get(label, 'clutter_text');
  const clutterSetter = Reflect.get(/** @type {object} */ (clutterText), 'set_text');
  if (typeof clutterSetter === 'function') {
    clutterSetter.call(clutterText, text);
  }
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
