# AGENTS.md -- Tabulor: Setup & Onboarding Guide for Coding Agents

You're installing **Tabulor** for the user. Your job is not just to set it up -- it's to get them excited about using it.

> **Tabulor** is a Chrome extension forked from [tab-out](https://github.com/zarazhangrui/tab-out) by Zara and inspired by [tab-harbor](https://github.com/V-IOLE-T/tab-harbor) by V-IOLE-T.

---

## Step 0 -- Introduce the product

Before doing anything technical, tell the user what they're about to get:

> **Tabulor** replaces your new tab page with a clean dashboard of everything you have open, grouped by domain.
>
> Here's what makes it great:
> - **See all your open tabs at a glance** grouped by domain on a grid
> - **Click any tab title to jump to it** even across different Chrome windows
> - **Close whole groups** with one click, or just close individual tabs
> - **Custom group names** rename any group inline via the pencil icon; names stick across sessions
> - **Duplicate detection** flags when you have the same page open twice
> - **Save for later** bookmark individual tabs to a checklist before closing them
>
> It's just a Chrome extension. Setup takes about 1 minute.

---

## Step 1 -- Clone the repo

```bash
git clone https://github.com/CaiShawn/tabulor.git
cd tabulor
```

---

## Step 2 -- Install the Chrome extension

This is the one step that requires manual action from the user. Make it as easy as possible.

**First**, print the full path to the `extension/` folder:
```bash
echo "Extension folder: $(cd extension && pwd)"
```

**Then**, copy the `extension/` folder path to their clipboard:
- macOS: `cd extension && pwd | pbcopy && echo "Path copied to clipboard"`
- Linux: `cd extension && pwd | xclip -selection clipboard 2>/dev/null || echo "Path: $(pwd)"`
- Windows: `cd extension && echo %CD% | clip`

**Then**, open the extensions page:
```bash
open "chrome://extensions"
```

**Then**, walk the user through it step by step:

> I've copied the extension folder path to your clipboard. Now:
>
> 1. You should see Chrome's extensions page. In the **top-right corner**, toggle on **Developer mode** (it's a switch).
> 2. Once Developer mode is on, you'll see a button called **"Load unpacked"** appear in the top-left. Click it.
> 3. A file picker will open. **Press Cmd+Shift+G** (Mac) or **Ctrl+L** (Windows/Linux) to open the "Go to folder" bar, then **paste** the path I copied (Cmd+V / Ctrl+V) and press Enter.
> 4. Click **"Select"** or **"Open"** and the extension will install.
>
> You should see "Tabulor" appear in your extensions list.

**Also**, open the file browser directly to the extension folder as a fallback:
- macOS: `open extension/`
- Linux: `xdg-open extension/`
- Windows: `explorer extension\\`

---

## Step 3 -- Show them around

Once the extension is loaded:

> You're all set! Open a **new tab** and you'll see Tabulor.
>
> Here's how it works:
> 1. **Your open tabs are grouped by domain** in a grid layout.
> 2. **Click any tab title** to jump directly to that tab.
> 3. **Click the X** next to any tab to close just that one.
> 5. **Click "Close all N tabs"** on a group to close the whole thing.
> 6. **Duplicate tabs** are flagged with an amber "(2x)" badge. Click "Close duplicates" to keep one copy.
> 7. **Save a tab for later** by clicking the bookmark icon before closing it. Saved tabs appear in the sidebar.
> 8. **Rename a group** by clicking the pencil icon next to its title. Empty input or the default name reverts.
> 9. **Toggle the theme** with the sun/moon button at the top of the section.
>
> That's it! No server to run, no config files. Everything works right away.

---

## Key Facts

- Tabulor is a pure Chrome extension. No server, no Node.js, no npm.
- Saved tabs and theme choice are stored in `chrome.storage.local` (persists across sessions).
- 100% local. No data is sent to any external service.
- To update: `cd tabulor && git pull`, then reload the extension in `chrome://extensions`.
- Upstream: forked from [zarazhangrui/tab-out](https://github.com/zarazhangrui/tab-out); also inspired by [V-IOLE-T/tab-harbor](https://github.com/V-IOLE-T/tab-harbor).
