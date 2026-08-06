/* Tabulor — new-tab dashboard, no server or build step. */
'use strict';

const MAX_NAME_LENGTH = 50;
const LOCAL_FILES_KEY = 'local-files';
const BACKUP_SCHEMA_VERSION = 1;
// `readingListMirror` is a local shadow copy of `chrome.readingList`, populated
// lazily on every successful query(). It is the render source so the dashboard
// still has data to show if a later query() rejects, and it survives new-tab
// page reloads. `chrome.readingList` is the source of truth; the mirror is a
// cache, not a peer. We do not listen for our own mirror writes in
// `storage.onChanged` — reactivity for external Reading-list changes comes
// from `chrome.readingList.onEntryAdded/Updated/Removed`.
const STORAGE_KEYS = { readingListMirror: 'readingListMirror', theme: 'theme', styleId: 'styleId', customGroupNames: 'customGroupNames', pinnedGroupKeys: 'pinnedGroupKeys', unreadExpanded: 'unreadExpanded', readExpanded: 'readExpanded', layout: 'openTabsLayout', columnOrder: 'columnOrder', backgroundImage: 'backgroundImage', uiLanguage: 'uiLanguage' };
// Two visual styles: 'classic' (the original ink-on-paper look) and 'terminal'
// (Fira Code, saturated colors, sharp corners). Style is independent of the
// light/dark theme: terminal-light is Blue Sea, terminal-dark is Pistachio.
const STYLES = [
  { id: 'classic', label: 'Classic' },
  { id: 'terminal', label: 'Terminal' },
];
const DEFAULT_STYLE_ID = 'classic';
const LAYOUTS = ['multi', 'single'];
const COLUMN_ORDERS = ['tabs-list', 'list-tabs'];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $('#app');

const dataState = {
  tabs: [],
  customGroupNames: {},
  // Group keys whose domain the user pinned to the top row. Persisted across
  // reloads so a pinned group whose tabs all close comes back when the user
  // reopens a tab at that domain. Order is the pin order.
  pinnedGroupKeys: [],
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
  // Horizontal order of the two main dashboard columns. 'tabs-list' =
  // Open tabs on the left, Reading list on the right (default). 'list-tabs'
  // mirrors horizontally. Vertical flip is intentionally out of scope; the
  // narrow-viewport stacking order follows the same `columnOrder` choice.
  columnOrder: 'tabs-list',
};

const uiState = {
  editingKey: null,
  editingDraft: '',
  // group.key of the pinned chip whose inline preview popover is open, or null.
  // Lives in uiState (not persisted) because it's a transient view state — a
  // page reload starts with everything closed.
  pinnedPopoverKey: null,
  // Whether the settings menu (gear icon) is open. Renamed from backupOpen
  // when the gear absorbed the backup items; behaviour (click-outside closes)
  // is unchanged.
  settingsOpen: false,
  unreadExpanded: true,
  readExpanded: false,
  // Resolved by resolveLanguage() at load: 'en' or 'zh_CN'. Persisted on
  // user toggle via chrome.storage.local; the very first load falls back
  // to chrome.i18n.getUILanguage() when nothing is stored.
  language: 'en',
  firstRender: true,
};

const SUPPORTED_LANGUAGES = ['en', 'zh_CN'];

