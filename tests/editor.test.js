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
      documentElement: { dataset: {} },
      body: { classList: { toggle: () => {} } },
      // Some tabulor paths call `el.matches?.(...)` on event targets.
      // The initial render uses #app and $ to find it, so we don't need a real DOM.
    },
  };
}

async function loadAppInVm(initialStorage = {}, initialReadingList = [], initialTabs = []) {
  const dom = buildDomContext();
  const chrome = installChromeStub({ initialStorage, initialReadingList, initialTabs });
  const ctx = { ...dom, chrome };
  ctx.globalThis = ctx;
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'extension/app.js'), 'utf8')
    + '\n;globalThis.__test = { dataState, uiState, mergeByLabel, buildGroups, withPages, pickRepGroup, groupAt, lastGroups, applyTheme, currentStyleId, currentTheme, parseIds, buildBackup, normaliseBackup, importBackup };';
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
