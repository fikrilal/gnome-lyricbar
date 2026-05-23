import { listFiles, readText } from './lib/repo.mjs';

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

  checkForbidden(
    path,
    content,
    /bus_watch_name\s*\([\s\S]*?['"][^'"]*\*[^'"]*['"]/,
    'Gio.bus_watch_name must not be used with wildcard D-Bus names',
  );

  if (!path.startsWith('tests/') && !path.startsWith('scripts/')) {
    checkForbidden(
      path,
      content,
      /\bconsole\.log\s*\(/,
      'production source must not use console.log',
    );
  }
}

function checkForbidden(path, content, pattern, message) {
  if (!pattern.test(content)) {
    return;
  }

  failures.push(`${path}: ${message}`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Architecture guardrails passed.\n');
