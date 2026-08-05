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

function makeTabsApi(initialTabs = []) {
  let tabs = initialTabs.map(tab => ({ ...tab }));
  let nextId = tabs.reduce((max, tab) => Math.max(max, Number(tab.id) || 0), 0) + 1;
  const tabListeners = new Set();
  const noopFn = async () => {};
  return {
    query: async () => tabs.map(tab => ({ ...tab })),
    create: async ({ url, active = true }) => {
      const tab = { id: nextId++, windowId: 1, url, title: url, active };
      tabs.push(tab);
      for (const listener of tabListeners) listener(tab);
      return { ...tab };
    },
    remove: noopFn,
    update: noopFn,
    onCreated: { addListener: l => tabListeners.add(l) },
    onRemoved: { addListener: l => tabListeners.add(l) },
    onUpdated: { addListener: l => tabListeners.add(l) },
    onMoved: { addListener: l => tabListeners.add(l) },
    _peek: () => tabs.map(tab => ({ ...tab })),
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

// Minimal chrome.readingList stub. Keeps an in-memory array of entries keyed
// by URL (matching the real API's uniqueness contract), fires onEntry* events
// when entries are added/updated/removed, and exposes `_peek` so tests can
// assert the underlying state without going through `query()`.
function makeReadingListApi({ initialEntries = [] } = {}) {
  let entries = initialEntries.map(entry => ({ ...entry }));
  const listenerSets = {
    onEntryAdded: new Set(),
    onEntryUpdated: new Set(),
    onEntryRemoved: new Set(),
  };
  const fire = (name, entry) => { for (const cb of listenerSets[name]) cb(entry); };
  return {
    query: async () => entries.map(entry => ({ ...entry })),
    addEntry: async ({ url, title, hasBeenRead }) => {
      if (!url) throw new Error('readingList.addEntry: url is required');
      if (!entries.find(e => e.url === url)) {
        const entry = {
          url,
          title: title || url,
          hasBeenRead: !!hasBeenRead,
          creationTime: Date.now(),
          lastUpdateTime: Date.now(),
        };
        entries.push(entry);
        fire('onEntryAdded', { ...entry });
      }
    },
    updateEntry: async ({ url, title, hasBeenRead }) => {
      const entry = entries.find(e => e.url === url);
      if (!entry) return;
      if (title !== undefined) entry.title = title;
      if (hasBeenRead !== undefined) entry.hasBeenRead = !!hasBeenRead;
      entry.lastUpdateTime = Date.now();
      fire('onEntryUpdated', { ...entry });
    },
    removeEntry: async ({ url }) => {
      const idx = entries.findIndex(e => e.url === url);
      if (idx < 0) return;
      const [entry] = entries.splice(idx, 1);
      fire('onEntryRemoved', { ...entry });
    },
    onEntryAdded: { addListener: cb => listenerSets.onEntryAdded.add(cb) },
    onEntryUpdated: { addListener: cb => listenerSets.onEntryUpdated.add(cb) },
    onEntryRemoved: { addListener: cb => listenerSets.onEntryRemoved.add(cb) },
    _peek: () => entries.map(entry => ({ ...entry })),
  };
}

function installChromeStub({ initialStorage = {}, initialReadingList = [], initialTabs = [] } = {}) {
  const storage = makeStorage(initialStorage);
  const tabs = makeTabsApi(initialTabs);
  const windows = makeWindowsApi();
  const runtime = makeRuntimeApi();
  const readingList = makeReadingListApi({ initialEntries: initialReadingList });
  return {
    runtime,
    storage: { local: storage, onChanged: storage.onChanged },
    tabs,
    windows,
    readingList,
    // expose the underlying storage / reading-list for assertions
    _storage: storage,
    _readingList: readingList,
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
