import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { fileExists, repoPath } from './lib/repo.mjs';

const repoMetadataPath = 'metadata.json';
const repoMetadata = JSON.parse(await readFile(repoPath(repoMetadataPath), 'utf8'));
const { uuid } = repoMetadata;

if (typeof uuid !== 'string' || uuid.trim() === '') {
  process.stderr.write('validate-bundle: metadata.json uuid is missing; run validate:metadata.\n');
  process.exit(1);
}

const distRoot = repoPath('dist');
const unpackedDir = join(distRoot, uuid);
const unpackedMetadataPath = join(unpackedDir, 'metadata.json');
const bundlePath = join(distRoot, `${uuid}.zip`);

const failures = [];

if (!(await fileExists(`dist/${uuid}/metadata.json`))) {
  failures.push(
    `validate-bundle: unpacked bundle metadata not found at dist/${uuid}/metadata.json. Run npm run build:extension first.`,
  );
}

if (!(await fileExists(`dist/${uuid}.zip`))) {
  failures.push(
    `validate-bundle: bundle zip not found at dist/${uuid}.zip. Run npm run build:extension first.`,
  );
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

const unpackedMetadata = JSON.parse(await readFile(unpackedMetadataPath, 'utf8'));

const unzipResult = spawnSync('unzip', ['-p', bundlePath, 'metadata.json'], {
  encoding: 'utf8',
});

if (isNodeError(unzipResult.error) && unzipResult.error.code === 'ENOENT') {
  process.stderr.write('validate-bundle: unzip is required to inspect the bundle.\n');
  process.exit(1);
}

if (unzipResult.status !== 0) {
  process.stderr.write(unzipResult.stderr || unzipResult.stdout || 'unzip failed.\n');
  process.exit(unzipResult.status ?? 1);
}

const zippedMetadataText = unzipResult.stdout;
if (!zippedMetadataText) {
  failures.push('validate-bundle: bundle zip does not contain metadata.json.');
} else {
  const zippedMetadata = JSON.parse(zippedMetadataText);
  compareMetadata('dist/<uuid>/metadata.json (unpacked)', unpackedMetadata, repoMetadata, failures);
  compareMetadata('metadata.json inside zip', zippedMetadata, repoMetadata, failures);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(
  `Bundle metadata matches repo metadata (version-name: ${repoMetadata['version-name'] ?? 'unset'}).\n`,
);

/**
 * @param {string} label
 * @param {Record<string, unknown>} candidate
 * @param {Record<string, unknown>} expected
 * @param {string[]} failures
 * @returns {void}
 */
function compareMetadata(label, candidate, expected, failures) {
  const fields = ['uuid', 'name', 'version-name', 'description', 'url', 'settings-schema'];
  for (const field of fields) {
    if (candidate[field] !== expected[field]) {
      failures.push(
        `validate-bundle: ${label} field "${field}" is "${formatValue(candidate[field])}" but repo metadata.json says "${formatValue(expected[field])}". Did you forget to rebuild after bumping the version?`,
      );
    }
  }

  const candidateShellVersions = Array.isArray(candidate['shell-version'])
    ? [...candidate['shell-version']]
    : [];
  const expectedShellVersions = Array.isArray(expected['shell-version'])
    ? [...expected['shell-version']]
    : [];
  if (
    candidateShellVersions.length !== expectedShellVersions.length ||
    candidateShellVersions.some((value, index) => value !== expectedShellVersions[index])
  ) {
    failures.push(
      `validate-bundle: ${label} shell-version is ${JSON.stringify(candidateShellVersions)} but repo metadata.json says ${JSON.stringify(expectedShellVersions)}.`,
    );
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(value) {
  if (value === undefined) {
    return '<missing>';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * @param {unknown} error
 * @returns {error is NodeJS.ErrnoException}
 */
function isNodeError(error) {
  return error instanceof Error;
}
