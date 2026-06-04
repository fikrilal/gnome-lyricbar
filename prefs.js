import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Soup from 'gi://Soup';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
  isHexColor,
  TEXT_COLOR_MODES,
  textColorModeIndex,
} from './src/domain/settings/appearance.js';

const UPDATE_CHECK_INTERVAL_S = 86400;
const GITHUB_RELEASES_URL = 'https://github.com/fikrilal/gnome-lyricbar/releases/latest';
const STATE_DIR = GLib.build_filenamev([GLib.get_user_state_dir(), 'lyricbar']);
const UPDATE_STATE_FILE = GLib.build_filenamev([STATE_DIR, 'update-check.json']);
const UPDATER_PATH = GLib.build_filenamev([
  GLib.get_home_dir(),
  '.local',
  'bin',
  'lyricbar-update',
]);

export default class LyricBarPreferences extends ExtensionPreferences {
  /**
   * @param {any} window
   * @returns {void}
   */
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const metadata = /** @type {Record<string, unknown>} */ (
      /** @type {{ metadata?: unknown }} */ (this).metadata ?? {}
    );
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

    // text-align: ComboRow
    const alignments = ['left', 'center', 'right'];
    const textAlignRow = new Adw.ComboRow({
      title: 'Text alignment',
      subtitle: 'Horizontal alignment of the lyric text within the indicator.',
      model: new Gtk.StringList({ strings: ['Left', 'Center', 'Right'] }),
    });
    const currentAlign = settings.get_string('text-align');
    const alignIndex = alignments.indexOf(currentAlign);
    if (alignIndex !== -1) {
      textAlignRow.selected = alignIndex;
    }
    const alignNotifyId = textAlignRow.connect('notify::selected', () => {
      const { selected } = textAlignRow;
      if (selected >= 0 && selected < alignments.length) {
        settings.set_string('text-align', alignments[selected]);
      }
    });
    connections.push([textAlignRow, alignNotifyId]);

    const alignChangedId = settings.connect('changed::text-align', () => {
      const currentAlign = settings.get_string('text-align');
      const alignIndex = alignments.indexOf(currentAlign);
      if (alignIndex !== -1 && textAlignRow.selected !== alignIndex) {
        textAlignRow.selected = alignIndex;
      }
    });
    connections.push([settings, alignChangedId]);

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

    const showSettingsIconRow = new Adw.SwitchRow({
      title: 'Show settings icon',
      subtitle: 'Show a separate top-bar shortcut to LyricBar preferences.',
    });
    settings.bind(
      'show-settings-icon',
      showSettingsIconRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );

    displayGroup.add(panelPositionRow);
    displayGroup.add(maxWidthRow);
    displayGroup.add(textAlignRow);
    displayGroup.add(fallbackModeRow);
    displayGroup.add(showSettingsIconRow);

    // 1.5 Appearance Group
    const appearanceGroup = new Adw.PreferencesGroup({
      title: 'Appearance',
      description: 'Customize lyric text style.',
    });

    const textColorPresetRow = new Adw.ComboRow({
      title: 'Text color preset',
      subtitle: 'Preset text color style for the lyric label.',
      model: new Gtk.StringList({
        strings: ['Default (White)', 'Theme default', 'White', 'Black', 'Custom color'],
      }),
    });
    const currentColorType = settings.get_string('style-text-color-type');
    const colorTypeIndex = textColorModeIndex(currentColorType);
    if (colorTypeIndex !== -1) {
      textColorPresetRow.selected = colorTypeIndex;
    }

    const textColorCustomRow = new Adw.EntryRow({
      title: 'Custom text color (HEX)',
      show_apply_button: true,
    });
    textColorCustomRow.text = settings.get_string('style-text-color-custom');

    const updateCustomColorVisibility = () => {
      textColorCustomRow.visible = textColorPresetRow.selected === 4;
    };
    updateCustomColorVisibility();

