/* Tabulor — new-tab dashboard, no server or build step. */
'use strict';

const MAX_NAME_LENGTH = 50;
const LOCAL_FILES_KEY = 'local-files';
// `readingListMirror` is a local shadow copy of `chrome.readingList`, populated
// lazily on every successful query(). It is the render source so the dashboard
// still has data to show if a later query() rejects, and it survives new-tab
// page reloads. `chrome.readingList` is the source of truth; the mirror is a
// cache, not a peer. We do not listen for our own mirror writes in
// `storage.onChanged` — reactivity for external Reading-list changes comes
// from `chrome.readingList.onEntryAdded/Updated/Removed`.
const STORAGE_KEYS = { readingListMirror: 'readingListMirror', theme: 'theme', styleId: 'styleId', customGroupNames: 'customGroupNames', unreadExpanded: 'unreadExpanded', readExpanded: 'readExpanded', layout: 'openTabsLayout' };
// Two visual styles: 'classic' (the original ink-on-paper look) and 'terminal'
// (Fira Code, saturated colors, sharp corners). Style is independent of the
// light/dark theme: terminal-light is Blue Sea, terminal-dark is Pistachio.
const STYLES = [
  { id: 'classic', label: 'Classic' },
  { id: 'terminal', label: 'Terminal' },
];
const DEFAULT_STYLE_ID = 'classic';
const LAYOUTS = ['multi', 'single'];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $('#app');

const dataState = {
  tabs: [],
  customGroupNames: {},
  // Mirrors the entries in chrome.readingList (URL-keyed). Populated from the
  // local `readingListMirror` cache on load and refreshed by
  // `refreshReadingList()` thereafter.
  readingList: [],
  // True after a `chrome.readingList.query()` rejection. The UI uses this to
  // surface a "showing cached" banner; the column still renders from the
  // mirror so the user is not left with an empty state on a transient blip.
  readingListError: false,
  theme: null,
  styleId: DEFAULT_STYLE_ID,
  layout: 'multi',
};

const uiState = {
  editingKey: null,
  editingDraft: '',
  unreadExpanded: true,
  readExpanded: false,
  firstRender: true,
};

const FRIENDLY = {
  'github.com': 'GitHub', 'gist.github.com': 'GitHub Gist',
  'youtube.com': 'YouTube', 'www.youtube.com': 'YouTube', 'music.youtube.com': 'YouTube Music',
  'x.com': 'X', 'twitter.com': 'X', 'www.x.com': 'X',
  'reddit.com': 'Reddit', 'www.reddit.com': 'Reddit', 'old.reddit.com': 'Reddit',
  'linkedin.com': 'LinkedIn', 'www.linkedin.com': 'LinkedIn',
  'stackoverflow.com': 'Stack Overflow', 'news.ycombinator.com': 'Hacker News',
  'mail.google.com': 'Gmail', 'docs.google.com': 'Google Docs', 'drive.google.com': 'Google Drive',
  'calendar.google.com': 'Google Calendar', 'meet.google.com': 'Google Meet',
  'gemini.google.com': 'Gemini', 'chatgpt.com': 'ChatGPT', 'chat.openai.com': 'ChatGPT',
  'claude.ai': 'Claude', 'code.claude.com': 'Claude Code', 'notion.so': 'Notion',
  'figma.com': 'Figma', 'app.slack.com': 'Slack', 'discord.com': 'Discord',
  'en.wikipedia.org': 'Wikipedia', 'open.spotify.com': 'Spotify', 'developer.mozilla.org': 'MDN',
  'arxiv.org': 'arXiv', 'huggingface.co': 'Hugging Face', 'producthunt.com': 'Product Hunt',
  'www.xiaohongshu.com': 'RedNote', 'feishu.cn': 'Feishu', 'www.feishu.cn': 'Feishu', [LOCAL_FILES_KEY]: 'Local Files',
};

const ICONS = {
  tabs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25M3 8.25h18M3 8.25V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  iconSun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  iconMoon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>`,
  undo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg>`,
  layout: `<span class="layout-icon"><svg viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="9" height="9"/><rect x="17" y="4" width="9" height="9"/><rect x="4" y="17" width="9" height="9"/><rect x="17" y="17" width="9" height="9"/></svg><span>/</span><svg viewBox="0 0 24 30" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="22" height="4"/><rect x="4" y="13" width="22" height="4"/><rect x="4" y="22" width="22" height="4"/></svg></span>`,
};

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const isWebTab = tab => /^(https?|file):/.test(tab.url || '');
const hostname = url => {
  try { return url.startsWith('file:') ? LOCAL_FILES_KEY : new URL(url).hostname; }
  catch { return ''; }
};
const tidyName = (value, max = MAX_NAME_LENGTH) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
};
const localFavicon = url => `${chrome.runtime.getURL('_favicon/')}?pageUrl=${encodeURIComponent(url)}&size=16`;

function safeImageUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return ['data:', 'blob:', 'http:', 'https:', 'chrome:', 'chrome-extension:'].includes(protocol) ? value : '';
  } catch { return ''; }
}

function originFavicon(url) {
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) ? `${parsed.origin}/favicon.ico` : '';
  } catch { return ''; }
}

function faviconImage(item, className = '') {
  const candidates = [...new Set([
    safeImageUrl(item.favIconUrl),
    originFavicon(item.url),
    localFavicon(item.url),
  ].filter(Boolean))];
  const [primary, ...fallbacks] = candidates;
  return `<img${className ? ` class="${className}"` : ''} src="${esc(primary)}" data-favicon-fallbacks="${esc(JSON.stringify(fallbacks))}" alt="">`;
}

function friendlyDomain(host) {
  if (FRIENDLY[host]) return FRIENDLY[host];
  const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
  if (host.endsWith('.feishu.cn')) return 'Feishu';
  if (host.endsWith('.substack.com')) return `${cap(host.replace('.substack.com', ''))}'s Substack`;
  if (host.endsWith('.github.io')) return `${cap(host.replace('.github.io', ''))} (GitHub Pages)`;
  return host.replace(/^www\./, '').replace(/\.(com|org|net|io|co|ai|dev|app|so|me|xyz|info|us|uk|cn)$/, '')
    .split('.').map(cap).join(' ');
}

function displayTitle(tab) {
  let title = (tab.title || tab.url || '')
    .replace(/^\(\d+\+?\)\s*/, '')
    .replace(/\s*\([\d,]+\+?\)\s*/g, ' ')
    .replace(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '')
    .replace(/\s+on X:\s*/, ': ').replace(/\s*\/\s*X\s*$/, '').trim();

  try {
    const { hostname: host, pathname, port } = new URL(tab.url);
    const parts = pathname.split('/').filter(Boolean);
    const titleIsUrl = !title || title === tab.url || title.startsWith(host) || title.startsWith('http');
    if (['x.com', 'twitter.com'].includes(host) && pathname.includes('/status/') && titleIsUrl) title = `Post by @${parts[0]}`;
    if (host.replace(/^www\./, '') === 'github.com' && parts.length >= 2 && titleIsUrl) title = `${parts[0]}/${parts[1]}`;
    if (host.includes('youtube.com') && pathname === '/watch' && titleIsUrl) title = 'YouTube Video';
    if (host.includes('reddit.com') && pathname.includes('/comments/') && titleIsUrl) {
      const i = parts.indexOf('r');
      if (parts[i + 1]) title = `r/${parts[i + 1]} post`;
    }
    if (host === 'localhost' && port) title = `${port} ${title}`;

    const site = friendlyDomain(host).toLowerCase();
    for (const sep of [' - ', ' | ', ' — ', ' · ', ' – ']) {
      const i = title.lastIndexOf(sep);
      if (i > 4 && title.slice(i + sep.length).trim().toLowerCase() === site) title = title.slice(0, i);
    }
  } catch { /* Preserve the original title for unusual URLs. */ }
  return title || tab.url;
}

const configuredCustomRules = () => typeof LOCAL_CUSTOM_GROUPS === 'undefined' ? [] : LOCAL_CUSTOM_GROUPS;

function ruleMatches(rule, url) {
  try {
    const parsed = new URL(url);
    const hostMatches = rule.hostname ? parsed.hostname === rule.hostname
      : rule.hostnameEndsWith ? parsed.hostname.endsWith(rule.hostnameEndsWith) : false;
    if (!hostMatches) return false;
    if (rule.test) return rule.test(parsed.pathname, url);
    if (rule.pathPrefix) return parsed.pathname.startsWith(rule.pathPrefix);
    if (rule.pathExact) return rule.pathExact.includes(parsed.pathname);
    return parsed.pathname === '/' || !rule.pathPrefix;
  } catch { return false; }
}

function customNameFor(key) {
  return tidyName(dataState.customGroupNames[key]);
}

