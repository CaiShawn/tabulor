# ROADMAP

Status board for the `dev` branch. Sections:

- **Recent discussions**
- **Backlog** (highest priority first)

Shipped work history lives in `docs/v0.2-dev.md`, not here.

## Recently discussed

> Discussion that has not yet been promoted to a backlog entry, latest first.

- **Search + keyboard-first.** Fuzzy-search open tabs by title/URL to jump straight to one; make the dashboard keyboard-operable (search, navigate groups, rename, move tabs) for a terminal-style, hands-on-keys flow.
- **Tab pin.** Pin a group to a compact chip row at the top of the active section; clicking a chip opens an inline preview popover listing every tab in the group, so picking a tab never switches the dashboard away. Persisted via `pinnedGroupKeys` in storage; the very-top dashboard slot stays free for the future per-tab pinning.


### Group-as-core refactor (with dependent layout + ordering)

- **Group/tab ordering controls.** The current first-tab-position ordering is stable enough for now, but alternate ordering rules and their interaction with the group-as-core-data model should be revisited later.
- **Group as the core data structure.** Refactor `dataState.tabs` + `lastGroups` model so the group is the source of truth and the tab list is an input feed. Open questions and proposed shape to be discussed in a later session. Carries the narrow-width stacking fix (former backlog item: `Reading list` + `Archive` should stay visible below `Open tabs` at viewports that can't fit both columns comfortably).

## Backlog

> Pending work, highest priority first.

> This file tracks the product only — agent configuration changes belong in `.pi`(do not trackd by git).
