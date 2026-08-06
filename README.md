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
- **Custom background image** — use your own image as the dashboard backdrop (a work in progress, still being refined)
- **100% local** — local storage, no server or account

---

## What's new

### v0.2.6

- **Pin a group.** Pin a group to a compact top row of chips; clicking a chip previews every tab in the group without leaving the dashboard.
- **Mirror flip columns.** A swap button flips the two main columns between `Open tabs | Reading list` and `Reading list | Open tabs`.
- **Manual light/dark toggle.** A sun/moon button overrides the system theme when you want a specific mode.
- **Custom dashboard background image.** Use your own image as the dashboard backdrop (a work in progress, still being refined).
- **Settings menu.** A gear icon gathers backup and background options in one place.

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
