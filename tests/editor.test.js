'use strict';
// Hello-world smoke test for tests/helpers/chrome-stub.js.
// Loads extension/app.js in a vm context with a stubbed Chrome API,
// then asserts that the initial refresh() populated dataState and
// rendered an empty-state container.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const { installChromeStub, settle } = require('./helpers/chrome-stub');

function buildDomContext(appText = '') {
  const app = { innerHTML: '' };
  const matches = selector => {
    if (selector === '#app') return !!app.innerHTML.includes(selector);
    return false;
  };
  return {
    console,
    URL,
    Date,
    Map,
    Set,
    Object,
    String,
    Number,
    Math,
    crypto: require('crypto').webcrypto,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: callback => callback(),
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    document: {
      activeElement: null,
      querySelector: selector => (selector === '#app' ? app : null),
      querySelectorAll: () => [],
      addEventListener: () => {},
      documentElement: { dataset: {}, lang: '' },
      body: { classList: { toggle: () => {} } },
      // Some tabulor paths call `el.matches?.(...)` on event targets.
      // The initial render uses #app and $ to find it, so we don't need a real DOM.
    },
  };
}

async function loadAppInVm(initialStorage = {}, initialReadingList = [], initialTabs = [], options = {}) {
  const dom = buildDomContext();
  const chrome = installChromeStub({ initialStorage, initialReadingList, initialTabs, uiLanguage: options.uiLanguage || 'en' });
  const ctx = { ...dom, chrome };
  ctx.globalThis = ctx;
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'extension/app.js'), 'utf8')
    + '\n;globalThis.__app = app; globalThis.__test = { dataState, uiState, mergeByLabel, buildGroups, withPages, pickRepGroup, groupAt, lastGroups, applyTheme, currentStyleId, currentTheme, parseIds, buildBackup, normaliseBackup, importBackup, t, plural, resolveLanguage, render };';
  vm.runInNewContext(source, ctx, { filename: 'extension/app.js' });
  // The migration path awaits N addEntry + remove + re-read inside loadState,
  // plus a fresh refreshReadingList, so a handful of microtask hops is not
  // enough on legacy-storage cases. 20 covers the worst case with margin.
  await settle(20);
  return { ctx, chrome };
}

