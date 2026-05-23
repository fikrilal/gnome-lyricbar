import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { LyricBarIndicator } from './src/shell/indicator.js';

export default class LyricBarExtension extends Extension {
  enable() {
    if (this._indicator) {
      return;
    }

    this._indicator = new LyricBarIndicator();
    Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'center');
  }

  disable() {
    if (!this._indicator) {
      return;
    }

    this._indicator.destroy();
    this._indicator = null;
  }
}