// Two-track dictionary: chrome.i18n.getMessage is the runtime source for
// manifest-visible strings (extension name, description), and the same
// dict keys back the in-page strings via t() / plural(). The built-in
// LOCALES map is the same shape as the messages.json entries, so the
// fallback path is a plain key lookup. Storing the dict in code (not
// inlined strings) keeps a single source of truth: editing a key here
// edits the en/zh variant together.
const LOCALES = {
  en: {
    openTabs: 'Open tabs',
    readingList: 'Reading list',
    unread: 'Unread',
    done: 'Done',
    emptyTitle: 'Inbox zero, but for tabs.',
    emptySubtitle: "You're free.",
    readingListEmpty: 'Nothing saved. Living in the moment.',
    errorLoadingTabs: 'Could not read your tabs. Reload this page to try again.',
    styleGroupAria: 'Style',
    styleClassic: 'Classic',
    styleTerminal: 'Terminal',
    styleTitle: (style) => `${style} style`,
    layoutAriaSingle: 'Switch to single-column layout',
    layoutAriaMulti: 'Switch to multi-column layout',
    layoutTitleSingle: 'Switch to single-column layout',
    layoutTitleMulti: 'Switch to multi-column layout',
    closeAllTabs: (n) => `Close all ${n} ${n === 1 ? 'tab' : 'tabs'}`,
    closeGroup: 'Close all',
    closeDuplicates: (n) => `Close ${n} ${n === 1 ? 'duplicate' : 'duplicates'}`,
    pluralGroup: (n) => `${n} ${n === 1 ? 'group' : 'groups'}`,
    pluralTab: (n) => `${n} ${n === 1 ? 'tab' : 'tabs'}`,
    pluralItem: (n) => `${n} ${n === 1 ? 'item' : 'items'}`,
    pluralDuplicate: (n) => `${n} ${n === 1 ? 'duplicate' : 'duplicates'}`,
    tabsOpenBadge: (n) => `${n} ${n === 1 ? 'tab' : 'tabs'} open`,
    saveForLaterTitle: 'Save for later',
    saveAlreadyInReadingList: 'Already in Reading list',
    saveFailed: "Couldn't save. Try again.",
    pinGroupTitle: 'Pin to top',
    unpinGroupTitle: 'Unpin',
    pinnedRowAria: 'Pinned',
    pinnedChipAria: (name, n) => `Open ${name} (${n})`,
    pinnedPopoverAria: (name) => `Tabs in ${name}`,
    flipColumnsTitle: 'Mirror flip',
    themeToggleTitle: 'Theme',
    settingsTitle: 'Settings',
    backgroundChoose: 'Choose image…',
    backgroundClear: 'Clear background',
    backgroundSet: 'Background set',
    backgroundCleared: 'Background cleared',
    backgroundTooLarge: 'Image too large (max 5 MB)',
    backgroundFailed: (msg) => `Background failed: ${msg}`,
    backgroundPermissionDenied: 'Permission denied',
    closeTabTitle: 'Close this tab',
    markAsReadTitle: 'Mark as read',
    dismissTitle: 'Dismiss',
    moveToUnreadTitle: 'Move back to Unread',
    renameGroupTitle: 'Rename group',
    renameAria: (name) => `Rename ${name}`,
    customNameAria: (name) => `Custom name for ${name}`,
    describeDefault: (name) => `Default: ${name}`,
    describeCombined: (n) => `Combined from ${n} groups`,
    describeDomain: (domain) => `Domain: ${domain}`,
    describeSource: (name, domain) => `${name} (${domain})`,
    backup: 'Backup',
    backUpDashboardTitle: 'Back up dashboard',
    exportJson: 'Export JSON',
    importJson: 'Import JSON',
    backupExported: 'Backup exported',
    backupImported: (n) => `Backup imported (${n} ${n === 1 ? 'tab' : 'tabs'})`,
    backupImportedSkipped: (n, m) => `Backup imported (${n} ${n === 1 ? 'tab' : 'tabs'}, ${m} reading skipped)`,
    importFailed: (msg) => `Import failed: ${msg}`,
    languageEnglish: 'EN',
    languageChinese: '中',
    languageSwitcherAria: 'Language',
    languageEnglishAria: 'Switch to English',
    languageChineseAria: '切换到简体中文',
    timeJustNow: 'just now',
    timeMinAgo: (n) => `${n} min ago`,
    timeHrAgo: (n) => `${n} hr ago`,
    timeYesterday: 'yesterday',
    timeDaysAgo: (n) => `${n} ${n === 1 ? 'day' : 'days'} ago`,
  },
  zh_CN: {
    openTabs: '打开的标签',
    readingList: '阅读列表',
    unread: '未读',
    done: '已完成',
    emptyTitle: '标签页收件箱已清零。',
    emptySubtitle: '可以喘口气了。',
    readingListEmpty: '还没有保存。先活在当下。',
    errorLoadingTabs: '无法读取标签页。请刷新此页重试。',
    styleGroupAria: '风格',
    styleClassic: '经典',
    styleTerminal: '终端',
    styleTitle: (style) => `${style} 风格`,
    layoutAriaSingle: '切换为单列布局',
    layoutAriaMulti: '切换为多列布局',
    layoutTitleSingle: '切换为单列布局',
    layoutTitleMulti: '切换为多列布局',
    closeAllTabs: (n) => `关闭全部 ${n} 个标签`,
    closeGroup: '关闭全部',
    closeDuplicates: (n) => `关闭 ${n} 个重复标签`,
    pluralGroup: (n) => `${n} 个分组`,
    pluralTab: (n) => `${n} 个标签`,
    pluralItem: (n) => `${n} 项`,
    pluralDuplicate: (n) => `${n} 个重复`,
    tabsOpenBadge: (n) => `${n} 个标签打开`,
    saveForLaterTitle: '稍后再读',
    saveAlreadyInReadingList: '已在阅读列表中',
    saveFailed: '保存失败，请重试',
    pinGroupTitle: '置顶分组',
    unpinGroupTitle: '取消置顶',
    pinnedRowAria: '已置顶',
    pinnedChipAria: (name, n) => `打开 ${name}（${n}）`,
    pinnedPopoverAria: (name) => `${name} 中的标签`,
    flipColumnsTitle: '镜像翻转',
    themeToggleTitle: '主题',
    settingsTitle: '设置',
    backgroundChoose: '选择图片…',
    backgroundClear: '清除背景',
    backgroundSet: '背景已设置',
    backgroundCleared: '背景已清除',
    backgroundTooLarge: '图片过大（最大 5 MB）',
    backgroundFailed: (msg) => `背景加载失败：${msg}`,
    backgroundPermissionDenied: '权限被拒',
    closeTabTitle: '关闭此标签',
    markAsReadTitle: '标记为已读',
    dismissTitle: '移除',
    moveToUnreadTitle: '移回未读',
    renameGroupTitle: '重命名分组',
    renameAria: (name) => `重命名 ${name}`,
    customNameAria: (name) => `${name} 的自定义名`,
    describeDefault: (name) => `默认名：${name}`,
    describeCombined: (n) => `合并自 ${n} 个分组`,
    describeDomain: (domain) => `域名：${domain}`,
    describeSource: (name, domain) => `${name}（${domain}）`,
    backup: '备份',
    backUpDashboardTitle: '备份仪表盘',
    exportJson: '导出 JSON',
    importJson: '导入 JSON',
    backupExported: '备份已导出',
    backupImported: (n) => `备份已导入（${n} 个标签）`,
    backupImportedSkipped: (n, m) => `备份已导入（${n} 个标签，${m} 条阅读列表已跳过）`,
    importFailed: (msg) => `导入失败：${msg}`,
    languageEnglish: 'EN',
    languageChinese: '中',
    languageSwitcherAria: '语言',
    languageEnglishAria: '切换为英文',
    languageChineseAria: '切换为简体中文',
    timeJustNow: '刚刚',
    timeMinAgo: (n) => `${n} 分钟前`,
    timeHrAgo: (n) => `${n} 小时前`,
    timeYesterday: '昨天',
    timeDaysAgo: (n) => `${n} 天前`,
  },
};

function resolveLanguage(stored) {
  if (SUPPORTED_LANGUAGES.includes(stored)) return stored;
  const ui = typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage
    ? chrome.i18n.getUILanguage() : 'en';
  return ui.toLowerCase().startsWith('zh') ? 'zh_CN' : 'en';
}

