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
      // Some tabulor paths call `el.matches?.(...)` on event targets.
      // The initial render uses #app and $ to find it, so we don't need a real DOM.
    },
  };
}

async function loadAppInVm(initialStorage = {}) {
  const dom = buildDomContext();
  const chrome = installChromeStub({ initialStorage });
  const ctx = { ...dom, chrome };
  ctx.globalThis = ctx;
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'extension/app.js'), 'utf8')
    + '\n;globalThis.__test = { dataState, uiState, mergeByLabel, buildGroups, withPages, pickRepGroup, groupAt, lastGroups };';
  vm.runInNewContext(source, ctx, { filename: 'extension/app.js' });
  await settle();
  return { ctx, chrome };
}

(async () => {
  // Case 1: empty storage -> no groups, render still completes
  {
    const { ctx } = await loadAppInVm();
    assert.strictEqual(JSON.stringify(ctx.__test.dataState.tabs), '[]');
    assert.strictEqual(JSON.stringify(ctx.__test.dataState.saved), '[]');
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

  // Case 3: pickRepGroup is the bucket sort comparator (no observable change yet,
  // but we can call it to confirm shape)
  {
    const { ctx } = await loadAppInVm();
    const { pickRepGroup } = ctx.__test;
    const a = { key: 'a.com', tabs: [1], priority: 0 };
    const b = { key: 'b.com', tabs: [1, 2], priority: 0 };
    // pickRepGroup(a, b) > 0 means a sorts after b — b has more tabs so b wins.
    assert.ok(pickRepGroup(a, b) > 0, 'a has fewer tabs so it sorts after b');
    console.log('smoke: pickRepGroup orders by tabs.length');
  }

  console.log('all smoke tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
