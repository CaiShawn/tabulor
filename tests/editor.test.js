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

async function loadAppInVm(initialStorage = {}, initialReadingList = []) {
  const dom = buildDomContext();
  const chrome = installChromeStub({ initialStorage, initialReadingList });
  const ctx = { ...dom, chrome };
  ctx.globalThis = ctx;
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'extension/app.js'), 'utf8')
    + '\n;globalThis.__test = { dataState, uiState, mergeByLabel, buildGroups, withPages, pickRepGroup, groupAt, lastGroups, applyTheme, currentStyleId, currentTheme, parseIds };';
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