function buildGroups(tabs) {
  const custom = configuredCustomRules();
  const groups = new Map();

  for (const [order, tab] of tabs.filter(isWebTab).entries()) {
    const customRule = custom.find(rule => ruleMatches(rule, tab.url));
    const key = customRule?.groupKey || hostname(tab.url);
    if (!key) continue;
    if (!groups.has(key)) {
      const defaultLabel = customRule?.groupLabel || friendlyDomain(key);
      groups.set(key, {
        key,
        defaultLabel,
        label: customNameFor(key) || defaultLabel,
        domain: !customRule && key !== LOCAL_FILES_KEY ? key : '',
        priority: 0,
        order,
        tabs: [],
      });
    }
    groups.get(key).tabs.push(tab);
  }

  return [...groups.values()].sort(sortGroups);
}

function withPages(group) {
  if (group.pages) return group;
  const pages = new Map();
  for (const tab of group.tabs) {
    if (!pages.has(tab.url)) pages.set(tab.url, []);
    pages.get(tab.url).push(tab);
  }
  group.pages = [...pages.values()];
  group.duplicates = group.pages.reduce((n, x) => n + x.length - 1, 0);
  return group;
}

function sortGroups(a, b) {
  const aOrder = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
  const bOrder = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
  return b.priority - a.priority || aOrder - bOrder || a.key.localeCompare(b.key);
}

// Merge groups that share the same display label (custom or default).
// Prefer a custom name, then local files, then the first tab position.
function pickRepGroup(a, b) {
  const repBoost = g => (customNameFor(g.key) ? 2 : 0) + (g.key === LOCAL_FILES_KEY ? 1 : 0);
  const aOrder = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
  const bOrder = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
  return repBoost(b) - repBoost(a) || aOrder - bOrder || a.key.localeCompare(b.key);
}

function mergeByLabel(groups) {
  const buckets = new Map();
  for (const group of groups) {
    if (!buckets.has(group.label)) buckets.set(group.label, []);
    buckets.get(group.label).push(group);
  }
  const merged = [];
  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      const [group] = bucket;
      merged.push(withPages({ ...group, sources: [{ key: group.key, defaultLabel: group.defaultLabel, domain: group.domain }] }));
      continue;
    }
    bucket.sort(pickRepGroup);
    const rep = bucket[0];
    const tabs = bucket.flatMap(g => g.tabs);
    const sources = bucket.map(g => ({ key: g.key, defaultLabel: g.defaultLabel, domain: g.domain }));
    merged.push(withPages({ ...rep, tabs, sources }));
  }
  return merged.sort(sortGroups);
}

function describeGroup(group) {
  const lines = [`Default: ${group.defaultLabel}`];
  if (group.sources.length > 1) {
    lines.push(`Combined from ${group.sources.length} groups`);
    for (const s of group.sources) {
      lines.push(s.domain ? `${s.defaultLabel} (${s.domain})` : s.defaultLabel);
    }
  } else if (group.domain) {
    lines.push(`Domain: ${group.domain}`);
  }
  return lines.join('\n');
}

