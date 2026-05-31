import { fileExists, readText } from './lib/repo.mjs';

const requiredDocs = [
  'AGENTS.md',
  'README.md',
  'docs/README.md',
  'docs/product.md',
  'docs/engineering/proposal.md',
  'docs/harness/agent-harness.md',
  'docs/exec-plans/README.md',
  'docs/exec-plans/_template.md',
  'docs/exec-plans/tech-debt-tracker.md',
];

const failures = [];

for (const path of requiredDocs) {
  if (!(await fileExists(path))) {
    failures.push(`Missing required documentation file: ${path}`);
  }
}

if (failures.length === 0) {
  const docsIndex = await readText('docs/README.md');
  for (const path of requiredDocs.filter(
    (path) => path.startsWith('docs/') && path !== 'docs/README.md',
  )) {
    const relativePath = path.replace('docs/', '');
    if (!docsIndex.includes(relativePath) && !docsIndex.includes(path)) {
      failures.push(`docs/README.md does not reference ${path}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Documentation structure is valid.\n');