function t(key, ...args) {
  const dict = LOCALES[uiState.language] || LOCALES.en;
  const entry = dict[key];
  if (entry === undefined) return key;
  return typeof entry === 'function' ? entry(...args) : entry;
}

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
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a2 2 0 0 1 2-2h1a1 1 0 0 0 0-2H6a1 1 0 0 0 0 2h1a2 2 0 0 1 2 2z"/></svg>`,
  // Two opposing horizontal arrows stacked vertically — the canonical "swap"
  // affordance, distinct from the 2x2/3-rows ICONS.layout so the two
  // adjacent header toggles read as a pair without competing visually.
  swap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8H15"/><path d="M15 5l3 3-3 3"/><path d="M21 16H9"/><path d="M9 13l-3 3 3 3"/></svg>`,
  layout: `<span class="layout-icon"><svg viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="9" height="9"/><rect x="17" y="4" width="9" height="9"/><rect x="4" y="17" width="9" height="9"/><rect x="17" y="17" width="9" height="9"/></svg><span>/</span><svg viewBox="0 0 24 30" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="22" height="4"/><rect x="4" y="13" width="22" height="4"/><rect x="4" y="22" width="22" height="4"/></svg></span>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const plural = (key, n) => t(`plural${key}`, n);
const isWebTab = tab => /^(https?|file):/.test(tab.url || '');

// O(n) on a typical session (≤ dozens of pinned groups). If we ever ship URL-
// level pinning too, swap to a Set built once per render. The lookup lives on
// the hot path of `render()` and `groupTemplate()`, so we keep it dependency-
// free rather than maintaining a parallel Set across mutations.
const isPinned = key => dataState.pinnedGroupKeys.includes(key);
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
  const lines = [t('describeDefault', group.defaultLabel)];
  if (group.sources.length > 1) {
    lines.push(t('describeCombined', group.sources.length));
    for (const s of group.sources) {
      lines.push(s.domain ? t('describeSource', s.defaultLabel, s.domain) : s.defaultLabel);
    }
  } else if (group.domain) {
    lines.push(t('describeDomain', group.domain));
  }
  return lines.join('\n');
}

function timeAgo(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value)) / 60000));
  if (minutes < 1) return t('timeJustNow');
  if (minutes < 60) return t('timeMinAgo', minutes);
  if (minutes < 1440) return t('timeHrAgo', Math.floor(minutes / 60));
  const days = Math.floor(minutes / 1440);
  return days === 1 ? t('timeYesterday') : t('timeDaysAgo', days);
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
      <button class="chip-action chip-save" data-action="save" data-tab-ids="${ids}" data-tab-id="${tab.id}" title="${esc(t('saveForLaterTitle'))}">${ICONS.plus}</button>
      <button class="chip-action chip-close" data-action="close" data-tab-ids="${ids}" data-tab-id="${tab.id}" title="${esc(t('closeTabTitle'))}">${ICONS.close}</button>
    </div>
  </div>`;
}

function groupTemplate(group, index) {
  const { pages, duplicates } = withPages(group);
  const visible = pages.slice(0, 8);
  const hidden = pages.slice(8);
  const duplicateBadge = duplicates
    ? `<span class="open-tabs-badge open-tabs-badge-duplicate">${plural('Duplicate', duplicates)}</span>` : '';
  const editing = uiState.editingKey === group.key;
  const pinned = isPinned(group.key);
  const titleHtml = editing
    ? `<input class="group-name-input" data-group="${index}" value="${esc(uiState.editingDraft)}" maxlength="${MAX_NAME_LENGTH}" placeholder="${esc(group.defaultLabel)}" title="${esc(describeGroup(group))}" aria-label="${esc(t('customNameAria', group.defaultLabel))}" autocomplete="off">`
    : `<span class="mission-name" title="${esc(describeGroup(group))}">${esc(group.label)}</span>
      <button class="group-rename-btn" data-action="edit-group" data-group="${index}" title="${esc(t('renameGroupTitle'))}" aria-label="${esc(t('renameAria', group.label))}">${ICONS.edit}</button>
      <button class="group-pin-btn" data-action="toggle-pin" data-group="${index}" aria-pressed="${pinned}" title="${esc(t(pinned ? 'unpinGroupTitle' : 'pinGroupTitle'))}">${ICONS.pin}</button>`;
  return `<article class="mission-card domain-card${duplicates ? ' has-duplicates' : ''}" data-group="${index}">
    <div class="mission-content">
      <div class="mission-top"><div class="mission-title">${titleHtml}</div>${duplicateBadge}<button class="action-btn close-tabs" data-action="close-group" data-group="${index}">${ICONS.close}${t('closeGroup')}</button></div>
      <div class="mission-pages">${visible.map(tabTemplate).join('')}
        ${hidden.length ? `<div class="page-chips-overflow" hidden>${hidden.map(tabTemplate).join('')}</div>
          <div class="page-chip page-chip-overflow clickable" data-action="expand">+${hidden.length} more</div>` : ''}
      </div>
      ${duplicates ? `<div class="actions"><button class="action-btn" data-action="dedupe" data-group="${index}">${t('closeDuplicates', duplicates)}</button></div>` : ''}
    </div>
  </article>`;
}

function pinnedChipTemplate(group) {
  // One compact pill per pinned group. Clicking opens an inline preview popover
  // listing every tab in the group; selecting a tab in the popover focuses it.
  // The chip itself never switches tabs — that decision belongs to the
  // popover so the user stays on the dashboard while browsing.
  const tab = group.tabs[0];
  if (!tab) return '';
  const expanded = uiState.pinnedPopoverKey === group.key;
  return `<button class="pinned-chip clickable" data-action="toggle-pinned-popover" data-group-key="${esc(group.key)}" aria-expanded="${expanded}" aria-controls="pinned-popover" title="${esc(describeGroup(group))}" aria-label="${esc(t('pinnedChipAria', group.label, group.tabs.length))}">
    ${faviconImage(tab, 'pinned-chip-favicon')}
    <span class="pinned-chip-label">${esc(group.label)}</span>
    <span class="pinned-chip-count">${group.tabs.length}</span>
  </button>`;
}

