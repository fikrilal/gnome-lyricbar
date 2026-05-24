/**
 * @typedef {Readonly<{
 *   acquirePattern: RegExp,
 *   releasePattern: RegExp,
 *   acquireLabel: string,
 *   releaseLabel: string,
 * }>} CleanupRule
 */

import { listFiles, readText } from './lib/repo.mjs';

/** @type {string[]} */
const failures = [];
const sourceFiles = (await listFiles('.')).filter(
  (path) => (path.endsWith('.js') || path.endsWith('.mjs')) && !path.startsWith('node_modules/'),
);

for (const path of sourceFiles) {
  const content = await readText(path);

  if (path.startsWith('src/domain/')) {
    checkForbidden(path, content, /gi:\/\//, 'domain modules must not import GJS GI modules');
    checkForbidden(
      path,
      content,
      /resource:\/\/\/org\/gnome/,
      'domain modules must not import GNOME Shell resources',
    );
    checkForbidden(
      path,
      content,
      /\b(Gio|GLib|St|Clutter|PanelMenu|PopupMenu)\b/,
      'domain modules must stay platform-free',
    );
    checkForbidden(
      path,
      content,
      /\b(fetch|XMLHttpRequest)\b/,
      'domain modules must not perform network I/O',
    );
    checkForbidden(path, content, /node:/, 'domain modules must not import Node.js modules');
  }

  if (path.startsWith('src/shell/') || path === 'extension.js' || path === 'prefs.js') {
    checkRequiredCleanup(path, content, {
      acquirePattern: /\.connect\s*\(/,
      releasePattern: /\.disconnect\s*\(/,
      acquireLabel: 'connect(...)',
      releaseLabel: 'disconnect(...)',
    });
    checkRequiredCleanup(path, content, {
      acquirePattern: /\bGLib\.timeout_add(?:_seconds)?\s*\(/,
      releasePattern: /\bGLib\.source_remove\s*\(/,
      acquireLabel: 'GLib timeout',
      releaseLabel: 'GLib.source_remove(...)',
    });
    checkRequiredCleanup(path, content, {
      acquirePattern: /\bGio\.bus_watch_name\s*\(/,
      releasePattern: /\bGio\.bus_unwatch_name\s*\(/,
      acquireLabel: 'Gio.bus_watch_name(...)',
      releaseLabel: 'Gio.bus_unwatch_name(...)',
    });
    checkRequiredCleanup(path, content, {
      acquirePattern: /\bGio\.Cancellable\b/,
      releasePattern: /\.cancel\s*\(/,
      acquireLabel: 'Gio.Cancellable',
      releaseLabel: 'cancel(...)',
    });
  }

  if (path.startsWith('src/runtime/')) {
    checkRequiredCleanup(path, content, {
      acquirePattern: /\.connect\s*\(/,
      releasePattern: /\.disconnect\s*\(|\blifecycle\.\w+\s*\(/,
      acquireLabel: 'connect(...)',
      releaseLabel: 'disconnect(...) or lifecycle.<method>(...)',
    });
    checkRequiredCleanup(path, content, {
      acquirePattern: /\bGio\.Cancellable\b/,
      releasePattern: /\.cancel\s*\(|\blifecycle\.\w+\s*\(/,
      acquireLabel: 'Gio.Cancellable',
      releaseLabel: 'cancel(...) or lifecycle.<method>(...)',
    });
  }

  if (isRuntimeSource(path)) {
    checkForbidden(
      path,
      content,
      /bus_watch_name\s*\([\s\S]*?['"][^'"]*\*[^'"]*['"]/,
      'Gio.bus_watch_name must not be used with wildcard D-Bus names',
    );
  }

  if (!path.startsWith('tests/') && !path.startsWith('scripts/')) {
    checkForbidden(
      path,
      content,
      /\bconsole\.log\s*\(/,
      'production source must not use console.log',
    );
  }
}

/**
 * @param {string} path
 * @param {string} content
 * @param {RegExp} pattern
 * @param {string} message
 * @returns {void}
 */
function checkForbidden(path, content, pattern, message) {
  if (!pattern.test(content)) {
    return;
  }

  failures.push(`${path}: ${message}`);
}

/**
 * @param {string} path
 * @returns {boolean}
 */
function isRuntimeSource(path) {
  return path === 'extension.js' || path === 'prefs.js' || path.startsWith('src/');
}

/**
 * @param {string} path
 * @param {string} content
 * @param {CleanupRule} rule
 * @returns {void}
 */
function checkRequiredCleanup(path, content, rule) {
  if (!rule.acquirePattern.test(content)) {
    return;
  }

  if (rule.releasePattern.test(content)) {
    return;
  }

  failures.push(`${path}: ${rule.acquireLabel} requires tracked cleanup via ${rule.releaseLabel}`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Architecture guardrails passed.\n');
