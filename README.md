# Tabulor

**Keep tabs on your tabs.**

Tabulor is a Chrome extension that replaces your new tab page with a local dashboard that groups, renames, merges, and saves your open tabs — with a terminal-style view for those who like their dashboards sharp.

Light & dark themes. No server. No account. No external API calls. Just a Chrome extension.

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

- **Group by domain** — open tabs cluster by site; same-label groups (custom or default) collapse into one card
- **Click to jump or close** — jump straight to any tab across windows, or close whole groups with one click
- **Light & dark themes** with a one-click toggle that follows your system preference
- **100% local** — saved tabs and preferences stay on your machine; no server, no account, no external API calls

### Highlights

- **Selectable visual styles** — Classic (rounded) or Terminal (sharp + monospace), chosen from the dashboard and persisted per device
- **Self-hosted fonts** — Inter, Meslo LG Mono, Noto Sans SC bundled with the extension; no external font request
- **Toolbar icon follows `prefers-color-scheme`** — the puzzle-menu icon swaps between light and dark variants
- **Custom group names** — rename any group inline; names persist locally across Chrome sessions
- **Auto-merge same-named groups** — give two groups the same label (custom or default) and they collapse into one card; hover the title to see every source domain
- **Save tabs for later** with a completion → archive flow and an in-dashboard archive list

---

## What's new

### v2.1.0

- **Selectable visual styles** — switch between Classic (rounded) and Terminal (sharp + monospace) from the dashboard; choice persists as `styleId`
- **Self-hosted fonts** — Inter, Meslo LG Mono, Noto Sans SC bundled; no external font request
- **System-aware light/dark palettes** for both styles
- **Terminal-style extension icons** — light and dark PNG / SVG variants; the toolbar icon now follows `prefers-color-scheme`
- **Domain-only grouping** — the old "Homepages" special-case bucket (163/QQ Mail, Bilibili, Weibo, Xiaohongshu, Zhihu, etc.) is gone; same-label auto-merge handles the use cases
- **Manifest version `0.2.1`** — pre-1.0 SemVer from here on

### v2.0.0

- **Custom group names** — inline rename via the pencil icon; empty input or a value equal to the default reverts to the default label
- **Auto-merge same-named groups** — two groups that share a label (custom or default) collapse into a single card; the merged card's tooltip lists every source domain

### Roadmap

- **Group as the core data structure** — refactor the in-memory model so the group is the source of truth and the tab list is an input feed
- **Themed saved-column scrollbar** — make the "Saved for later" column's vertical scrollbar follow the active style

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

```
You open a new tab
  -> Tabulor shows your open tabs grouped by domain
  -> Choose Classic or Terminal style from the dashboard
  -> Click the pencil icon to rename a group; hover the title for the default label and source domains
  -> Groups that share the same name (custom or default) collapse into one card
  -> Click any tab title to jump to it
  -> Close groups you're done with
  -> Save tabs for later before closing them; completed items move to the archive
  -> Toggle light/dark any time with the button in the section header
```

Everything runs inside the Chrome extension. No external server, no API calls, no data sent anywhere. Saved tabs, your theme choice, and your style selection are stored in `chrome.storage.local`.

---

## Tech stack

| What | How |
|------|-----|
| Extension | Chrome Manifest V3 |
| Storage | chrome.storage.local |
| Theming | CSS variables + `prefers-color-scheme`, per-style palette tokens |

---

## Inspired by

Tabulor is based on [tab-out](https://github.com/zarazhangrui/tab-out) by Zara Zhang (MIT) and inspired by [tab-harbor](https://github.com/V-IOLE-T/tab-harbor) by V-IOLE-T (MIT).

---

## License

MIT — see [`LICENSE`](./LICENSE).

Maintained by [CaiShawn](https://github.com/CaiShawn)