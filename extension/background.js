'use strict';

const isWebTab = tab => /^(https?|file):/.test(tab.url || '');

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

chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);
chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.tabs.onUpdated.addListener(updateBadge);
updateBadge();