function pinnedPopoverTemplate() {
  // Renders only when a pinned chip is open. The list comes from lastGroups
  // (the same view render() just produced), so tab ids always match the DOM
  // the user is looking at — no race with concurrent refreshes.
  if (!uiState.pinnedPopoverKey) return '';
  const group = lastGroups.find(g => g.key === uiState.pinnedPopoverKey);
  if (!group || !group.tabs.length) return '';
  return `<div class="pinned-popover" id="pinned-popover" role="dialog" aria-label="${esc(t('pinnedPopoverAria', group.label))}">
    <ul class="pinned-popover-list">${group.tabs.map(tab => `<li><button class="pinned-popover-tab clickable" data-action="focus-from-popover" data-tab-id="${tab.id}" title="${esc(displayTitle(tab))}">
      ${faviconImage(tab, 'pinned-popover-favicon')}
      <span class="pinned-popover-tab-label">${esc(displayTitle(tab))}</span>
    </button></li>`).join('')}</ul>
  </div>`;
}

function savedItemTemplate(item) {
  const domain = hostname(item.url).replace(/^www\./, '');
  return `<div class="deferred-item" data-saved-url="${esc(item.url)}">
    ${faviconImage({ url: item.url }, 'deferred-favicon')}
    <div class="deferred-info"><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener" class="deferred-title">${esc(item.title || item.url)}</a>
      <div class="deferred-meta"><span>${esc(domain)}</span><span>${timeAgo(item.creationTime)}</span></div></div>
    <button class="deferred-dismiss" data-action="complete" data-saved-url="${esc(item.url)}" title="${esc(t('markAsReadTitle'))}">${ICONS.check}</button>
    <button class="deferred-dismiss" data-action="dismiss" data-saved-url="${esc(item.url)}" title="${esc(t('dismissTitle'))}">${ICONS.close}</button>
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
    <button class="deferred-dismiss" data-action="restore" data-saved-url="${esc(item.url)}" title="${esc(t('moveToUnreadTitle'))}">${ICONS.undo}</button>
    <button class="deferred-dismiss" data-action="dismiss" data-saved-url="${esc(item.url)}" title="${esc(t('dismissTitle'))}">${ICONS.close}</button>
  </div>`;
}

function safeUrl(url) {
  try { return /^(https?|file):$/.test(new URL(url).protocol) ? url : '#'; }
  catch { return '#'; }
}

function buildBackup() {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tabs: dataState.tabs.filter(isWebTab).map(tab => ({ url: tab.url, title: tab.title || tab.url })),
    customGroupNames: { ...dataState.customGroupNames },
    pinnedGroupKeys: [...dataState.pinnedGroupKeys],
    readingList: dataState.readingList.map(item => ({
      url: item.url,
      title: item.title || item.url,
      hasBeenRead: !!item.hasBeenRead,
      creationTime: item.creationTime,
      lastUpdateTime: item.lastUpdateTime,
    })),
    settings: {
      theme: dataState.theme,
      styleId: currentStyleId(),
      layout: LAYOUTS.includes(dataState.layout) ? dataState.layout : 'multi',
      columnOrder: COLUMN_ORDERS.includes(dataState.columnOrder) ? dataState.columnOrder : 'tabs-list',
      unreadExpanded: uiState.unreadExpanded,
      readExpanded: uiState.readExpanded,
    },
  };
}