    const colorTypeNotifyId = textColorPresetRow.connect('notify::selected', () => {
      const { selected } = textColorPresetRow;
      if (selected >= 0 && selected < TEXT_COLOR_MODES.length) {
        settings.set_string('style-text-color-type', TEXT_COLOR_MODES[selected]);
        updateCustomColorVisibility();
      }
    });
    connections.push([textColorPresetRow, colorTypeNotifyId]);

    const colorTypeChangedId = settings.connect('changed::style-text-color-type', () => {
      const current = settings.get_string('style-text-color-type');
      const idx = textColorModeIndex(current);
      if (idx !== -1 && textColorPresetRow.selected !== idx) {
        textColorPresetRow.selected = idx;
        updateCustomColorVisibility();
      }
    });
    connections.push([settings, colorTypeChangedId]);

    const textColorCustomApplyId = textColorCustomRow.connect('apply', () => {
      const text = textColorCustomRow.text.trim();
      if (isHexColor(text)) {
        settings.set_string('style-text-color-custom', text);
      } else {
        textColorCustomRow.text = settings.get_string('style-text-color-custom');
      }
    });
    connections.push([textColorCustomRow, textColorCustomApplyId]);

    const textColorCustomChangedId = settings.connect('changed::style-text-color-custom', () => {
      const current = settings.get_string('style-text-color-custom');
      if (textColorCustomRow.text !== current) {
        textColorCustomRow.text = current;
      }
    });
    connections.push([settings, textColorCustomChangedId]);

    const textShadowRow = new Adw.SwitchRow({
      title: 'Text drop shadow',
      subtitle: 'Show a drop shadow behind the lyric text for readability.',
    });
    settings.bind('style-text-shadow', textShadowRow, 'active', Gio.SettingsBindFlags.DEFAULT);

    appearanceGroup.add(textColorPresetRow);
    appearanceGroup.add(textColorCustomRow);
    appearanceGroup.add(textShadowRow);

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

    // browser-player-service: ComboRow
    const browserPlayerServices = ['auto', 'spotify', 'youtube-music', 'apple-music', 'generic'];
    const browserPlayerServiceRow = new Adw.ComboRow({
      title: 'Browser player service',
      subtitle: 'How browser media players should be interpreted.',
      model: new Gtk.StringList({
        strings: ['Auto detect', 'Spotify Web', 'YouTube Music', 'Apple Music', 'Generic browser'],
      }),
    });
    const currentBrowserPlayerService = settings.get_string('browser-player-service');
    const browserPlayerServiceIndex = browserPlayerServices.indexOf(currentBrowserPlayerService);
    if (browserPlayerServiceIndex !== -1) {
      browserPlayerServiceRow.selected = browserPlayerServiceIndex;
    }
    const browserPlayerServiceNotifyId = browserPlayerServiceRow.connect('notify::selected', () => {
      const { selected } = browserPlayerServiceRow;
      if (selected >= 0 && selected < browserPlayerServices.length) {
        settings.set_string('browser-player-service', browserPlayerServices[selected]);
      }
    });
    connections.push([browserPlayerServiceRow, browserPlayerServiceNotifyId]);

    const browserPlayerServiceChangedId = settings.connect(
      'changed::browser-player-service',
      () => {
        const currentBrowserPlayerService = settings.get_string('browser-player-service');
        const browserPlayerServiceIndex = browserPlayerServices.indexOf(
          currentBrowserPlayerService,
        );
        if (
          browserPlayerServiceIndex !== -1 &&
          browserPlayerServiceRow.selected !== browserPlayerServiceIndex
        ) {
          browserPlayerServiceRow.selected = browserPlayerServiceIndex;
        }
      },
    );
    connections.push([settings, browserPlayerServiceChangedId]);

    behaviorGroup.add(browserPlayerServiceRow);
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

