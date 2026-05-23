import { mkdtemp, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { readText, repoPath } from './lib/repo.mjs';

const schemaPath = 'schemas/org.gnome.shell.extensions.lyricbar.gschema.xml';
const schema = await readText(schemaPath);
const failures = [];

const requiredKeys = [
  'panel-position',
  'max-width',
  'fallback-mode',
  'player-priority',
  'cache-enabled',
  'debug-logging',
];

if (!schema.includes('id="org.gnome.shell.extensions.lyricbar"')) {
  failures.push('Schema id must be org.gnome.shell.extensions.lyricbar.');
}

if (!schema.includes('path="/org/gnome/shell/extensions/lyricbar/"')) {
  failures.push('Schema path must be /org/gnome/shell/extensions/lyricbar/.');
}

for (const key of requiredKeys) {
  if (!schema.includes(`name="${key}"`)) {
    failures.push(`Schema is missing required key: ${key}`);
  }
}

const tmp = await mkdtemp(join(tmpdir(), 'lyricbar-schema-'));
try {
  await cp(repoPath('schemas'), tmp, { recursive: true });
  const result = spawnSync('glib-compile-schemas', [tmp], {
    encoding: 'utf8',
  });

  if (result.error?.code === 'ENOENT') {
    failures.push('glib-compile-schemas is required to validate the GSettings schema.');
  } else if (result.status !== 0) {
    failures.push(`glib-compile-schemas failed:\n${result.stderr || result.stdout}`);
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('GSettings schema is valid.\n');
