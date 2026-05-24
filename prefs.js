import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class LyricBarPreferences extends ExtensionPreferences {
  /**
   * @param {any} window
   * @returns {void}
   */
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    /** @type {any[]} */
    const connections = [];

    const page = new Adw.PreferencesPage({
      title: 'LyricBar',
      icon_name: 'audio-x-generic-symbolic',
    });

    // 1. Display Group
    const displayGroup = new Adw.PreferencesGroup({
      title: 'Display',
      description: 'Control how LyricBar appears in the GNOME top bar.',
    });

    // panel-position: ComboRow
    const positions = ['left', 'center', 'right'];
    const panelPositionRow = new Adw.ComboRow({
      title: 'Panel position',
      subtitle: 'Where the LyricBar indicator is placed in the top bar.',
      model: new Gtk.StringList({ strings: ['Left', 'Center', 'Right'] }),
    });
    const currentPos = settings.get_string('panel-position');
    const posIndex = positions.indexOf(currentPos);
    if (posIndex !== -1) {
      panelPositionRow.selected = posIndex;
    }
    const posNotifyId = panelPositionRow.connect('notify::selected', () => {
      const { selected } = panelPositionRow;
      if (selected >= 0 && selected < positions.length) {
        settings.set_string('panel-position', positions[selected]);
      }
    });
    connections.push([panelPositionRow, posNotifyId]);

    const posChangedId = settings.connect('changed::panel-position', () => {
      const currentPos = settings.get_string('panel-position');
      const posIndex = positions.indexOf(currentPos);
      if (posIndex !== -1 && panelPositionRow.selected !== posIndex) {
        panelPositionRow.selected = posIndex;
      }
    });
    connections.push([settings, posChangedId]);

    // max-width: SpinRow
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

    // fallback-mode: ComboRow
    const fallbackModes = ['track', 'idle', 'hidden'];
    const fallbackModeRow = new Adw.ComboRow({
      title: 'Fallback mode',
      subtitle: 'Display behavior when synced lyrics are unavailable.',
      model: new Gtk.StringList({
        strings: ['Show track title', 'Show static idle text', 'Hide indicator'],
      }),
    });
    const currentFallback = settings.get_string('fallback-mode');
    const fallbackIndex = fallbackModes.indexOf(currentFallback);
    if (fallbackIndex !== -1) {
      fallbackModeRow.selected = fallbackIndex;
    }
    const fallbackNotifyId = fallbackModeRow.connect('notify::selected', () => {
      const { selected } = fallbackModeRow;
      if (selected >= 0 && selected < fallbackModes.length) {
        settings.set_string('fallback-mode', fallbackModes[selected]);
      }
    });
    connections.push([fallbackModeRow, fallbackNotifyId]);

    const fallbackChangedId = settings.connect('changed::fallback-mode', () => {
      const currentFallback = settings.get_string('fallback-mode');
      const fallbackIndex = fallbackModes.indexOf(currentFallback);
      if (fallbackIndex !== -1 && fallbackModeRow.selected !== fallbackIndex) {
        fallbackModeRow.selected = fallbackIndex;
      }
    });
    connections.push([settings, fallbackChangedId]);

    displayGroup.add(panelPositionRow);
    displayGroup.add(maxWidthRow);
    displayGroup.add(fallbackModeRow);

    // 2. Behavior Group
    const behaviorGroup = new Adw.PreferencesGroup({
      title: 'Behavior',
      description: 'Customize lyrics behavior and player connection.',
    });

    // player-priority: EntryRow
    const playerPriorityRow = new Adw.EntryRow({
      title: 'Player priority (comma-separated)',
      show_apply_button: true,
    });
    const currentPriority = settings.get_strv('player-priority').join(', ');
    playerPriorityRow.text = currentPriority;
    const priorityApplyId = playerPriorityRow.connect('apply', () => {
      const parts = playerPriorityRow.text
        .split(',')
        .map((/** @type {string} */ p) => p.trim())
        .filter((/** @type {string} */ p) => p !== '');
      settings.set_strv('player-priority', parts);
    });
    connections.push([playerPriorityRow, priorityApplyId]);

    const priorityChangedId = settings.connect('changed::player-priority', () => {
      const currentPriority = settings.get_strv('player-priority').join(', ');
      if (playerPriorityRow.text !== currentPriority) {
        playerPriorityRow.text = currentPriority;
      }
    });
    connections.push([settings, priorityChangedId]);

    // cache-enabled: SwitchRow
    const cacheEnabledRow = new Adw.SwitchRow({
      title: 'Cache lyrics',
      subtitle: 'Whether lyric lookup results should be cached locally.',
    });
    settings.bind('cache-enabled', cacheEnabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);

    behaviorGroup.add(playerPriorityRow);
    behaviorGroup.add(cacheEnabledRow);

    // 3. Debugging Group
    const debuggingGroup = new Adw.PreferencesGroup({
      title: 'Debugging',
      description: 'Troubleshoot issues.',
    });

    // debug-logging: SwitchRow
    const debugLoggingRow = new Adw.SwitchRow({
      title: 'Debug logging',
      subtitle: 'Whether verbose diagnostic logging should be enabled.',
    });
    settings.bind('debug-logging', debugLoggingRow, 'active', Gio.SettingsBindFlags.DEFAULT);

    debuggingGroup.add(debugLoggingRow);

    page.add(displayGroup);
    page.add(behaviorGroup);
    page.add(debuggingGroup);

    window.add(page);

    // Disconnect all listeners when the window is destroyed
    const windowDestroyId = window.connect('destroy', () => {
      for (const [obj, id] of connections) {
        try {
          obj.disconnect(id);
        } catch {
          // Ignore if object is already finalized
        }
      }
      window.disconnect(windowDestroyId);
    });
  }
}
