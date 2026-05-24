# LyricBar Documentation

This directory is the source of truth for LyricBar product direction, engineering rules, harness design, and execution plans.

## Start Here

- [Product overview](product.md): product definition, target users, v1 scope, and success criteria.
- [Engineering proposal](engineering-proposal.md): architecture, stack, module boundaries, testing, CI, release, and risks.
- [Privacy](privacy.md): network requests, local cache, logs, and data handling.
- [Troubleshooting](troubleshooting.md): install, runtime, player selection, lyric sync, and preference issues.
- [Release checklist](release-checklist.md): public release gates and runtime scenarios.
- [Agent harness](harness/agent-harness.md): agent-first workflow, verification gates, guardrails, and feedback loops.
- [Nested runtime harness](harness/nested-runtime-harness.md): recommended visual runtime evidence loop with nested GNOME Shell and mock MPRIS.
- [Runtime agent workflow](harness/runtime-agent-workflow.md): step-by-step nested Shell workflow for R&D agents.
- [Execution plans](exec-plans/README.md): planning workflow for non-trivial agent work.
- [Execution plan template](exec-plans/_template.md): required structure for non-trivial agent work plans.
- [Technical debt tracker](exec-plans/tech-debt-tracker.md): unresolved harness, product, and architecture debt.

## Directory Layout

```text
docs/
  README.md
  product.md
  engineering-proposal.md
  privacy.md
  troubleshooting.md
  release-checklist.md
  harness/
    agent-harness.md
    nested-runtime-harness.md
    runtime-agent-workflow.md
  exec-plans/
    README.md
    _template.md
    active/
    completed/
    tech-debt-tracker.md
```

## Documentation Rules

- Product intent belongs in `docs/product.md`.
- Architecture and implementation policy belong in `docs/engineering-proposal.md` until the topic is stable enough to split into focused engineering docs.
- Agent workflow and harness design belong in `docs/harness/`.
- Active implementation plans belong in `docs/exec-plans/active/`.
- Completed implementation plans belong in `docs/exec-plans/completed/`.
- Durable decisions should become ADRs once the project needs a decision log.
- Root-level Markdown should stay focused on public entry points and repository policy.

## Harness Rule

Documentation is not enough for rules that matter. If a rule affects desktop stability, privacy, release correctness, or architecture boundaries, prefer a validator, lint, test, or fixture.
