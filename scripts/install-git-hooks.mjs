import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { repoRoot } from './lib/repo.mjs';

const root = repoRoot;
const hooksPath = join(root, '.githooks');

if (!existsSync(join(root, '.git'))) {
  console.error('Git hooks can only be installed from a git worktree.');
  process.exit(1);
}

if (!existsSync(hooksPath)) {
  console.error(`Missing hooks directory: ${hooksPath}`);
  process.exit(1);
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: root,
  stdio: 'inherit',
});

process.stdout.write('Configured git core.hooksPath=.githooks\n');