function timeAgo(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value)) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr${minutes < 120 ? '' : 's'} ago`;
  const days = Math.floor(minutes / 1440);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function tabTemplate(copies) {
  // Each chip owns the full set of tab ids that share its URL so per-chip
  // actions (focus/close/save) operate on the visible chip instead of always
  // the first instance, which used to leak across duplicates.
  const tab = copies[0];
  const ids = copies.map(t => t.id).join(',');
  const count = copies.length;
  return `<div class="page-chip clickable${count > 1 ? ' chip-has-dupes' : ''}" data-action="focus" data-tab-ids="${ids}" data-tab-id="${tab.id}" title="${esc(displayTitle(tab))}">
    ${faviconImage(tab, 'chip-favicon')}
    <span class="chip-text">${esc(displayTitle(tab))}</span>
    ${count > 1 ? `<span class="chip-dupe-badge">(${count}x)</span>` : ''}
    <div class="chip-actions">
      <button class="chip-action chip-save" data-action="save" data-tab-ids="${ids}" data-tab-id="${tab.id}" title="Save for later">☆</button>
      <button class="chip-action chip-close" data-action="close" data-tab-ids="${ids}" data-tab-id="${tab.id}" title="Close this tab">${ICONS.close}</button>
    </div>
  </div>`;
}

function groupTemplate(group, index) {
  const { pages, duplicates } = withPages(group);
  const visible = pages.slice(0, 8);
  const hidden = pages.slice(8);
  const duplicateBadge = duplicates
    ? `<span class="open-tabs-badge open-tabs-badge-duplicate">${plural(duplicates, 'duplicate')}</span>` : '';
  const editing = uiState.editingKey === group.key;
  const titleHtml = editing
    ? `<input class="group-name-input" data-group="${index}" value="${esc(uiState.editingDraft)}" maxlength="${MAX_NAME_LENGTH}" placeholder="${esc(group.defaultLabel)}" title="${esc(describeGroup(group))}" aria-label="Custom name for ${esc(group.defaultLabel)}" autocomplete="off">`
    : `<span class="mission-name" title="${esc(describeGroup(group))}">${esc(group.label)}</span>
      <button class="group-rename-btn" data-action="edit-group" data-group="${index}" title="Rename group" aria-label="Rename ${esc(group.label)}">${ICONS.edit}</button>`;
  return `<article class="mission-card domain-card${duplicates ? ' has-duplicates' : ''}" data-group="${index}">
    <div class="mission-content">
      <div class="mission-top"><div class="mission-title">${titleHtml}</div>
        <span class="open-tabs-badge">${ICONS.tabs}${plural(group.tabs.length, 'tab')} open</span>${duplicateBadge}</div>
      <div class="mission-pages">${visible.map(tabTemplate).join('')}
        ${hidden.length ? `<div class="page-chips-overflow" hidden>${hidden.map(tabTemplate).join('')}</div>
          <div class="page-chip page-chip-overflow clickable" data-action="expand">+${hidden.length} more</div>` : ''}
      </div>
      <div class="actions">
        <button class="action-btn close-tabs" data-action="close-group" data-group="${index}">${ICONS.close}Close all ${plural(group.tabs.length, 'tab')}</button>
        ${duplicates ? `<button class="action-btn" data-action="dedupe" data-group="${index}">Close ${plural(duplicates, 'duplicate')}</button>` : ''}
      </div>
    </div>
  </article>`;
}

function savedItemTemplate(item) {
  const domain = hostname(item.url).replace(/^www\./, '');
  return `<div class="deferred-item" data-saved-url="${esc(item.url)}">
    ${faviconImage({ url: item.url }, 'deferred-favicon')}
    <div class="deferred-info"><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener" class="deferred-title">${esc(item.title || item.url)}</a>
      <div class="deferred-meta"><span>${esc(domain)}</span><span>${timeAgo(item.creationTime)}</span></div></div>
    <button class="deferred-dismiss" data-action="complete" data-saved-url="${esc(item.url)}" title="Mark as read">${ICONS.check}</button>
    <button class="deferred-dismiss" data-action="dismiss" data-saved-url="${esc(item.url)}" title="Dismiss">${ICONS.close}</button>
  </div>`;
}

// One row in the collapsible "Done" section. Same visual structure as the
// Unread row (favicon + info + action button + dismiss); the action button
// is the inverse of Unread's "mark as read" — it restores the entry to the
// Unread list via the `restore` action.
function readItemTemplate(item) {
  const domain = hostname(item.url).replace(/^www\./, '');
  return `<div class="deferred-item" data-saved-url="${esc(item.url)}">
    ${faviconImage({ url: item.url }, 'deferred-favicon')}
    <div class="deferred-info"><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener" class="deferred-title">${esc(item.title || item.url)}</a>
      <div class="deferred-meta"><span>${esc(domain)}</span><span>${timeAgo(item.lastUpdateTime || item.creationTime)}</span></div></div>
    <button class="deferred-dismiss" data-action="restore" data-saved-url="${esc(item.url)}" title="Move back to Unread">${ICONS.undo}</button>
    <button class="deferred-dismiss" data-action="dismiss" data-saved-url="${esc(item.url)}" title="Dismiss">${ICONS.close}</button>
  </div>`;
}

function safeUrl(url) {
  try { return /^(https?|file):$/.test(new URL(url).protocol) ? url : '#'; }
  catch { return '#'; }
}

function savedTemplate() {
  const unread = dataState.readingList.filter(x => !x.hasBeenRead);
  const read = dataState.readingList.filter(x => x.hasBeenRead);
  if (!unread.length && !read.length) return '';
  // Top-level "Reading list" header above two peer sub-sections, each
  // independently collapsible with its own count badge: "Unread" and "Done".
  // Search filtering within the list is deferred to the Search + keyboard-first plan.
  return `<aside class="deferred-column" id="deferredColumn">
    <div class="section-header reading-list-header"><h2>Reading list</h2></div>
    <div class="deferred-unread">
      <button class="unread-toggle section-header" data-action="toggle-unread" aria-expanded="${uiState.unreadExpanded}">
        <span class="unread-title">Unread</span><span class="section-line"></span><span class="section-count">${plural(unread.length, 'item')}</span><span class="unread-chevron">${ICONS.chevron}</span></button>
      <div class="unread-body" ${uiState.unreadExpanded ? '' : 'hidden'}>
        <div class="deferred-list">${unread.map(savedItemTemplate).join('')}</div>
        ${unread.length ? '' : '<div class="deferred-empty">Nothing saved. Living in the moment.</div>'}
      </div>
    </div>
    ${read.length ? `<div class="deferred-read">
      <button class="read-toggle section-header" data-action="toggle-read" aria-expanded="${uiState.readExpanded}">
        <span class="read-title">Done</span><span class="section-line"></span><span class="section-count">${plural(read.length, 'item')}</span><span class="read-chevron">${ICONS.chevron}</span></button>
      <div class="read-body" ${uiState.readExpanded ? '' : 'hidden'}>
        <div class="read-list">${read.map(readItemTemplate).join('')}</div>
      </div></div>` : ''}
  </aside>`;
}

function render() {
  const groups = mergeByLabel(buildGroups(dataState.tabs));
  lastGroups = groups;
  const realTabs = dataState.tabs.filter(isWebTab);
  const styleSegments = STYLES.map(s => {
    const active = s.id === currentStyleId();
    return `<button class="theme-segment" data-action="set-style" data-style="${s.id}" aria-pressed="${active}" title="${s.label} style">${s.label}</button>`;
  }).join('');
  const containerClass = uiState.firstRender ? 'container' : 'container no-anim';
  const layout = LAYOUTS.includes(dataState.layout) ? dataState.layout : 'multi';

  app.innerHTML = `<div class="${containerClass}">
    <div class="dashboard-columns">
      ${groups.length ? `<section class="active-section"><div class="section-header"><div class="theme-segments" role="group" aria-label="Style">${styleSegments}</div><button class="layout-toggle action-btn" data-action="toggle-layout" aria-pressed="${layout === 'single'}" title="Switch to ${layout === 'single' ? 'multi-column' : 'single-column'} layout" aria-label="Switch to ${layout === 'single' ? 'multi-column' : 'single-column'} layout">${ICONS.layout}</button><h2>Open tabs</h2><div class="section-line"></div><div class="section-count"><span class="section-count-text">${plural(groups.length, 'domain')}</span><span class="section-dot">·</span><button class="action-btn close-tabs" data-action="close-all">${ICONS.close}Close all ${plural(realTabs.length, 'tab')}</button></div></div><div class="missions${layout === 'single' ? ' layout-single' : ''}">${groups.map(groupTemplate).join('')}</div></section>` : emptyTemplate()}
      ${savedTemplate()}
    </div>
  </div>`;
  uiState.firstRender = false;
  focusEditorIfNeeded();
}

function focusEditorIfNeeded() {
  if (!uiState.editingKey) return;
  const input = $('.group-name-input');
  if (!input) return;
  input.focus();
  input.select();
}

function emptyTemplate() {
  return `<section class="active-section"><div class="missions-empty-state"><div class="empty-checkmark">✓</div><div class="empty-title">Inbox zero, but for tabs.</div><div class="empty-subtitle">You're free.</div></div></section>`;
}

