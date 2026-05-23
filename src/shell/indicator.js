import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

export const LyricBarIndicator = GObject.registerClass(
  class LyricBarIndicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, 'LyricBar');

      this._label = new St.Label({
        text: 'LyricBar',
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'lyricbar-label',
      });

      this.add_child(this._label);
    }

    setText(text) {
      if (!this._label) {
        return;
      }

      this._label.text = text;
    }

    destroy() {
      this._label = null;
      super.destroy();
    }
  },
);
