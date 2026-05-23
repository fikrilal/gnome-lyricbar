import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { repoPath } from './lib/repo.mjs';

const metadata = JSON.parse(await readFile(repoPath('metadata.json'), 'utf8'));
const { uuid } = metadata;
const distRoot = repoPath('dist');
const buildRoot = join(distRoot, uuid);
const bundlePath = join(distRoot, `${uuid}.zip`);

const runtimeFiles = [
  'metadata.json',
  'extension.js',
  'prefs.js',
  'stylesheet.css',
  'schemas',
  'src/shell',
  'src/runtime',
  'src/domain',
];

await rm(distRoot, { recursive: true, force: true });
await mkdir(buildRoot, { recursive: true });

for (const path of runtimeFiles) {
  await cp(repoPath(path), join(buildRoot, path), { recursive: true });
}

const schemaResult = spawnSync('glib-compile-schemas', [join(buildRoot, 'schemas')], {
  encoding: 'utf8',
});

if (isNodeError(schemaResult.error) && schemaResult.error.code === 'ENOENT') {
  process.stderr.write('glib-compile-schemas is required to build the extension bundle.\n');
  process.exit(1);
}

if (schemaResult.status !== 0) {
  process.stderr.write(schemaResult.stderr || schemaResult.stdout);
  process.exit(schemaResult.status ?? 1);
}

const manifest = {
  uuid,
  builtAt: new Date().toISOString(),
  files: runtimeFiles,
};
await writeFile(
  join(buildRoot, 'build-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

const zipResult = spawnSync('zip', ['-qr', bundlePath, '.'], {
  cwd: buildRoot,
  encoding: 'utf8',
});

if (isNodeError(zipResult.error) && zipResult.error.code === 'ENOENT') {
  process.stderr.write('zip is required to build the extension bundle.\n');
  process.exit(1);
}

if (zipResult.status !== 0) {
  process.stderr.write(zipResult.stderr || zipResult.stdout);
  process.exit(zipResult.status ?? 1);
}

await mkdir(dirname(bundlePath), { recursive: true });
process.stdout.write(`Built ${bundlePath}\n`);

/**
 * @param {unknown} error
 * @returns {error is NodeJS.ErrnoException}
 */
function isNodeError(error) {
  return error instanceof Error;
}
