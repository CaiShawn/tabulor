# ROADMAP

Status board for the `dev` branch. Sections:

- **Recent discussions**
- **Backlog** (highest priority first)

Shipped work history lives in `docs/v0.2-dev.md`, not here.

## Recently discussed

> Discussion that has not yet been promoted to a backlog entry, latest first.

- **Search + keyboard-first.** Fuzzy-search open tabs by title/URL to jump straight to one; make the dashboard keyboard-operable (search, navigate groups, rename, move tabs) for a terminal-style, hands-on-keys flow.
- **Tab pin.** Pin a group to a compact chip row at the top of the active section; clicking a chip opens an inline preview popover listing every tab in the group, so picking a tab never switches the dashboard away. Persisted via `pinnedGroupKeys` in storage; the very-top dashboard slot stays free for the future per-tab pinning.
- **Horizontal mirror flip.** Swap icon next to the layout-toggle flips `.dashboard-columns` between `Open tabs | Reading list` and `Reading list | Open tabs`; preference stored in `columnOrder`; narrow-viewport stack uses `column-reverse`. Vertical flip is intentionally out of scope.
- **Manual light/dark toggle.** Sun/moon icon next to the column-flip-toggle overrides the OS-level `prefers-color-scheme` signal. Default follows OS via the existing `dataState.theme: null`; first click exits auto and sets the opposite of the current OS theme, subsequent clicks alternate light ↔ dark. No UI path back to auto — clearing the `theme` storage key restores the OS-follow default.
- **Custom dashboard background image.** Gear icon at the rightmost of the section header opens a Settings menu (absorbing the previous top-level Backup) with "Choose image…" (File System Access API, `showOpenFilePicker`, image MIME types only) and "Clear background". The picked `FileSystemFileHandle` is stored in IndexedDB (`tabulor-bg.handles.background`); image bytes never enter extension storage. On every load the handle is re-read and a fresh blob URL is applied to `body { background: ... center / cover no-repeat fixed }`. No size limit (file stays on disk); cards retain solid `--card` for readability.

​		FSA fail -> local storage

### Group-as-core refactor (with dependent layout + ordering)

- **Group/tab ordering controls.** The current first-tab-position ordering is stable enough for now, but alternate ordering rules and their interaction with the group-as-core-data model should be revisited later.
- **Group as the core data structure.** Refactor `dataState.tabs` + `lastGroups` model so the group is the source of truth and the tab list is an input feed. Open questions and proposed shape to be discussed in a later session. Carries the narrow-width stacking fix (former backlog item: `Reading list` + `Archive` should stay visible below `Open tabs` at viewports that can't fit both columns comfortably).

## Backlog

> Pending work, highest priority first.

> This file tracks the product only — agent configuration changes belong in `.pi`(do not trackd by git).
