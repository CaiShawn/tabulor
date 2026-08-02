/* Tabulor — new-tab dashboard, no server or build step. */
'use strict';

const MAX_NAME_LENGTH = 50;
const LOCAL_FILES_KEY = 'local-files';
const STORAGE_KEYS = { deferred: 'deferred', theme: 'theme', styleId: 'styleId', customGroupNames: 'customGroupNames' };
// Two visual styles: 'classic' (the original ink-on-paper look) and 'terminal'
// (Fira Code, saturated colors, sharp corners). Style is independent of the
// light/dark theme: terminal-light is Blue Sea, terminal-dark is Pistachio.
const STYLES = [
  { id: 'classic', label: 'Classic' },
  { id: 'terminal', label: 'Terminal' },
];
const DEFAULT_STYLE_ID = 'classic';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $('#app');

const dataState = {
  tabs: [],
  customGroupNames: {},
  saved: [],
  theme: null,
  styleId: DEFAULT_STYLE_ID,
};

const uiState = {
  editingKey: null,
  editingDraft: '',
  archiveOpen: false,
  archiveQuery: '',
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

  for (const tab of tabs.filter(isWebTab)) {
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
  return b.priority - a.priority || b.tabs.length - a.tabs.length || a.key.localeCompare(b.key);
}

// Merge groups that share the same display label (custom or default).
// `rep` priority picks the group a user would expect to "own" the merged card:
//   1. has a custom name override
//   2. is local files
//   3. more tabs
//   4. lexicographic key (deterministic fallback)
function pickRepGroup(a, b) {
  const repBoost = g => (customNameFor(g.key) ? 2 : 0) + (g.key === LOCAL_FILES_KEY ? 1 : 0);
  return repBoost(b) - repBoost(a) || b.tabs.length - a.tabs.length || a.key.localeCompare(b.key);
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
  const tab = copies[0];
  const count = copies.length;
  return `<div class="page-chip clickable${count > 1 ? ' chip-has-dupes' : ''}" data-action="focus" data-tab-id="${tab.id}" title="${esc(displayTitle(tab))}">
    ${faviconImage(tab, 'chip-favicon')}
    <span class="chip-text">${esc(displayTitle(tab))}</span>
    ${count > 1 ? `<span class="chip-dupe-badge">(${count}x)</span>` : ''}
    <div class="chip-actions">
      <button class="chip-action chip-save" data-action="save" data-tab-id="${tab.id}" title="Save for later">☆</button>
      <button class="chip-action chip-close" data-action="close" data-tab-id="${tab.id}" title="Close this tab">${ICONS.close}</button>
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
  return `<div class="deferred-item" data-saved-id="${esc(item.id)}">
    <input type="checkbox" class="deferred-checkbox" data-action="complete" data-saved-id="${esc(item.id)}">
    <div class="deferred-info"><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener" class="deferred-title">${esc(item.title || item.url)}</a>
      <div class="deferred-meta"><span>${esc(domain)}</span><span>${timeAgo(item.savedAt)}</span></div></div>
    <button class="deferred-dismiss" data-action="dismiss" data-saved-id="${esc(item.id)}" title="Dismiss">${ICONS.close}</button>
  </div>`;
}

function archiveItemTemplate(item) {
  return `<div class="archive-item"><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener" class="archive-item-title">${esc(item.title || item.url)}</a>
    <span class="archive-item-date">${timeAgo(item.completedAt || item.savedAt)}</span></div>`;
}

function safeUrl(url) {
  try { return /^(https?|file):$/.test(new URL(url).protocol) ? url : '#'; }
  catch { return '#'; }
}

function savedTemplate() {
  const active = dataState.saved.filter(x => !x.completedAt);
  const archived = dataState.saved.filter(x => x.completedAt);
  if (!active.length && !archived.length) return '';
  const query = uiState.archiveQuery.trim().toLowerCase();
  const filtered = query.length < 2 ? archived : archived.filter(x =>
    (x.title || '').toLowerCase().includes(query) || (x.url || '').toLowerCase().includes(query));

  return `<aside class="deferred-column" id="deferredColumn">
    <div class="section-header"><h2>Saved for later</h2><div class="section-line"></div>
      <div class="section-count">${active.length ? plural(active.length, 'item') : ''}</div></div>
    <div class="deferred-list">${active.map(savedItemTemplate).join('')}</div>
    ${active.length ? '' : '<div class="deferred-empty">Nothing saved. Living in the moment.</div>'}
    ${archived.length ? `<div class="deferred-archive">
      <button class="archive-toggle ${uiState.archiveOpen ? 'open' : ''}" data-action="toggle-archive">⌄ Archive <span class="archive-count">(${archived.length})</span></button>
      <div class="archive-body" ${uiState.archiveOpen ? '' : 'hidden'}>
        <input class="archive-search" id="archiveSearch" value="${esc(uiState.archiveQuery)}" placeholder="Search archived tabs...">
        <div class="archive-list">${filtered.map(archiveItemTemplate).join('') || '<div class="deferred-meta">No results</div>'}</div>
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

  app.innerHTML = `<div class="${containerClass}">
    <div class="dashboard-columns">
      ${groups.length ? `<section class="active-section"><div class="section-header"><div class="theme-segments" role="group" aria-label="Style">${styleSegments}</div><h2>Open tabs</h2><div class="section-line"></div><div class="section-count">${plural(groups.length, 'domain')} &nbsp;·&nbsp; <button class="action-btn close-tabs" data-action="close-all">${ICONS.close}Close all ${plural(realTabs.length, 'tab')}</button></div></div><div class="missions">${groups.map(groupTemplate).join('')}</div></section>` : emptyTemplate()}
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
  document.body.classList.toggle('terminal', currentStyleId() === 'terminal');
}

async function loadState() {
  const [tabs, stored] = await Promise.all([
    chrome.tabs.query({}),
    chrome.storage.local.get({ [STORAGE_KEYS.deferred]: [], [STORAGE_KEYS.theme]: null, [STORAGE_KEYS.styleId]: DEFAULT_STYLE_ID, [STORAGE_KEYS.customGroupNames]: {} }),
  ]);
  dataState.tabs = tabs;
  // Read the original v1 shape too: completed/dismissed were booleans.
  dataState.saved = stored.deferred.filter(item => item && !item.dismissed).map(item => ({
    ...item,
    completedAt: item.completedAt || (item.completed ? item.savedAt : null),
  }));
  dataState.theme = stored.theme;
  // Resolve styleId: prefer new key, fall back to legacy themeId.
  dataState.styleId = STYLES.some(s => s.id === stored.styleId) ? stored.styleId : DEFAULT_STYLE_ID;
  dataState.customGroupNames = Object.fromEntries(
    Object.entries(stored.customGroupNames || {})
      .map(([key, value]) => [key, tidyName(value)])
      .filter(([key, value]) => key && value),
  );
}

async function refresh() {
  await loadState();
  applyTheme();
  render();
}

function findTab(id) {
  return dataState.tabs.find(tab => tab.id === Number(id));
}

async function setDeferred(update) {
  dataState.saved = update(dataState.saved);
  await chrome.storage.local.set({ [STORAGE_KEYS.deferred]: dataState.saved });
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
  } catch (error) {
    dataState.customGroupNames = previousNames;
    console.error('[tabulor]', error);
  }
  render();
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
    await closeWithEffect([el.dataset.tabId]);
  },
  save: async (el, event) => {
    event.stopPropagation();
    const tab = findTab(el.dataset.tabId);
    if (!tab) return;
    await setDeferred(items => [{ id: crypto.randomUUID(), url: tab.url, title: displayTitle(tab), savedAt: new Date().toISOString(), completedAt: null }, ...items]);
    await removeTabs([tab.id]);
    await refresh();
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
  complete: async el => {
    const now = new Date().toISOString();
    await setDeferred(items => items.map(x => x.id === el.dataset.savedId ? { ...x, completedAt: now } : x));
    await refresh();
  },
  dismiss: async el => {
    await setDeferred(items => items.filter(x => x.id !== el.dataset.savedId));
    await refresh();
  },
  'toggle-archive': () => {
    uiState.archiveOpen = !uiState.archiveOpen;
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
  expand: el => {
    const overflow = el.previousElementSibling;
    overflow.hidden = false; overflow.style.display = 'contents'; el.remove();
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
  if (target.id !== 'archiveSearch') return;
  uiState.archiveQuery = target.value;
  const archived = dataState.saved.filter(x => x.completedAt);
  const query = uiState.archiveQuery.trim().toLowerCase();
  const filtered = query.length < 2 ? archived : archived.filter(x =>
    (x.title || '').toLowerCase().includes(query) || (x.url || '').toLowerCase().includes(query));
  $('.archive-list').innerHTML = filtered.map(archiveItemTemplate).join('') || '<div class="deferred-meta">No results</div>';
});

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
  // theme toggles are handled inline; customGroupNames needs a fresh render.
  if (STORAGE_KEYS.customGroupNames in changes || STORAGE_KEYS.deferred in changes) scheduleRefresh();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!dataState.theme) applyTheme(); });

refresh().catch(error => {
  console.error('[tabulor]', error);
  app.innerHTML = '<div class="container"><h2>Tabulor</h2><p>Could not read your tabs. Reload this page to try again.</p></div>';
});
