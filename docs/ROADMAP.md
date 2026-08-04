# ROADMAP

Status board for the `dev` branch. Sections:

- **Recent discussions**
- **Backlog** (highest priority first)

Shipped work history lives in `docs/v0.2-dev.md`, not here.

## Recently discussed

> Discussion that has not yet been promoted to a backlog entry, latest first.

- **Search + keyboard-first.** Fuzzy-search open tabs by title/URL to jump straight to one; make the dashboard keyboard-operable (search, navigate groups, rename, move tabs) for a terminal-style, hands-on-keys flow.
- **Per-tag pin/star system.** A lightweight "favorite tags" row pinned to the top, separate from the main grouped list.
- **Flip dashboard columns horizontally.** Add a layout option to switch between `Open tabs → Reading list` and `Reading list → Open tabs`; persist the preference with the other layout settings.
- **Manual light/dark toggle.** Theme currently auto-follows `prefers-color-scheme` (with a stored `theme` override + offscreen listener driving the toolbar icon); add a manual light/dark switcher.

### Group-as-core refactor (with dependent layout + ordering)

- **Group/tab ordering controls.** The current first-tab-position ordering is stable enough for now, but alternate ordering rules and their interaction with the group-as-core-data model should be revisited later.
- **Group as the core data structure.** Refactor `dataState.tabs` + `lastGroups` model so the group is the source of truth and the tab list is an input feed. Open questions and proposed shape to be discussed in a later session. Carries the narrow-width stacking fix (former backlog item: `Reading list` + `Archive` should stay visible below `Open tabs` at viewports that can't fit both columns comfortably).

## Backlog

> Pending work, highest priority first.

### Export / import of the whole group layout
JSON in/out so a user can back up or share their tab dashboard.

### i18n (中英双语切换)
Add zh/en language switching for the UI. No i18n (`_locales`, `chrome.i18n`) plumbing exists yet — all UI strings are hardcoded English.

### Custom dashboard background image
User-supplied image as the dashboard background. Open: source (file upload vs URL), storage (data URL size vs external URL; `chrome.storage.local` quota), interaction with theming (overlay/blur/opacity for content legibility).

> This file tracks the product only — agent configuration changes belong in `.pi`(do not trackd by git).
