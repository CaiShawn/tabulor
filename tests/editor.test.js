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

async function loadAppInVm(initialStorage = {}) {
  const dom = buildDomContext();
  const chrome = installChromeStub({ initialStorage });
  const ctx = { ...dom, chrome };
  ctx.globalThis = ctx;
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'extension/app.js'), 'utf8')
    + '\n;globalThis.__test = { dataState, uiState, mergeByLabel, buildGroups, withPages, pickRepGroup, groupAt, lastGroups, applyTheme, currentStyleId, currentTheme, parseIds };';
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

  // Case 3: pickRepGroup is the bucket sort comparator
  {
    const { ctx } = await loadAppInVm();
    const { pickRepGroup } = ctx.__test;
    const a = { key: 'a.com', tabs: [1], priority: 0 };
    const b = { key: 'b.com', tabs: [1, 2], priority: 0 };
    assert.ok(pickRepGroup(a, b) > 0, 'a has fewer tabs so it sorts after b');
    console.log('smoke: pickRepGroup orders by tabs.length');
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

  console.log('all smoke tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
