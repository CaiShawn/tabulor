# ROADMAP

Status board for the `dev` branch. Sections:

- **Recent discussions**
- **What’s In progress**
- **Backlog** (highest priority first)

Shipped work history lives in `docs/v0.2-dev.md`, not here.

## Recently discussed

> Discussion that has not yet been promoted to a backlog entry, latest first.

- **README focus pointer.** Dev README's "Current development focus" now references this file so the two documents can evolve independently.
- **Group as the core data structure.** Refactor `dataState.tabs` + `lastGroups` model so the group is the source of truth and the tab list is an input feed. Open questions and proposed shape to be discussed in a later session.

## In progress

> Work actively being implemented on `dev` at the moment.

### Theme the saved-column scrollbar
Make the browser-native scrollbar on `.deferred-column` follow the active style: WebKit/Blink selectors first, standard properties as fallback; square thumb + `--line` / `--muted` (or `--ink`) for terminal, subtle custom for classic. Three open questions on classic / thumb color / width still pending.

## Backlog

> Pending work, highest priority first.

### Fix tag-delete group jumping
Deleting a tag inside a group can cause the group to jump/scroll elsewhere, breaking rapid consecutive deletion. Likely tied to how groups are sorted; investigate ordering (e.g. re-sorting on each mutation or stable grouping) and make the selected/current group stay put during batch removals.

### Browser parity notes
README mentions "Chrome usually picks up changes to an unpacked extension automatically", but the same has not been confirmed for Edge / Brave / Arc / Firefox. Capture observed behavior in a short note under `extension/` or in the release notes when `0.2.x` ships.

> This file tracks the product only — agent configuration changes belong in `.pi`(do not trackd by git).