function currentTheme() {
  return dataState.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function currentStyleId() {
  return STYLES.some(s => s.id === dataState.styleId) ? dataState.styleId : DEFAULT_STYLE_ID;
}

function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = currentTheme();
  root.dataset.style = currentStyleId();
  // Switch the body font stack via the .terminal class (CSS keys off `.terminal`).
  // Guard `document.body` so the test stub (no body element) can still drive a
  // refresh() without a classList TypeError leaking into the test output.
  if (document.body) document.body.classList.toggle('terminal', currentStyleId() === 'terminal');
  notifyTheme();
}

// Mirrors the resolved effective theme (dataState.theme override or
// prefers-color-scheme) to the background service worker so the toolbar
// action icon can swap to the matching light/dark variant. MV3 service
// workers cannot register matchMedia listeners themselves; the new-tab page
// is the only place we can observe OS color-scheme changes.
function notifyTheme() {
  const theme = currentTheme();
  console.log('[tabulor-page] notifyTheme ->', theme, '(system dark =', matchMedia('(prefers-color-scheme: dark)').matches, ')');
  try {
    chrome.runtime?.sendMessage?.({ type: 'tabulor:theme-change', theme });
  } catch { /* service worker not ready yet — background.js initializes on its own */ }
}

async function loadState() {
  // One-time migration: if the legacy `deferred` key is still on disk, push
  // each entry into chrome.readingList and drop the local key. The
  // chrome.readingList API is idempotent by URL, so a re-run on a later load
  // (after the key has been removed) is a cheap no-op against an empty list.
  // The legacy schema stored `completedAt` as an ISO string; we map that to
  // `hasBeenRead` so the Pages-you've-read section is preserved across the move.
  // The key name is hardcoded because `STORAGE_KEYS.deferred` was retired
  // with the migration; only this one call site still knows the legacy name.
  const legacy = await chrome.storage.local.get('deferred');
  const legacyItems = Array.isArray(legacy.deferred) ? legacy.deferred.filter(item => item && item.url && !item.dismissed) : [];
  if (legacyItems.length) {
    for (const item of legacyItems) {
      try {
        await chrome.readingList.addEntry({
          url: item.url,
          title: item.title || item.url,
          hasBeenRead: !!(item.completedAt || item.completed),
        });
      } catch (error) {
        console.error('[tabulor] migration addEntry failed for', item.url, error);
      }
    }
    await chrome.storage.local.remove('deferred');
  }

  const [tabs, stored] = await Promise.all([
    chrome.tabs.query({}),
    chrome.storage.local.get({ [STORAGE_KEYS.readingListMirror]: [], [STORAGE_KEYS.theme]: null, [STORAGE_KEYS.styleId]: DEFAULT_STYLE_ID, [STORAGE_KEYS.customGroupNames]: {}, [STORAGE_KEYS.unreadExpanded]: true, [STORAGE_KEYS.readExpanded]: false, [STORAGE_KEYS.layout]: 'multi' }),
  ]);
  dataState.tabs = tabs;
  // The mirror is the immediate render source; refreshReadingList() overwrites
  // it with the fresh API snapshot a few ms later.
  dataState.readingList = Array.isArray(stored[STORAGE_KEYS.readingListMirror]) ? stored[STORAGE_KEYS.readingListMirror] : [];
  dataState.theme = stored.theme;
  // Resolve styleId against the registered style list; unknown or missing values
  // fall back to the default. The legacy `themeId` key was never written, so
  // there is no on-disk migration step to perform here.
  dataState.styleId = STYLES.some(s => s.id === stored.styleId) ? stored.styleId : DEFAULT_STYLE_ID;
  dataState.customGroupNames = Object.fromEntries(
    Object.entries(stored.customGroupNames || {})
      .map(([key, value]) => [key, tidyName(value)])
      .filter(([key, value]) => key && value),
  );
  uiState.unreadExpanded = stored[STORAGE_KEYS.unreadExpanded] !== false;
  uiState.readExpanded = !!stored[STORAGE_KEYS.readExpanded];
  dataState.layout = LAYOUTS.includes(stored[STORAGE_KEYS.layout]) ? stored[STORAGE_KEYS.layout] : 'multi';
}

