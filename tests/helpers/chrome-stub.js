'use strict';

// Shared Chrome API stub for Node-based unit tests of extension/app.js.
// Usage:
//   const { installChromeStub, settle } = require('./tests/helpers/chrome-stub');
//   const ctx = installChromeStub({ initialStorage: { deferred: [] } });
//   vm.runInNewContext(source, ctx);
//   await settle();

const noop = () => {};

function makeStorage(initial = {}) {
  let data = { ...initial };
  const listeners = new Set();
  return {
    get: async defaults => { const out = { ...defaults }; for (const k of Object.keys(data)) if (data[k] !== undefined) out[k] = data[k]; return out; },
    set: async patch => {
      const before = { ...data };
      data = { ...data, ...patch };
      const changes = {};
      for (const key of Object.keys(patch)) {
        changes[key] = { oldValue: before[key], newValue: data[key] };
      }
      for (const listener of listeners) listener(changes, 'local');
    },
    remove: async keys => {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes = {};
      for (const key of list) {
        changes[key] = { oldValue: data[key], newValue: undefined };
        delete data[key];
      }
      for (const listener of listeners) listener(changes, 'local');
    },
    onChanged: { addListener: listener => listeners.add(listener) },
    _peek: () => ({ ...data }),
  };
}

function makeTabsApi() {
  const tabListeners = new Set();
  const noopFn = async () => {};
  return {
    query: async () => [],
    remove: noopFn,
    update: noopFn,
    onCreated: { addListener: l => tabListeners.add(l) },
    onRemoved: { addListener: l => tabListeners.add(l) },
    onUpdated: { addListener: l => tabListeners.add(l) },
    onMoved: { addListener: l => tabListeners.add(l) },
  };
}

function makeWindowsApi() {
  return { update: async () => {} };
}

function makeRuntimeApi() {
  // `getURL` is used by app.js to build `_favicon/` URLs. The listener stubs
  // are kept so the same harness can drive `background.js` later.
  return {
    getURL: value => `chrome-extension://test/${value}`,
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} },
  };
}

function installChromeStub({ initialStorage = {} } = {}) {
  const storage = makeStorage(initialStorage);
  const tabs = makeTabsApi();
  const windows = makeWindowsApi();
  const runtime = makeRuntimeApi();
  return {
    runtime,
    storage: { local: storage, onChanged: storage.onChanged },
    tabs,
    windows,
    // expose the underlying storage for assertions
    _storage: storage,
  };
}

// Drain pending microtasks so the initial refresh() in app.js can settle
// before tests assert state. Chrome's stubs are all async, so a few
// microtask hops are enough.
async function settle(times = 5) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

module.exports = { installChromeStub, settle };
