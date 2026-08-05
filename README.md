# Tabulor

<p align="center">
  <img src="extension/icons/icon.svg" alt="Tabulor" width="128">
</p>

**Keep tabs on your tabs.**

Tabulor is a Chrome extension that replaces your new tab page with a local dashboard that groups, renames, merges, and saves your open tabs — with a terminal-style view for those who like their dashboards sharp.

Light & dark themes. No server. No account. No external server calls — only Chrome's built-in `readingList` API surfaces Chrome's Reading List. Just a Chrome extension.

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

- **Group by domain** — open tabs cluster by site; rename groups inline and they persist across sessions
- **Click to jump or close** — jump straight to any tab across windows, or close whole groups with one click
- **Save tabs for later** — sends the current tab to Chrome's Reading List; the right column shows Unread and Done sub-lists

### Highlights

- **Reading List on chrome.readingList** — the right column is a view onto Chrome's Reading List (Chrome 120+), with a local mirror for offline resilience and reactivity from signed-in Chrome devices
- **Auto-merge same-named groups** — groups that share a label (custom or default) collapse into one card; hover the title to see every source domain
- **Two selectable visual styles** (Classic rounded / Terminal sharp + monospace) with system-aware light/dark palettes
- **Self-contained** — self-hosted fonts and 100% local storage; no server, no account, no external API calls

---

## What's new

### v0.2.5

- **Toolbar icon no longer follows system theme.** The toolbar icon stays light regardless of system dark mode (the new-tab page still follows `prefers-color-scheme`). The service worker and offscreen document that made the swap possible are removed.
- **CJK fallback moves to system fonts.** The 1.1 MB Noto Sans SC font is removed; the terminal font stack now falls back to system `PingFang SC` / `Microsoft YaHei`.
- **Smaller extension package.** `extension/` from ~1.4 MB to 220 KB (-84%). Self-hosted fonts went from three files / ~1.23 MB to two / ~123 KB.

### v0.2.4

- **Reading list on chrome.readingList** — the right-column section is now a view onto Chrome's Reading List (Chrome 120+); legacy saved entries migrate automatically on first load
- **Unread + Done sections** — the right column renders two peer sub-sections under a centered "Reading list" umbrella; each is independently collapsible with its own count badge
- **Per-item favicon** — each entry shows a site icon at the left slot
- **Paired action button** — the checkbox became a paired "mark as read" / "undo" button

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
| Theming | CSS variables + `prefers-color-scheme`, per-style palette tokens |

---

## Inspired by

Tabulor is based on [tab-out](https://github.com/zarazhangrui/tab-out) by Zara Zhang (MIT) and inspired by [tab-harbor](https://github.com/V-IOLE-T/tab-harbor) by V-IOLE-T (MIT).

---

## License

MIT — see [`LICENSE`](./LICENSE).

Maintained by [CaiShawn](https://github.com/CaiShawn)