let refreshInFlight;
async function refresh() {
  // Coalesce concurrent refreshes so the storage.onChanged callback and the
  // main-flow `await refresh()` don't race each other and overwrite each
  // other's `loadState()` result.
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    await loadState();
    applyTheme();
    render();
    await refreshReadingList();
    registerReadingListListeners();
  })();
  try { await refreshInFlight; }
  finally { refreshInFlight = null; }
}

// Pull the current chrome.readingList snapshot, replace the mirror, and
// re-render. On rejection (e.g. permission revoked mid-flight) we keep the
// existing mirror so the column still renders, and flip `readingListError`
// so the UI can surface a "showing cached" banner. Re-rendering twice (once
// with the mirror, once with the fresh API data) is intentional — the first
// render is immediate on load, the second replaces it within a frame.
async function refreshReadingList() {
  try {
    const items = await chrome.readingList.query({});
    const normalised = items.map(item => ({
      url: item.url,
      title: item.title || item.url,
      hasBeenRead: !!item.hasBeenRead,
      creationTime: item.creationTime,
      lastUpdateTime: item.lastUpdateTime,
    }));
    dataState.readingList = normalised;
    dataState.readingListError = false;
    await chrome.storage.local.set({ [STORAGE_KEYS.readingListMirror]: normalised });
    render();
  } catch (error) {
    console.error('[tabulor] readingList query failed', error);
    dataState.readingListError = true;
    render();
  }
}

