# Agent Harness

## Purpose

LyricBar is expected to be built mostly through agent execution with a human acting as product owner, reviewer, and final decision maker.

That changes what the repository needs first. Before major product behavior exists, the repo needs a harness that makes agent work:

- legible
- bounded
- mechanically verifiable
- recoverable across sessions
- safe for a GNOME Shell extension runtime

The harness is the development environment, docs map, verification scripts, execution-plan workflow, and architecture guardrails that let agents safely make progress.

## Principles

### `AGENTS.md` Is A Map

Root `AGENTS.md` should stay short and point agents to source-of-truth docs. Detailed rules belong in docs, validators, tests, and scripts.

### Repository Knowledge Is The System Of Record

If an agent needs to know something repeatedly, encode it in the repository.

Examples:

- architecture boundaries
- GNOME Shell lifecycle rules
- MPRIS integration constraints
- privacy policy
- verification commands
- execution plans
- known debt

### Enforcement Beats Reminder Text

When a rule matters, prefer a script, lint, test, fixture, or scaffold over prose alone.

Examples:

- metadata shape -> `scripts/validate-metadata.mjs`
- GSettings schema shape -> `scripts/validate-schema.mjs`
- docs structure -> `scripts/validate-docs.mjs`
- architecture boundaries -> `scripts/check-architecture.mjs`
- release bundle contents -> `scripts/build-extension.mjs`

### Agent Legibility Is A Product Requirement

Code should be readable by future agent runs, not only humans.

That means:

- stable paths
- explicit boundaries
- small modules
- predictable naming
- source-local docs where useful
- minimal hidden state
- boring dependencies

### Promote Repeated Feedback Into The Harness

If the same issue appears twice, it should become one of:

- a coding rule
- a verification script
- a unit test
- a fixture
- a scaffold/template update
- an ADR
- an execution-plan checklist item

## Harness Components

### Docs Map

Current docs map:

```text
docs/
  README.md
  product.md
  players/
  engineering/
    proposal.md
  contributing/
  operations/
  harness/
  exec-plans/
```

The docs index should be enough for a fresh agent to find the right context without reading every file.

### Execution Plans

Non-trivial tasks should create a plan under:

```text
docs/exec-plans/active/
```

Plans are used when work includes:

- multiple implementation steps
- GNOME Shell lifecycle changes
- D-Bus behavior
- network/provider behavior
- cache behavior
- architecture decisions
- release workflow changes
- risky desktop behavior

Tiny docs edits do not need plans.

### Verification Scripts

Canonical static-safe command:

```bash
npm run verify:safe
```

`npm run verify` is an alias for `npm run verify:safe`. The verify gate
should be the one command agents run before claiming static completion.

Current verification stages:

- docs structure validation
- metadata validation
- GSettings schema validation
- architecture guardrails
- formatting check
- lint
- unit tests
- extension bundle build

### Architecture Checks

Architecture checks start small and grow with the codebase.

Initial checks:

- `src/domain/` must not import GNOME Shell APIs.
- `src/domain/` must not import `gi://` modules.
- `src/domain/` must not use D-Bus, filesystem, network, or timer APIs.
- runtime code must not call `Gio.bus_watch_name` with wildcard names.
- Shell runtime `connect(...)` calls require tracked `disconnect(...)` cleanup.
- Shell runtime `GLib.timeout_add(...)` calls require tracked `GLib.source_remove(...)` cleanup.
- Shell runtime `Gio.bus_watch_name(...)` calls require tracked `Gio.bus_unwatch_name(...)` cleanup.
- Shell runtime `Gio.Cancellable` usage requires explicit cancellation on disable.
- production source must not use `console.log`.

These checks are intentionally simple. They catch easy drift early and give agents immediate feedback.

### Runtime Evidence

Static checks cannot fully prove a GNOME Shell extension is safe. Medium/high-risk changes should include runtime evidence.

Examples:

- extension enabled successfully
- extension disabled successfully
- logout/login smoke check
- Spotify started before extension
- Spotify started after extension
- Spotify quit while extension is active
- network failure while lyrics are loading

Runtime evidence belongs in the relevant execution plan or release notes.
It must follow `docs/harness/runtime-evidence.md`.

## Initial Harness Build Order

1. Keep `AGENTS.md` short and map-like.
2. Maintain `docs/README.md` as the docs index.
3. Add `docs/exec-plans/` workflow.
4. Add `npm run verify`.
5. Add metadata, schema, architecture, and bundle validators.
6. Add a smoke extension only after the harness can verify itself.
7. Add MPRIS and lyrics behavior behind tests and targeted runtime checks.

## Human Commander Workflow

For non-trivial tasks, the human should be able to say:

```text
Create an execution plan for X, then implement it and run the harness.
```

The agent should then:

1. Read `AGENTS.md`.
2. Read relevant docs only.
3. Create or update an execution plan.
4. Implement the change.
5. Run `npm run verify:safe`.
6. Update the plan with verification evidence.
7. Summarize outcome and remaining risk.

## Harness Debt

Harness debt is real debt.

Examples:

- verification scripts that are too slow
- docs that point to moved files
- architecture checks with noisy false positives
- missing fixtures for bugs we already saw
- commands that agents cannot run locally
- runtime evidence that is hard to collect

Track unresolved harness debt in:

```text
docs/exec-plans/tech-debt-tracker.md
```
