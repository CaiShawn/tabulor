'use strict';

const isWebTab = tab => /^(https?|file):/.test(tab.url || '');

const ICONS = {
  light: { 16: 'icons/icon16.png', 48: 'icons/icon48.png' },
  dark: { 16: 'icons/icon16-dark.png', 48: 'icons/icon48-dark.png' },
};

const STORAGE_KEYS = { theme: 'theme' };
const OFFSCREEN_URL = 'offscreen.html';

// Diagnostic log: mirrors each step to the SW console AND to a bounded
// chrome.storage.local ring buffer so a frozen toolbar icon can be traced
// without the console being open.
const DIAG_KEY = '_diag';
function diag(area, detail) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${area}: ${detail}`;
  console.log('[tabulor]', line);
  chrome.storage.local.get({ [DIAG_KEY]: [] }).then(stored => {
    const next = [...(stored[DIAG_KEY] || []), line].slice(-80);
    chrome.storage.local.set({ [DIAG_KEY]: next }).catch(() => {});
  }).catch(() => {});
}

// The effective theme is an explicit `theme` override from chrome.storage.local
// when present; otherwise the system `prefers-color-scheme` value, reported by
// the offscreen document (offscreen.js) and the new-tab page (app.js) via
// chrome.runtime messages.
async function resolveStoredTheme() {
  const stored = await chrome.storage.local.get({ [STORAGE_KEYS.theme]: null });
  const value = stored[STORAGE_KEYS.theme];
  diag('resolveStoredTheme', `raw=${stored[STORAGE_KEYS.theme]} -> ${value === 'light' || value === 'dark' ? value : 'null'}`);
  return value === 'light' || value === 'dark' ? value : null;
}

async function updateIcon(theme) {
  const variant = ICONS[theme === 'dark' ? 'dark' : 'light'];
  try {
    await chrome.action.setIcon({ path: variant });
    diag('setIcon', JSON.stringify(variant));
  } catch (error) {
    diag('setIcon', `FAILED: ${error.message || error}`);
  }
}

// Stored override wins over the reported theme; fall back to light so a
// never-synced worker does not render a dark icon on a light surface.
async function applyTheme(reportedTheme) {
  diag('applyTheme', `reported=${reportedTheme}`);
  const override = await resolveStoredTheme();
  await updateIcon(override || reportedTheme || 'light');
}

async function setupOffscreenDocument() {
  if (!chrome.offscreen) {
    diag('offscreen', 'chrome.offscreen NOT available');
    return;
  }
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_URL);
  try {
    if ('getContexts' in chrome.runtime) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl],
      });
      diag('offscreen', `getContexts -> ${contexts.length} doc(s)`);
      if (contexts.length) return;
    } else {
      const clients = await self.clients.matchAll();
      if (clients.some(client => client.url === offscreenUrl)) return;
    }
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['MATCH_MEDIA'],
      justification: 'Watch prefers-color-scheme so the toolbar icon matches the browser theme.',
    });
    diag('offscreen', `created ${OFFSCREEN_URL} (MATCH_MEDIA)`);
  } catch (error) {
    diag('offscreen', `FAILED: ${error.message || error}`);
  }
}

async function updateBadge() {
  try {
    const count = (await chrome.tabs.query({})).filter(isWebTab).length;
    await chrome.action.setBadgeText({ text: count ? String(count) : '' });
    if (count) await chrome.action.setBadgeBackgroundColor({
      color: count <= 10 ? '#3d7a4a' : count <= 20 ? '#b8892e' : '#b35a5a',
    });
  } catch {
    await chrome.action.setBadgeText({ text: '' });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  diag('lifecycle', 'onInstalled');
  await applyTheme(null);
  await setupOffscreenDocument();
  await updateBadge();
});
chrome.runtime.onStartup.addListener(async () => {
  diag('lifecycle', 'onStartup');
  await applyTheme(null);
  await setupOffscreenDocument();
  await updateBadge();
});
chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.tabs.onUpdated.addListener(updateBadge);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || message.type !== 'tabulor:theme-change') return;
  diag('onMessage', `theme=${message.theme}`);
  applyTheme(message.theme).then(
    () => sendResponse && sendResponse({ ok: true }),
    error => {
      diag('onMessage', `FAILED: ${error.message || error}`);
      sendResponse && sendResponse({ ok: false });
    },
  );
  return true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEYS.theme]) return;
  diag('onStorage', `theme -> ${JSON.stringify(changes[STORAGE_KEYS.theme].newValue)}`);
  applyTheme(null).catch(error => diag('onStorage', `FAILED: ${error.message || error}`));
});

diag('lifecycle', 'worker top-level');
updateBadge();
