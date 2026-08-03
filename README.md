# Tabulor Development Branch

`dev` is the integration branch for active Tabulor development. It contains work that may not yet be available on `main`, including experiments that are still being validated before release.

Tabulor is a Chrome Manifest V3 extension that replaces the new-tab page with a local dashboard for grouping, renaming, merging, saving, and reopening tabs.

## Current development focus

`dev` carries everything `main` ships, plus the active integration line. As of v0.2.1 the user-facing surfaces (visual styles, fonts, icon set, grouping model) are aligned with `main`. The work still moving on `dev` only:

- **Theming the saved-column scrollbar** — make the browser-native scrollbar on `.deferred-column` follow the active style (WebKit/Blink first, standard properties as fallback); square thumb using `--line` / `--muted` (or `--ink`) for Terminal, subtle custom for Classic.
- **Archive module redesign** — scope open (toggle handling, search UX, dedupe vs un-complete, theme tokens); see [`ROADMAP.md`](./ROADMAP.md) → *Recently discussed* for the latest framing.
- **Group as the core data structure** — refactor the in-memory model so the group is the source of truth and the tab list is an input feed.

For shipped work, in-progress items, backlog, and recent discussions, see [`ROADMAP.md`](./ROADMAP.md).

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

> After loading, refresh any new-tab page to pick up changes to `extension/app.js`, `style.css`, or `offscreen.*`. Changes to `manifest.json` require a Reload on the `chrome://extensions` card.

### Validation

Run the relevant checks before proposing a commit:

```bash
node --check extension/app.js
node --test tests/editor.test.js
git diff --check
```

### Important notes

- **Agent configuration is personal.** `AGENTS.md` and `.pi/` are gitignored on purpose; do not commit them, remove those `.gitignore` lines, or add other agent-routing files to the tracked tree.
- **Local experiments stay outside the tracked tree** — `.tmp/`, `.sketches/`, scratch scripts, ad-hoc logs. Verify `git status` before committing.

- **Versioned dev docs** (architecture, review, shipped history) live under [`docs/`](./docs/).

## Agent workflow

This repository does not prescribe a shared agent setup; agent configuration is personal (see "Important notes"). Use any coding agent with your own rules — there is no required hidden directory or rules-file layout.

## Git conventions

- `main` is the release/user-facing branch.
- `dev` is the active integration branch.
- Keep each commit independently verifiable.

## Credits and license

Tabulor is based on [tab-out](https://github.com/zarazhangrui/tab-out) by Zara Zhang and is inspired by [tab-harbor](https://github.com/V-IOLE-T/tab-harbor) by V-IOLE-T.

MIT — see [`LICENSE`](./LICENSE).