// External Reading-list changes (added from Chrome's side panel, another
// extension, or another signed-in device after the next sync cycle) flow in
// via the three entry events. We only react by re-querying — refreshReadingList
// owns the mirror write and the render, so we do not also need to subscribe
// to `storage.onChanged` for `readingListMirror` (our own write would loop).
let readingListListenersRegistered = false;
function registerReadingListListeners() {
  if (readingListListenersRegistered) return;
  if (!chrome.readingList) return; // not granted in this context (tests, older Chrome)
  const onChange = () => { refreshReadingList().catch(error => console.error('[tabulor]', error)); };
  chrome.readingList.onEntryAdded.addListener(onChange);
  chrome.readingList.onEntryUpdated.addListener(onChange);
  chrome.readingList.onEntryRemoved.addListener(onChange);
  readingListListenersRegistered = true;
}

function findTab(id) {
  return dataState.tabs.find(tab => tab.id === Number(id));
}

function parseIds(value) {
  if (!value) return [];
  return [...new Set(value.split(',').map(Number).filter(Number.isFinite))];
}

async function removeTabs(ids) {
  const unique = [...new Set(ids.map(Number).filter(Number.isFinite))];
  if (unique.length) await chrome.tabs.remove(unique);
}

// Populated by render(); actions read the same view the user just saw,
// so editor open/close/save all operate on consistent state.
let lastGroups = [];
const groupAt = index => lastGroups[Number(index)] || null;

function openEditor(group) {
  uiState.editingKey = group.key;
  // Start with an empty draft so the placeholder ("default label") stays visible
  // until the user types. commitEditor treats an empty value as "revert".
  uiState.editingDraft = '';
  render();
}

const groupByKey = key => lastGroups.find(g => g.sources.some(s => s.key === key)) || null;

function cancelEditor() {
  if (!uiState.editingKey) return;
  uiState.editingKey = null;
  uiState.editingDraft = '';
  render();
}

async function commitEditor() {
  const key = uiState.editingKey;
  if (!key) return;
  const live = lastGroups.find(g => g.sources.some(s => s.key === key));
  if (!live) { cancelEditor(); return; }

  const entered = tidyName(uiState.editingDraft);
  const defaultLabel = live.defaultLabel;
  const nextName = entered && entered !== defaultLabel ? entered : '';
  const previousName = tidyName(dataState.customGroupNames[key]);

  uiState.editingKey = null;
  uiState.editingDraft = '';

  if (nextName === previousName) { render(); return; }

  const nextNames = { ...dataState.customGroupNames };
  if (nextName) nextNames[key] = nextName;
  else delete nextNames[key];

  const previousNames = dataState.customGroupNames;
  dataState.customGroupNames = nextNames;
  try {
    await chrome.storage.local.set({ customGroupNames: nextNames });
    render();
  } catch (error) {
    dataState.customGroupNames = previousNames;
    console.error('[tabulor]', error);
  }
}

async function closeWithEffect(ids) {
  await removeTabs(ids);
  await refresh();
}

// Click actions grouped by the state they touch. The single click delegate
// below flattens these into one lookup table.
const tabActions = {
  focus: async el => {
    const tab = findTab(el.dataset.tabId);
    if (!tab) return;
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  },
  close: async (el, event) => {
    event.stopPropagation();
    await closeWithEffect(parseIds(el.dataset.tabIds));
  },
  save: async (el, event) => {
    event.stopPropagation();
    const tab = findTab(el.dataset.tabId);
    if (!tab || !tab.url) return;
    try {
      await chrome.readingList.addEntry({ url: tab.url, title: displayTitle(tab), hasBeenRead: false });
    } catch (error) {
      console.error('[tabulor] addEntry failed', error);
      return;
    }
    await closeWithEffect(parseIds(el.dataset.tabIds));
  },
  'close-group': async el => {
    const group = groupAt(el.dataset.group);
    if (group) await closeWithEffect(group.tabs.map(t => t.id));
  },
  dedupe: async el => {
    const group = groupAt(el.dataset.group);
    if (!group) return;
    const { pages } = withPages(group);
    const ids = pages.flatMap(copies => {
      const keep = copies.find(t => t.active) || copies[0];
      return copies.filter(t => t.id !== keep.id).map(t => t.id);
    });
    await closeWithEffect(ids);
  },
  'close-all': async () => closeWithEffect(dataState.tabs.filter(isWebTab).map(t => t.id)),
};

