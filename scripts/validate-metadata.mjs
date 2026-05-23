import { readFile } from 'node:fs/promises';

import { fileExists, repoPath } from './lib/repo.mjs';

const metadataPath = 'metadata.json';
const metadata = JSON.parse(await readFile(repoPath(metadataPath), 'utf8'));
const failures = [];

/**
 * @param {string} key
 * @returns {void}
 */
function requireString(key) {
  if (typeof metadata[key] !== 'string' || metadata[key].trim() === '') {
    failures.push(`metadata.json field "${key}" must be a non-empty string.`);
  }
}

requireString('uuid');
requireString('name');
requireString('description');
requireString('url');
requireString('settings-schema');

if (!/^[a-z0-9._-]+@[a-z0-9._-]+$/i.test(metadata.uuid ?? '')) {
  failures.push('metadata.json uuid must look like a GNOME extension UUID.');
}

if (!Array.isArray(metadata['shell-version']) || metadata['shell-version'].length === 0) {
  failures.push('metadata.json shell-version must be a non-empty array.');
} else if (
  !metadata['shell-version'].every(
    (version) => typeof version === 'string' && /^\d+$/.test(version),
  )
) {
  failures.push('metadata.json shell-version values must be numeric strings.');
}

const schemaPath = `schemas/${metadata['settings-schema']}.gschema.xml`;
if (!(await fileExists(schemaPath))) {
  failures.push(`metadata.json settings-schema points to missing schema file: ${schemaPath}`);
}

if (metadata.uuid !== 'lyricbar@fikrilal.github.io') {
  failures.push('metadata.json uuid must remain stable: lyricbar@fikrilal.github.io');
}

if (!metadata['shell-version']?.includes('46')) {
  failures.push(
    'metadata.json must explicitly support GNOME Shell 46 for the first release target.',
  );
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('metadata.json is valid.\n');
