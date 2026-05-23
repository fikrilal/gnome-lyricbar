import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

class LyricBarIndicatorBase extends PanelMenu.Button {
  /** @type {InstanceType<typeof St.Label> | null} */
  _label = null;

  /** @override */
  _init() {
    super._init(0.0, 'LyricBar');

    this._label = new St.Label({
      text: 'LyricBar',
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'lyricbar-label',
    });

    this.add_child(this._label);
  }

  /**
   * @param {string} text
   * @returns {void}
   */
  setText(text) {
    if (!this._label) {
      return;
    }

    this._label.text = text;
  }

  /** @override */
  destroy() {
    this._label = null;
    super.destroy();
  }
}

export const LyricBarIndicator = /** @type {typeof LyricBarIndicatorBase} */ (
  GObject.registerClass(LyricBarIndicatorBase)
);