function normaliseBackup(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('Unsupported Tabulor backup format');
  }
  const tabs = [];
  const tabUrls = new Set();
  for (const item of Array.isArray(value.tabs) ? value.tabs : []) {
    if (!item || typeof item.url !== 'string' || !isWebTab(item) || safeUrl(item.url) === '#') continue;
    if (tabUrls.has(item.url)) continue;
    tabUrls.add(item.url);
    tabs.push({ url: item.url, title: typeof item.title === 'string' ? item.title.slice(0, 1000) : item.url });
  }

  const readingList = [];
  const readingUrls = new Set();
  for (const item of Array.isArray(value.readingList) ? value.readingList : []) {
    if (!item || typeof item.url !== 'string' || !/^https?:/.test(item.url) || safeUrl(item.url) === '#') continue;
    if (readingUrls.has(item.url)) continue;
    readingUrls.add(item.url);
    readingList.push({
      url: item.url,
      title: typeof item.title === 'string' ? item.title.slice(0, 1000) : item.url,
      hasBeenRead: !!item.hasBeenRead,
    });
  }

  const names = {};
  if (value.customGroupNames && typeof value.customGroupNames === 'object' && !Array.isArray(value.customGroupNames)) {
    for (const [key, name] of Object.entries(value.customGroupNames)) {
      const clean = tidyName(name);
      if (key && clean) names[key] = clean;
    }
  }

  // Pinned keys are an additive field — older backups omit it, in which case
  // we restore an empty list. Dedupe + drop non-string entries so the storage
  // round-trip can never widen the set via a malformed JSON.
  const pinnedGroupKeys = Array.isArray(value.pinnedGroupKeys)
    ? Array.from(new Set(value.pinnedGroupKeys.filter(k => typeof k === 'string' && k)))
    : [];

  const settings = value.settings && typeof value.settings === 'object' ? value.settings : {};
  return {
    tabs,
    readingList,
    customGroupNames: names,
    pinnedGroupKeys,
    settings: {
      theme: settings.theme === 'dark' || settings.theme === 'light' ? settings.theme : null,
      styleId: STYLES.some(style => style.id === settings.styleId) ? settings.styleId : DEFAULT_STYLE_ID,
      layout: LAYOUTS.includes(settings.layout) ? settings.layout : 'multi',
      columnOrder: COLUMN_ORDERS.includes(settings.columnOrder) ? settings.columnOrder : 'tabs-list',
      unreadExpanded: settings.unreadExpanded !== false,
      readExpanded: settings.readExpanded === true,
    },
  };
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.error = isError ? 'true' : 'false';
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `tabulor-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
  uiState.settingsOpen = false;
  render();
  showToast(t('backupExported'));
}

async function importBackup(file) {
  let backup;
  try {
    backup = normaliseBackup(JSON.parse(await file.text()));
  } catch (error) {
    console.error('[tabulor] backup import failed', error);
    showToast(t('importFailed', error.message || String(error)), true);
    return;
  }

  const existingTabUrls = new Set(dataState.tabs.filter(isWebTab).map(tab => tab.url));
  const tabsToOpen = backup.tabs.filter(tab => !existingTabUrls.has(tab.url));
  const created = [];
  for (const tab of tabsToOpen) {
    try {
      await chrome.tabs.create({ url: tab.url, active: false });
      created.push(tab.url);
    } catch (error) {
      if (!/duplicate/i.test(error.message || '')) {
        console.error('[tabulor] backup import tabs.create failed', error);
      }
    }
  }
  let readingListFailures = 0;
  for (const item of backup.readingList) {
    try {
      await chrome.readingList.addEntry(item);
    } catch (error) {
      console.error('[tabulor] backup import readingList.addEntry failed', error);
      readingListFailures += 1;
    }
  }

  dataState.customGroupNames = { ...dataState.customGroupNames, ...backup.customGroupNames };
  // Merge: union of local + imported pinned keys preserves whichever side
  // pinned something the other side didn't. Order follows local first, then
  // imported keys that aren't already present.
  {
    const merged = new Set(dataState.pinnedGroupKeys);
    for (const k of backup.pinnedGroupKeys) merged.add(k);
    dataState.pinnedGroupKeys = [...merged];
  }
  dataState.theme = backup.settings.theme;
  dataState.styleId = backup.settings.styleId;
  dataState.layout = backup.settings.layout;
  dataState.columnOrder = backup.settings.columnOrder;
  uiState.unreadExpanded = backup.settings.unreadExpanded;
  uiState.readExpanded = backup.settings.readExpanded;
  uiState.settingsOpen = false;
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.customGroupNames]: dataState.customGroupNames,
      [STORAGE_KEYS.pinnedGroupKeys]: dataState.pinnedGroupKeys,
      [STORAGE_KEYS.theme]: dataState.theme,
      [STORAGE_KEYS.styleId]: dataState.styleId,
      [STORAGE_KEYS.layout]: dataState.layout,
      [STORAGE_KEYS.columnOrder]: dataState.columnOrder,
      [STORAGE_KEYS.unreadExpanded]: uiState.unreadExpanded,
      [STORAGE_KEYS.readExpanded]: uiState.readExpanded,
    });
  } catch (error) {
    console.error('[tabulor] backup storage write failed', error);
  }
  try {
    applyTheme();
    await refresh();
  } catch (error) {
    console.error('[tabulor] backup post-import refresh failed', error);
  }
  const summary = readingListFailures
    ? t('backupImportedSkipped', created.length, readingListFailures)
    : t('backupImported', created.length);
  showToast(summary, readingListFailures > 0);
}

function settingsControlsTemplate() {
  // Settings menu: gear icon opens a flat menu with the previously top-level
  // backup actions on top and the new custom-background actions below a
  // divider. Stays in `uiState` (not persisted) — same lifecycle as the
  // prior backup menu it absorbed.
  return `<div class="settings-controls">
    <button class="action-btn settings-toggle" data-action="toggle-settings" aria-expanded="${uiState.settingsOpen}" title="${esc(t('settingsTitle'))}" aria-label="${esc(t('settingsTitle'))}">${ICONS.gear}</button>
    ${uiState.settingsOpen ? `<div class="settings-menu" role="menu">
      <button class="settings-menu-item" data-action="export-backup" role="menuitem">${t('exportJson')}</button>
      <button class="settings-menu-item" data-action="import-backup" role="menuitem">${t('importJson')}</button>
      <div class="settings-menu-divider" role="separator"></div>
      <button class="settings-menu-item" data-action="choose-background" role="menuitem">${t('backgroundChoose')}</button>
      <button class="settings-menu-item" data-action="clear-background" role="menuitem">${t('backgroundClear')}</button>
    </div>` : ''}
  </div>`;
}

// Background image is read as a data URL via FileReader and stored under
// `backgroundImage` in chrome.storage.local. Earlier versions used the File
// System Access API + IndexedDB handle, but Chrome serializes the handle's
// permission state as 'prompt' across page sessions, and `requestPermission`
// is only callable inside a user gesture — a no-go on page load. The data-URL
// approach trades the 10 MB chrome.storage.local quota for a no-permission
// flow that survives reloads trivially. No size limit is enforced; quota
// errors surface as toasts.
async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function applyBackgroundFromDataUrl(dataUrl) {
  const body = document.body;
  body.style.backgroundImage = `url(${dataUrl})`;
  body.style.backgroundSize = 'cover';
  body.style.backgroundPosition = 'center';
  body.style.backgroundRepeat = 'no-repeat';
  body.style.backgroundAttachment = 'fixed';
  body.dataset.bg = 'custom';
}

function clearBodyBackground() {
  const body = document.body;
  body.style.backgroundImage = '';
  body.style.backgroundSize = '';
  body.style.backgroundPosition = '';
  body.style.backgroundRepeat = '';
  body.style.backgroundAttachment = '';
  body.dataset.bg = '';
}

async function loadBackgroundImage() {
  // Run on init; doesn't block render. The data URL is fully self-contained
  // so there is no permission / cross-session state to worry about. If the
  // key isn't set, we fall back to the default paper background silently.
  if (typeof chrome === 'undefined' || !chrome.storage) return;  // test stub
  const stored = await chrome.storage.local.get(STORAGE_KEYS.backgroundImage);
  const dataUrl = stored[STORAGE_KEYS.backgroundImage];
  if (typeof dataUrl === 'string' && dataUrl) {
    applyBackgroundFromDataUrl(dataUrl);
  }
}

function languageSwitcherTemplate() {
  const segments = SUPPORTED_LANGUAGES.map(code => {
    const active = code === uiState.language;
    const labelKey = code === 'en' ? 'languageEnglish' : 'languageChinese';
    const ariaKey = code === 'en' ? 'languageEnglishAria' : 'languageChineseAria';
    return `<button class="language-segment" data-action="set-language" data-language="${code}" aria-pressed="${active}" aria-label="${esc(t(ariaKey))}">${t(labelKey)}</button>`;
  }).join('');
  return `<div class="language-switcher" role="group" aria-label="${esc(t('languageSwitcherAria'))}">${segments}</div>`;
}

function savedTemplate() {
  const unread = dataState.readingList.filter(x => !x.hasBeenRead);
  const read = dataState.readingList.filter(x => x.hasBeenRead);
  if (!unread.length && !read.length) return '';
  // Top-level "Reading list" header above two peer sub-sections, each
  // independently collapsible with its own count badge: "Unread" and "Done".
  // Search filtering within the list is deferred to the Search + keyboard-first plan.
  return `<aside class="deferred-column" id="deferredColumn">
    <div class="section-header reading-list-header"><h2>${t('readingList')}</h2></div>
    <div class="deferred-unread">
      <button class="unread-toggle section-header" data-action="toggle-unread" aria-expanded="${uiState.unreadExpanded}">
        <span class="unread-title">${t('unread')}</span><span class="section-line"></span><span class="section-count">${plural('Item', unread.length)}</span><span class="unread-chevron">${ICONS.chevron}</span></button>
      <div class="unread-body" ${uiState.unreadExpanded ? '' : 'hidden'}>
        <div class="deferred-list">${unread.map(savedItemTemplate).join('')}</div>
        ${unread.length ? '' : `<div class="deferred-empty">${t('readingListEmpty')}</div>`}
      </div>
    </div>
    ${read.length ? `<div class="deferred-read">
      <button class="read-toggle section-header" data-action="toggle-read" aria-expanded="${uiState.readExpanded}">
        <span class="read-title">${t('done')}</span><span class="section-line"></span><span class="section-count">${plural('Item', read.length)}</span><span class="read-chevron">${ICONS.chevron}</span></button>
      <div class="read-body" ${uiState.readExpanded ? '' : 'hidden'}>
        <div class="read-list">${read.map(readItemTemplate).join('')}</div>
      </div></div>` : ''}
  </aside>`;
}

function render() {
  // <html lang> is part of the rendered document's metadata; keep it in
  // sync with uiState.language so screen readers and browser translation
  // tooling follow the user's toggle. Set here (not in applyTheme) so any
  // caller of render() — including the test stub — picks up the new lang
  // without needing to know about theme plumbing.
  document.documentElement.lang = uiState.language === 'zh_CN' ? 'zh-CN' : 'en';
  const groups = mergeByLabel(buildGroups(dataState.tabs));
  lastGroups = groups;
  const realTabs = dataState.tabs.filter(isWebTab);
  const styleSegments = STYLES.map(s => {
    const active = s.id === currentStyleId();
    const label = s.id === 'classic' ? t('styleClassic') : t('styleTerminal');
    return `<button class="theme-segment" data-action="set-style" data-style="${s.id}" aria-pressed="${active}" title="${esc(t('styleTitle', label))}">${label}</button>`;
  }).join('');
  const containerClass = uiState.firstRender ? 'container' : 'container no-anim';
  const layout = LAYOUTS.includes(dataState.layout) ? dataState.layout : 'multi';
  // Pinned row: a pinned group whose tabs have all closed still lives in
  // dataState.pinnedGroupKeys (so the user's choice survives), but we drop it
  // from the visible row until a tab reappears under that key. The very-top
  // dashboard slot stays free for the future URL-level pinning.
  const pinnedGroups = groups.filter(g => isPinned(g.key) && g.tabs.length > 0);

  app.innerHTML = `<div class="${containerClass}">
    <div class="dashboard-columns${dataState.columnOrder === 'list-tabs' ? ' column-flip' : ''}">
      ${groups.length ? `<section class="active-section"><div class="section-header section-header-rows">
        <div class="section-header-row"><div class="theme-segments" role="group" aria-label="${esc(t('styleGroupAria'))}">${styleSegments}</div><button class="action-btn theme-toggle" data-action="toggle-theme" title="${esc(t('themeToggleTitle'))}" aria-label="${esc(t('themeToggleTitle'))}">${currentTheme() === 'dark' ? ICONS.iconMoon : ICONS.iconSun}</button><button class="layout-toggle action-btn" data-action="toggle-layout" aria-pressed="${layout === 'single'}" title="${esc(t(layout === 'single' ? 'layoutTitleMulti' : 'layoutTitleSingle'))}" aria-label="${esc(t(layout === 'single' ? 'layoutAriaMulti' : 'layoutAriaSingle'))}">${ICONS.layout}</button><button class="action-btn column-flip-toggle" data-action="flip-columns" aria-pressed="${dataState.columnOrder === 'list-tabs'}" title="${esc(t('flipColumnsTitle'))}" aria-label="${esc(t('flipColumnsTitle'))}">${ICONS.swap}</button>${settingsControlsTemplate()}</div>
        <div class="section-header-row"><h2>${t('openTabs')}</h2><div class="section-count"><span class="section-count-text">${plural('Group', groups.length)}</span><span class="section-dot">·</span><button class="action-btn close-tabs" data-action="close-all">${ICONS.close}${t('closeAllTabs', realTabs.length)}</button></div></div>
      </div>${pinnedGroups.length ? `<div class="pinned-row" aria-label="${esc(t('pinnedRowAria'))}">${pinnedGroups.map(pinnedChipTemplate).join('')}</div>${pinnedPopoverTemplate()}` : ''}<div class="missions${layout === 'single' ? ' layout-single' : ''}">${groups.map(groupTemplate).join('')}</div></section>` : emptyTemplate()}
      ${savedTemplate()}
    </div>
    ${languageSwitcherTemplate()}
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
  return `<section class="active-section"><div class="section-header section-header-rows">
    <div class="section-header-row">${settingsControlsTemplate()}</div>
    <div class="section-header-row"><h2>${t('openTabs')}</h2></div>
  </div><div class="missions-empty-state"><div class="empty-checkmark">✓</div><div class="empty-title">${t('emptyTitle')}</div><div class="empty-subtitle">${t('emptySubtitle')}</div></div></section>`;
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
    chrome.storage.local.get({ [STORAGE_KEYS.readingListMirror]: [], [STORAGE_KEYS.theme]: null, [STORAGE_KEYS.styleId]: DEFAULT_STYLE_ID, [STORAGE_KEYS.customGroupNames]: {}, [STORAGE_KEYS.pinnedGroupKeys]: [], [STORAGE_KEYS.unreadExpanded]: true, [STORAGE_KEYS.readExpanded]: false, [STORAGE_KEYS.layout]: 'multi', [STORAGE_KEYS.columnOrder]: 'tabs-list' }),
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
  // Pinned group keys: dedupe defensively in case storage was tampered with,
  // and drop anything that isn't a non-empty string.
  dataState.pinnedGroupKeys = Array.isArray(stored.pinnedGroupKeys)
    ? Array.from(new Set(stored.pinnedGroupKeys.filter(k => typeof k === 'string' && k)))
    : [];
  uiState.unreadExpanded = stored[STORAGE_KEYS.unreadExpanded] !== false;
  uiState.readExpanded = !!stored[STORAGE_KEYS.readExpanded];
  dataState.layout = LAYOUTS.includes(stored[STORAGE_KEYS.layout]) ? stored[STORAGE_KEYS.layout] : 'multi';
  dataState.columnOrder = COLUMN_ORDERS.includes(stored[STORAGE_KEYS.columnOrder]) ? stored[STORAGE_KEYS.columnOrder] : 'tabs-list';
  uiState.language = resolveLanguage(stored[STORAGE_KEYS.uiLanguage]);
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
    // Background image is independent of the chrome.storage.local state;
    // kick it off here so the image shows up on first paint if a handle
    // is in IndexedDB. We don't await — a permission re-prompt shouldn't
    // block the dashboard.
    loadBackgroundImage().catch(error => console.error('[tabulor] background load failed', error));
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
      // chrome.readingList.addEntry rejects with "Duplicate URL" when the URL is
      // already on the Reading list. Surface that as an info toast (the user's
      // intent — "this is on my list" — is already satisfied; we leave the tab
      // open so they can decide what to do with it). Other errors fall through
      // to a generic toast + console.error so the cause is still investigable.
      if (/duplicate url/i.test(error.message || '')) {
        showToast(t('saveAlreadyInReadingList'));
      } else {
        console.error('[tabulor] addEntry failed', error);
        showToast(t('saveFailed'), true);
      }
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
  'toggle-pin': async (el, event) => {
    // Pin / unpin a group by domain key. Pinned keys persist even when the
    // group has no live tabs so the user's choice survives a session wipe;
    // the row simply hides empty pinned groups until a tab reappears.
    event.stopPropagation();
    const group = groupAt(el.dataset.group);
    if (!group) return;
    const keys = dataState.pinnedGroupKeys;
    const idx = keys.indexOf(group.key);
    if (idx >= 0) keys.splice(idx, 1); else keys.push(group.key);
    // Unpinning a group whose popover is open collapses the popover too — the
    // chip disappears on the next render anyway.
    if (uiState.pinnedPopoverKey === group.key) uiState.pinnedPopoverKey = null;
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.pinnedGroupKeys]: [...keys] });
    } catch (error) {
      console.error('[tabulor] pinnedGroupKeys write failed', error);
    }
    render();
  },
  'toggle-pinned-popover': (el, event) => {
    // Same chip → close; different chip → switch. Always renders so the
    // chip's aria-expanded and the popover's presence stay in sync.
    event.stopPropagation();
    const key = el.dataset.groupKey;
    if (!key) return;
    uiState.pinnedPopoverKey = uiState.pinnedPopoverKey === key ? null : key;
    render();
  },
  'focus-from-popover': async el => {
    // Focus the chosen tab and dismiss the popover in one motion. We close
    // the popover *before* awaiting chrome.tabs.update so the dashboard
    // re-renders without the popover overlay while the focus switch happens.
    const tab = findTab(el.dataset.tabId);
    uiState.pinnedPopoverKey = null;
    render();
    if (!tab) return;
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  },
  'set-style': (el) => {
    const nextId = el.dataset.style;
    if (!STYLES.some(s => s.id === nextId)) return;
    dataState.styleId = nextId;
    chrome.storage.local.set({ [STORAGE_KEYS.styleId]: nextId });
    applyTheme();
    render();
  },
  'set-language': (el) => {
    const next = el.dataset.language;
    if (!SUPPORTED_LANGUAGES.includes(next) || next === uiState.language) return;
    uiState.language = next;
    chrome.storage.local.set({ [STORAGE_KEYS.uiLanguage]: next });
    render();
  },
  'toggle-layout': () => {
    dataState.layout = dataState.layout === 'single' ? 'multi' : 'single';
    chrome.storage.local.set({ [STORAGE_KEYS.layout]: dataState.layout });
    render();
  },
  'flip-columns': () => {
    // Mirror the two main dashboard columns horizontally. The CSS
    // `.dashboard-columns.column-flip { flex-direction: row-reverse; }` plus
    // its narrow-viewport `column-reverse` variant handle the actual swap;
    // we only persist the preference and re-render so the button's
    // aria-pressed and the column class stay in sync.
    dataState.columnOrder = dataState.columnOrder === 'tabs-list' ? 'list-tabs' : 'tabs-list';
    chrome.storage.local.set({ [STORAGE_KEYS.columnOrder]: dataState.columnOrder });
    render();
  },
  'toggle-theme': () => {
    // Strict 2-state toggle: dataState.theme resolves null to OS via
    // currentTheme(), so the first click from auto mode "exits" auto by
    // setting an explicit value (the opposite of OS). Subsequent clicks
    // alternate light ↔ dark. No UI path back to auto — clearing requires
    // editing storage or importing a backup without the theme key.
    const current = currentTheme();
    dataState.theme = current === 'dark' ? 'light' : 'dark';
    chrome.storage.local.set({ [STORAGE_KEYS.theme]: dataState.theme });
    applyTheme();
    render();
  },
  'toggle-settings': () => {
    uiState.settingsOpen = !uiState.settingsOpen;
    render();
  },
  'choose-background': () => {
    // Trigger the hidden <input type="file">. The actual read + store runs
    // in the change handler registered below. Closing the menu first so the
    // picker doesn't sit on top of the dimmed overlay.
    uiState.settingsOpen = false;
    render();
    $('#backgroundFileInput')?.click();
  },
  'clear-background': async () => {
    await chrome.storage.local.remove(STORAGE_KEYS.backgroundImage);
    clearBodyBackground();
    showToast(t('backgroundCleared'));
  },
  'export-backup': () => exportBackup(),
  'import-backup': () => {
    uiState.settingsOpen = false;
    render();
    $('#backupFileInput')?.click();
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
  const settingsControls = $('.settings-controls');
  if (uiState.settingsOpen && settingsControls && !settingsControls.contains(event.target)) {
    uiState.settingsOpen = false;
    render();
  }
  // Dismiss the pinned-popover on any click that lands outside both the
  // popover and its owning chip. Clicking *inside* the popover or on the chip
  // itself falls through so the data-action handler can run.
  if (uiState.pinnedPopoverKey) {
    const popover = $('.pinned-popover');
    const insidePopover = popover && popover.contains(event.target);
    const onChip = event.target.closest('.pinned-chip');
    if (!insidePopover && !onChip) {
      uiState.pinnedPopoverKey = null;
      render();
    }
  }
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

document.addEventListener('change', async event => {
  const input = event.target;
  if (input.matches('#backupFileInput') && input.files?.[0]) {
    importBackup(input.files[0]).catch(error => console.error('[tabulor]', error));
    input.value = '';
    return;
  }
  if (input.matches('#backgroundFileInput') && input.files?.[0]) {
    const file = input.files[0];
    input.value = '';  // reset so picking the same file again re-fires
    // 5 MB cap on the picked file. The data URL is ~33% larger than the
    // binary (~6.7 MB), so this leaves headroom inside chrome.storage.local's
    // default 10 MB quota for the rest of the extension's state (customGroupNames,
    // pinnedGroupKeys, readingListMirror, etc.).
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('backgroundTooLarge'), true);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      // Drop the previous cached image before writing the new one. This frees
      // the storage quota up front, so a near-quota pick doesn't end with the
      // new data URL failing while the old one still occupies the space.
      await chrome.storage.local.remove(STORAGE_KEYS.backgroundImage);
      await chrome.storage.local.set({ [STORAGE_KEYS.backgroundImage]: dataUrl });
      applyBackgroundFromDataUrl(dataUrl);
      showToast(t('backgroundSet'));
    } catch (error) {
      console.error('[tabulor] background image read failed', error);
      showToast(t('backgroundFailed', error.message || String(error)), true);
    }
  }
});

