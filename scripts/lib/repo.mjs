import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

export const repoRoot = resolve(import.meta.dirname, '..', '..');

/**
 * @param {...string} parts
 * @returns {string}
 */
export function repoPath(...parts) {
  return resolve(repoRoot, ...parts);
}

/**
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function readText(path) {
  return readFile(repoPath(path), 'utf8');
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
export async function fileExists(path) {
  try {
    const info = await stat(repoPath(path));
    return info.isFile();
  } catch {
    return false;
  }
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
export async function dirExists(path) {
  try {
    const info = await stat(repoPath(path));
    return info.isDirectory();
  } catch {
    return false;
  }
}

/**
 * @typedef {Readonly<{
 *   ignoredDirs?: readonly string[],
 * }>} ListFilesOptions
 */

/**
 * @param {string} rootPath
 * @param {ListFilesOptions} [options]
 * @returns {Promise<string[]>}
 */
export async function listFiles(rootPath, options = {}) {
  const rootAbs = repoPath(rootPath);
  const ignoredDirs = new Set(options.ignoredDirs ?? ['.git', 'node_modules', 'dist', 'coverage']);
  /** @type {string[]} */
  const files = [];

  /**
   * @param {string} dirAbs
   * @returns {Promise<void>}
   */
  async function walk(dirAbs) {
    const entries = await readdir(dirAbs, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && ignoredDirs.has(entry.name)) {
        continue;
      }

      const abs = resolve(dirAbs, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      files.push(relative(repoRoot, abs).replaceAll('\\', '/'));
    }
  }

  await walk(rootAbs);
  files.sort((left, right) => left.localeCompare(right));
  return files;
}
