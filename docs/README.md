# Docs

Developer-facing documentation that lives outside `README.md`. The README covers project setup, agent workflow, and contribution norms; this directory holds deeper technical references.

## File naming

Each major version introduces at most two sibling files:

| File | Purpose |
|---|---|
| `v{N}-architecture.md` | Frozen snapshot of the architecture at version N. Not edited in place once a newer version exists. |
| `v{N}-flaw.md` | Defect / product-fit review written against version N. Closed items stay as historical record. |

`v{N}` is the version the doc is *about*, not the version when the doc was written. Today the only such version is `0.1`; the next major architectural change introduces `v0.2-architecture.md` and (if a review is written) `v0.2-flaw.md`.

The architecture and flaw files for the same version do **not** cross-reference each other. The relationship between them is explained only here and in the top-level `README.md`. This keeps each file usable on its own.

## Current files

- [`v0.1-architecture.md`](./v0.1-architecture.md) — state and storage, grouping, styling, fonts, and `config.local.js` at v0.1.
- [`v0.1-flaw.md`](./v0.1-flaw.md) — review of v0.1 against upstream `tab-out`, covering architecture, UX, and engineering.

## Conventions

- Older files are **not** edited in place once a newer version exists. Update the newer doc instead and link from there if context demands.
- Closing an entry in a `v{N}-flaw.md` does not delete it; annotate the closing commit / PR next to the entry and move on.
- New docs in this directory must follow the `v{N}-{topic}.md` pattern unless a doc is genuinely version-agnostic (in which case it does not need a version prefix).
