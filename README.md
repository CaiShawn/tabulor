# Tabulor Development Branch

`dev` is the integration branch for active Tabulor development. It contains work that may not yet be available on `main`, including experiments that are still being validated before release.

Tabulor is a Chrome Manifest V3 extension that replaces the new-tab page with a local dashboard for grouping, renaming, merging, saving, and reopening tabs.

## Current development focus

Compared with `main`, this branch is the integration line for active Tabulor development. Headline features:

- **Selectable visual styles** — Classic and Terminal, persisted as `styleId`.
- **System-aware light/dark palettes** for both styles.
- **Self-hosted fonts** — Inter, Meslo LG Mono, Noto Sans SC; no external font request.
- **Terminal-style extension icons** with light/dark toolbar variant.
- **Domain-only grouping**, without the former homepage special-case bucket.

For shipped work, in-progress items, backlog, and recent discussions beyond what `main` carries, see [`ROADMAP.md`](./ROADMAP.md).

The branch is intentionally allowed to differ from the user-facing documentation on `main`. Release-facing installation and product copy should be finalized when changes are promoted.

## Development setup

### 1. Clone and switch to `dev`

```bash
git clone https://github.com/CaiShawn/tabulor.git
cd tabulor
git switch dev
```

### 2. Load the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository's `extension/` directory.
5. Open a new tab to run the extension.

No package installation or build step is currently required.

### Reloading

After loading, refresh any new-tab page to pick up changes to `extension/app.js`, `style.css`, or `offscreen.*`. Changes to `manifest.json` require a Reload on the `chrome://extensions` card.

### Validation

Run the relevant checks before proposing a commit:

```bash
node --check extension/app.js
node --test tests/editor.test.js
git diff --check
```

The smoke tests use `tests/helpers/chrome-stub.js`. When adding browser-dependent behavior, extend the shared stub instead of creating one-off mocks.

For visual changes, also verify manually in Chrome:

- Classic and Terminal styles
- light and dark system modes
- long domain and tab titles
- custom group rename and same-label merge behavior
- saved-tab interactions
- extension reload with persisted storage

## Important notes

- **Agent configuration is personal.** The repository's `.gitignore` excludes `AGENTS.md` and `.pi/` for a reason — agent rules, retros, and routing files belong to the agent's local setup, not the project. Do not commit `AGENTS.md` or `.pi/` from somewhere else, do not remove those `.gitignore` lines, and do not add other agent-routing files to the tracked tree. Any change to `.gitignore` patterns that affects agent-personal paths should be proposed as a separate commit with explicit justification.
- **Local experiments, drafts, and diagnostics stay outside the tracked tree** — paths like `.tmp/`, `.sketches/`, scratch scripts, and ad-hoc logs all belong under gitignored locations, not in `extension/` or `tests/`. Verify `git status` before committing.

## Repository layout

```text
extension/
  app.js             Core state, grouping, rendering, and Chrome API actions
  index.html         New-tab page shell
  style.css          Classic/Terminal tokens and component styles
  manifest.json      Chrome Manifest V3 configuration
  fonts/             Bundled fonts and attribution
  icons/             Shipped extension icons

tests/
  editor.test.js     Node-based smoke tests
  helpers/
    chrome-stub.js   Chrome API and DOM test stubs
```

## Architecture notes

### State and storage

`extension/app.js` reads and writes local state through `chrome.storage.local`.

Important keys include:

| Key | Purpose |
|---|---|
| `deferred` | Saved tabs and their completion/archive state |
| `theme` | Explicit light/dark value when present |
| `styleId` | Active visual style: `classic` or `terminal` |
| `customGroupNames` | User-defined labels keyed by group identifier |

Storage schema changes should be treated as compatibility-sensitive even while the extension is unreleased.

### Grouping

Web tabs are grouped by hostname unless a custom local rule assigns another group key. Groups sharing the same display label are merged into one card. Representative selection favors:

1. a group with a custom name;
2. the local-files group;
3. the group with more tabs;
4. a deterministic lexicographic fallback.

### Styling

`extension/style.css` contains both visual systems:

- `data-style="classic"` uses the original rounded dashboard presentation.
- `data-style="terminal"` overrides color and radius tokens for the terminal presentation.
- `data-theme="light|dark"` controls the active palette.
- The `.terminal` body class applies the terminal font stack.

Style and light/dark theme are separate state dimensions. New styles should preserve this separation rather than introduce a combined style-theme identifier.

### Fonts

Fonts are served from `extension/fonts/`; the extension makes no external font request. Attribution and source information belong in `extension/fonts/CREDITS.md`.

### User-defined grouping rules

`extension/index.html` loads an optional `config.local.js` before `app.js`.
The file is gitignored and is the supported extension point for
personal grouping rules. When present, it should expose a global
`LOCAL_CUSTOM_GROUPS` array of objects shaped like:

```js
[
  { hostname: 'mail.google.com', groupKey: 'mail', groupLabel: 'Mail' },
  { hostnameEndsWith: '.feishu.cn', groupKey: 'feishu', groupLabel: 'Feishu' },
  { hostname: 'github.com', pathPrefix: '/issues', groupKey: 'gh-issues', groupLabel: 'GitHub Issues' },
]
```

A missing file is harmless; the dashboard falls back to host-based
grouping.

## Agent workflow

This repository can be used with any coding agent, but it does not prescribe a shared agent setup. Agent instructions are personal and tool-specific — see "Important notes" above for the rule on keeping agent configuration local.

A practical workflow is:

1. Ask the agent to inspect the relevant tracked files and current Git state.
2. Describe the desired outcome, constraints, and whether commits are authorized.
3. Prefer the smallest complete change for clear, localized tasks.
4. Require validation proportional to the change and a concise summary of affected files.
5. Review the diff yourself before authorizing a commit or push.
6. Check that ignored drafts, local instructions, and temporary artifacts have not entered the commit.

Example prompt:

```text
Inspect the relevant tracked files, make the smallest complete change, run
checks proportional to the change, and leave the result uncommitted for review.
Do not add local agent configuration, drafts, or temporary files.
```

Use whichever local rules fit your own agent and workflow; no particular hidden directory or rules-file layout is required.

## Git conventions

- `main` is the release/user-facing branch.
- `dev` is the active integration branch.
- Keep each commit independently verifiable.
- Use imperative commit subjects of at most 72 characters.
- Do not rewrite shared branch history without confirming the impact.
- Review `main...dev` before promoting changes.

Example review commands:

```bash
git fetch origin
git log --oneline --left-right origin/main...dev
git diff --stat origin/main...dev
git diff origin/main...dev
```

## Credits and license

Tabulor is based on [tab-out](https://github.com/zarazhangrui/tab-out) by Zara Zhang and is inspired by [tab-harbor](https://github.com/V-IOLE-T/tab-harbor) by V-IOLE-T.

MIT — see [`LICENSE`](./LICENSE).