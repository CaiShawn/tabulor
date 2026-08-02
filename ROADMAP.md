# ROADMAP

Status board for the `dev` branch. Sections:

- **Recent discussions**
- **What’s In progress**
- **Backlog** (highest priority first)
- **Shipped** (latest commits first)

## Recently discussed

> Discussion that has not yet been promoted to a backlog entry, latest first.

- **Archive module redesign.** Scope of the redesign (toggle handling, search UX, dedupe vs un-complete, theme tokens) still to be decided; not yet a backlog entry.
- **README focus pointer.** Dev README's "Current development focus" now references this file so the two documents can evolve independently.
- **Group as the core data structure.** Refactor `dataState.tabs` + `lastGroups` model so the group is the source of truth and the tab list is an input feed. Open questions and proposed shape to be discussed in a later session.

## In progress

> Work actively being implemented on `dev` at the moment.

### Theme the saved-column scrollbar
Make the browser-native scrollbar on `.deferred-column` follow the
active style: WebKit/Blink selectors first, standard properties as
fallback; square thumb + `--line` / `--muted` (or `--ink`) for
terminal, subtle custom for classic. Three open questions on
classic / thumb color / width still pending.

## Backlog

> Pending work, highest priority first.

### Browser parity notes
README mentions "Chrome usually picks up changes to an unpacked
extension automatically", but the same has not been confirmed for
Edge / Brave / Arc / Firefox. Capture observed behavior in a short
note under `extension/` or in the release notes when `0.2.x` ships.

## Shipped

> Completed work on `dev`, latest commits first.

### Drop the not-quite-SemVer bump: adopt `0.2.x`
**Shipped 2026-08-02** (commits `7384d4a`, current). Chrome rejects
version strings that are not dot-separated integers, so `2.1.0-beta`
was not a legal manifest value. The branch now ships `0.2.1` and
follows SemVer from here on.

### Toolbar action icon follows `prefers-color-scheme`
**Shipped 2026-08-02** (commits `b526f5e`, `523aed2`). Toolbar /
puzzle-menu icon swaps via `chrome.action.setIcon` on
`tabulor:theme-change` messages; `offscreen.html` (with the
`MATCH_MEDIA` reason) watches OS color-scheme globally because MV3
service workers cannot use `matchMedia`. Race fixed where the
default-light path could overwrite a message-driven dark update.

**Failed direction (recorded for posterity):** a theme-neutral
single icon for the tab bar was proposed (light/dark badge variants
of the same glyph) and rejected by the user ("效果不好，不用继续了").
The tab-bar (`chrome_url_overrides`) and `chrome://extensions` icons
are static `manifest.json` entries with no dynamic API, so the
toolbar / puzzle-menu is the only spot that can follow the theme.

### Re-render shipped extension icons in terminal style
**Shipped 2026-08-02** (commit `dcf67e9`). Light and dark PNG/SVG
variants produced from `icon.svg` in terminal style; manifest
updated.

### Bundle self-hosted fonts and unify style metrics
**Shipped 2026-08-02** (commits `f264034`, `16b4ef4`, `2fcbd44`,
`40cccad`, `bf6b475`). Inter, Meslo LG Mono, and Noto Sans SC served
from `extension/fonts/` with no external font request; attribution in
`extension/fonts/CREDITS.md`. Same series introduced the selectable
visual styles (Classic / Terminal) model with `data-style` /
`data-theme` separation and `styleId` persisted in
`chrome.storage.local`.

### Drop the Homepages special-case grouping
**Shipped 2026-08-02** (commit `d3461dc`). The fork's `landingRules`
table (which gave 163/QQ Mail, Bilibili, Weibo, Xiaohongshu, Zhihu,
etc. their own "Homepages" card) is removed; all tabs now group by
hostname alone, with the same-label auto-merge (core) handling the
"feels like it deserves its own card" cases.

### README: drop the "in transition" caveat
**Shipped 2026-08-02**. With the icon re-render shipped, the README's
terminal-icons bullet is accurate again; no edit needed.

## Core (from tab-out)

> Product behavior inherited from the original tab-out fork; ships on
> both `main` and `dev`.

These were already present in the initial fork commit and ship on
both `main` and `dev`. Listed here only so future readers know which
product behaviors are *floor* behavior, not dev-only work:

- Domain-based grouping (with `local-files` bucket for `file:` URLs)
- Saved-for-later (`deferred`) with completion → archive flow
- Archive list with title/URL search and 2-char minimum query
- Duplicate tab detection + dedupe action
- 8+ tabs overflow (`+N more`) per group
- Inline group rename via pencil icon, persisted via
  `customGroupNames`
- Same-label auto-merge across groups
- Light/dark theme that follows `prefers-color-scheme`
- One-click close-all and close-group
- Custom hostname rules via `config.local.js` →
  `LOCAL_CUSTOM_GROUPS`



> This file tracks the product only — agent configuration changes belong in `.pi`(do not trackd by git).