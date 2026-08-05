# Tabulor

<p align="center">
  <img src="extension/icons/icon.svg" alt="Tabulor" width="128">
</p>

**Keep tabs on your tabs.**

Tabulor is a Chrome extension that turns your new tab page into a local dashboard for grouping, renaming, merging, and saving open tabs — with an optional terminal-style view.

Light and dark themes. No server, no account, no external calls — the only outside touch is Chrome's built-in `readingList` API. Just a Chrome extension.

---

## Install with a coding agent

Send your coding agent (Claude Code, Codex, etc.) this repo and say **"install this"**:

```
https://github.com/CaiShawn/tabulor
```

The agent will walk you through it. Takes about 1 minute.

---

## Features

### Core

- **Group by domain** — cluster by site, rename inline, persist across sessions
- **Click to jump or close** — jump to any tab across windows, or close whole groups
- **Save tabs for later** — Chrome's Reading List (120+) with offline mirror; Unread and Done sub-lists

### Highlights

- **Auto-merge same-named groups** — same label → one card; hover to see source domains
- **Two selectable visual styles** — Classic rounded / Terminal sharp + monospace
- **English and Simplified Chinese** — two-track dictionary (`_locales/` + `LOCALES`); an `EN / 中` switcher sits at the bottom-left of the dashboard
- **Backup and restore** — export the dashboard to a versioned JSON file; import merges with existing data
- **100% local** — local storage, no server or account

---

## What's new

### v0.2.5

**新特性**

- **English and Simplified Chinese.** The UI ships in two languages with a bottom-left `EN / 中` switcher. First load follows `chrome.i18n.getUILanguage()`; the choice is persisted afterwards. Reading-list timestamps, plurals, and the rest of the UI re-localize on switch.
- **Backup and restore.** The `Backup` menu next to `Close all` exports a versioned JSON snapshot of the dashboard (open tabs, custom group names, Reading list, layout, theme, style) and re-imports it as a merge — existing tabs and Reading-list URLs are preserved.

**UI 修改**

- **Icon refresh.** Redesigned to white outline on Terminal Blue Sea `--card` (`#1e44a8`); card geometry refined to 96×64 (3:2), `>` stroke-width 6, `_` height 4. The icon now appears centered at the top of the README.

**软件包瘦身**

- **Smaller extension package.** `extension/` from ~1.4 MB to 220 KB (-84%). Self-hosted fonts went from three files / ~1.23 MB to two / ~123 KB. The toolbar icon's `prefers-color-scheme` auto-swap (and the offscreen document that drove it) is removed; the new-tab page itself still follows the system color scheme. The 1.1 MB Noto Sans SC CJK fallback is dropped; the terminal font stack now falls back to system `PingFang SC` / `Microsoft YaHei`.

## Roadmap

- Group as the core data structure — refactor the in-memory model so the group is the source of truth and the tab list is an input feed

---

## Manual Setup

**1. Clone the repo**

```bash
git clone https://github.com/CaiShawn/tabulor.git
```

**2. Load the Chrome extension**

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Navigate to the `extension/` folder inside the cloned repo and select it

**3. Open a new tab**

You'll see Tabulor.

---

## How it works

![How it works](docs/images/how-it-works.png)

Everything runs inside the Chrome extension — no server, no third-party API calls. Tabs, style, theme, and a local mirror of your Reading list live in `chrome.storage.local`; saved tabs themselves are surfaced from Chrome's built-in `readingList` API.

---

## Tech stack

| What | How |
|------|-----|
| Extension | Chrome Manifest V3 |
| Storage | chrome.storage.local + chrome.readingList (Chrome 120+) |
| i18n | `_locales/en` + `_locales/zh_CN` (manifest) backed by a `LOCALES` map in `app.js` (in-page); `chrome.i18n.getUILanguage()` drives the first-load default |
| Theming | CSS variables + `prefers-color-scheme`, per-style palette tokens |

---

## Inspired by

Tabulor is based on [tab-out](https://github.com/zarazhangrui/tab-out) by Zara Zhang (MIT) and inspired by [tab-harbor](https://github.com/V-IOLE-T/tab-harbor) by V-IOLE-T (MIT).

---

## License

MIT — see [`LICENSE`](./LICENSE).

---

**Author:** [CaiShawn](https://github.com/CaiShawn)

**Terminal CSS:** courtesy of [terminal-css](https://github.com/panr/terminal-css/) by panr (The Unlicense)