function renderReadList() {
  const read = dataState.readingList.filter(x => x.hasBeenRead);
  const list = $('.read-list');
  if (list) list.innerHTML = read.map(readItemTemplate).join('');
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && uiState.settingsOpen) {
    event.preventDefault();
    uiState.settingsOpen = false;
    render();
    return;
  }
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
  // pinnedGroupKeys can change from another tab via the same extension; pull
  // the new array in and re-render so the row and per-card star buttons stay
  // in sync without re-running the heavier loadState path.
  if (STORAGE_KEYS.pinnedGroupKeys in changes) {
    const next = changes[STORAGE_KEYS.pinnedGroupKeys].newValue;
    dataState.pinnedGroupKeys = Array.isArray(next)
      ? Array.from(new Set(next.filter(k => typeof k === 'string' && k)))
      : [];
    render();
  }
  // columnOrder flips from another tab — just re-render so the flex class
  // updates; the value itself was already validated in loadState.
  if (STORAGE_KEYS.columnOrder in changes) {
    const next = changes[STORAGE_KEYS.columnOrder].newValue;
    dataState.columnOrder = COLUMN_ORDERS.includes(next) ? next : 'tabs-list';
    render();
  }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  // Only the OS-level signal flows through here; if the user has an explicit
  // dataState.theme, applyTheme() (via storage change) has already fired.
  if (!dataState.theme) applyTheme();
});

refresh().catch(error => {
  console.error('[tabulor]', error);
  app.innerHTML = `<div class="container"><h2>Tabulor</h2><p>${t('errorLoadingTabs')}</p></div>`;
});
