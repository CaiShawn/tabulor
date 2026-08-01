# Tabulor

**Keep tabs on your tabs.**

Tabulor is a Chrome extension that replaces your new tab page with a dashboard of everything you have open. Tabs are grouped by domain, with homepages (163/QQ Mail, Bilibili, Weibo, Xiaohongshu, Zhihu, etc.) pulled into their own group.

Light & dark themes. No server. No account. No external API calls. Just a Chrome extension.

---

## Inspired by

Tabulor is a personal rebrand and continuation of ideas from two excellent open-source projects:

- [**tab-out**](https://github.com/zarazhangrui/tab-out) by [Zara](https://x.com/zarazhangrui) — the upstream foundation. Tabulor is forked from this project; most of the core behavior, grouping logic, and overall structure come from there.
- [**tab-harbor**](https://github.com/V-IOLE-T/tab-harbor) by V-IOLE-T — a richer evolution of the same idea, adding saved sessions, todos, themes, custom backgrounds, and a more configurable workspace. Tabulor borrows inspiration from its broader product thinking.

If you like Tabulor, please check out and star the original projects — they did the hard work.

## Recommendation

There are also some awesome extensions you might like:

- [**Session Buddy**](https://chromewebstore.google.com/detail/session-buddy-tab-bookmar/edacconmaakjimmfgnblocblbcdcpbko) by [sessionbuddy.com](https://sessionbuddy.com/) - Save and restore sessions, manage tabs and bookmarks, and stay organized with a powerful and trusted privacy-first session manager.
- [**Tree Style Tab**](https://github.com/xingtanzjr/Tree-Style-Tab) by xingtanzjr - A tree-style tab manager for Chrome & Edge. Organize, search, and navigate your tabs visually.
- [**Tab Session Manager**](https://github.com/sienori/Tab-Session-Manager) by sienori - Save and restore the state of browser windows and tabs. It also supports automatic saving.
- [**TabFS**](https://github.com/osnr/TabFS) by osnr - a browser extension that mounts your browser tabs as a filesystem on your computer.

---

## Install with a coding agent

Send your coding agent (Claude Code, Codex, etc.) this repo and say **"install this"**:

```
https://github.com/CaiShawn/tabulor
```

The agent will walk you through it. Takes about 1 minute.

---

## Features

- **Group by domain, homepages on top** — open tabs cluster by site; homepages (163/QQ Mail, Bilibili, Weibo, Xiaohongshu, Zhihu, etc.) get their own card
- **Custom group names** — rename any group inline; names persist locally across Chrome sessions
- **Auto-merge same-named groups** — give two groups the same label (custom or default) and they collapse into one card; hover the title to see every source domain
- **Click to jump or close** — jump straight to any tab across windows, or close whole groups with one click
- **Light & dark themes** with a one-click toggle that follows your system preference
- **100% local** — saved tabs and preferences stay on your machine; no server, no account, no external API calls

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
  -> Homepages (163/QQ Mail, Bilibili, Weibo, etc.) get their own group at the top
  -> Click the pencil icon to rename a group; hover the title for the default label and source domains
  -> Groups that share the same name (custom or default) collapse into one card
  -> Click any tab title to jump to it
  -> Close groups you're done with
  -> Save tabs for later before closing them
  -> Toggle light/dark any time with the button in the section header
```

Everything runs inside the Chrome extension. No external server, no API calls, no data sent anywhere. Saved tabs and your theme choice are stored in `chrome.storage.local`.

---

## Tech stack

| What | How |
|------|-----|
| Extension | Chrome Manifest V3 |
| Storage | chrome.storage.local |
| Theming | CSS variables + `prefers-color-scheme` |

---

## License

MIT — see [`LICENSE`](./LICENSE).

Based on [tab-out](https://github.com/zarazhangrui/tab-out) by Zara Zhang (MIT) and inspired by [tab-harbor](https://github.com/V-IOLE-T/tab-harbor) by V-IOLE-T (MIT).

---

Maintained by [CaiShawn](https://github.com/CaiShawn)
