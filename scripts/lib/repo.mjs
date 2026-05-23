import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

export const repoRoot = resolve(import.meta.dirname, '..', '..');

export function repoPath(...parts) {
  return resolve(repoRoot, ...parts);
}

export async function readText(path) {
  return await readFile(repoPath(path), 'utf8');
}

export async function fileExists(path) {
  try {
    const info = await stat(repoPath(path));
    return info.isFile();
  } catch {
    return false;
  }
}

export async function dirExists(path) {
  try {
    const info = await stat(repoPath(path));
    return info.isDirectory();
  } catch {
    return false;
  }
}

export async function listFiles(rootPath, options = {}) {
  const rootAbs = repoPath(rootPath);
  const ignoredDirs = new Set(options.ignoredDirs ?? ['.git', 'node_modules', 'dist', 'coverage']);
  const files = [];

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
