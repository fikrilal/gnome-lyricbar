# Commit Conventions

LyricBar uses semantic scoped commit messages for maintainability and agent coordination.

## Format

```text
type(scope): message
```

Examples:

```text
feat(prefs): add copy diagnostics action
fix(mpris): keep latest browser playback status during debounce
docs(product): expand release notes
chore(harness): add youtube music browser fixtures
```

## Allowed Types

- `build`
- `chore`
- `ci`
- `docs`
- `feat`
- `fix`
- `perf`
- `refactor`
- `revert`
- `style`
- `test`

## Allowed Scopes

- `build`
- `ci`
- `diagnostics`
- `docs`
- `domain`
- `harness`
- `install`
- `lifecycle`
- `lyrics`
- `mpris`
- `prefs`
- `privacy`
- `product`
- `release`
- `runtime`
- `settings`
- `shell`
- `test`

## Local Enforcement

Install the local commit hook once per worktree:

```bash
npm ci
npm run setup:hooks
```

Check a commit range manually:

```bash
npm run commitlint -- --from origin/main --to HEAD
```

Check the last commit:

```bash
npm run commitlint -- --from HEAD~1 --to HEAD
```

GitHub CI intentionally does not run commitlint. CI should validate the code artifact; commit-message enforcement belongs in local tooling, agent workflow, and review.
