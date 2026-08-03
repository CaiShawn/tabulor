# ROADMAP

Status board for the `dev` branch. Sections:

- **Recent discussions**
- **Backlog** (highest priority first)

Shipped work history lives in `docs/v0.2-dev.md`, not here.

## Recently discussed

> Discussion that has not yet been promoted to a backlog entry, latest first.

- **Custom dashboard background image.** User-supplied image as the dashboard background. Open: source (file upload vs URL), storage (data URL size vs external URL; `chrome.storage.local` quota), interaction with theming (overlay/blur/opacity for content legibility).
- **Saved section renamed to "Reading list".** The right-column section was labeled "Bookmark" but is semantically a reading list (local, flat, ephemeral, manual archive). Renamed first so the upcoming `chrome.readingList` migration ships as a UI of Chrome Reading List, not a rename-during-migration.
- **Search + keyboard-first.** Fuzzy-search open tabs by title/URL to jump straight to one; make the dashboard keyboard-operable (search, navigate groups, rename, move tabs) for a terminal-style, hands-on-keys flow.
- **Per-tag pin/star system.** A lightweight "favorite tags" row pinned to the top, separate from the main grouped list.
- **Export / import of the whole group layout.** JSON in/out so a user can back up or share their tab dashboard.
- **README focus pointer.** Dev README's "Current development focus" now references this file so the two documents can evolve independently.
- **i18n (中英双语切换).** Add zh/en language switching for the UI. No i18n (`_locales`, `chrome.i18n`) plumbing exists yet — all UI strings are hardcoded English.
- **Manual light/dark toggle.** Theme currently auto-follows `prefers-color-scheme` (with a stored `theme` override + offscreen listener driving the toolbar icon); add a manual light/dark switcher.
- **Group as the core data structure.** Refactor `dataState.tabs` + `lastGroups` model so the group is the source of truth and the tab list is an input feed. Open questions and proposed shape to be discussed in a later session.

## Backlog

> Pending work, highest priority first.

### Migrate saved section to `chrome.readingList` (core direction)
The right-column "Reading list" section is semantically a reading list, not a bookmark; today it is backed by `dataState.saved` in `chrome.storage.local`. Migrate the backing store to `chrome.readingList` so Tabulor's right column becomes a view onto Chrome's Reading List — Tabulor's differentiation shifts from "another save-for-later tool" to "Chrome Reading List, surfaced on the new tab page with grouping, count badge, and quick push from any open tab".

Scope:
- Add `readingList` permission; gate the feature on Chrome 120+ minimum supported version.
- Replace reads with `chrome.readingList.query({hasBeenRead: false})`; map the "Archived" subsection to `hasBeenRead: true` or `removeEntry`.
- One-time data migration: import existing `dataState.saved` entries via `chrome.readingList.addEntry`, then drop the local key.
- Add Tabulor-native affordances on top of the raw list: count badge in the section header, per-domain grouping matching the open-tab groups, "send current tab to Reading list" from any open tab.

Open questions:
- Local cache for offline render, or trust the API and show a graceful empty state on error?
- De-dupe when a URL is in both Tabulor's old save list and Chrome Reading List?
- Per-tag pin/star (existing discussion) — survives on Reading List entries, or moves to a Tabulor-only annotation layer?

### Fix tag-delete group jumping
Deleting a tag inside a group can cause the group to jump/scroll elsewhere, breaking rapid consecutive deletion. Likely tied to how groups are sorted; investigate ordering (e.g. re-sorting on each mutation or stable grouping) and make the selected/current group stay put during batch removals.

### Switch Open tabs between single- and multi-column
Add a user toggle (section header action or settings entry) to flip the `Open tabs` region between the current CSS multi-column layout (`columns: 290px` on `.missions`) and a forced single column; persist the choice alongside the other layout prefs. Groups with `Fix tag-delete group jumping` as the next `Open tabs` UX pass.

### Keep Reading list / Archive visible at narrow widths
At narrow viewport widths, stack the columns: push `Reading list` + `Archive` below `Open tabs` (full width, normal page flow) instead of competing for horizontal space. The existing `@media (max-width: 800px)` rule already does this via `flex-direction: column`; raise the breakpoint so the stack fires before `.deferred-column` (`flex: 1 1 0; min-width: 0`) collapses to ~0 against `.active-section` (`flex: 2 1 0`). Stacked column defaults to expanded; user can collapse via the existing `Archive` toggle. Small UX fix.

> This file tracks the product only — agent configuration changes belong in `.pi`(do not trackd by git).