    const copyDiagnosticsRow = new Adw.ActionRow({
      title: 'Copy diagnostics',
      subtitle: 'Copy safe extension settings for bug reports.',
    });
    const copyDiagnosticsButton = new Gtk.Button({
      icon_name: 'edit-copy-symbolic',
      valign: Gtk.Align.CENTER,
      tooltip_text: 'Copy diagnostics',
    });
    const copyDiagnosticsId = copyDiagnosticsButton.connect('clicked', () => {
      window.get_clipboard().set(buildDiagnosticsMarkdown(metadata, settings));
      copyDiagnosticsButton.tooltip_text = 'Copied diagnostics';
    });
    connections.push([copyDiagnosticsButton, copyDiagnosticsId]);
    copyDiagnosticsRow.add_suffix(copyDiagnosticsButton);
    debuggingGroup.add(copyDiagnosticsRow);

    const openIssueRow = new Adw.ActionRow({
      title: 'Open issue',
      subtitle: 'Open GitHub issue tracker in your browser.',
    });
    const openIssueButton = new Gtk.Button({
      icon_name: 'dialog-question-symbolic',
      valign: Gtk.Align.CENTER,
      tooltip_text: 'Open issue',
    });
    const openIssueId = openIssueButton.connect('clicked', () => {
      Gtk.show_uri(
        window,
        `${readMetadataText(metadata, 'url', 'https://github.com/fikrilal/gnome-lyricbar')}/issues/new`,
        0,
      );
    });
    connections.push([openIssueButton, openIssueId]);
    openIssueRow.add_suffix(openIssueButton);
    debuggingGroup.add(openIssueRow);

    // 4. About Group
    const aboutGroup = new Adw.PreferencesGroup({
      title: 'About',
    });

    const currentVersion = readMetadataText(metadata, 'version-name', 'Unknown');

    const versionRow = new Adw.ActionRow({
      title: 'Version',
      subtitle: currentVersion,
    });

    const updateRow = new Adw.ActionRow({
      title: 'Update available',
      subtitle: 'Checking for updates...',
    });
    updateRow.visible = true;

    const releasesUrl = `${readMetadataText(metadata, 'url', 'https://github.com/fikrilal/gnome-lyricbar')}/releases`;
    updateRow.activatable = true;
    const updateActivateId = updateRow.connect('activated', () => {
      Gtk.show_uri(window, releasesUrl, 0);
    });
    connections.push([updateRow, updateActivateId]);

    const openButton = new Gtk.Button({
      icon_name: 'external-link-symbolic',
      valign: Gtk.Align.CENTER,
      tooltip_text: 'View releases',
    });
    const openButtonId = openButton.connect('clicked', () => {
      Gtk.show_uri(window, releasesUrl, 0);
    });
    connections.push([openButton, openButtonId]);
    updateRow.add_suffix(openButton);

    const updaterExists = GLib.file_test(UPDATER_PATH, GLib.FileTest.EXISTS);
    /** @type {any | null} */
    let updateNowButton = null;
    /** @type {boolean} */
    let windowDestroyed = false;

    if (updaterExists) {
      updateNowButton = new Gtk.Button({
        label: 'Update Now',
        valign: Gtk.Align.CENTER,
        css_classes: ['suggested-action'],
      });
      const updateNowId = updateNowButton.connect('clicked', async () => {
        updateNowButton.sensitive = false;
        updateNowButton.label = 'Updating...';
        updateRow.subtitle = 'Running updater...';

        const result = await runSubprocess(UPDATER_PATH, []);

        if (windowDestroyed) {
          return;
        }

        if (result.ok) {
          updateRow.subtitle = 'Updated! Restart GNOME Shell to apply.';
          updateNowButton.label = 'Done';
        } else {
          updateRow.subtitle = 'Update failed. Try again or visit releases page.';
          updateNowButton.label = 'Retry';
          updateNowButton.sensitive = true;
        }
      });
      connections.push([updateNowButton, updateNowId]);
      updateRow.add_suffix(updateNowButton);
    }

    checkForUpdate(currentVersion, (latestVersion) => {
      if (windowDestroyed) {
        return;
      }
      if (latestVersion) {
        updateRow.subtitle = `${latestVersion} is available on GitHub`;
        if (!updaterExists) {
          updateRow.subtitle += '. Install auto-updater to enable Update Now.';
        }
      } else {
        updateRow.visible = false;
      }
    });

