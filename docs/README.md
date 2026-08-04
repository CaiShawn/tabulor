# Docs

Per-version technical references under `docs/`.

## File naming

- `v{N}-dev.md` — N is the version the doc is *about*, not when it was written.
- Version-agnostic docs (e.g. `ROADMAP.md`) skip the prefix.

## Current files

- [`v0.1-dev.md`](./v0.1-dev.md) — v0.1 architecture + flaw review vs `tab-out`. Frozen.
- [`v0.2-dev.md`](./v0.2-dev.md) — v0.2 shipped history, latest first.
- [`ROADMAP.md`](./ROADMAP.md) — dev branch status board (recently discussed / backlog).
- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — `dev` branch workflow guide: setup, validation, git conventions, agent notes.

## Conventions

- **Read this README before editing any file in `docs/`.**
- Per-version entries: `## vN` heading + `### New Feature` / `### Code Review` / `### Bug Fix` sub-headings.
- Newer versions freeze the older. Don't edit in place; annotate closing commit / PR next to flaw entries.