const savedActions = {
  // Mark an entry as read. `hasBeenRead: true` is how chrome.readingList
  // expresses the read state, mirroring the Unread / Done split
  // rendered by savedTemplate().
  complete: async el => {
    await chrome.readingList.updateEntry({ url: el.dataset.savedUrl, hasBeenRead: true });
    await refreshReadingList();
  },
  dismiss: async el => {
    await chrome.readingList.removeEntry({ url: el.dataset.savedUrl });
    await refreshReadingList();
  },
  // Move a read entry back into the Unread list. Triggered by the undo
  // button on each row in the "Done" section.
  restore: async el => {
    await chrome.readingList.updateEntry({ url: el.dataset.savedUrl, hasBeenRead: false });
    await refreshReadingList();
  },
  'toggle-read': () => {
    uiState.readExpanded = !uiState.readExpanded;
    chrome.storage.local.set({ [STORAGE_KEYS.readExpanded]: uiState.readExpanded });
    render();
  },
  'toggle-unread': () => {
    uiState.unreadExpanded = !uiState.unreadExpanded;
    chrome.storage.local.set({ [STORAGE_KEYS.unreadExpanded]: uiState.unreadExpanded });
    render();
  },
};

const uiActions = {
  'edit-group': (el, event) => {
    event.stopPropagation();
    const group = groupAt(el.dataset.group);
    if (group) openEditor(group);
  },
  'set-style': (el) => {
    const nextId = el.dataset.style;
    if (!STYLES.some(s => s.id === nextId)) return;
    dataState.styleId = nextId;
    chrome.storage.local.set({ [STORAGE_KEYS.styleId]: nextId });
    applyTheme();
    render();
  },
  'toggle-layout': () => {
    dataState.layout = dataState.layout === 'single' ? 'multi' : 'single';
    chrome.storage.local.set({ [STORAGE_KEYS.layout]: dataState.layout });
    render();
  },
  expand: el => {
    const overflow = el.previousElementSibling;
    if (overflow) overflow.hidden = false;
    el.remove();
  },
};

const actions = { ...tabActions, ...savedActions, ...uiActions };

document.addEventListener('error', event => {
  const image = event.target;
  if (!image.matches?.('img[data-favicon-fallbacks]')) return;
  const fallbacks = JSON.parse(image.dataset.faviconFallbacks || '[]');
  const next = fallbacks.shift();
  if (!next) { image.hidden = true; return; }
  image.dataset.faviconFallbacks = JSON.stringify(fallbacks);
  image.src = next;
}, true);

document.addEventListener('click', async event => {
  const el = event.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  el.disabled = true;
  try { await actions[el.dataset.action](el, event); }
  catch (error) { console.error('[tabulor]', error); }
  finally { if (el.isConnected) el.disabled = false; }
});

document.addEventListener('input', event => {
  const target = event.target;
  if (target.matches('.group-name-input')) {
    uiState.editingDraft = target.value;
    return;
  }
  // Reading-list search filtering is deferred to the Search + keyboard-first
  // plan; no input handlers attach to the Reading list section today.
});

function renderReadList() {
  const read = dataState.readingList.filter(x => x.hasBeenRead);
  const list = $('.read-list');
  if (list) list.innerHTML = read.map(readItemTemplate).join('');
}

document.addEventListener('keydown', event => {
  if (!event.target.matches('.group-name-input') || event.isComposing) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    commitEditor().catch(error => console.error('[tabulor]', error));
  } else if (event.key === 'Escape') {
    event.preventDefault();
    cancelEditor();
  }
});

document.addEventListener('focusout', event => {
  if (!event.target.matches('.group-name-input') || !uiState.editingKey) return;
  commitEditor().catch(error => console.error('[tabulor]', error));
});

let refreshTimer;
const scheduleRefresh = () => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refresh().catch(console.error), 80);
};
chrome.tabs.onCreated.addListener(scheduleRefresh);
chrome.tabs.onRemoved.addListener(scheduleRefresh);
chrome.tabs.onUpdated.addListener(scheduleRefresh);
chrome.tabs.onMoved.addListener(scheduleRefresh);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  // style/theme/unreadExpanded/readExpanded switches are handled inline
  // (applyTheme, set-style, toggle-unread, toggle-read) and do not need a
  // full refresh. customGroupNames changes need a fresh render.
  // Reading-list reactivity flows through chrome.readingList.onEntry*
  // events, not the storage mirror.
  if (STORAGE_KEYS.customGroupNames in changes) scheduleRefresh();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  // Only the OS-level signal flows through here; if the user has an explicit
  // dataState.theme, applyTheme() (via storage change) has already pushed the
  // notification. notifyTheme() is also called inside applyTheme() so the
  // toolbar icon stays in sync whenever the dashboard re-renders.
  if (!dataState.theme) applyTheme();
});

refresh().catch(error => {
  console.error('[tabulor]', error);
  app.innerHTML = '<div class="container"><h2>Tabulor</h2><p>Could not read your tabs. Reload this page to try again.</p></div>';
});