    const uuidRow = new Adw.ActionRow({
      title: 'Extension UUID',
      subtitle: readMetadataText(metadata, 'uuid', 'lyricbar@fikrilal.github.io'),
    });

    const websiteRow = new Adw.ActionRow({
      title: 'Website',
      subtitle: readMetadataText(metadata, 'url', 'https://github.com/fikrilal/gnome-lyricbar'),
    });
    websiteRow.activatable = true;
    const websiteActivateId = websiteRow.connect('activated', () => {
      Gtk.show_uri(window, websiteRow.subtitle, 0);
    });
    connections.push([websiteRow, websiteActivateId]);

    aboutGroup.add(versionRow);
    aboutGroup.add(updateRow);
    aboutGroup.add(uuidRow);
    aboutGroup.add(websiteRow);

    page.add(displayGroup);
    page.add(appearanceGroup);
    page.add(behaviorGroup);
    page.add(debuggingGroup);
    page.add(aboutGroup);

    window.add(page);

    // Disconnect all listeners when the window is destroyed
    const windowDestroyId = window.connect('destroy', () => {
      windowDestroyed = true;
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

/**
 * @param {Record<string, unknown>} metadata
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
function readMetadataText(metadata, key, fallback) {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @returns {Promise<{ok: boolean, stdout: string, stderr: string}>}
 */
function runSubprocess(command, args) {
  return new Promise((resolve) => {
    try {
      const proc = new Gio.Subprocess({
        argv: [command, ...args],
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      });
      proc.init(null);

      proc.communicate_utf8_async(
        null,
        null,
        /**
         * @param {unknown} _source
         * @param {unknown} result
         * @returns {void}
         */
        (_source, result) => {
          try {
            const [, stdout, stderr] = proc.communicate_utf8_finish(result);
            resolve({
              ok: proc.get_successful(),
              stdout: stdout ?? '',
              stderr: stderr ?? '',
            });
          } catch (e) {
            resolve({ ok: false, stdout: '', stderr: String(e) });
          }
        },
      );
    } catch (e) {
      resolve({ ok: false, stdout: '', stderr: String(e) });
    }
  });
}

/**
 * @returns {{ lastCheck: number, latestVersion: string } | null}
 */
function readUpdateState() {
  try {
    const [ok, contents] = GLib.file_get_contents(UPDATE_STATE_FILE);
    if (!ok || !contents) {
      return null;
    }
    const decoder = new TextDecoder('utf-8');
    return JSON.parse(decoder.decode(contents));
  } catch {
    return null;
  }
}

/**
 * @param {{ lastCheck: number, latestVersion: string }} state
 * @returns {void}
 */
function writeUpdateState(state) {
  try {
    GLib.mkdir_with_parents(STATE_DIR, 0o755);
    const payload = JSON.stringify(state, null, 2);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(payload);
    GLib.file_set_contents(UPDATE_STATE_FILE, bytes);
  } catch {
    // Silently ignore write failures
  }
}

/**
 * @param {string} current
 * @param {string} latest
 * @returns {boolean}
 */
function isNewerVersion(current, latest) {
  const normalize = (/** @type {string} */ v) => v.replace(/^v/, '').trim();
  const currentParts = normalize(current).split('.').map(Number);
  const latestParts = normalize(latest).split('.').map(Number);
  const maxLen = Math.max(currentParts.length, latestParts.length);
  for (let i = 0; i < maxLen; i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (l > c) {
      return true;
    }
    if (l < c) {
      return false;
    }
  }
  return false;
}

/**
 * @param {string} currentVersion
 * @param {(latestVersion: string | null) => void} callback
 * @returns {void}
 */
function checkForUpdate(currentVersion, callback) {
  const state = readUpdateState();
  const now = Math.floor(Date.now() / 1000);

  if (state && now - state.lastCheck < UPDATE_CHECK_INTERVAL_S) {
    callback(isNewerVersion(currentVersion, state.latestVersion) ? state.latestVersion : null);
    return;
  }

  const session = new Soup.Session({ user_agent: 'lyricbar-prefs/1.0' });
  const message = Soup.Message.new('HEAD', GITHUB_RELEASES_URL);
  if (!message) {
    callback(null);
    return;
  }

  session.send_and_read_async(
    message,
    GLib.PRIORITY_DEFAULT,
    null,
    /**
     * @param {unknown} _source
     * @param {unknown} result
     * @returns {void}
     */
    (_source, result) => {
      try {
        session.send_and_read_finish(result);
        const uri = message.get_uri()?.to_string?.() ?? '';
        const match = uri.match(/\/tag\/([^/?#]+)/);
        const latestVersion = match ? match[1] : null;

        if (latestVersion) {
          writeUpdateState({ lastCheck: now, latestVersion });
        }

        callback(
          latestVersion && isNewerVersion(currentVersion, latestVersion) ? latestVersion : null,
        );
      } catch {
        callback(null);
      }
    },
  );
}

/**
 * @param {Record<string, unknown>} metadata
 * @param {{
 *   get_string(key: string): string,
 *   get_int(key: string): number,
 *   get_strv(key: string): string[],
 *   get_boolean(key: string): boolean,
 * }} settings
 * @returns {string}
 */
function buildDiagnosticsMarkdown(metadata, settings) {
  return [
    '## LyricBar diagnostics',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Version | ${escapeMarkdownTable(readMetadataText(metadata, 'version-name', 'Unknown'))} |`,
    `| UUID | ${escapeMarkdownTable(readMetadataText(metadata, 'uuid', 'lyricbar@fikrilal.github.io'))} |`,
    `| URL | ${escapeMarkdownTable(readMetadataText(metadata, 'url', 'https://github.com/fikrilal/gnome-lyricbar'))} |`,
    `| Shell compatibility | ${escapeMarkdownTable(readShellVersions(metadata))} |`,
    `| Panel position | ${escapeMarkdownTable(settings.get_string('panel-position'))} |`,
    `| Text alignment | ${escapeMarkdownTable(settings.get_string('text-align'))} |`,
    `| Maximum width | ${settings.get_int('max-width')} |`,
    `| Fallback mode | ${escapeMarkdownTable(settings.get_string('fallback-mode'))} |`,
    `| Show settings icon | ${formatBoolean(settings.get_boolean('show-settings-icon'))} |`,
    `| Player priority | ${escapeMarkdownTable(settings.get_strv('player-priority').join(', '))} |`,
    `| Browser player service | ${escapeMarkdownTable(settings.get_string('browser-player-service'))} |`,
    `| Cache enabled | ${formatBoolean(settings.get_boolean('cache-enabled'))} |`,
    `| Debug logging | ${formatBoolean(settings.get_boolean('debug-logging'))} |`,
    `| Style text color type | ${escapeMarkdownTable(settings.get_string('style-text-color-type'))} |`,
    `| Style text color custom | ${escapeMarkdownTable(settings.get_string('style-text-color-custom'))} |`,
    `| Style text shadow | ${formatBoolean(settings.get_boolean('style-text-shadow'))} |`,
    '',
    'This diagnostic block intentionally excludes lyrics, listening history, logs, local file paths, and MPRIS metadata.',
  ].join('\n');
}

/**
 * @param {Record<string, unknown>} metadata
 * @returns {string}
 */
function readShellVersions(metadata) {
  const value = metadata['shell-version'];
  if (!Array.isArray(value)) {
    return 'Unknown';
  }

  const versions = value.filter((entry) => typeof entry === 'string' && entry.trim() !== '');
  return versions.length === 0 ? 'Unknown' : versions.join(', ');
}

/**
 * @param {boolean} value
 * @returns {string}
 */
function formatBoolean(value) {
  return value ? 'yes' : 'no';
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeMarkdownTable(value) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}
