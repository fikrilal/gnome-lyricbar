# LyricBar Documentation

This directory is the source of truth for LyricBar product direction, engineering rules, harness design, and execution plans.

## Start Here

- [Product overview](product.md): product definition, target users, v1 scope, and success criteria.
- [Compatibility matrix](compatibility.md): tested GNOME Shell versions, browser clients, music clients, and evidence requirements.
- [Privacy](privacy.md): network requests, local cache, logs, and data handling.
- [Engineering proposal](engineering/proposal.md): architecture, stack, module boundaries, testing, CI, release, and risks.

## Player Support

- [Player support overview](players/README.md): how LyricBar supports each player and how to add a new one.
- [Player profile architecture](players/profile-architecture.md): MPRIS profile and metadata stability design for Spotify Desktop, browser players, YouTube Music, and Apple Music.
- [Spotify Web](players/spotify-web.md): live MPRIS findings and phased improvements for better Spotify browser support.
- [YouTube Music](players/youtube-music.md): live MPRIS findings and phased work for explicit YouTube Music browser compatibility.
- [Apple Music](players/apple-music.md): live MPRIS findings and implementation plan for Apple Music Web support.
- [TIDAL observation](players/tidal.md): TIDAL Web playback observed through generic Chrome MPRIS; LyricBar cannot identify TIDAL from the captured data.
- [Firefox](players/firefox.md): live MPRIS findings and limitations for Firefox-backed players.

## Contributing

- [Commit conventions](contributing/commit-conventions.md): semantic scoped commit rules and local hook setup.

## Operations

- [Troubleshooting](operations/troubleshooting.md): install, runtime, player selection, lyric sync, and preference issues.
- [Release checklist](operations/release-checklist.md): public release gates and runtime scenarios.
- [Release notes](release-notes/): curated user-facing notes for GitHub Releases.

## Harness

- [Agent harness](harness/agent-harness.md): agent-first workflow, verification gates, guardrails, and feedback loops.
- [Browser player R&D workflow](harness/browser-player-rnd-workflow.md): mandatory evidence workflow for Spotify Web, YouTube Music, Apple Music Web, and future browser player support.
- [Nested runtime harness](harness/nested-runtime-harness.md): recommended visual runtime evidence loop with nested GNOME Shell and mock MPRIS.
- [Runtime agent workflow](harness/runtime-agent-workflow.md): step-by-step nested Shell workflow for R&D agents.

## Execution Plans

- [Execution plans](exec-plans/README.md): planning workflow for non-trivial agent work.
- [Execution plan template](exec-plans/_template.md): required structure for non-trivial agent work plans.
- [Technical debt tracker](exec-plans/tech-debt-tracker.md): unresolved harness, product, and architecture debt.

## Directory Layout

```text
docs/
  README.md
  product.md
  compatibility.md
  privacy.md
  players/
    README.md
    profile-architecture.md
    spotify-web.md
    youtube-music.md
    apple-music.md
    tidal.md
    firefox.md
  engineering/
    proposal.md
  contributing/
    commit-conventions.md
  operations/
    troubleshooting.md
    release-checklist.md
  release-notes/
    v0.1.10.md
  harness/
    agent-harness.md
    browser-player-rnd-workflow.md
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
- Architecture and implementation policy belong in `docs/engineering/proposal.md` until the topic is stable enough to split into focused engineering docs.
- Per-player support docs belong in `docs/players/`, named `players/<service>.md`.
- Contributor policy belongs in `docs/contributing/`.
- Operational runbooks and release gates belong in `docs/operations/`.
- Agent workflow and harness design belong in `docs/harness/`.
- Active implementation plans belong in `docs/exec-plans/active/`.
- Completed implementation plans belong in `docs/exec-plans/completed/`.
- Curated GitHub Release bodies belong in `docs/release-notes/vX.Y.Z.md`.
- Durable decisions should become ADRs once the project needs a decision log.
- Root-level Markdown should stay focused on public entry points and repository policy.

## Harness Rule

Documentation is not enough for rules that matter. If a rule affects desktop stability, privacy, release correctness, or architecture boundaries, prefer a validator, lint, test, or fixture.
