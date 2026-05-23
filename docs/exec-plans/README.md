# Execution Plans

Execution plans are checked-in work plans for non-trivial agent tasks.

Use a plan when a change includes:

- multiple implementation steps
- GNOME Shell lifecycle behavior
- D-Bus or MPRIS behavior
- network/provider behavior
- cache behavior
- release or CI behavior
- architecture decisions
- medium/high-risk user-facing behavior

Tiny docs edits and mechanical one-file changes do not need plans.

## Workflow

1. Copy `_template.md` into `active/`.
2. Fill in objective, constraints, acceptance criteria, risk, and checklist.
3. Keep the checklist current while implementing.
4. Record verification commands and outcomes before completion.
5. Move the plan to `completed/` when done.
6. Add unresolved follow-ups to `tech-debt-tracker.md`.

## Naming

Use date-prefixed filenames:

```text
YYYY-MM-DD_short-title.md
```

Example:

```text
2026-05-23_mpris-player-discovery.md
```
