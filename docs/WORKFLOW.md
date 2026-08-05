# Tabulor Development Branch

Workflow only: setup, validation, agent notes — current development focus lives in ROADMAP.md.

## Current development focus

`dev` carries everything `main` ships, plus the active integration line.

See [`ROADMAP.md`](./ROADMAP.md) for current development priorities.

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

> After loading, refresh any new-tab page to pick up changes to `extension/app.js` or `style.css`. Changes to `manifest.json` require a Reload on the `chrome://extensions` card.

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

- **Versioned dev docs** (architecture, review, shipped history) live in this directory.

## Agent workflow

This repository does not prescribe a shared agent setup; agent configuration is personal (see "Important notes"). Use any coding agent with your own rules — there is no required hidden directory or rules-file layout.

## Git conventions

- `main` is the release/user-facing branch.
- `dev` is the active integration branch.
- Keep each commit independently verifiable.

## Credits and license

Tabulor is based on [tab-out](https://github.com/zarazhangrui/tab-out) by Zara Zhang and is inspired by [tab-harbor](https://github.com/V-IOLE-T/tab-harbor) by V-IOLE-T.

MIT — see [`LICENSE`](../LICENSE).