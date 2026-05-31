# Repository Guidelines

## Project Posture

LyricBar is a public GNOME Shell extension that runs inside the user's desktop shell process. Favor correctness, explicit lifecycle cleanup, and mechanical verification over feature speed.

## Source Of Truth

Start here:

- Docs index: `docs/README.md`
- Product overview: `docs/product.md`
- Engineering proposal: `docs/engineering/proposal.md`
- Agent harness: `docs/harness/agent-harness.md`
- Browser player R&D workflow: `docs/harness/browser-player-rnd-workflow.md`
- Execution plans: `docs/exec-plans/README.md`

## Non-Negotiables

- GNOME Shell runtime code uses GJS JavaScript and GNOME platform APIs directly.
- Product behavior integrates through MPRIS over D-Bus; do not scrape Spotify, browser windows, credentials, or private app state.
- Pure logic under `src/domain/` must not import GNOME Shell, GJS, D-Bus, filesystem, network, or UI APIs.
- Shell runtime code must clean up signal handlers, D-Bus subscriptions, timeouts, cancellables, and actors on disable.
- Browser-player support work must follow `docs/harness/browser-player-rnd-workflow.md` before implementation or final recommendations.
- Async callbacks must be guarded so they do not mutate state after disable.
- Never use wildcard names with `Gio.bus_watch_name`; it only accepts exact D-Bus names.
- Treat JavaScript as strict production code: no `any`-style loose shapes in domain logic, no unchecked external data, and keep JSDoc contracts current.
- Keep `AGENTS.md` short. Promote durable rules into docs, tests, validators, or scripts.

## Verification

Baseline check for changes:

```bash
npm run verify
```

Targeted checks:

```bash
npm run lint
npm test
npm run build:extension
```

Docs-only changes can run:

```bash
npm run verify:docs
```

If dependencies are not installed, run `npm install` before verification.

## Commit Messages

Use semantic scoped commits:

```text
type(scope): message
```

See `docs/contributing/commit-conventions.md` for allowed types/scopes and local hook setup. GitHub CI intentionally does not run commitlint.

## Agent Workflow

For non-trivial implementation work:

1. Read `docs/README.md` and the relevant topic docs.
2. Create or update an execution plan under `docs/exec-plans/active/`.
3. Implement small, reversible changes.
4. Run the relevant verification gate.
5. Record verification evidence in the plan.
6. Promote repeated mistakes into a guardrail.

## Documentation Discipline

If the same issue appears twice, promote it into one of:

- an architecture rule
- a validator or verify script
- a unit test
- a fixture
- an execution-plan checklist item
- an ADR or engineering doc

Do not rely on chat history as durable project memory.
