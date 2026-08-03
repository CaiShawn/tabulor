# Docs

Developer-facing documentation that lives outside `README.md`. The README covers project setup, agent workflow, and contribution norms; this directory holds deeper technical references.

## File naming

Each version has one consolidated dev document:

| File | Contents |
|---|---|
| `v{N}-dev.md` | The complete dev record for version N: architecture snapshot, product surface, and the defect / product-fit review. Frozen once a newer version exists. |

`v{N}` is the version the doc is *about*, not the version when the doc was written. Today the editions are `v0.1-dev.md` and `v0.2-dev.md`. The next major architectural change updates/adds `v0.3-dev.md` and frees the older files from further edits.

## Current files

- [`v0.1-dev.md`](./v0.1-dev.md) — v0.1 architecture (state, grouping, styling, fonts, config), product surface from the upstream fork, and the flaw review vs `tab-out`.
- [`v0.2-dev.md`](./v0.2-dev.md) — v0.2 shipped history (moved out of `ROADMAP.md`), latest first.

## Conventions

- A version's dev document is **not** edited in place once a newer version exists. Update the newer version's doc instead and link from there if context demands.
- Closing an entry in the flaw section does not delete it; annotate the closing commit / PR next to the entry and move on.
- New docs in this directory follow the `v{N}-dev.md` pattern unless a doc is genuinely version-agnostic (in which case it does not need a version prefix).
