/* Tabulor — new-tab dashboard, no server or build step. */
'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $('#app');

const state = {
  tabs: [],
  groups: [],
  saved: [],
  archiveOpen: false,
  archiveQuery: '',
  theme: null,
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
  'www.xiaohongshu.com': 'RedNote', 'feishu.cn': 'Feishu', 'www.feishu.cn': 'Feishu', 'local-files': 'Local Files',
};

const ICONS = {
  tabs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25M3 8.25h18M3 8.25V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
  iconSun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  iconMoon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
};

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const isWebTab = tab => /^(https?|file):/.test(tab.url || '');
const hostname = url => {
  try { return url.startsWith('file:') ? 'local-files' : new URL(url).hostname; }
  catch { return ''; }
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
  if (host.endsWith('.feishu.cn')) return 'Feishu';
  if (host.endsWith('.substack.com')) return `${capitalize(host.replace('.substack.com', ''))}'s Substack`;
  if (host.endsWith('.github.io')) return `${capitalize(host.replace('.github.io', ''))} (GitHub Pages)`;
  return host.replace(/^www\./, '').replace(/\.(com|org|net|io|co|ai|dev|app|so|me|xyz|info|us|uk|cn)$/, '')
    .split('.').map(capitalize).join(' ');
}

function capitalize(value = '') {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

function configuredRules() {
  const localLanding = typeof LOCAL_LANDING_PAGE_PATTERNS === 'undefined' ? [] : LOCAL_LANDING_PAGE_PATTERNS;
  const custom = typeof LOCAL_CUSTOM_GROUPS === 'undefined' ? [] : LOCAL_CUSTOM_GROUPS;
  return { localLanding, custom };
}

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

function groupTabs(tabs) {
  const { localLanding, custom } = configuredRules();
  const landingRules = [
    { hostname: 'mail.google.com', test: (_path, url) => !/#(inbox|sent|search)\//.test(url) },
    { hostname: 'x.com', pathExact: ['/home'] },
    { hostname: 'www.linkedin.com', pathExact: ['/'] },
    { hostname: 'github.com', pathExact: ['/'] },
    { hostname: 'www.youtube.com', pathExact: ['/'] },
    ...localLanding,
  ];
  const groups = new Map();

  for (const tab of tabs.filter(isWebTab)) {
    const customRule = custom.find(rule => ruleMatches(rule, tab.url));
    const landing = !customRule && landingRules.some(rule => ruleMatches(rule, tab.url));
    const key = customRule?.groupKey || (landing ? '__landing-pages__' : hostname(tab.url));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, {
      key,
      label: customRule?.groupLabel || (landing ? 'Homepages' : friendlyDomain(key)),
      priority: landing ? 2 : landingRules.some(rule => rule.hostname === key) ? 1 : 0,
      tabs: [],
    });
    groups.get(key).tabs.push(tab);
  }

  return [...groups.values()].map(group => {
    const pages = new Map();
    for (const tab of group.tabs) {
      if (!pages.has(tab.url)) pages.set(tab.url, []);
      pages.get(tab.url).push(tab);
    }
    return { ...group, pages: [...pages.values()], duplicates: [...pages.values()].reduce((n, x) => n + x.length - 1, 0) };
  }).sort((a, b) => b.priority - a.priority || b.tabs.length - a.tabs.length);
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
  const visible = group.pages.slice(0, 8);
  const hidden = group.pages.slice(8);
  const duplicateBadge = group.duplicates
    ? `<span class="open-tabs-badge" style="color:var(--accent-amber);background:rgba(200,113,58,.08)">${plural(group.duplicates, 'duplicate')}</span>` : '';
  return `<article class="mission-card domain-card ${group.duplicates ? 'has-amber-bar' : 'has-neutral-bar'}" data-group="${index}">
    <div class="status-bar"></div><div class="mission-content">
      <div class="mission-top"><span class="mission-name">${esc(group.label)}</span>
        <span class="open-tabs-badge">${ICONS.tabs}${plural(group.tabs.length, 'tab')} open</span>${duplicateBadge}</div>
      <div class="mission-pages">${visible.map(tabTemplate).join('')}
        ${hidden.length ? `<div class="page-chips-overflow" hidden>${hidden.map(tabTemplate).join('')}</div>
          <div class="page-chip page-chip-overflow clickable" data-action="expand">+${hidden.length} more</div>` : ''}
      </div>
      <div class="actions">
        <button class="action-btn close-tabs" data-action="close-group" data-group="${index}">${ICONS.close}Close all ${plural(group.tabs.length, 'tab')}</button>
        ${group.duplicates ? `<button class="action-btn" data-action="dedupe" data-group="${index}">Close ${plural(group.duplicates, 'duplicate')}</button>` : ''}
      </div>
    </div><div class="mission-meta"></div>
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
  const active = state.saved.filter(x => !x.completedAt);
  const archived = state.saved.filter(x => x.completedAt);
  if (!active.length && !archived.length) return '';
  const query = state.archiveQuery.toLowerCase();
  const filtered = query.length < 2 ? archived : archived.filter(x =>
    (x.title || '').toLowerCase().includes(query) || (x.url || '').toLowerCase().includes(query));

  return `<aside class="deferred-column" id="deferredColumn">
    <div class="section-header"><h2>Saved for later</h2><div class="section-line"></div>
      <div class="section-count">${active.length ? plural(active.length, 'item') : ''}</div></div>
    <div class="deferred-list">${active.map(savedItemTemplate).join('')}</div>
    ${active.length ? '' : '<div class="deferred-empty">Nothing saved. Living in the moment.</div>'}
    ${archived.length ? `<div class="deferred-archive">
      <button class="archive-toggle ${state.archiveOpen ? 'open' : ''}" data-action="toggle-archive">⌄ Archive <span class="archive-count">(${archived.length})</span></button>
      <div class="archive-body" ${state.archiveOpen ? '' : 'hidden'}>
        <input class="archive-search" id="archiveSearch" value="${esc(state.archiveQuery)}" placeholder="Search archived tabs...">
        <div class="archive-list">${filtered.map(archiveItemTemplate).join('') || '<div class="deferred-meta">No results</div>'}</div>
      </div></div>` : ''}
  </aside>`;
}

function render() {
  const realTabs = state.tabs.filter(isWebTab);
  const themeIcon = currentTheme() === 'dark' ? ICONS.iconSun : ICONS.iconMoon;
  app.innerHTML = `<div class="container">
    <div class="dashboard-columns">
      ${state.groups.length ? `<section class="active-section"><div class="section-header"><button class="theme-toggle" data-action="toggle-theme" title="Toggle theme">${themeIcon}</button><h2>Open tabs</h2><div class="section-line"></div><div class="section-count">${plural(state.groups.length, 'domain')} &nbsp;·&nbsp; <button class="action-btn close-tabs" data-action="close-all">${ICONS.close}Close all ${plural(realTabs.length, 'tab')}</button></div></div><div class="missions">${state.groups.map(groupTemplate).join('')}</div></section>` : emptyTemplate()}
      ${savedTemplate()}
    </div>
  </div>`;
}

function emptyTemplate() {
  return `<section class="active-section"><div class="missions-empty-state"><div class="empty-checkmark">✓</div><div class="empty-title">Inbox zero, but for tabs.</div><div class="empty-subtitle">You're free.</div></div></section>`;
}

function currentTheme() {
  return state.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function applyTheme() {
  document.documentElement.dataset.theme = currentTheme();
}

async function refresh() {
  const [tabs, stored] = await Promise.all([
    chrome.tabs.query({}), chrome.storage.local.get({ deferred: [], theme: null }),
  ]);
  state.tabs = tabs;
  // Read the original v1 shape too: completed/dismissed were booleans.
  state.saved = stored.deferred.filter(item => item && !item.dismissed).map(item => ({
    ...item,
    completedAt: item.completedAt || (item.completed ? item.savedAt : null),
  }));
  state.theme = stored.theme;
  state.groups = groupTabs(tabs);
  applyTheme();
  render();
}

async function setSaved(update) {
  const next = update(state.saved);
  state.saved = next;
  await chrome.storage.local.set({ deferred: next });
}

function findTab(id) {
  return state.tabs.find(tab => tab.id === Number(id));
}

async function removeTabs(ids) {
  const unique = [...new Set(ids.map(Number).filter(Number.isFinite))];
  if (unique.length) await chrome.tabs.remove(unique);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

async function closeWithEffect(ids, message) {
  await removeTabs(ids); showToast(message); await refresh();
}

const actions = {
  focus: async el => {
    const tab = findTab(el.dataset.tabId);
    if (!tab) return;
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  },
  close: async (el, event) => {
    event.stopPropagation();
    await closeWithEffect([el.dataset.tabId], 'Tab closed');
  },
  save: async (el, event) => {
    event.stopPropagation();
    const tab = findTab(el.dataset.tabId);
    if (!tab) return;
    await setSaved(items => [{ id: crypto.randomUUID(), url: tab.url, title: displayTitle(tab), savedAt: new Date().toISOString(), completedAt: null }, ...items]);
    await removeTabs([tab.id]); showToast('Saved for later'); await refresh();
  },
  'close-group': async el => {
    const group = state.groups[el.dataset.group];
    if (group) await closeWithEffect(group.tabs.map(t => t.id), `Closed ${plural(group.tabs.length, 'tab')} from ${group.label}`);
  },
  dedupe: async el => {
    const group = state.groups[el.dataset.group];
    if (!group) return;
    const ids = group.pages.flatMap(copies => {
      const keep = copies.find(t => t.active) || copies[0];
      return copies.filter(t => t.id !== keep.id).map(t => t.id);
    });
    await closeWithEffect(ids, 'Closed duplicates, kept one copy each');
  },
  'close-all': async el => closeWithEffect(state.tabs.filter(isWebTab).map(t => t.id), 'All tabs closed. Fresh start.'),
  'toggle-theme': () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    state.theme = next;
    chrome.storage.local.set({ theme: next });
    applyTheme();
    render();
  },
  complete: async el => {
    const now = new Date().toISOString();
    await setSaved(items => items.map(x => x.id === el.dataset.savedId ? { ...x, completedAt: now } : x));
    await refresh();
  },
  dismiss: async el => {
    await setSaved(items => items.filter(x => x.id !== el.dataset.savedId));
    await refresh();
  },
  'toggle-archive': el => {
    state.archiveOpen = !state.archiveOpen;
    render();
  },
  expand: el => {
    const overflow = el.previousElementSibling;
    overflow.hidden = false; overflow.style.display = 'contents'; el.remove();
  },
};

document.addEventListener('error', event => {
  const image = event.target;
  if (!image.matches?.('img[data-favicon-fallbacks]')) return;
  const fallbacks = JSON.parse(image.dataset.faviconFallbacks || '[]');
  const next = fallbacks.shift();
  if (!next) {
    image.hidden = true;
    return;
  }
  image.dataset.faviconFallbacks = JSON.stringify(fallbacks);
  image.src = next;
}, true);

document.addEventListener('click', async event => {
  const el = event.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  el.disabled = true;
  try { await actions[el.dataset.action](el, event); }
  catch (error) { console.error('[tabulor]', error); showToast('Something went wrong'); }
  finally { if (el.isConnected) el.disabled = false; }
});

document.addEventListener('input', event => {
  if (event.target.id !== 'archiveSearch') return;
  state.archiveQuery = event.target.value;
  const archived = state.saved.filter(x => x.completedAt);
  const query = state.archiveQuery.trim().toLowerCase();
  const filtered = query.length < 2 ? archived : archived.filter(x =>
    (x.title || '').toLowerCase().includes(query) || (x.url || '').toLowerCase().includes(query));
  $('.archive-list').innerHTML = filtered.map(archiveItemTemplate).join('') || '<div class="deferred-meta">No results</div>';
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
chrome.storage.onChanged.addListener((_changes, area) => area === 'local' && scheduleRefresh());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!state.theme) applyTheme(); });

refresh().catch(error => {
  console.error('[tabulor]', error);
  app.innerHTML = '<div class="container"><h2>Tabulor</h2><p>Could not read your tabs. Reload this page to try again.</p></div>';
});
