import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class LyricBarPreferences extends ExtensionPreferences {
  /**
   * @param {{ add(page: unknown): void }} window
   * @returns {void}
   */
  fillPreferencesWindow(window) {
    const settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: 'LyricBar',
      icon_name: 'audio-x-generic-symbolic',
    });

    const displayGroup = new Adw.PreferencesGroup({
      title: 'Display',
      description: 'Control how LyricBar appears in the GNOME top bar.',
    });

    const maxWidthRow = new Adw.SpinRow({
      title: 'Maximum width',
      subtitle: 'Maximum top-bar label width in pixels.',
      adjustment: new Gtk.Adjustment({
        lower: 120,
        upper: 720,
        step_increment: 10,
        page_increment: 50,
        value: settings.get_int('max-width'),
      }),
    });
    settings.bind('max-width', maxWidthRow, 'value', Gio.SettingsBindFlags.DEFAULT);

    displayGroup.add(maxWidthRow);
    page.add(displayGroup);
    window.add(page);
  }
}
