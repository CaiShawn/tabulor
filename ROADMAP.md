# ROADMAP

Status board for the `dev` branch. Sections:

- **Recent discussions**
- **Backlog** (highest priority first)

Shipped work history lives in `docs/v0.2-dev.md`, not here.

## Recently discussed

> Discussion that has not yet been promoted to a backlog entry, latest first.

- **Search + keyboard-first.** Fuzzy-search open tabs by title/URL to jump straight to one; make the dashboard keyboard-operable (search, navigate groups, rename, move tabs) for a terminal-style, hands-on-keys flow.
- **Per-tag pin/star system.** A lightweight "favorite tags" row pinned to the top, separate from the main grouped list.
- **Export / import of the whole group layout.** JSON in/out so a user can back up or share their tab dashboard.
- **README focus pointer.** Dev README's "Current development focus" now references this file so the two documents can evolve independently.
- **i18n (中英双语切换).** Add zh/en language switching for the UI. No i18n (`_locales`, `chrome.i18n`) plumbing exists yet — all UI strings are hardcoded English.
- **Manual light/dark toggle.** Theme currently auto-follows `prefers-color-scheme` (with a stored `theme` override + offscreen listener driving the toolbar icon); add a manual light/dark switcher.
- **Group as the core data structure.** Refactor `dataState.tabs` + `lastGroups` model so the group is the source of truth and the tab list is an input feed. Open questions and proposed shape to be discussed in a later session.

## Backlog

> Pending work, highest priority first.

### Fix tag-delete group jumping
Deleting a tag inside a group can cause the group to jump/scroll elsewhere, breaking rapid consecutive deletion. Likely tied to how groups are sorted; investigate ordering (e.g. re-sorting on each mutation or stable grouping) and make the selected/current group stay put during batch removals.

> This file tracks the product only — agent configuration changes belong in `.pi`(do not trackd by git).