(async () => {
  // Case 1: empty storage -> no groups, render still completes
  {
    const { ctx } = await loadAppInVm();
    assert.strictEqual(JSON.stringify(ctx.__test.dataState.tabs), '[]');
    assert.strictEqual(JSON.stringify(ctx.__test.dataState.readingList), '[]');
    assert.strictEqual(ctx.__test.dataState.readingListError, false);
    assert.strictEqual(JSON.stringify(ctx.__test.dataState.customGroupNames), '{}');
    assert.strictEqual(JSON.stringify(ctx.__test.lastGroups), '[]');
    // Bug fix: empty-state header must render the full controls bar, not
    // just settings. Previously theme/style/layout/column-flip toggles
    // vanished when there were no missions.
    const html = ctx.__app.innerHTML;
    assert.ok(html.includes('theme-segments'), 'empty state renders style segments');
    assert.ok(html.includes('data-action="toggle-theme"'), 'empty state renders theme toggle');
    assert.ok(html.includes('data-action="toggle-layout"'), 'empty state renders layout toggle');
    assert.ok(html.includes('data-action="flip-columns"'), 'empty state renders column-flip toggle');
    assert.ok(html.includes('data-action="toggle-settings"'), 'empty state renders settings toggle');
    console.log('smoke: empty storage -> lastGroups is empty');
  }

  // Case 2: existing customGroupNames survive the load
  {
    const { ctx } = await loadAppInVm({ customGroupNames: { 'caishawn.store': 'My Site' } });
    assert.strictEqual(ctx.__test.dataState.customGroupNames['caishawn.store'], 'My Site');
    console.log('smoke: customGroupNames round-trips through storage');
  }

  // Case 3: pickRepGroup is the bucket sort comparator
  {
    const { ctx } = await loadAppInVm();
    const { pickRepGroup } = ctx.__test;
    const a = { key: 'a.com', tabs: [1], priority: 0, order: 1 };
    const b = { key: 'b.com', tabs: [1, 2], priority: 0, order: 4 };
    assert.ok(pickRepGroup(a, b) < 0, 'earlier first-tab position wins');
    console.log('smoke: pickRepGroup preserves first-tab order');
  }

  // Case 4: applyTheme writes dataset.theme and dataset.style and toggles body.terminal
  {
    const { ctx } = await loadAppInVm({ theme: 'dark', styleId: 'terminal' });
    const { applyTheme, currentStyleId, currentTheme } = ctx.__test;
    let bodyToggles = [];
    ctx.document.body.classList.toggle = (cls, on) => { bodyToggles.push([cls, !!on]); };
    applyTheme();
    assert.strictEqual(ctx.document.documentElement.dataset.theme, 'dark');
    assert.strictEqual(ctx.document.documentElement.dataset.style, 'terminal');
    assert.strictEqual(currentTheme(), 'dark');
    assert.strictEqual(currentStyleId(), 'terminal');
    assert.deepStrictEqual(bodyToggles, [['terminal', true]]);
    console.log('smoke: applyTheme writes dataset and toggles body.terminal');
  }

  // Case 5: applyTheme falls back to default styleId on unknown stored value
  {
    const { ctx } = await loadAppInVm({ styleId: 'mystery-style' });
    const { applyTheme, currentStyleId } = ctx.__test;
    applyTheme();
    assert.strictEqual(currentStyleId(), 'classic');
    assert.strictEqual(ctx.document.documentElement.dataset.style, 'classic');
    console.log('smoke: applyTheme falls back to default styleId');
  }

  // Case 6: parseIds is the chip shared-id parser used by close/save
  {
    const { ctx } = await loadAppInVm();
    const { parseIds } = ctx.__test;
    // Compare via JSON because values originate in a different VM context
    // and `deepStrictEqual` rejects cross-realm objects.
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    assert.ok(eq(parseIds('1,2,3,3'), [1, 2, 3]));
    assert.ok(eq(parseIds(''), []));
    assert.ok(eq(parseIds('not-a-number'), []));
    console.log('smoke: parseIds dedupes and filters non-numeric ids');
  }

  // Case 7: backups carry the complete dashboard snapshot and reject unknown schemas.
  {
    const initialReadingList = [{
      url: 'https://read.example/a', title: 'Read me', hasBeenRead: true,
      creationTime: 1700000000000, lastUpdateTime: 1700000001000,
    }];
    const initialTabs = [{ id: 1, windowId: 1, url: 'https://example.com/a', title: 'Example A', active: true }];
    const { ctx } = await loadAppInVm(
      { customGroupNames: { 'example.com': 'Examples' }, styleId: 'terminal', openTabsLayout: 'single' },
      initialReadingList,
      initialTabs,
    );
    const backup = ctx.__test.buildBackup();
    assert.strictEqual(backup.schemaVersion, 1);
    assert.strictEqual(backup.tabs[0].url, 'https://example.com/a');
    assert.strictEqual(backup.customGroupNames['example.com'], 'Examples');
    assert.strictEqual(backup.readingList[0].hasBeenRead, true);
    assert.strictEqual(backup.settings.styleId, 'terminal');
    assert.strictEqual(backup.settings.layout, 'single');
    assert.throws(() => ctx.__test.normaliseBackup({ schemaVersion: 99 }), /Unsupported Tabulor backup format/);
    console.log('smoke: backup snapshot includes tabs, groups, reading list, and settings');
  }

  // Case 8: merge import opens only missing URLs, preserves existing content,
  // and lets imported group names/settings override matching local values.
  {
    const initialTabs = [{ id: 1, windowId: 1, url: 'https://keep.example/', title: 'Keep', active: true }];
    const initialReadingList = [{
      url: 'https://read.example/existing', title: 'Existing', hasBeenRead: false,
      creationTime: 1700000000000, lastUpdateTime: 1700000000000,
    }];
    const { ctx, chrome } = await loadAppInVm(
      { customGroupNames: { 'keep.example': 'Old name', 'local.example': 'Local only' } },
      initialReadingList,
      initialTabs,
    );
    const file = {
      text: async () => JSON.stringify({
        schemaVersion: 1,
        tabs: [
          { url: 'https://keep.example/', title: 'Duplicate' },
          { url: 'https://new.example/', title: 'New' },
          { url: 'javascript:alert(1)', title: 'Unsafe' },
        ],
        customGroupNames: { 'keep.example': 'Imported name', 'new.example': 'New group' },
        readingList: [
          { url: 'https://read.example/existing', title: 'Imported duplicate', hasBeenRead: true },
          { url: 'https://read.example/new', title: 'New reading item', hasBeenRead: true },
        ],
        settings: { theme: 'dark', styleId: 'terminal', layout: 'single', unreadExpanded: false, readExpanded: true },
      }),
    };
    await ctx.__test.importBackup(file);
    await settle(20);
    const tabs = chrome.tabs._peek();
    assert.strictEqual(tabs.length, 2, 'only the missing safe URL is opened');
    assert.ok(tabs.some(tab => tab.url === 'https://new.example/'));
    const names = ctx.__test.dataState.customGroupNames;
    assert.strictEqual(names['keep.example'], 'Imported name');
    assert.strictEqual(names['local.example'], 'Local only');
    assert.strictEqual(names['new.example'], 'New group');
    const entries = chrome._readingList._peek();
    assert.strictEqual(entries.length, 2, 'existing Reading-list URLs are not duplicated');
    assert.strictEqual(entries.find(item => item.url.endsWith('/existing')).hasBeenRead, false, 'existing Reading-list state is preserved');
    assert.strictEqual(ctx.__test.dataState.theme, 'dark');
    assert.strictEqual(ctx.__test.dataState.styleId, 'terminal');
    assert.strictEqual(ctx.__test.dataState.layout, 'single');
    console.log('smoke: backup import merges tabs, groups, reading list, and settings');
  }

  // Case 8b: importing a backup whose open tabs collide with already-open
  // URLs in other windows must not fail — chrome.tabs.create rejects with
  // "Duplicate URL" when another window already hosts the same URL, and we
  // want to treat that as a soft skip rather than aborting the import.
  {
    const initialTabs = [{ id: 1, windowId: 7, url: 'https://other-window.example/', title: 'Other window', active: true }];
    const { ctx, chrome } = await loadAppInVm({}, [], initialTabs);
    let nextId = 100;
    const seen = new Set();
    const originalCreate = chrome.tabs.create;
    chrome.tabs.create = async ({ url, active }) => {
      if (seen.has(url)) { const e = new Error('Duplicate URL'); throw e; }
      seen.add(url);
      return originalCreate({ url, active });
    };
    const file = {
      text: async () => JSON.stringify({
        schemaVersion: 1,
        tabs: [
          { url: 'https://other-window.example/', title: 'Duplicate in other window' },
          { url: 'https://fresh.example/', title: 'Fresh' },
        ],
        readingList: [],
        customGroupNames: {},
        settings: {},
      }),
    };
    await ctx.__test.importBackup(file);
    await settle(20);
    const tabs = chrome.tabs._peek();
    assert.ok(tabs.some(tab => tab.url === 'https://fresh.example/'), 'non-duplicate tab still opens');
    assert.strictEqual(tabs.filter(tab => tab.url === 'https://other-window.example/').length, 1, 'no extra copy of the duplicated URL');
    console.log('smoke: backup import tolerates Duplicate URL errors from chrome.tabs.create');
  }

  // Case 9b: i18n — t() / plural() / timeAgo() honour the current language;
  // resolveLanguage() falls back to chrome.i18n.getUILanguage() on first
  // load and respects a stored override thereafter.
  {
    // (a) Default English
    const { ctx } = await loadAppInVm();
    assert.strictEqual(ctx.__test.t('openTabs'), 'Open tabs');
    assert.strictEqual(ctx.__test.t('readingList'), 'Reading list');
    assert.strictEqual(ctx.__test.plural('Group', 1), '1 group');
    assert.strictEqual(ctx.__test.plural('Group', 6), '6 groups');
    assert.strictEqual(ctx.__test.t('timeMinAgo', 5), '5 min ago');
    assert.strictEqual(ctx.__test.t('timeDaysAgo', 3), '3 days ago');
    assert.strictEqual(ctx.__test.t('timeJustNow'), 'just now');
    assert.strictEqual(ctx.__test.t('timeYesterday'), 'yesterday');
    // (b) Switch to Chinese at runtime
    ctx.__test.uiState.language = 'zh_CN';
    assert.strictEqual(ctx.__test.t('openTabs'), '打开的标签');
    assert.strictEqual(ctx.__test.t('readingList'), '阅读列表');
    assert.strictEqual(ctx.__test.plural('Group', 1), '1 个分组');
    assert.strictEqual(ctx.__test.plural('Group', 6), '6 个分组');
    assert.strictEqual(ctx.__test.t('timeMinAgo', 5), '5 分钟前');
    assert.strictEqual(ctx.__test.t('timeDaysAgo', 3), '3 天前');
    assert.strictEqual(ctx.__test.t('timeJustNow'), '刚刚');
    assert.strictEqual(ctx.__test.t('timeYesterday'), '昨天');
    console.log('smoke: t() and plural() switch between en and zh_CN');
  }
  {
    // (c) First load without stored language follows Chrome UI language.
    const { ctx } = await loadAppInVm({}, [], [], { uiLanguage: 'zh-CN' });
    assert.strictEqual(ctx.__test.uiState.language, 'zh_CN', 'chrome.i18n.getUILanguage zh* resolves to zh_CN');
    console.log('smoke: resolveLanguage follows chrome.i18n.getUILanguage on first load');
  }
  {
    // (d) Stored override beats Chrome UI language.
    const { ctx } = await loadAppInVm({ uiLanguage: 'zh_CN' }, [], [], { uiLanguage: 'en' });
    assert.strictEqual(ctx.__test.uiState.language, 'zh_CN', 'stored uiLanguage overrides chrome.i18n.getUILanguage');
    console.log('smoke: stored uiLanguage overrides chrome.i18n.getUILanguage');
  }

  // Case 9c: end-to-end render + language switch — the rendered HTML reflects
  // uiState.language immediately, <html lang> follows the toggle, and the
  // language switcher template carries the correct aria-pressed per locale.
  {
    const { ctx } = await loadAppInVm();
    assert.strictEqual(ctx.document.documentElement.lang, 'en', 'applyTheme sets <html lang="en"> by default');
    assert.ok(ctx.__app.innerHTML.includes('>Open tabs<'), 'English render contains "Open tabs" heading');
    assert.ok(ctx.__app.innerHTML.includes('>EN</button>'), 'language switcher renders EN segment');
    assert.ok(ctx.__app.innerHTML.includes('data-language="en" aria-pressed="true"'), 'EN segment is initially pressed');
    assert.ok(ctx.__app.innerHTML.includes('data-language="zh_CN" aria-pressed="false"'), 'zh_CN segment is initially unpressed');

    ctx.__test.uiState.language = 'zh_CN';
    ctx.__test.render();
    assert.strictEqual(ctx.document.documentElement.lang, 'zh-CN', '<html lang> follows the toggle');
    assert.ok(ctx.__app.innerHTML.includes('>打开的标签<'), 'Chinese render contains "打开的标签" heading');
    assert.ok(ctx.__app.innerHTML.includes('data-language="zh_CN" aria-pressed="true"'), 'zh_CN segment is now pressed');
    assert.ok(ctx.__app.innerHTML.includes('data-language="en" aria-pressed="false"'), 'EN segment is now unpressed');
    assert.ok(!ctx.__app.innerHTML.includes('>Open tabs<'), 'no stale English heading after switch');

    // Toggle back; render should revert.
    ctx.__test.uiState.language = 'en';
    ctx.__test.render();
    assert.strictEqual(ctx.document.documentElement.lang, 'en');
    assert.ok(ctx.__app.innerHTML.includes('>Open tabs<'));
    console.log('smoke: render() and <html lang> follow uiState.language');
  }

  // Case 9: the one-time migration pushes legacy `deferred` entries into
  // chrome.readingList (mapping completedAt -> hasBeenRead), drops the local
  // key, and lets refreshReadingList populate dataState.readingList from the
  // fresh API snapshot. Asserts each leg of that round-trip.
  {
    const legacy = {
      deferred: [
        { id: 'a', url: 'https://example.com/a', title: 'A', savedAt: 1700000000000, completedAt: null },
        { id: 'b', url: 'https://example.com/b', title: 'B', savedAt: 1700000001000, completedAt: 1700000002000 },
        { id: 'c', url: 'https://example.com/c', title: 'C', savedAt: 1700000003000, dismissed: true },
      ],
    };
    const { ctx } = await loadAppInVm(legacy);
    const entries = ctx.chrome._readingList._peek();
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    assert.strictEqual(entries.length, 2, 'dismissed entries are skipped during migration');
    assert.ok(eq(entries.map(e => e.url).sort(), ['https://example.com/a', 'https://example.com/b']));
    const archived = entries.find(e => e.url === 'https://example.com/b');
    assert.strictEqual(archived.hasBeenRead, true, 'completedAt maps to hasBeenRead');
    const active = entries.find(e => e.url === 'https://example.com/a');
    assert.strictEqual(active.hasBeenRead, false, 'null completedAt maps to hasBeenRead=false');
    assert.ok(!('deferred' in ctx.chrome._storage._peek()), 'legacy deferred key is removed after migration');
    assert.strictEqual(ctx.__test.dataState.readingList.length, 2, 'dataState.readingList picks up the migrated entries via refreshReadingList');
    console.log('smoke: legacy deferred entries migrate to chrome.readingList and drop the local key');
  }

  console.log('all smoke tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
